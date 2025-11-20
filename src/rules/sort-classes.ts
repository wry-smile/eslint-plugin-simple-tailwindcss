import type { TSESLint } from "@typescript-eslint/utils";
import type { SourceCode } from "@typescript-eslint/utils/ts-eslint";
import type { TailwindGroupDefinition } from "../config/group-definitions.js";
import { createClassFormatter } from "../utils/class-processor.js";

type ClassRegexEntry = string | [string, string];

type Options = [
  {
    classRegex?: ClassRegexEntry[];
    groupDefinitions?: TailwindGroupDefinition[];
    debug?: boolean;
  }?
];

type MessageIds = "unsorted";
const DEFAULT_CLASS_REGEX: ClassRegexEntry[] = [
  ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]+)[\"'`]"],
  "clsx\\(([^)]*)\\)",
  "cn\\(([^)]*)\\)",
  "twMerge\\(([^)]*)\\)",
];

interface RangeMatch {
  range: [number, number];
  value: string;
}

const createRegExp = (source: string) => new RegExp(source, "g");

const findCaptureOffset = (fullMatch: string, capture: string) => {
  const index = fullMatch.indexOf(capture);
  return index >= 0 ? index : 0;
};

const applyRegexEntry = (
  sourceCode: SourceCode,
  entry: ClassRegexEntry,
  onMatch: (match: RangeMatch) => void,
) => {
  const text = sourceCode.getText();
  const outerRegex = Array.isArray(entry)
    ? createRegExp(entry[0])
    : createRegExp(entry);
  const innerPattern = Array.isArray(entry) ? entry[1] : undefined;
  const innerRegex = innerPattern ? createRegExp(innerPattern) : undefined;

  let outerMatch: RegExpExecArray | null;
  while ((outerMatch = outerRegex.exec(text)) !== null) {
    const matchedText = outerMatch[0];
    if (!matchedText) {
      outerRegex.lastIndex += 1;
      continue;
    }

    const container = outerMatch[1] ?? matchedText;
    const containerOffset =
      outerMatch.index + findCaptureOffset(matchedText, container);

    if (!innerRegex) {
      const value = container;
      const start = containerOffset;
      const end = start + value.length;
      onMatch({ range: [start, end], value: text.slice(start, end) });
      continue;
    }

    innerRegex.lastIndex = 0;
    let innerMatch: RegExpExecArray | null;
    while ((innerMatch = innerRegex.exec(container)) !== null) {
      const innerFull = innerMatch[0];
      if (!innerFull) {
        innerRegex.lastIndex += 1;
        continue;
      }
      const innerValue = innerMatch[1] ?? innerFull;
      const innerOffset =
        innerMatch.index + findCaptureOffset(innerFull, innerValue);
      const start = containerOffset + innerOffset;
      const end = start + innerValue.length;
      onMatch({ range: [start, end], value: text.slice(start, end) });
    }
  }
};

const handleLiteralValue = (
  context: TSESLint.RuleContext<MessageIds, Options>,
  range: [number, number],
  value: string,
  reportedRanges: Set<string>,
  formatClassList: ReturnType<typeof createClassFormatter>,
) => {
  const formatted = formatClassList(value);
  if (!formatted || formatted === value) {
    return;
  }

  const key = `${range[0]}:${range[1]}`;
  if (reportedRanges.has(key)) {
    return;
  }
  reportedRanges.add(key);

  const sourceCode = context.sourceCode ?? context.getSourceCode();
  context.report({
    messageId: "unsorted",
    loc: {
      start: sourceCode.getLocFromIndex(range[0]),
      end: sourceCode.getLocFromIndex(range[1]),
    },
    fix: (fixer) => fixer.replaceTextRange(range, formatted),
  });
};

const rule: TSESLint.RuleModule<MessageIds, Options> = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Sort and deduplicate Tailwind CSS class lists across templates and utilities.",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          classRegex: {
            type: "array",
            items: {
              anyOf: [
                { type: "string" },
                {
                  type: "array",
                  items: [{ type: "string" }, { type: "string" }],
                  minItems: 2,
                  maxItems: 2,
                },
              ],
            },
          },
          groupDefinitions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                matchers: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 1,
                },
              },
              required: ["matchers"],
              additionalProperties: false,
            },
          },
          debug: {
            type: "boolean",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unsorted: "Tailwind CSS classes should be sorted and deduplicated.",
    },
  },
  defaultOptions: [{}],
  create(context) {
    const reportedRanges = new Set<string>();
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const option = context.options[0] ?? {};
    const classRegex = option.classRegex ?? DEFAULT_CLASS_REGEX;
    const formatClassList = createClassFormatter({
      groupDefinitions: option.groupDefinitions,
    });
    const debugEnabled = option.debug ?? false;

    const logDebug = (label: string, payload: Record<string, unknown>) => {
      if (!debugEnabled) return;
      const serialized = JSON.stringify(payload, null, 2);
      // eslint-disable-next-line no-console -- opt-in debugging utility
      console.log(`[simple-tailwindcss] ${label}\n${serialized}`);
    };

    const visitLiteralRange = (range: [number, number], rawValue?: string) => {
      if (!rawValue) return;
      handleLiteralValue(
        context,
        range,
        rawValue,
        reportedRanges,
        formatClassList,
      );
    };

    const visitors: TSESLint.RuleListener = {
      JSXAttribute(node) {
        if (
          node.name.type !== "JSXIdentifier" ||
          (node.name.name !== "class" && node.name.name !== "className")
        ) {
          return;
        }
        if (!node.value) return;
        if (node.value.type === "Literal" && typeof node.value.value === "string") {
          logDebug("JSXAttribute literal", {
            name: node.name.name,
            value: node.value.value,
            loc: node.loc,
          });
          const range: [number, number] = [
            node.value.range![0] + 1,
            node.value.range![1] - 1,
          ];
          visitLiteralRange(range, node.value.value);
        } else if (
          node.value.type === "JSXExpressionContainer" &&
          node.value.expression.type === "Literal" &&
          typeof node.value.expression.value === "string"
        ) {
          const literal = node.value.expression;
          logDebug("JSXAttribute expression literal", {
            name: node.name.name,
            value: literal.value,
            loc: node.loc,
          });
          const range: [number, number] = [
            literal.range![0] + 1,
            literal.range![1] - 1,
          ];
          visitLiteralRange(range, literal.value);
        } else if (
          node.value.type === "JSXExpressionContainer" &&
          node.value.expression.type === "TemplateLiteral" &&
          node.value.expression.expressions.length === 0
        ) {
          const template = node.value.expression;
          const rawValue = template.quasis[0]?.value.cooked;
          if (typeof rawValue === "string") {
            logDebug("JSXAttribute template literal", {
              name: node.name.name,
              value: rawValue,
              loc: node.loc,
            });
            const range: [number, number] = [
              template.range![0] + 1,
              template.range![1] - 1,
            ];
            visitLiteralRange(range, rawValue);
          }
        }
      },
      TemplateLiteral(node) {
        if (node.expressions.length > 0) return;
        const parent = node.parent;
        if (!parent) return;
        if (
          parent.type === "TaggedTemplateExpression" ||
          parent.type === "TemplateLiteral"
        ) {
          return;
        }
        const rawValue = node.quasis[0]?.value.cooked;
        if (typeof rawValue !== "string") return;
        const range: [number, number] = [
          node.range![0] + 1,
          node.range![1] - 1,
        ];
        visitLiteralRange(range, rawValue);
      },
      "Program:exit"() {
        classRegex.forEach((entry) =>
          applyRegexEntry(sourceCode, entry, (match) =>
            handleLiteralValue(
              context,
              match.range,
              match.value,
              reportedRanges,
              formatClassList,
            ),
          ),
        );
      },
    };

    const parserServices = sourceCode.parserServices;
    if (
      parserServices &&
      "defineTemplateBodyVisitor" in parserServices &&
      typeof parserServices.defineTemplateBodyVisitor === "function"
    ) {
      return parserServices.defineTemplateBodyVisitor(
        {
          VAttribute(node: any) {
            if (!node.value) return;
            if (
              node.key.type === "VIdentifier" &&
              node.key.name === "class" &&
              node.value.type === "VLiteral" &&
              typeof node.value.value === "string"
            ) {
              logDebug("VAttribute literal", {
                value: node.value.value,
                loc: node.loc,
              });
              const range: [number, number] = [
                node.value.range![0] + 1,
                node.value.range![1] - 1,
              ];
              visitLiteralRange(range, node.value.value);
            }
          },
          "VElement:exit"() {
            // Process classRegex in Vue template after all elements are visited
            classRegex.forEach((entry) =>
              applyRegexEntry(sourceCode, entry, (match) =>
                handleLiteralValue(
                  context,
                  match.range,
                  match.value,
                  reportedRanges,
                  formatClassList,
                ),
              ),
            );
          },
        },
        undefined,
        visitors,
      );
    }

    return visitors;
  },
};

export default rule;

