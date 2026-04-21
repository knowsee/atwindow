<script setup>
import { $api } from '@/utils/api'

const loading = ref(true)
const loadError = ref('')
const info = ref(null)

function displayVal(v) {
  if (v == null || v === '')
    return '—'

  return String(v)
}

const displayRows = computed(() => {
  const d = info.value || {}

  return [
    { label: '用户名', value: displayVal(d.username) },
    { label: '用户编码', value: displayVal(d.user_code) },
    { label: '真实姓名', value: displayVal(d.realname) },
    { label: '邮箱', value: displayVal(d.email) },
    { label: '手机', value: displayVal(d.mobile) },
    { label: '登录 IP', value: displayVal(d.loginip) },
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
      loadError.value = res?.msg || '加载用户信息失败'
    }
  }
  catch (e) {
    info.value = null
    loadError.value = e?.data?.msg || e?.message || '网络请求失败'
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
      <VCard title="账户信息">
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
