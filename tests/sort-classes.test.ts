import { createRequire } from 'node:module'
import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import sortClassesRule from '../src/rules/sort-classes.js'

const require = createRequire(import.meta.url)
const tsParser = require('@typescript-eslint/parser')
const vueParser = require('vue-eslint-parser')

const jsxRuleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      ecmaFeatures: { jsx: true },
    },
  },
})

const vueRuleTester = new RuleTester({
  languageOptions: {
    parser: vueParser,
    parserOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
})

describe('simple-tailwindcss/sort-classes', () => {
  it('sorts JSX classes and collapses whitespace', () => {
    jsxRuleTester.run('sort-classes', sortClassesRule, {
      valid: [
        {
          code: '<div className="flex items-center justify-between" />',
        },
      ],
      invalid: [
        {
          code: '<div className="items-center   flex flex" />',
          output: '<div className="flex flex items-center" />',
          errors: [{ messageId: 'unsorted' }],
        },
      ],
    })
  })

  it('sorts JSX expression literals and template literals in className', () => {
    jsxRuleTester.run('sort-classes', sortClassesRule, {
      valid: [
        {
          code: '<div className={"flex items-center"} />',
        },
        {
          code: '<div className={`flex items-center ${props.className}`} />',
        },
      ],
      invalid: [
        {
          code: '<div className={"items-center flex"} />',
          output: '<div className={"flex items-center"} />',
          errors: [{ messageId: 'unsorted' }],
        },
        {
          code: '<div className={`items-center flex ${props.className}`} />',
          output: '<div className={`flex items-center ${props.className}`} />',
          errors: [{ messageId: 'unsorted' }],
        },
      ],
    })
  })

  it('collapses extra whitespace in real-world className strings', () => {
    jsxRuleTester.run('sort-classes', sortClassesRule, {
      valid: [],
      invalid: [
        {
          code: '<div className="mx-auto grid size-full     gap-4 px-4 py-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-6 lg:py-6" />',
          output: '<div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] mx-auto px-4 lg:px-6 py-4 lg:py-6 size-full" />',
          errors: [{ messageId: 'unsorted' }],
        },
      ],
    })
  })

  it('sorts Vue static class attributes', () => {
    vueRuleTester.run('sort-classes', sortClassesRule, {
      valid: [
        {
          code: '<template><div class="flex gap-2"></div></template>',
        },
      ],
      invalid: [
        {
          code: '<template><div class="gap-2   flex"></div></template>',
          output: '<template><div class="flex gap-2"></div></template>',
          errors: [{ messageId: 'unsorted' }],
        },
      ],
    })
  })

  it('sorts class lists inside clsx conditionals, arrays, object keys, and String.raw', () => {
    jsxRuleTester.run('sort-classes', sortClassesRule, {
      valid: [
        {
          code: 'clsx(\'flex flex-col\', isOpen ? \'bottom-1 top-1\' : \'left-1 right-1\', isReady && \'pl-2 pr-2\', { \'font-semibold text-sm\': enabled }, [String.raw`relative rounded`])',
        },
      ],
      invalid: [
        {
          code: 'clsx(\'flex-col flex\', isOpen ? \'top-1 bottom-1\' : \'right-1 left-1\', isReady && \'pr-2 pl-2\', { \'text-sm font-semibold\': enabled }, [String.raw`rounded relative`])',
          output: 'clsx(\'flex flex-col\', isOpen ? \'bottom-1 top-1\' : \'left-1 right-1\', isReady && \'pl-2 pr-2\', { \'font-semibold text-sm\': enabled }, [String.raw`relative rounded`])',
          errors: [
            { messageId: 'unsorted' },
            { messageId: 'unsorted' },
            { messageId: 'unsorted' },
            { messageId: 'unsorted' },
            { messageId: 'unsorted' },
            { messageId: 'unsorted' },
          ],
        },
      ],
    })
  })

  it('sorts template literals without breaking interpolations', () => {
    jsxRuleTester.run('sort-classes', sortClassesRule, {
      valid: [],
      invalid: [
        {
          code: 'const clsButton = `items-center flex ${props.className} rounded  text-sm`; ',
          output: 'const clsButton = `flex items-center ${props.className} text-sm rounded`; ',
          errors: [{ messageId: 'unsorted' }, { messageId: 'unsorted' }],
        },
      ],
    })
  })

  it('supports custom callees and variable matchers', () => {
    jsxRuleTester.run('sort-classes', sortClassesRule, {
      valid: [
        {
          code: 'superclass(\'items-center flex\')',
        },
      ],
      invalid: [
        {
          code: 'superclass(\'items-center flex\')',
          options: [{ callees: ['superclass'] }],
          output: 'superclass(\'flex items-center\')',
          errors: [{ messageId: 'unsorted' }],
        },
        {
          code: 'const CLS_BUTTON = { base: \'pr-2 pl-2\', active: \'text-sm font-semibold\' }',
          options: [{ variables: ['^CLS_'] }],
          output: 'const CLS_BUTTON = { base: \'pl-2 pr-2\', active: \'font-semibold text-sm\' }',
          errors: [{ messageId: 'unsorted' }, { messageId: 'unsorted' }],
        },
      ],
    })
  })

  it('sorts cn() calls in JSX', () => {
    jsxRuleTester.run('sort-classes', sortClassesRule, {
      valid: [],
      invalid: [
        {
          code: 'const classes = cn(\'rounded  relative size-full text-sm\', props.class);',
          output: 'const classes = cn(\'relative size-full text-sm rounded\', props.class);',
          errors: [{ messageId: 'unsorted' }],
        },
      ],
    })
  })

  it('sorts cva() variants recursively', () => {
    jsxRuleTester.run('sort-classes', sortClassesRule, {
      valid: [],
      invalid: [
        {
          code: 'const button = cva({ variants: { size: { sm: \'px-2 text-sm py-1\', md: \'px-4 text-base py-2\' } } });',
          output: 'const button = cva({ variants: { size: { sm: \'px-2 py-1 text-sm\', md: \'px-4 py-2 text-base\' } } });',
          errors: [{ messageId: 'unsorted' }, { messageId: 'unsorted' }],
        },
      ],
    })
  })

  it('supports legacy classRegex call patterns without source regex replacement', () => {
    jsxRuleTester.run('sort-classes', sortClassesRule, {
      valid: [],
      invalid: [
        {
          code: 'const button = cva(\'font-semibold text-sm flex gap-4\');',
          options: [
            {
              classRegex: [
                ['cva\\(([^)]*)\\)', '["\'`]([^"\'`]+)["\'`]'],
              ],
            },
          ],
          output: 'const button = cva(\'flex gap-4 font-semibold text-sm\');',
          errors: [{ messageId: 'unsorted' }],
        },
      ],
    })
  })

  it('sorts bound Vue class expressions safely', () => {
    vueRuleTester.run('sort-classes', sortClassesRule, {
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
          output: `<template>
  <section
    :class="cn('relative size-full text-sm rounded', props.class)"
    role="table"
  >
  </section>
</template>`,
          errors: [{ messageId: 'unsorted' }],
        },
      ],
    })
  })

  it('sorts class-like variables recursively', () => {
    jsxRuleTester.run('sort-classes', sortClassesRule, {
      valid: [
        {
          code: 'const unrelated = \'mr-1 ml-1\'',
        },
      ],
      invalid: [
        {
          code: 'const clsButton = { base: \'pr-2  pl-2\', states: { active: \'text-sm font-semibold\' } }',
          output: 'const clsButton = { base: \'pl-2 pr-2\', states: { active: \'font-semibold text-sm\' } }',
          errors: [{ messageId: 'unsorted' }, { messageId: 'unsorted' }],
        },
      ],
    })
  })
})
