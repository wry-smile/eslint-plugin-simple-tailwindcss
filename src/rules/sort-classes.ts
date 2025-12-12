import type { TSESLint } from '@typescript-eslint/utils'
import type { SourceCode } from '@typescript-eslint/utils/ts-eslint'
import type { TailwindGroupDefinition } from '../config/group-definitions.js'
import { createClassFormatter } from '../utils/class-processor.js'

type ClassRegexEntry = string | [string, string]

type Options = [
  {
    classRegex?: ClassRegexEntry[]
    groupDefinitions?: TailwindGroupDefinition[]
    debug?: boolean
  }?,
]

type MessageIds = 'unsorted'
const STRING_ARGUMENT_REGEX = '["\'`]([^"\'`]+)["\'`]'

const DEFAULT_CLASS_REGEX: ClassRegexEntry[] = [
  ['cva\\(([^)]*)\\)', STRING_ARGUMENT_REGEX],
  ['clsx\\(([^)]*)\\)', STRING_ARGUMENT_REGEX],
  ['cn\\(([^)]*)\\)', STRING_ARGUMENT_REGEX],
  ['twMerge\\(([^)]*)\\)', STRING_ARGUMENT_REGEX],
]

interface RangeMatch {
  range: [number, number]
  value: string
}

const createRegExp = (source: string) => new RegExp(source, 'g')

function extractStringLiterals(text: string): Array<{ value: string, start: number, end: number }> {
  const literals: Array<{ value: string, start: number, end: number }> = []
  let i = 0
  while (i < text.length) {
    const char = text[i]
    if (char === '"' || char === '\'' || char === '`') {
      const quote = char
      const start = i
      i += 1
      let value = ''
      while (i < text.length) {
        if (text[i] === quote && text[i - 1] !== '\\') {
          literals.push({ value, start: start + 1, end: i })
          i += 1
          break
        }
        value += text[i]
        i += 1
      }
    }
    else {
      i += 1
    }
  }
  return literals
}

function findCaptureOffset(fullMatch: string, capture: string) {
  const index = fullMatch.indexOf(capture)
  return index >= 0 ? index : 0
}

function processInnerMatches(target: string, regex: RegExp, containerOffset: number, text: string, onMatch: (match: RangeMatch) => void) {
  let matched = false
  regex.lastIndex = 0
  const processedRanges = new Set<string>()
  let innerMatch: RegExpExecArray | null = regex.exec(target)
  while (innerMatch !== null) {
    const innerFull = innerMatch[0]
    if (!innerFull) {
      regex.lastIndex += 1
      innerMatch = regex.exec(target)
      continue
    }
    const innerValue = innerMatch[1] ?? innerFull
    const innerOffset
      = innerMatch.index + findCaptureOffset(innerFull, innerValue)
    const start = containerOffset + innerOffset
    const end = start + innerValue.length
    const rangeKey = `${start}:${end}`
    if (!processedRanges.has(rangeKey)) {
      processedRanges.add(rangeKey)
      onMatch({ range: [start, end], value: text.slice(start, end) })
      matched = true
    }
    innerMatch = regex.exec(target)
  }
  return matched
}

function findMatchingParenIndex(text: string, openParenIndex: number) {
  let i = openParenIndex + 1
  let depth = 1
  let inString: false | '"' | '\'' | '`' = false
  let escaped = false
  while (i < text.length) {
    const ch = text[i]!
    if (inString) {
      if (!escaped && ch === inString) {
        inString = false
      }
      escaped = !escaped && ch === '\\'
      i += 1
      continue
    }
    if (ch === '"' || ch === '\'' || ch === '`') {
      inString = ch as any
      escaped = false
      i += 1
      continue
    }
    if (ch === '(') {
      depth += 1
    }
    else if (ch === ')') {
      depth -= 1
      if (depth === 0) {
        return i
      }
    }
    i += 1
  }
  return -1
}

function applyRegexEntry(sourceCode: SourceCode, entry: ClassRegexEntry, onMatch: (match: RangeMatch) => void) {
  const text = sourceCode.getText()
  const outerRegex = Array.isArray(entry)
    ? createRegExp(entry[0])
    : createRegExp(entry)
  const innerPattern = Array.isArray(entry) ? entry[1] : undefined
  const innerRegex = innerPattern ? createRegExp(innerPattern) : undefined

  let outerMatch: RegExpExecArray | null
  while (true) {
    outerMatch = outerRegex.exec(text)
    if (outerMatch === null)
      break

    const matchedText = outerMatch[0]
    if (!matchedText) {
      outerRegex.lastIndex += 1
      continue
    }

    const openRel = matchedText.indexOf('(')
    if (openRel < 0) {
      continue
    }
    const openAbs = outerMatch.index + openRel
    const closeAbs = findMatchingParenIndex(text, openAbs)
    if (closeAbs < 0) {
      continue
    }

    const containerOffset = openAbs + 1
    const container = text.slice(containerOffset, closeAbs)

    if (innerRegex) {
      processInnerMatches(container, innerRegex, containerOffset, text, onMatch)
      continue
    }

    // Fallback: extract all string literals inside container
    const literals = extractStringLiterals(container)
    if (literals.length > 0) {
      for (const lit of literals) {
        onMatch({ range: [containerOffset + lit.start, containerOffset + lit.end], value: lit.value })
      }
      continue
    }

    // If no literals matched, treat entire container as a value
    const value = container
    const start = containerOffset
    const end = start + value.length
    onMatch({ range: [start, end], value: text.slice(start, end) })
  }
}

function handleLiteralValue(context: TSESLint.RuleContext<MessageIds, Options>, range: [number, number], value: string, reportedRanges: Set<string>, formatClassList: ReturnType<typeof createClassFormatter>) {
  const formatted = formatClassList(value)
  if (!formatted || formatted === value) {
    return
  }

  const key = `${range[0]}:${range[1]}`
  if (reportedRanges.has(key)) {
    return
  }
  reportedRanges.add(key)

  const sourceCode = context.sourceCode ?? context.getSourceCode()
  context.report({
    messageId: 'unsorted',
    loc: {
      start: sourceCode.getLocFromIndex(range[0]),
      end: sourceCode.getLocFromIndex(range[1]),
    },
    fix: fixer => fixer.replaceTextRange(range, formatted),
  })
}

const rule: TSESLint.RuleModule<MessageIds, Options> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Sort and deduplicate Tailwind CSS class lists across templates and utilities.',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
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
          debug: {
            type: 'boolean',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unsorted: 'Tailwind CSS classes should be sorted and deduplicated.',
    },
  },
  defaultOptions: [{}],
  create(context) {
    const reportedRanges = new Set<string>()
    const sourceCode = context.sourceCode ?? context.getSourceCode()
    const option = context.options[0] ?? {}
    const classRegex = option.classRegex ?? DEFAULT_CLASS_REGEX
    const formatClassList = createClassFormatter({
      groupDefinitions: option.groupDefinitions,
    })
    const debugEnabled = option.debug ?? false

    const logDebug = (label: string, payload: Record<string, unknown>) => {
      if (!debugEnabled)
        return
      const serialized = JSON.stringify(payload, null, 2)
      // eslint-disable-next-line no-console -- opt-in debugging utility
      console.log(`[simple-tailwindcss] ${label}\n${serialized}`)
    }

    const visitLiteralRange = (range: [number, number], rawValue?: string) => {
      if (!rawValue)
        return
      handleLiteralValue(
        context,
        range,
        rawValue,
        reportedRanges,
        formatClassList,
      )
    }

    const visitors: TSESLint.RuleListener = {
      JSXAttribute(node) {
        if (
          node.name.type !== 'JSXIdentifier'
          || (node.name.name !== 'class' && node.name.name !== 'className')
        ) {
          return
        }
        if (!node.value)
          return
        if (node.value.type === 'Literal' && typeof node.value.value === 'string') {
          logDebug('JSXAttribute literal', {
            name: node.name.name,
            value: node.value.value,
            loc: node.loc,
          })
          const range: [number, number] = [
            node.value.range![0] + 1,
            node.value.range![1] - 1,
          ]
          visitLiteralRange(range, node.value.value)
        }
        else if (
          node.value.type === 'JSXExpressionContainer'
          && node.value.expression.type === 'Literal'
          && typeof node.value.expression.value === 'string'
        ) {
          const literal = node.value.expression
          logDebug('JSXAttribute expression literal', {
            name: node.name.name,
            value: literal.value,
            loc: node.loc,
          })
          const range: [number, number] = [
            literal.range![0] + 1,
            literal.range![1] - 1,
          ]
          visitLiteralRange(range, literal.value)
        }
        else if (
          node.value.type === 'JSXExpressionContainer'
          && node.value.expression.type === 'TemplateLiteral'
          && node.value.expression.expressions.length === 0
        ) {
          const template = node.value.expression
          const rawValue = template.quasis[0]?.value.cooked
          if (typeof rawValue === 'string') {
            logDebug('JSXAttribute template literal', {
              name: node.name.name,
              value: rawValue,
              loc: node.loc,
            })
            const range: [number, number] = [
              template.range![0] + 1,
              template.range![1] - 1,
            ]
            visitLiteralRange(range, rawValue)
          }
        }
      },
      TemplateLiteral(node) {
        if (node.expressions.length > 0)
          return
        const parent = node.parent
        if (!parent)
          return
        if (
          parent.type === 'TaggedTemplateExpression'
          || parent.type === 'TemplateLiteral'
        ) {
          return
        }
        const rawValue = node.quasis[0]?.value.cooked
        if (typeof rawValue !== 'string')
          return
        const range: [number, number] = [
          node.range![0] + 1,
          node.range![1] - 1,
        ]
        visitLiteralRange(range, rawValue)
      },
      'Program:exit': function () {
        classRegex.forEach(entry =>
          applyRegexEntry(sourceCode, entry, match =>
            handleLiteralValue(
              context,
              match.range,
              match.value,
              reportedRanges,
              formatClassList,
            )),
        )
      },
    }

    const parserServices = sourceCode.parserServices
    if (
      parserServices
      && 'defineTemplateBodyVisitor' in parserServices
      && typeof parserServices.defineTemplateBodyVisitor === 'function'
    ) {
      return parserServices.defineTemplateBodyVisitor(
        {
          VAttribute(node: any) {
            if (!node.value)
              return
            if (
              node.key.type === 'VIdentifier'
              && node.key.name === 'class'
              && node.value.type === 'VLiteral'
              && typeof node.value.value === 'string'
            ) {
              logDebug('VAttribute literal', {
                value: node.value.value,
                loc: node.loc,
              })
              const range: [number, number] = [
                node.value.range![0] + 1,
                node.value.range![1] - 1,
              ]
              visitLiteralRange(range, node.value.value)
            }
          },
          'VElement:exit': function () {
            // Process classRegex in Vue template after all elements are visited
            classRegex.forEach(entry =>
              applyRegexEntry(sourceCode, entry, match =>
                handleLiteralValue(
                  context,
                  match.range,
                  match.value,
                  reportedRanges,
                  formatClassList,
                )),
            )
          },
        },
        undefined,
        visitors,
      )
    }

    return visitors
  },
}

export default rule
