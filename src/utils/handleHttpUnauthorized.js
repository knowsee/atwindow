import { useCookie } from '@core/composable/useCookie'
import { clearAppAbilityRules } from '@/utils/authAbilityRegistry'

let redirecting401 = false

function clearAuthCookies() {
  if (typeof document === 'undefined')
    return

  useCookie('accessToken').value = null
  useCookie('userData').value = null
  useCookie('userAbilityRules').value = null
}

/**
 * HTTP 401：清除登录态并进入登录页（与手动登出逻辑一致，并同步清空 CASL 能力）。
 * 使用动态 import router，避免 utils/api ↔ router/guards 循环依赖。
 */
export async function handleHttpUnauthorized() {
  if (typeof document === 'undefined')
    return

  const { router } = await import('@/plugins/1.router/index')
  const route = router.currentRoute.value

  if (route.name === 'login')
    return

  if (redirecting401)
    return

  redirecting401 = true

  try {
    clearAuthCookies()
    clearAppAbilityRules()

    await router.replace({
      name: 'login',
      query: {
        ...route.query,
        to: route.fullPath !== '/' ? route.path : undefined,
      },
    })
  }
  finally {
    redirecting401 = false
  }
}
