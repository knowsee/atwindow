<script setup>
import { $api } from '@/utils/api'

const loading = ref(true)
const loadError = ref('')
const info = ref(null)
const { t } = useI18n({ useScope: 'global' })

function displayVal(v) {
  if (v == null || v === '')
    return '—'

  return String(v)
}

const displayRows = computed(() => {
  const d = info.value || {}

  return [
    { label: t('pages.accountSettings.account.fields.username'), value: displayVal(d.username) },
    { label: t('pages.accountSettings.account.fields.userCode'), value: displayVal(d['user_code']) },
    { label: t('pages.accountSettings.account.fields.realName'), value: displayVal(d.realname) },
    { label: t('pages.accountSettings.account.fields.email'), value: displayVal(d.email) },
    { label: t('pages.accountSettings.account.fields.mobile'), value: displayVal(d.mobile) },
    { label: t('pages.accountSettings.account.fields.loginIp'), value: displayVal(d.loginip) },
  ]
})

async function loadInfo() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await $api('/user/info', {
      method: 'POST',
      body: {},
    })

    if (Number(res?.code) === 1 && res?.data && typeof res.data === 'object') {
      info.value = res.data
    }
    else {
      info.value = null
      loadError.value = res?.msg || t('pages.accountSettings.account.messages.loadFailed')
    }
  }
  catch (e) {
    info.value = null
    loadError.value = e?.data?.msg || e?.message || t('pages.accountSettings.account.messages.networkFailed')
  }
  finally {
    loading.value = false
  }
}

onMounted(loadInfo)
</script>

<template>
  <VRow>
    <VCol cols="12">
      <VCard :title="$t('pages.accountSettings.account.title')">
        <VCardText>
          <VAlert
            v-if="loadError"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-4"
            closable
            @click:close="loadError = ''"
          >
            {{ loadError }}
          </VAlert>

          <div
            v-if="loading"
            class="py-8"
          >
            <VSkeletonLoader type="article, article" />
          </div>

          <template v-else-if="info">
            <VRow>
              <VCol
                v-for="row in displayRows"
                :key="row.label"
                cols="12"
                sm="6"
                lg="4"
              >
                <AppTextField
                  :model-value="row.value"
                  :label="row.label"
                  readonly
                  density="comfortable"
                  hide-details="auto"
                />
              </VCol>
            </VRow>
          </template>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>
