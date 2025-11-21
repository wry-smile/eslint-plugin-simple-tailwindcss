import type { TailwindGroupDefinition } from '../config/group-definitions.js'
import { twMerge } from 'tailwind-merge'
import { defaultGroupDefinitions } from '../config/group-definitions.js'

const WHITESPACE_RE = /\s+/

interface CompiledGroupDefinition {
  name: string
  weight: number
  regexes: RegExp[]
}

interface NormalizedToken {
  important: boolean
  base: string
  groupWeight: number
}

function removeImportantPrefix(token: string) {
  if (token.startsWith('!')) {
    return { important: true, value: token.slice(1) }
  }
  return { important: false, value: token }
}

function collapseWhitespace(value: string) {
  return value.trim().replace(WHITESPACE_RE, ' ')
}

function stripVariants(token: string) {
  let depth = 0
  for (let i = token.length - 1; i >= 0; i -= 1) {
    const char = token[i]!
    if (char === ']') {
      depth += 1
    }
    else if (char === '[') {
      if (depth > 0) {
        depth -= 1
      }
    }
    else if (char === ':' && depth === 0) {
      return token.slice(i + 1)
    }
  }
  return token
}

function compileGroupDefinitions(definitions: TailwindGroupDefinition[]): CompiledGroupDefinition[] {
  return definitions.map((definition, index) => ({
    name: definition.name,
    weight: index,
    regexes: definition.matchers.map(pattern => new RegExp(pattern)),
  }))
}

function resolveGroupWeight(token: string, compiledGroups: CompiledGroupDefinition[]) {
  for (const group of compiledGroups) {
    if (group.regexes.some(regex => regex.test(token))) {
      return group.weight
    }
  }
  return compiledGroups.length
}

function normalizeToken(token: string, compiledGroups: CompiledGroupDefinition[], cache: Map<string, NormalizedToken>): NormalizedToken {
  const cached = cache.get(token)
  if (cached) {
    return cached
  }

  const importantStrip = removeImportantPrefix(token)
  const base = stripVariants(importantStrip.value)
  const weight = resolveGroupWeight(base, compiledGroups)

  const normalized: NormalizedToken = {
    important: importantStrip.important,
    base,
    groupWeight: weight,
  }

  cache.set(token, normalized)
  return normalized
}

function compareClasses(a: string, b: string, compiledGroups: CompiledGroupDefinition[], cache: Map<string, NormalizedToken>) {
  const normalizedA = normalizeToken(a, compiledGroups, cache)
  const normalizedB = normalizeToken(b, compiledGroups, cache)

  if (normalizedA.groupWeight !== normalizedB.groupWeight) {
    return normalizedA.groupWeight - normalizedB.groupWeight
  }

  const baseComparison = normalizedA.base.localeCompare(normalizedB.base)
  if (baseComparison !== 0) {
    return baseComparison
  }

  if (normalizedA.important !== normalizedB.important) {
    return normalizedA.important ? 1 : -1
  }

  return a.localeCompare(b)
}

function formatWithGroups(value: string, compiledGroups: CompiledGroupDefinition[]) {
  const collapsed = collapseWhitespace(value)
  if (!collapsed) {
    return null
  }

  const tokens = collapsed.split(' ').filter(Boolean)
  if (tokens.length <= 1) {
    return collapsed === value ? null : collapsed
  }

  const cache = new Map<string, NormalizedToken>()
  const sortedTokens = [...tokens].sort((a, b) =>
    compareClasses(a, b, compiledGroups, cache),
  )
  const merged = collapseWhitespace(twMerge(sortedTokens.join(' ')))

  if (merged === collapsed) {
    return collapsed === value ? null : collapsed
  }

  return merged
}

const defaultCompiledGroups = compileGroupDefinitions(defaultGroupDefinitions)

export interface FormatterConfig {
  groupDefinitions?: TailwindGroupDefinition[]
}

export type ClassFormatter = (value: string) => string | null

export function createClassFormatter(config?: FormatterConfig): ClassFormatter {
  const compiledGroups
    = config?.groupDefinitions && config.groupDefinitions.length > 0
      ? compileGroupDefinitions(config.groupDefinitions)
      : defaultCompiledGroups

  return (value: string) => formatWithGroups(value, compiledGroups)
}

const defaultFormatter = createClassFormatter()

export function formatClassString(value: string, config?: FormatterConfig): string | null {
  if (!config) {
    return defaultFormatter(value)
  }
  return createClassFormatter(config)(value)
}
