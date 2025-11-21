import sortClassesRule from './rules/sort-classes.js'

export { defaultGroupDefinitions } from './config/group-definitions.js'
export type { TailwindGroupDefinition } from './config/group-definitions.js'

export const rules = {
  'sort-classes': sortClassesRule,
}

export default {
  rules,
}
