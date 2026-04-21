import { canNavigate } from '@layouts/plugins/casl'
import { $api } from '@/utils/api'

const defaultAbilityRules = [{ action: 'manage', subject: 'all' }]
let lastFailedCookieToken = ''
let checkingCookieTokenPromise = null

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

async function ensureLoginFromDomainCookie() {
  const accessToken = useCookie('accessToken')
  const userData = useCookie('userData')
  if (accessToken.value && userData.value)
    return true

  const domainToken = getCookieValue('token')
  if (!domainToken || domainToken === lastFailedCookieToken)
    return false

  if (!checkingCookieTokenPromise) {
    checkingCookieTokenPromise = (async () => {
      try {
        accessToken.value = domainToken

        const res = await $api('/apiOrdernew/checkToken', { method: 'GET' })

        if (res?.accessToken) {
          useCookie('userAbilityRules').value = res.userAbilityRules?.length ? res.userAbilityRules : defaultAbilityRules
          useCookie('userData').value = res.userData || {}
          accessToken.value = res.accessToken
          
          return true
        }

        const token = res?.data?.userinfo?.token
        const codeOk = Number(res?.code) === 1
        if (codeOk && token) {
          useCookie('userAbilityRules').value = defaultAbilityRules
          useCookie('userData').value = res.data.userinfo
          accessToken.value = token
          
          return true
        }

        accessToken.value = null
        lastFailedCookieToken = domainToken
        
        return false
      }
      catch (err) {
        accessToken.value = null
        lastFailedCookieToken = domainToken
        
        return false
      }
      finally {
        checkingCookieTokenPromise = null
      }
    })()
  }

  return checkingCookieTokenPromise
}

export const setupGuards = router => {
  // 👉 router.beforeEach
  // Docs: https://router.vuejs.org/guide/advanced/navigation-guards.html#global-before-guards
  router.beforeEach(async to => {
    /*
         * If it's a public route, continue navigation. This kind of pages are allowed to visited by login & non-login users. Basically, without any restrictions.
         * Examples of public routes are, 404, under maintenance, etc.
         */
    if (to.meta.public)
      return

    /**
         * Check if user is logged in by checking if token & user data exists in local storage
         * Feel free to update this logic to suit your needs
         */
    let isLoggedIn = !!(useCookie('userData').value && useCookie('accessToken').value)
    if (!isLoggedIn)
      isLoggedIn = await ensureLoginFromDomainCookie()

    /*
          If user is logged in and is trying to access login like page, redirect to home
          else allow visiting the page
          (WARN: Don't allow executing further by return statement because next code will check for permissions)
         */
    if (to.meta.unauthenticatedOnly) {
      if (isLoggedIn)
        return '/'
      else
        return undefined
    }
    if (!canNavigate(to) && to.matched.length) {
      /* eslint-disable indent */
            return isLoggedIn
                ? { name: 'not-authorized' }
                : {
                    name: 'login',
                    query: {
                        ...to.query,
                        to: to.fullPath !== '/' ? to.path : undefined,
                    },
                }
            /* eslint-enable indent */
    }
  })
}
