import { describe, it } from "vitest";
import { createRequire } from "node:module";
import { RuleTester } from "eslint";
import sortClassesRule from "../src/rules/sort-classes.js";

const require = createRequire(import.meta.url);
const tsParser = require("@typescript-eslint/parser");
const vueParser = require("vue-eslint-parser");

const jsxRuleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      ecmaFeatures: { jsx: true },
    },
  },
});

const vueRuleTester = new RuleTester({
  languageOptions: {
    parser: vueParser,
    parserOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
});

describe("simple-tailwindcss/sort-classes", () => {
  it("reorders JSX classes", () => {
    jsxRuleTester.run("sort-classes", sortClassesRule, {
      valid: [
        {
          code: '<div className="flex items-center justify-between" />',
        },
      ],
      invalid: [
        {
          code: '<div className="items-center flex flex" />',
          output: '<div className="flex items-center" />',
          errors: [{ messageId: "unsorted" }],
        },
      ],
    });
  });

  it("reorders Vue template classes", () => {
    vueRuleTester.run("sort-classes", sortClassesRule, {
      valid: [
        {
          code: "<template><div class=\"flex gap-2\"></div></template>",
        },
      ],
      invalid: [
        {
          code: "<template><div class=\"gap-2 flex flex\"></div></template>",
          output: "<template><div class=\"flex gap-2\"></div></template>",
          errors: [{ messageId: "unsorted" }],
        },
      ],
    });
  });

  it("supports Tailwind classRegex style extraction", () => {
    jsxRuleTester.run("sort-classes", sortClassesRule, {
      valid: [],
      invalid: [
        {
          code: "const button = cva('font-semibold text-sm flex gap-4');",
          options: [
            {
              classRegex: [
                ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]+)[\"'`]"],
              ],
            },
          ],
          output: "const button = cva('flex gap-4 font-semibold text-sm');",
          errors: [{ messageId: "unsorted" }],
        },
      ],
    });
  });

  it("respects default group ordering", () => {
    jsxRuleTester.run("sort-classes", sortClassesRule, {
      valid: [],
      invalid: [
        {
          code: '<div className="bg-red-500 flex mt-4" />',
          output: '<div className="flex mt-4 bg-red-500" />',
          errors: [{ messageId: "unsorted" }],
        },
      ],
    });
  });

  it("allows overriding group ordering", () => {
    jsxRuleTester.run("sort-classes", sortClassesRule, {
      valid: [],
      invalid: [
        {
          code: '<div className="flex bg-red-500" />',
          options: [
            {
              groupDefinitions: [
                { name: "backgrounds-first", matchers: ["^bg-"] },
                { name: "layout", matchers: [".*"] },
              ],
            },
          ],
          output: '<div className="bg-red-500 flex" />',
          errors: [{ messageId: "unsorted" }],
        },
      ],
    });
  });

  it("handles cn() function calls in Vue template :class bindings", () => {
    vueRuleTester.run("sort-classes", sortClassesRule, {
      valid: [],
      invalid: [
        {
          code: `<template>
  <section
    :class="cn('relative size-full  rounded text-sm ', props.class)"
    role="table"
  >
  </section>
</template>`,
          options: [
            {
              classRegex: [
                ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]+)[\"'`]"],
              ],
            },
          ],
          output: `<template>
  <section
    :class="cn('relative size-full text-sm rounded', props.class)"
    role="table"
  >
  </section>
</template>`,
          errors: [{ messageId: "unsorted" }],
        },
      ],
    });
  });

  it("uses default classRegex entries for cn()", () => {
    jsxRuleTester.run("sort-classes", sortClassesRule, {
      valid: [],
      invalid: [
        {
          code: "const classes = cn('relative size-full  rounded text-sm ', props.class);",
          output:
            "const classes = cn('relative size-full text-sm rounded', props.class);",
          errors: [{ messageId: "unsorted" }],
        },
      ],
    });
  });

  it("keeps additional cn() arguments when classRegex lacks inner pattern", () => {
    vueRuleTester.run("sort-classes", sortClassesRule, {
      valid: [],
      invalid: [
        {
          code: `<template>
  <section
    :class="cn('size-full text-sm rounded relative', props.class)"
    role="table"
  >
  </section>
</template>`,
          options: [
            {
              classRegex: ["cn\\(([^)]*)\\)"],
            },
          ],
          output: `<template>
  <section
    :class="cn('relative size-full text-sm rounded', props.class)"
    role="table"
  >
  </section>
</template>`,
          errors: [{ messageId: "unsorted" }],
        },
      ],
    });
  });
});

