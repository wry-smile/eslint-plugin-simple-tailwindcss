# @wry-smile/eslint-plugin-simple-tailwindcss

Keep Tailwind CSS class usage predictable in Vue, JSX, and utility helpers without relying on Prettier formatting.

## Features

- Sorts class lists deterministically and removes duplicates/conflicts via `tailwind-merge`.
- Uses an internal Tailwind group ordering table so layout → spacing → typography → backgrounds follow Tailwind’s mental model.
- Works with Vue SFC templates, JSX/TSX, and template literals.
- Extensible extraction via `classRegex`, mirroring VS Code Tailwind CSS Intellisense configuration (`tailwindCSS.experimental.classRegex`).

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

Enable the rule and (optionally) extend class extraction:

```json
{
  "plugins": ["simple-tailwindcss"],
  "rules": {
    "simple-tailwindcss/sort-classes": [
      "warn",
      {
        "classRegex": [
          [
            "cva\\(([^)]*)\\)",
            "[\"'`]([^\"'`]*).*?[\"'`]"
          ],
          "clsx\\(([^)]*)\\)"
        ],
        "debug": true,
        "groupDefinitions": [
          { "name": "backgrounds-first", "matchers": ["^bg-"] },
          { "name": "everything-else", "matchers": [".*"] }
        ]
      }
    ]
  }
}
```

When `classRegex` is omitted, the rule automatically covers:

- `class` in Vue templates
- `class` / `className` in JSX attributes
- Standalone template literals without expressions

Each regex entry may be either:

1. A single regex string where the first capture group represents the class list.
2. A tuple `[outerRegex, innerRegex]`. The outer regex selects a larger expression (e.g., `cva(...)`) and the inner regex extracts actual class strings within that expression, replicating the Tailwind CSS extension semantics.

## Tailwind group ordering

`simple-tailwindcss/sort-classes` ships with an internal ordering table that roughly follows Tailwind’s documentation order:

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

You can fully replace or reorder these groups per-project via the `groupDefinitions` option. Each definition is an object with a `name` and an array of regex `matchers`. The first matching group wins. When you need to inspect what the rule is seeing, set `"debug": true` to log every `JSXAttribute` / `VAttribute` class value and its location.

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

If you only need the defaults, import `defaultGroupDefinitions`:

```ts
import simpleTailwind, {
  defaultGroupDefinitions,
} from "@wry-smile/eslint-plugin-simple-tailwindcss";

export default [
  {
    plugins: { "simple-tailwindcss": simpleTailwind },
    rules: {
      "simple-tailwindcss/sort-classes": [
        "warn",
        { groupDefinitions: defaultGroupDefinitions },
      ],
    },
  },
];
```

## Formatting behavior

- Whitespace between classes is collapsed to a single space.
- Classes are sorted lexicographically (ignoring leading `!`), keeping `!`-prefixed tokens last so overrides remain effective.
- Conflict resolution is powered by `tailwind-merge`, so incompatible utilities collapse to the last surviving class in the sorted list.

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

