<script setup>
import { useGenerateImageVariant } from '@core/composable/useGenerateImageVariant'
import authV2LoginIllustrationBorderedDark from '@images/pages/auth-v2-login-illustration-bordered-dark.png'
import authV2LoginIllustrationBorderedLight from '@images/pages/auth-v2-login-illustration-bordered-light.png'
import authV2LoginIllustrationDark from '@images/pages/auth-v2-login-illustration-dark.png'
import authV2LoginIllustrationLight from '@images/pages/auth-v2-login-illustration-light.png'
import authV2MaskDark from '@images/pages/misc-mask-dark.png'
import authV2MaskLight from '@images/pages/misc-mask-light.png'
import { VNodeRenderer } from '@layouts/components/VNodeRenderer'
import { themeConfig } from '@themeConfig'
import { VForm } from 'vuetify/components/VForm'

const authThemeImg = useGenerateImageVariant(authV2LoginIllustrationLight, authV2LoginIllustrationDark, authV2LoginIllustrationBorderedLight, authV2LoginIllustrationBorderedDark, true)
const authThemeMask = useGenerateImageVariant(authV2MaskLight, authV2MaskDark)

definePage({
  meta: {
    layout: 'blank',
    unauthenticatedOnly: true,
  },
})

const isPasswordVisible = ref(false)
const route = useRoute()
const router = useRouter()
const ability = useAbility()
const { t } = useI18n({ useScope: 'global' })

const loginError = ref('')
const loggingIn = ref(false)

const errors = ref({
  account: undefined,
  password: undefined,
})

const refVForm = ref()

const credentials = ref({
  account: '',
  password: '',
})

/** 登录后默认可访问后台（与 PHP 接口无 CASL 规则时兜底） */
const defaultAbilityRules = [{ action: 'manage', subject: 'all' }]

/** 接口未返回 role 时与路由 redirect 约定一致 */
function withDefaultRole(user) {
  if (!user || typeof user !== 'object')
    return user
  
  return {
    ...user,
    role: user.role ?? 'client',
  }
}

function setDomainTokenCookie(token, seconds = 7 * 24 * 60 * 60) {
  if (typeof document === 'undefined' || !token)
    return

  const d = new Date()

  d.setTime(d.getTime() + seconds * 1000)

  const expires = `expires=${d.toUTCString()}`

  document.cookie = `token=${encodeURIComponent(token)}; ${expires};path=/;domain=atwindow.com`
}

const login = async () => {
  loginError.value = ''
  errors.value = { account: undefined, password: undefined }

  loggingIn.value = true
  try {
    const res = await $api('/user/login', {
      method: 'POST',
      body: {
        account: credentials.value.account,
        password: credentials.value.password,
      },
    })

    // MSW / 部分 mock：{ accessToken, userData, userAbilityRules }
    if (res?.accessToken) {
      const rules = res.userAbilityRules?.length ? res.userAbilityRules : defaultAbilityRules

      useCookie('userAbilityRules').value = rules
      ability.update(rules)
      useCookie('userData').value = withDefaultRole(res.userData)
      useCookie('accessToken').value = res.accessToken
      setDomainTokenCookie(res.accessToken)
      await nextTick(() => {
        router.replace(route.query.to ? String(route.query.to) : '/')
      })
      
      return
    }

    // 正式接口：{ code, msg, time?, data: { userinfo: { token, ... } } }
    const token = res?.data?.userinfo?.token
    const codeOk = Number(res?.code) === 1
    if (codeOk && token) {
      useCookie('userAbilityRules').value = defaultAbilityRules
      ability.update(defaultAbilityRules)
      useCookie('userData').value = withDefaultRole(res.data.userinfo)
      useCookie('accessToken').value = token
      setDomainTokenCookie(token)
      await nextTick(() => {
        router.replace(route.query.to ? String(route.query.to) : '/')
      })
      
      return
    }

    loginError.value = res?.msg || t('login.error.invalidCredentials')
  }
  catch (err) {
    const msg = err?.data?.msg || err?.data?.errors?.account?.[0] || err?.message

    loginError.value = msg || t('login.error.network')
    console.error(err)
  }
  finally {
    loggingIn.value = false
  }
}

const onSubmit = () => {
  refVForm.value?.validate().then(({ valid: isValid }) => {
    if (isValid)
      login()
  })
}
</script>

<template>
  <RouterLink to="/">
    <div class="auth-logo d-flex align-center gap-x-3">
      <VNodeRenderer :nodes="themeConfig.app.logoBlank" />
      <h1 class="auth-title">
        {{ themeConfig.app.title }}
      </h1>
    </div>
  </RouterLink>

  <VRow
    no-gutters
    class="auth-wrapper bg-surface"
  >
    <VCol
      md="8"
      class="d-none d-md-flex"
    >
      <div class="position-relative bg-background w-100 me-0">
        <div
          class="d-flex align-center justify-center w-100 h-100"
          style="padding-inline: 6.25rem;"
        >
          <VImg
            max-width="613"
            :src="authThemeImg"
            class="auth-illustration mt-16 mb-2"
          />
        </div>

        <img
          class="auth-footer-mask"
          :src="authThemeMask"
          alt=""
          height="280"
          width="100"
        >
      </div>
    </VCol>

    <VCol
      cols="12"
      md="4"
      class="auth-card-v2 d-flex align-center justify-center"
    >
      <VCard
        flat
        width="100%"
        class="mt-12 mt-sm-0 pa-4"
      >
        <VCardText>
          <h4 class="text-h4 mb-1">
            {{ t('login.title') }}
          </h4>
          <p class="mb-0 text-medium-emphasis">
            {{ t('login.subtitle') }}
          </p>
        </VCardText>
        <VCardText>
          <VAlert
            v-if="loginError"
            type="error"
            variant="tonal"
            class="mb-4"
            closable
            @click:close="loginError = ''"
          >
            {{ loginError }}
          </VAlert>
          <VForm
            ref="refVForm"
            @submit.prevent="onSubmit"
          >
            <VRow>
              <VCol cols="12">
                <AppTextField
                  v-model="credentials.account"
                  :label="t('login.form.account.label')"
                  :placeholder="t('login.form.account.placeholder')"
                  autofocus
                  autocomplete="username"
                  :hide-details="false"
                  :rules="[requiredValidator]"
                  :error-messages="errors.account"
                  :disabled="loggingIn"
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  v-model="credentials.password"
                  :label="t('login.form.password.label')"
                  :placeholder="t('login.form.password.placeholder')"
                  :rules="[requiredValidator]"
                  :type="isPasswordVisible ? 'text' : 'password'"
                  autocomplete="current-password"
                  :hide-details="false"
                  :error-messages="errors.password"
                  :append-inner-icon="isPasswordVisible ? 'tabler-eye-off' : 'tabler-eye'"
                  :disabled="loggingIn"
                  @click:append-inner="isPasswordVisible = !isPasswordVisible"
                />
              </VCol>

              <VCol cols="12">
                <VBtn
                  block
                  type="submit"
                  :loading="loggingIn"
                  :disabled="loggingIn"
                >
                  {{ t('login.form.submit') }}
                </VBtn>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<style lang="scss">
@use "@core/scss/template/pages/page-auth";
</style>
