/** @type {import('@casl/ability').MongoAbility | null} */
let appAbility = null

export function registerAppAbility(ability) {
  appAbility = ability
}

export function getAppAbility() {
  return appAbility
}

export function clearAppAbilityRules() {
  appAbility?.update([])
}
