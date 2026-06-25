import { clearAppAbilityRules } from '@/utils/authAbilityRegistry'
import { useCookie } from '@core/composable/useCookie'

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

  let router
  try {
    const mod = await import('@/plugins/1.router/index')

    router = mod.router
  }
  catch {
    // dev 模式下 HMR 窗口期动态 import 可能失败，降级为强制刷新
    if (typeof window !== 'undefined')
      window.location.href = '/login'
    
    return
  }

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
