<script setup>
import { $api, $apiJson } from '@/utils/api'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const formRef = ref()
const loading = ref(false)
const submitting = ref(false)
const isValid = ref(true)
const snack = ref({ show: false, text: '', color: 'info' })

const form = ref({
  isEnabled: 0,
  primaryLogisticsId: null,
  secondaryLogisticsId: 0,
  fallbackLogisticsId: 0,
})

const logisticsList = [
  { id: 27, name: 'USPS' },
  { id: 50, name: 'UPS' },
  { id: 52, name: 'FedEx 2Day' },
  { id: 53, name: 'SPEEDX' },
  { id: 56, name: 'Amazon' },
  { id: 213, name: 'NEXTDAY' },
  { id: 214, name: 'USPS-Y' },
]

const logisticsItems = logisticsList.map(i => ({ title: i.name, value: i.id }))
const optionalLogisticsItems = [{ title: '不配置（关闭）', value: 0 }, ...logisticsItems]

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

async function loadConfig() {
  loading.value = true
  try {
    const res = await $api('/ordernew/getOrderRule', { method: 'GET' })
    if (Number(res?.code) === 1 && res.data) {
      form.value = {
        isEnabled: Number(res.data.is_enabled ?? 0),
        primaryLogisticsId: res.data.primary_logistics_id || null,
        secondaryLogisticsId: Number(res.data.secondary_logistics_id ?? 0),
        fallbackLogisticsId: Number(res.data.fallback_logistics_id ?? 0),
      }
    }
    else {
      toast(res?.msg || '加载配置失败', 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '网络请求失败', 'error')
  }
  finally {
    loading.value = false
  }
}

function validatePrimary(value) {
  if (!value || Number(value) === 0)
    return '请选择首选运输方式'

  return true
}

async function saveConfig() {
  const { valid } = await formRef.value.validate()
  if (!valid)
    return

  submitting.value = true
  try {
    const payload = {
      'is_enabled': Number(form.value.isEnabled),
      'primary_logistics_id': Number(form.value.primaryLogisticsId),
      'secondary_logistics_id': Number(form.value.secondaryLogisticsId || 0),
      'fallback_logistics_id': Number(form.value.fallbackLogisticsId || 0),
    }

    const res = await $apiJson('/ordernew/saveOrderRule', {
      method: 'POST',
      body: payload,
    })

    if (Number(res?.code) === 1)
      toast(res?.msg || '保存成功', 'success')
    else
      toast(res?.msg || '保存失败', 'error')
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '网络请求失败', 'error')
  }
  finally {
    submitting.value = false
  }
}

function goBack() {
  router.back()
}

onMounted(loadConfig)
</script>

<template>
  <VContainer
    fluid
    class="pa-4 pa-sm-6 account-config-page"
  >
    <VSnackbar
      v-model="snack.show"
      :color="snack.color"
      location="top"
      :timeout="2600"
    >
      {{ snack.text }}
    </VSnackbar>
    <VCard class="rounded-lg position-relative">
      <VOverlay
        :model-value="loading"
        contained
        persistent
        class="align-center justify-center"
      >
        <div class="d-flex align-center gap-3 px-4 py-3 bg-surface rounded">
          <VProgressCircular
            indeterminate
            color="primary"
            size="24"
          />
          <span class="text-body-2">正在加载配置...</span>
        </div>
      </VOverlay>
      <VCardItem class="pb-3 pt-5 px-6">
        <template #title>
          <span class="text-h5 font-weight-medium">自动渠道配置</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">自动选渠道策略 + 三级渠道降级。</span>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4 pa-sm-6">
        <VAlert
          type="info"
          variant="tonal"
          class="mb-4"
        >
          当订单导入选择“自动渠道选择”时，系统按「首选 → 次选 → 兜底」顺序尝试下单，直到成功。
        </VAlert>

        <VSheet
          border
          rounded="lg"
          class="pa-4 mb-5"
        >
          <div class="d-flex align-center flex-wrap gap-2 gap-sm-3">
            <VChip
              color="primary"
              label
              variant="tonal"
            >
              1. 首选运输方式
            </VChip>
            <VIcon icon="tabler-arrow-right" />
            <VChip
              color="warning"
              label
              variant="tonal"
            >
              2. 次选运输方式
            </VChip>
            <VIcon icon="tabler-arrow-right" />
            <VChip
              color="success"
              label
              variant="tonal"
            >
              3. 兜底运输方式
            </VChip>
          </div>
        </VSheet>

        <VForm
          ref="formRef"
          v-model="isValid"
        >
          <VRow>
            <VCol
              cols="12"
              md="6"
            >
              <VSwitch
                v-model="form.isEnabled"
                :true-value="1"
                :false-value="0"
                color="primary"
                label="功能开关（开启 / 关闭）"
                inset
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
              class="d-flex align-center justify-md-end"
            >
              <VChip
                :color="Number(form.isEnabled) === 1 ? 'success' : 'secondary'"
                variant="tonal"
                label
              >
                {{ Number(form.isEnabled) === 1 ? '当前：已开启' : '当前：已关闭' }}
              </VChip>
            </VCol>

            <VCol cols="12">
              <AppSelect
                v-model="form.primaryLogisticsId"
                label="首选运输方式"
                :items="logisticsItems"
                item-title="title"
                item-value="value"
                placeholder="请选择首选运输方式（必填）"
                :rules="[validatePrimary]"
              />
              <div class="text-caption text-medium-emphasis mt-1">
                系统优先尝试该渠道下单。
              </div>
            </VCol>

            <VCol cols="12">
              <AppSelect
                v-model="form.secondaryLogisticsId"
                label="次选运输方式"
                :items="optionalLogisticsItems"
                item-title="title"
                item-value="value"
                placeholder="请选择次选运输方式（可选）"
              />
              <div class="text-caption text-medium-emphasis mt-1">
                首选失败后自动重试该渠道。
              </div>
            </VCol>

            <VCol cols="12">
              <AppSelect
                v-model="form.fallbackLogisticsId"
                label="兜底运输方式"
                :items="optionalLogisticsItems"
                item-title="title"
                item-value="value"
                placeholder="请选择兜底运输方式（可选）"
              />
              <div class="text-caption text-medium-emphasis mt-1">
                前两级都失败时启用，作为最终保障。
              </div>
            </VCol>

            <VCol cols="12">
              <div class="d-flex justify-end mt-2">
                <VBtn
                  color="primary"
                  :loading="submitting"
                  :disabled="loading"
                  @click="saveConfig"
                >
                  保存配置
                </VBtn>
              </div>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VContainer>
</template>

<style scoped>
.account-config-page {
  padding-block-end: 5.25rem;
}

.account-config-page__back {
  display: inline-flex;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 0.875rem;
  cursor: pointer;
}

.account-config-page__back:hover {
  text-decoration: underline;
}

.account-config-footer-bar {
  position: fixed;
  inset-inline: 0;
  inset-block-end: 0;
  z-index: 20;
  padding: 0.625rem 0.875rem;
  background: rgba(var(--v-theme-surface), 0.92);
  backdrop-filter: blur(8px);
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.account-config-footer-bar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  max-inline-size: 1280px;
  margin-inline: auto;
}

@media (max-width: 599px) {
  .account-config-footer-bar__inner {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
