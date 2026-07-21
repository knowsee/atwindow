import { createI18n } from 'vue-i18n'
import { cookieRef } from '@layouts/stores/config'
import { themeConfig } from '@themeConfig'

const messages = Object.fromEntries(Object.entries(import.meta.glob('./locales/*.json', { eager: true }))
  .map(([key, value]) => [key.slice(10, -5), value.default]))

const getDefaultLanguage = () => {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    const browserLang = navigator.language || navigator.userLanguage
    if (browserLang) {
      const availableLocales = Object.keys(messages)
      if (availableLocales.includes(browserLang)) {
        return browserLang
      }
      const shortLang = browserLang.split('-')[0]
      if (availableLocales.includes(shortLang)) {
        return shortLang
      }
    }
  }
  return themeConfig.app.i18n.defaultLocale
}

let _i18n = null
export const getI18n = () => {
  if (_i18n === null) {
    _i18n = createI18n({
      legacy: false,
      locale: cookieRef('language', getDefaultLanguage()).value,
      fallbackLocale: 'en',
      messages,
    })
  }
  
  return _i18n
}
export default function (app) {
  app.use(getI18n())
}
