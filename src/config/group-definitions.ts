export interface TailwindGroupDefinition {
  /**
   * Display name for reference when reordering or overriding groups.
   */
  name: string
  /**
   * Regex patterns (as strings) that determine whether a class belongs
   * to this group. The first matching group defines ordering precedence.
   */
  matchers: string[]

}

export const defaultGroupDefinitions: TailwindGroupDefinition[] = [
  {
    name: 'layout',
    matchers: [
      '^container$',
      '^box-(?:border|content)$',
      '^columns-',
      '^break-(?:after|before|inside)-',
      '^box-decoration-',
      '^(?:block|inline-block|inline|flex|inline-flex|grid|inline-grid|table|inline-table|table-caption|table-cell|table-column|table-row|flow-root|contents|list-item|hidden)$',
      '^float-',
      '^clear-',
      '^isolation-',
      '^object-',
      '^overflow-',
      '^overscroll-',
      '^scroll-(?![mp])',
      '^(?:static|fixed|absolute|relative|sticky)$',
      '^(?:top|right|bottom|left|inset)(?:-|$)',
      '^(?:start|end)(?:-|$)',
      '^z-',
      '^visibility$',
    ],
  },
  {
    name: 'flex-grid',
    matchers: [
      '^flex-',
      '^basis-',
      '^grow-?',
      '^shrink-?',
      '^grid-',
      '^auto-cols-',
      '^auto-rows-',
      '^col-(?:auto|span|start|end)',
      '^row-(?:auto|span|start|end)',
      '^gap-',
      '^place-(?:content|items|self)-',
      '^justify-',
      '^content-',
      '^items-',
      '^self-',
      '^order-',
    ],
  },
  {
    name: 'spacing',
    matchers: [
      '^-?m[trblxy]?(?:-|$)',
      '^-?p[trblxy]?(?:-|$)',
      '^space-[xy]-',
      '^divide-[xy]-',
      '^scroll-[mp][trblxy]?(?:-|$)',
    ],
  },
  {
    name: 'sizing',
    matchers: [
      '^w-',
      '^min-w-',
      '^max-w-',
      '^h-',
      '^min-h-',
      '^max-h-',
      '^size-',
    ],
  },
  {
    name: 'typography',
    matchers: [
      '^font-',
      '^text-',
      '^tracking-',
      '^leading-',
      '^list-',
      '^placeholder-',
      '^align-',
      '^whitespace-',
      '^break-(?:normal|words|all)$',
      '^hyphens-',
      '^content-',
      '^indent-',
      '^(?:normal-case|uppercase|lowercase|capitalize)$',
      '^subpixel-antialiased$',
      '^antialiased$',
      '^decoration-',
      '^underline$',
    ],
  },
  {
    name: 'background',
    matchers: [
      '^bg-',
      '^from-',
      '^via-',
      '^to-',
      '^gradient-',
      '^accent-',
    ],
  },
  {
    name: 'borders',
    matchers: [
      '^border',
      '^rounded',
      '^outline-',
      '^ring-',
      '^ring-offset-',
    ],
  },
  {
    name: 'effects',
    matchers: [
      '^shadow',
      '^opacity-',
      '^mix-blend-',
      '^bg-blend-',
      '^drop-shadow-',
    ],
  },
  {
    name: 'filters',
    matchers: [
      '^blur-',
      '^brightness-',
      '^contrast-',
      '^grayscale',
      '^hue-rotate-',
      '^invert',
      '^saturate-',
      '^sepia',
      '^backdrop-',
    ],
  },
  {
    name: 'tables',
    matchers: [
      '^table-',
      '^caption-',
      '^border-(?:collapse|separate)$',
    ],
  },
  {
    name: 'transforms',
    matchers: [
      '^transform(-gpu)?$',
      '^origin-',
      '^scale-',
      '^rotate-',
      '^translate-',
      '^skew-',
      '^motion-(?:safe|reduce)',
      '^perspective-',
    ],
  },
  {
    name: 'transitions',
    matchers: [
      '^transition',
      '^duration-',
      '^ease-',
      '^delay-',
      '^animate-',
    ],
  },
  {
    name: 'interactivity',
    matchers: [
      '^appearance-',
      '^cursor-',
      '^caret-',
      '^pointer-events-',
      '^resize-',
      '^scroll-(?:smooth|auto)$',
      '^touch-',
      '^select-',
      '^will-change-',
      '^snap-',
    ],
  },
  {
    name: 'svg',
    matchers: ['^fill-', '^stroke-'],
  },
  {
    name: 'accessibility',
    matchers: [
      '^sr-only$',
      '^not-sr-only$',
      '^aria-',
      '^data-',
    ],
  },
]
