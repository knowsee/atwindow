import { createMongoAbility } from '@casl/ability'
import { abilitiesPlugin } from '@casl/vue'
import { registerAppAbility } from '@/utils/authAbilityRegistry'

export default function (app) {
  const userAbilityRules = useCookie('userAbilityRules')
  const initialAbility = createMongoAbility(userAbilityRules.value ?? [])

  registerAppAbility(initialAbility)

  app.use(abilitiesPlugin, initialAbility, {
    useGlobalProperties: true,
  })
}
