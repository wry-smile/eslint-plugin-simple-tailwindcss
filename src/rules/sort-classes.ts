import type { TSESLint, TSESTree } from '@typescript-eslint/utils'
import type { TailwindGroupDefinition } from '../config/group-definitions.js'
import { createClassFormatter } from '../utils/class-processor.js'

type ClassRegexEntry = string | [string, string]

type Options = [
  {
    callees?: string[]
    classRegex?: ClassRegexEntry[]
    debug?: boolean
    groupDefinitions?: TailwindGroupDefinition[]
    variables?: string[]
  }?,
]

type MessageIds = 'unsorted'

const CLASS_FIELDS = new Set(['class', 'classname'])
const DEFAULT_CALLEES = ['clsx', 'classnames', 'cn', 'cva', 'twMerge', 'tv']
const DEFAULT_VARIABLES = ['^cls', 'classNames?$']
const WHITESPACE_RE = /\s+/

function collapseWhitespace(value: string) {
  return value.trim().replace(WHITESPACE_RE, ' ')
}

function dedupeStrings(values: string[]) {
  return [...new Set(values)]
}

function extractCalleesFromClassRegex(entries: ClassRegexEntry[] | undefined) {
  if (!entries?.length) {
    return []
  }

  return entries.flatMap((entry) => {
    const source = Array.isArray(entry) ? entry[0] : entry
    const match = source.match(/^([A-Z_$][\w$]*)\\?\(/i)
    return match?.[1] ? [match[1]] : []
  })
}

function getTemplateElementRange(sourceCode: TSESLint.SourceCode, quasi: TSESTree.TemplateElement) {
  const raw = quasi.value.raw
  const text = sourceCode.getText(quasi)
  const rawStart = text.indexOf(raw)
  if (rawStart < 0) {
    return null
  }

  const start = quasi.range[0] + rawStart
  const end = start + raw.length
  if (start < quasi.range[0] || end > quasi.range[1]) {
    return null
  }

  return [start, end] as const
}

function isStringLiteral(node: TSESTree.Node): node is TSESTree.Literal & { value: string } {
  return node.type === 'Literal' && typeof node.value === 'string'
}

function isStringRawTag(tag: TSESTree.Expression) {
  return tag.type === 'MemberExpression'
    && tag.object.type === 'Identifier'
    && tag.object.name === 'String'
    && tag.property.type === 'Identifier'
    && tag.property.name === 'raw'
}

const rule: TSESLint.RuleModule<MessageIds, Options> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Sort Tailwind CSS class lists and collapse extra whitespace without removing classes.',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          callees: {
            type: 'array',
            items: { type: 'string' },
          },
          classRegex: {
            type: 'array',
            items: {
              anyOf: [
                { type: 'string' },
                {
                  type: 'array',
                  items: [{ type: 'string' }, { type: 'string' }],
                  minItems: 2,
                  maxItems: 2,
                },
              ],
            },
          },
          groupDefinitions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                matchers: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1,
                },
              },
              required: ['matchers'],
              additionalProperties: false,
            },
          },
          variables: {
            type: 'array',
            items: { type: 'string' },
          },
          debug: {
            type: 'boolean',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unsorted: 'Tailwind CSS classes should be sorted and extra whitespace removed.',
    },
  },
  defaultOptions: [{}],
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode()
    const option = context.options[0] ?? {}
    const debugEnabled = option.debug ?? false
    const formatClassList = createClassFormatter({
      groupDefinitions: option.groupDefinitions,
    })
    const configuredCallees = dedupeStrings([
      ...DEFAULT_CALLEES,
      ...(option.callees ?? []),
      ...extractCalleesFromClassRegex(option.classRegex),
    ]).map(name => name.toLowerCase())
    const variablePatterns = (option.variables ?? DEFAULT_VARIABLES).map(
      pattern => new RegExp(pattern, 'i'),
    )
    const reportedRanges = new Set<string>()

    const logDebug = (label: string, payload: Record<string, unknown>) => {
      if (!debugEnabled) {
        return
      }

      const serialized = JSON.stringify(payload, null, 2)
      // eslint-disable-next-line no-console -- opt-in debugging utility
      console.log(`[simple-tailwindcss] ${label}\n${serialized}`)
    }

    const isTrackedVariable = (name: string) =>
      variablePatterns.some(pattern => pattern.test(name))

    const isTrackedCallee = (name: string) =>
      configuredCallees.includes(name.toLowerCase())

    const reportRange = (
      range: readonly [number, number],
      original: string,
      formatted: string,
      node: TSESTree.Node,
    ) => {
      if (!formatted || formatted === original) {
        return
      }

      const key = `${range[0]}:${range[1]}`
      if (reportedRanges.has(key)) {
        return
      }
      reportedRanges.add(key)

      context.report({
        node,
        loc: {
          start: sourceCode.getLocFromIndex(range[0]),
          end: sourceCode.getLocFromIndex(range[1]),
        },
        messageId: 'unsorted',
        fix: fixer => fixer.replaceTextRange([...range], formatted),
      })
    }

    const checkLiteral = (node: TSESTree.Literal & { value: string }) => {
      const formatted = formatClassList(node.value)
      if (!formatted) {
        return
      }

      logDebug('Literal', {
        value: node.value,
        formatted,
        range: node.range,
      })
      reportRange([node.range[0] + 1, node.range[1] - 1], node.value, formatted, node)
    }

    const checkTemplateElement = (quasi: TSESTree.TemplateElement) => {
      const input = quasi.value.raw
      if (!input) {
        return
      }

      const leadingSpace = /^\s/.test(input)
      const trailingSpace = /\s$/.test(input)
      const normalized = collapseWhitespace(input)
      let formatted = normalized
      const sorted = normalized ? formatClassList(normalized) : null
      if (sorted) {
        formatted = sorted
      }

      if (!formatted) {
        if (!normalized && input !== ' ') {
          formatted = ' '
        }
        else {
          return
        }
      }

      if (leadingSpace && !formatted.startsWith(' ')) {
        formatted = ` ${formatted}`
      }
      if (trailingSpace && !formatted.endsWith(' ')) {
        formatted = `${formatted} `
      }

      const range = getTemplateElementRange(sourceCode, quasi)
      if (!range) {
        return
      }

      logDebug('TemplateElement', {
        input,
        formatted,
        range,
      })
      reportRange(range, input, formatted, quasi)
    }

    function visitExpression(node: TSESTree.Node | null | undefined): void {
      if (!node) {
        return
      }

      if (isStringLiteral(node)) {
        checkLiteral(node)
        return
      }

      switch (node.type) {
        case 'TemplateLiteral':
          node.quasis.forEach(checkTemplateElement)
          return

        case 'TaggedTemplateExpression':
          if (isStringRawTag(node.tag)) {
            visitExpression(node.quasi)
          }
          return

        case 'ConditionalExpression':
          visitExpression(node.consequent)
          visitExpression(node.alternate)
          return

        case 'LogicalExpression':
          visitExpression(node.left)
          visitExpression(node.right)
          return

        case 'ArrayExpression':
          node.elements.forEach((element) => {
            if (element && element.type !== 'SpreadElement') {
              visitExpression(element)
            }
          })
          return

        case 'ObjectExpression':
          node.properties.forEach((property) => {
            if (property.type !== 'Property') {
              return
            }

            if (property.computed) {
              visitExpression(property.key)
            }
            else if (property.key.type !== 'Identifier') {
              visitExpression(property.key)
            }

            visitExpression(property.value)
          })
          return

        case 'CallExpression':
          handleCallExpression(node)
          return

        case 'ChainExpression':
          visitExpression(node.expression)
          return

        case 'TSAsExpression':
        case 'TSSatisfiesExpression':
        case 'TSNonNullExpression':
          visitExpression(node.expression)

        default:
      }
    }

    function handleCallExpression(node: TSESTree.CallExpression) {
      if (node.callee.type !== 'Identifier' || !isTrackedCallee(node.callee.name)) {
        return
      }

      logDebug('CallExpression', {
        callee: node.callee.name,
        range: node.range,
      })
      node.arguments.forEach(argument => visitExpression(argument))
    }

    const scriptVisitor: TSESLint.RuleListener = {
      JSXAttribute(node) {
        if (
          node.name.type !== 'JSXIdentifier'
          || !CLASS_FIELDS.has(node.name.name.toLowerCase())
          || !node.value
        ) {
          return
        }

        logDebug('JSXAttribute', {
          name: node.name.name,
          range: node.range,
        })
        if (node.value.type === 'JSXExpressionContainer') {
          if (node.value.expression.type !== 'JSXEmptyExpression') {
            visitExpression(node.value.expression)
          }
          return
        }

        if (node.value.type === 'Literal' && typeof node.value.value === 'string') {
          checkLiteral(node.value)
        }
      },

      CallExpression(node) {
        handleCallExpression(node)
      },

      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || !node.init || !isTrackedVariable(node.id.name)) {
          return
        }

        logDebug('VariableDeclarator', {
          name: node.id.name,
          range: node.range,
        })
        visitExpression(node.init)
      },
    }

    const templateBodyVisitor: TSESLint.RuleListener = {
      VAttribute(node: any) {
        const keyName = node.key?.name
        if (keyName === 'class' && node.value?.type === 'VLiteral' && typeof node.value.value === 'string') {
          const formatted = formatClassList(node.value.value)
          if (!formatted) {
            return
          }

          logDebug('VAttribute class', {
            value: node.value.value,
            formatted,
            range: node.value.range,
          })
          reportRange(
            [node.value.range[0] + 1, node.value.range[1] - 1],
            node.value.value,
            formatted,
            node,
          )
          return
        }

        const isBoundClass = node.directive
          && node.key?.name?.name === 'bind'
          && node.key?.argument?.type === 'VIdentifier'
          && node.key.argument.name === 'class'

        if (isBoundClass) {
          visitExpression(node.value?.expression)
        }
      },
    }

    const parserServices = sourceCode.parserServices
    if (
      parserServices
      && 'defineTemplateBodyVisitor' in parserServices
      && typeof parserServices.defineTemplateBodyVisitor === 'function'
    ) {
      return parserServices.defineTemplateBodyVisitor(templateBodyVisitor, scriptVisitor)
    }

    return scriptVisitor
  },
}

export default rule
