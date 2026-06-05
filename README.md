# @wry-smile/eslint-plugin-simple-tailwindcss

Keep Tailwind CSS class usage predictable in Vue, JSX, and utility helpers without relying on Prettier formatting.

## Features

- Sorts class lists deterministically and collapses extra whitespace without removing classes.
- Uses an internal Tailwind group ordering table so layout → spacing → typography → backgrounds follow Tailwind’s mental model.
- Works with Vue SFC templates, JSX/TSX, and template literals.
- Supports common utility helpers such as `cn`, `clsx`, `classnames`, `cva`, `twMerge`, and `tv`.

## Installation

```bash
# npm
npm install --save-dev eslint @wry-smile/eslint-plugin-simple-tailwindcss

# pnpm
pnpm add -D eslint @wry-smile/eslint-plugin-simple-tailwindcss

# yarn
yarn add -D eslint @wry-smile/eslint-plugin-simple-tailwindcss
```

## Usage

Most projects do not need any custom options. You only need two things:

- Register the plugin
- Enable the `simple-tailwindcss/sort-classes` rule

Use the defaults like this:

```js
import simpleTailwindcss from '@wry-smile/eslint-plugin-simple-tailwindcss'

export default [
  {
    plugins: {
      'simple-tailwindcss': simpleTailwindcss,
    },
    rules: {
      'simple-tailwindcss/sort-classes': 'warn',
    },
  },
]
```

Out of the box, the rule already covers:

- `class` in Vue templates
- `class` / `className` in JSX attributes
- Common helper calls such as `cn(...)`, `clsx(...)`, `classnames(...)`, `cva(...)`, `twMerge(...)`, and `tv(...)`
- Class-like variables such as `clsButton` or `buttonClassNames`

That means the plugin is intended to be zero-config for common Tailwind usage.

## Advanced options

You only need options when your project uses non-default naming or custom ordering.

```js
import simpleTailwindcss from '@wry-smile/eslint-plugin-simple-tailwindcss'

export default [
  {
    plugins: {
      'simple-tailwindcss': simpleTailwindcss,
    },
    rules: {
      'simple-tailwindcss/sort-classes': [
        'warn',
        {
          callees: ['superclass'],
          variables: ['^CLS_'],
          debug: true,
        },
      ],
    },
  },
]
```

Use `callees` when your project wraps class names in a custom helper like `superclass(...)`.

Use `variables` when your project stores class strings in variable names outside the default patterns.

Use `groupDefinitions` only when you want to replace the built-in ordering.

Use `debug` when you want the rule to log what it is visiting.

Legacy `classRegex` entries are still accepted for compatibility, but the rule now prefers AST-based detection so fixes only touch real string segments instead of regex-matched source slices.

## Tailwind group ordering

`simple-tailwindcss/sort-classes` currently uses the internal group definitions from [`src/config/group-definitions.ts`](./src/config/group-definitions.ts). That table roughly follows Tailwind’s documentation order:

1. Layout
2. Flex & Grid
3. Spacing
4. Sizing
5. Typography
6. Backgrounds
7. Borders / Rings / Outline
8. Effects (shadow/opacity)
9. Filters & Backdrop
10. Tables
11. Transforms
12. Transitions & Animation
13. Interactivity & Behavior
14. SVG
15. Accessibility catch-all

You can fully replace or reorder these groups per-project via the `groupDefinitions` option. Each definition is an object with a `name` and an array of regex `matchers`. The first matching group wins.

```js
{
  "rules": {
    "simple-tailwindcss/sort-classes": [
      "error",
      {
        "groupDefinitions": [
          { "name": "backgrounds", "matchers": ["^bg-"] },
          // reuse the defaults (exported as `defaultGroupDefinitions`)
          ...require("@wry-smile/eslint-plugin-simple-tailwindcss").defaultGroupDefinitions
        ]
      }
    ]
  }
}
```

If you want to customize the order but still start from the built-in defaults, import `defaultGroupDefinitions`:

```ts
import simpleTailwind, {
  defaultGroupDefinitions,
} from '@wry-smile/eslint-plugin-simple-tailwindcss'

export default [
  {
    plugins: { 'simple-tailwindcss': simpleTailwind },
    rules: {
      'simple-tailwindcss/sort-classes': [
        'warn',
        { groupDefinitions: defaultGroupDefinitions },
      ],
    },
  },
]
```

## Formatting behavior

- Whitespace between classes is collapsed to a single space.
- Classes are sorted lexicographically (ignoring leading `!`), keeping `!`-prefixed tokens last so overrides remain effective.
- The rule does not merge, deduplicate, or remove classes.

## Testing

```bash
pnpm test
```

## Debugging

This project includes VS Code debug configurations in `.vscode/launch.json`:

- **Debug Vitest Tests**: Run tests with breakpoints enabled
- **Debug ESLint Rule (Single File)**: Debug the rule against a specific file

To debug:
1. Set breakpoints in `src/rules/sort-classes.ts` (e.g., in `JSXAttribute` or `VAttribute` handlers)
2. Press F5 and select a debug configuration
3. Use the debug console to inspect `node`, `context`, and other variables

You can also enable `debug: true` in the rule options to see console logs of all processed attributes.
