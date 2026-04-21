function getCookieValue(name) {
  if (typeof document === 'undefined' || !document.cookie)
    return ''

  const cookie = document.cookie
    .split(';')
    .map(item => item.trim())
    .find(item => item.startsWith(`${name}=`))

  if (!cookie)
    return ''

  return decodeURIComponent(cookie.slice(name.length + 1))
}

// 👉 Redirects
export const redirects = [
  // ℹ️ We are redirecting to different pages based on role.
  // NOTE: Role is just for UI purposes. ACL is based on abilities.
  {
    path: '/',
    name: 'index',
    redirect: to => {
      const accessToken = useCookie('accessToken')
      const userData = useCookie('userData')
      const domainToken = getCookieValue('token')
      if ((!accessToken.value && !domainToken) || (!userData.value && !domainToken))
        return { name: 'login', query: to.query }

      // 演示用 dashboards-* 页面已迁出，统一进入业务 Dashboard
      return { name: 'dashboard' }
    },
  },
  {
    path: '/pages/user-profile',
    name: 'pages-user-profile',
    redirect: () => ({ name: 'pages-account-settings-tab', params: { tab: 'account' } }),
  },
  {
    path: '/pages/account-settings',
    name: 'pages-account-settings',
    redirect: () => ({ name: 'pages-account-settings-tab', params: { tab: 'account' } }),
  },
]
export const routes = []
