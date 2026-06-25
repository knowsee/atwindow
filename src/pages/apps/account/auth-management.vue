<script setup>
import { $api } from '@/utils/api'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const resultVisible = ref(false)
const list = ref([])
const authInfo = ref(null)
const authResult = ref(null)
const formRef = ref()
const snack = ref({ show: false, text: '', color: 'info' })
const form = ref({ erpId: null })
const { t } = useI18n({ useScope: 'global' })

const platformOptions = computed(() => [
  { title: t('pages.accountAuthManagement.platforms.mabang'), value: 1 },
  { title: t('pages.accountAuthManagement.platforms.thirdParty'), value: 3 },
  { title: t('pages.accountAuthManagement.platforms.tiktok'), value: 2 },
  { title: t('pages.accountAuthManagement.platforms.temu'), value: 5 },
])

const oldErpOpenUrl = computed(() => {
  const raw = import.meta.env.VITE_OLD_ERP_OPEN_URL
  if (raw && /^https?:\/\//i.test(String(raw).trim()))
    return String(raw).trim()

  return ''
})

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function openLegacyErpAuth() {
  if (!oldErpOpenUrl.value)
    return

  window.open(oldErpOpenUrl.value, '_blank', 'noopener')
}

function getStatusChipColor(isExpire) {
  return Number(isExpire) === 0 ? 'success' : 'error'
}

function getStatusText(isExpire) {
  return Number(isExpire) === 0 ? t('pages.accountAuthManagement.status.normal') : t('pages.accountAuthManagement.status.expired')
}

async function copyText(text) {
  const value = String(text || '')
  if (!value)
    return

  try {
    if (navigator?.clipboard?.writeText)
      await navigator.clipboard.writeText(value)
    else
      throw new Error('clipboard-unavailable')

    toast(t('pages.accountAuthManagement.messages.copySuccess'), 'success')
  }
  catch {
    try {
      const input = document.createElement('input')

      input.setAttribute('readonly', 'readonly')
      input.setAttribute('value', value)
      document.body.appendChild(input)
      input.select()

      const copied = document.execCommand('copy')

      document.body.removeChild(input)
      toast(copied ? t('pages.accountAuthManagement.messages.copySuccess') : t('pages.accountAuthManagement.messages.copyFailed'), copied ? 'success' : 'error')
    }
    catch {
      toast(t('pages.accountAuthManagement.messages.copyUnsupported'), 'error')
    }
  }
}

function resetForm() {
  form.value.erpId = null
  formRef.value?.resetValidation()
}

async function loadList() {
  loading.value = true
  try {
    const res = await $api('/user/getPanel', { method: 'GET' })
    if (Number(res?.code) === 1) {
      if (res?.data && res.data.list) {
        list.value = Array.isArray(res.data.list) ? res.data.list : []
        authInfo.value = res.data.auth || null
      }
      else if (Array.isArray(res?.data)) {
        list.value = res.data
        authInfo.value = null
      }
      else {
        list.value = []
        authInfo.value = null
      }
    }
    else {
      toast(res?.msg || t('pages.accountAuthManagement.messages.loadFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.accountAuthManagement.messages.networkFailed'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function submitAuth() {
  const { valid } = await formRef.value.validate()
  if (!valid)
    return

  submitting.value = true
  try {
    const res = await $api('/erp/erpAuth', {
      method: 'POST',
      body: {
        'erp_id': Number(form.value.erpId),
      },
    })

    if (Number(res?.code) !== 1) {
      toast(res?.msg || t('pages.accountAuthManagement.messages.operationFailed'), 'error')

      return
    }

    dialogVisible.value = false
    if (Number(form.value.erpId) === 5) {
      authResult.value = res?.data?.uData || res?.data || null
      resultVisible.value = true

      return
    }

    const authUrl = res?.data?.url
    if (authUrl) {
      window.open(authUrl, '_blank', 'noopener')
      toast(t('pages.accountAuthManagement.messages.authorizeInNewWindow'), 'warning')
    }
    else {
      toast(res?.msg || t('pages.accountAuthManagement.messages.operationSuccess'), 'success')
      await loadList()
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.accountAuthManagement.messages.requestFailed'), 'error')
  }
  finally {
    submitting.value = false
  }
}

onMounted(loadList)
</script>

<template>
  <VContainer
    fluid
    class="pa-4 pa-sm-6"
  >
    <VSnackbar
      v-model="snack.show"
      :color="snack.color"
      :timeout="2600"
      location="top"
    >
      {{ snack.text }}
    </VSnackbar>

    <VCard
      v-if="authInfo"
      class="rounded-lg mb-4"
    >
      <VCardItem class="pb-3 pt-5 px-6">
        <template #title>
          <span class="text-h6 font-weight-medium">{{ $t('pages.accountAuthManagement.developerTitle') }}</span>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4 pa-sm-6">
        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <div class="text-caption text-medium-emphasis mb-2">
              {{ $t('pages.accountAuthManagement.appKey') }}
            </div>
            <VSheet
              border
              rounded="lg"
              class="d-flex align-center justify-space-between pa-3"
            >
              <span class="auth-code">{{ authInfo.app_key || '-' }}</span>
              <VBtn
                variant="text"
                size="small"
                prepend-icon="tabler-copy"
                @click="copyText(authInfo.app_key)"
              >
                {{ $t('pages.accountAuthManagement.actions.copy') }}
              </VBtn>
            </VSheet>
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <div class="text-caption text-medium-emphasis mb-2">
              {{ $t('pages.accountAuthManagement.appSecret') }}
            </div>
            <VSheet
              border
              rounded="lg"
              class="d-flex align-center justify-space-between pa-3"
            >
              <span class="auth-code">{{ authInfo.app_secret || '-' }}</span>
              <VBtn
                variant="text"
                size="small"
                prepend-icon="tabler-copy"
                @click="copyText(authInfo.app_secret)"
              >
                {{ $t('pages.accountAuthManagement.actions.copy') }}
              </VBtn>
            </VSheet>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <VCard class="rounded-lg">
      <VCardItem class="pb-3 pt-5 px-6">
        <template #title>
          <span class="text-h5 font-weight-medium">{{ $t('pages.accountAuthManagement.title') }}</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">{{ $t('pages.accountAuthManagement.subtitle') }}</span>
        </template>
        <template #append>
          <div class="d-flex gap-2 flex-wrap justify-end">
            <VBtn
              color="primary"
              size="small"
              prepend-icon="tabler-plus"
              @click="dialogVisible = true"
            >
              {{ $t('pages.accountAuthManagement.actions.add') }}
            </VBtn>
            <VBtn
              v-if="oldErpOpenUrl"
              variant="text"
              size="small"
              prepend-icon="tabler-external-link"
              @click="openLegacyErpAuth"
            >
              {{ $t('pages.accountAuthManagement.actions.openLegacy') }}
            </VBtn>
          </div>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-0">
        <VTable
          hover
          density="comfortable"
        >
          <thead>
            <tr>
              <th class="text-left">
                {{ $t('pages.accountAuthManagement.headers.platform') }}
              </th>
              <th class="text-left">
                {{ $t('pages.accountAuthManagement.headers.seller') }}
              </th>
              <th class="text-left">
                {{ $t('pages.accountAuthManagement.headers.authTime') }}
              </th>
              <th class="text-center">
                {{ $t('pages.accountAuthManagement.headers.status') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td
                colspan="4"
                class="text-center py-6"
              >
                {{ $t('pages.accountAuthManagement.loading') }}
              </td>
            </tr>
            <tr
              v-for="item in list"
              v-else-if="list.length"
              :key="`${item.type}-${item.seller_name}-${item.addtime_text}`"
            >
              <td class="font-weight-medium">
                {{ item.type_ch || '-' }}
              </td>
              <td>{{ item.seller_name || '-' }}</td>
              <td>{{ item.addtime_text || '-' }}</td>
              <td class="text-center">
                <VChip
                  size="small"
                  :color="getStatusChipColor(item.is_expire)"
                  variant="tonal"
                >
                  {{ getStatusText(item.is_expire) }}
                </VChip>
              </td>
            </tr>
            <tr v-else>
              <td
                colspan="4"
                class="text-center text-medium-emphasis py-8"
              >
                {{ $t('pages.accountAuthManagement.empty') }}
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCardText>
    </VCard>

    <VDialog
      v-model="dialogVisible"
      width="480"
      @after-leave="resetForm"
    >
      <VCard>
        <VCardItem :title="$t('pages.accountAuthManagement.dialog.addTitle')" />
        <VDivider />
        <VCardText class="pt-5">
          <VForm ref="formRef">
            <AppSelect
              v-model="form.erpId"
              :label="$t('pages.accountAuthManagement.dialog.platformLabel')"
              :placeholder="$t('pages.accountAuthManagement.dialog.platformPlaceholder')"
              :items="platformOptions"
              item-title="title"
              item-value="value"
              :rules="[v => !!v || $t('pages.accountAuthManagement.dialog.platformRequired')]"
            />
          </VForm>
        </VCardText>
        <VCardActions class="px-6 pb-5">
          <VSpacer />
          <VBtn
            variant="text"
            @click="dialogVisible = false"
          >
            {{ $t('pages.accountAuthManagement.actions.cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            :loading="submitting"
            @click="submitAuth"
          >
            {{ $t('pages.accountAuthManagement.actions.authorize') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog
      v-model="resultVisible"
      width="500"
    >
      <VCard>
        <VCardItem :title="$t('pages.accountAuthManagement.dialog.temuTitle')" />
        <VDivider />
        <VCardText class="pt-5">
          <VAlert
            type="info"
            variant="tonal"
            class="mb-4"
          >
            {{ $t('pages.accountAuthManagement.dialog.temuAlert') }}
          </VAlert>

          <VList
            border
            rounded="lg"
            density="comfortable"
          >
            <VListItem>
              <VListItemTitle class="text-caption text-medium-emphasis mb-1">
                {{ $t('pages.accountAuthManagement.dialog.ownerId') }}
              </VListItemTitle>
              <VListItemSubtitle class="auth-code">
                {{ authResult?.user_code || '-' }}
              </VListItemSubtitle>
            </VListItem>
            <VListItem>
              <VListItemTitle class="text-caption text-medium-emphasis mb-1">
                {{ $t('pages.accountAuthManagement.dialog.authCode') }}
              </VListItemTitle>
              <VListItemSubtitle class="auth-code">
                {{ authResult?.app_secret || '-' }}
              </VListItemSubtitle>
            </VListItem>
            <VListItem>
              <VListItemTitle class="text-caption text-medium-emphasis mb-1">
                {{ $t('pages.accountAuthManagement.dialog.authKey') }}
              </VListItemTitle>
              <VListItemSubtitle class="auth-code">
                {{ authResult?.app_key || '-' }}
              </VListItemSubtitle>
            </VListItem>
          </VList>
        </VCardText>
        <VCardActions class="px-6 pb-5">
          <VSpacer />
          <VBtn
            color="primary"
            @click="resultVisible = false"
          >
            {{ $t('pages.accountAuthManagement.actions.copied') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VContainer>
</template>

<style scoped>
.auth-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.875rem;
  word-break: break-all;
}
</style>
