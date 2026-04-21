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

const platformOptions = [
  { title: '马帮ERP', value: 1 },
  { title: '第三方ERP (领星、赛狐等)', value: 3 },
  { title: 'TikTok', value: 2 },
  { title: 'TEMU', value: 5 },
]

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
  return Number(isExpire) === 0 ? '正常' : '已过期'
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

    toast('复制成功', 'success')
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
      toast(copied ? '复制成功' : '复制失败，请手动复制', copied ? 'success' : 'error')
    }
    catch {
      toast('当前浏览器不支持自动复制，请手动复制', 'error')
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
      toast(res?.msg || '获取列表失败', 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '网络请求失败', 'error')
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
      toast(res?.msg || '操作失败', 'error')

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
      toast('请在新窗口中完成授权，完成后请刷新列表', 'warning')
    }
    else {
      toast(res?.msg || '操作成功', 'success')
      await loadList()
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '请求出错，请检查网络', 'error')
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
          <span class="text-h6 font-weight-medium">开发者对接信息</span>
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
              App Key (应用标识)
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
                复制
              </VBtn>
            </VSheet>
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <div class="text-caption text-medium-emphasis mb-2">
              App Secret (应用密钥)
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
                复制
              </VBtn>
            </VSheet>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <VCard class="rounded-lg">
      <VCardItem class="pb-3 pt-5 px-6">
        <template #title>
          <span class="text-h5 font-weight-medium">授权管理</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">旧版 `erp-open` 页面迁移：ERP/平台授权列表、新增授权及 TEMU 授权信息展示。</span>
        </template>
        <template #append>
          <div class="d-flex gap-2 flex-wrap justify-end">
            <VBtn
              color="primary"
              size="small"
              prepend-icon="tabler-plus"
              @click="dialogVisible = true"
            >
              新增授权
            </VBtn>
            <VBtn
              v-if="oldErpOpenUrl"
              variant="text"
              size="small"
              prepend-icon="tabler-external-link"
              @click="openLegacyErpAuth"
            >
              打开旧版
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
                平台/ERP
              </th>
              <th class="text-left">
                店铺/账号名称
              </th>
              <th class="text-left">
                授权时间
              </th>
              <th class="text-center">
                状态
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td
                colspan="4"
                class="text-center py-6"
              >
                正在加载...
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
                暂无授权数据
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
        <VCardItem title="新增授权" />
        <VDivider />
        <VCardText class="pt-5">
          <VForm ref="formRef">
            <AppSelect
              v-model="form.erpId"
              label="选择平台"
              placeholder="请选择需要授权的平台"
              :items="platformOptions"
              item-title="title"
              item-value="value"
              :rules="[v => !!v || '请选择平台']"
            />
          </VForm>
        </VCardText>
        <VCardActions class="px-6 pb-5">
          <VSpacer />
          <VBtn
            variant="text"
            @click="dialogVisible = false"
          >
            取消
          </VBtn>
          <VBtn
            color="primary"
            :loading="submitting"
            @click="submitAuth"
          >
            前往授权
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog
      v-model="resultVisible"
      width="500"
    >
      <VCard>
        <VCardItem title="TEMU 授权信息" />
        <VDivider />
        <VCardText class="pt-5">
          <VAlert
            type="info"
            variant="tonal"
            class="mb-4"
          >
            请复制以下信息并填写到 TEMU 平台完成绑定。
          </VAlert>

          <VList
            border
            rounded="lg"
            density="comfortable"
          >
            <VListItem>
              <VListItemTitle class="text-caption text-medium-emphasis mb-1">
                货主 ID
              </VListItemTitle>
              <VListItemSubtitle class="auth-code">
                {{ authResult?.user_code || '-' }}
              </VListItemSubtitle>
            </VListItem>
            <VListItem>
              <VListItemTitle class="text-caption text-medium-emphasis mb-1">
                授权码
              </VListItemTitle>
              <VListItemSubtitle class="auth-code">
                {{ authResult?.app_secret || '-' }}
              </VListItemSubtitle>
            </VListItem>
            <VListItem>
              <VListItemTitle class="text-caption text-medium-emphasis mb-1">
                授权 KEY
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
            我已复制
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
