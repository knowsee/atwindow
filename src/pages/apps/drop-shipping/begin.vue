<script setup>
import FormPageLoadingOverlay from '@/components/FormPageLoadingOverlay.vue'
import { $api } from '@/utils/api'
import { resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadWarehouseOptions } from '@/views/apps/drop-shipping/useDropShippingShared'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const submitting = ref(false)
const loading = ref(false)
const formRef = ref()
const snack = ref({ show: false, text: '', color: 'info' })
const warehouseOptions = ref([])
const warehousePersistReady = ref(false)

const serviceSteps = [
  {
    title: '注册账号',
    desc: '完成账号注册并进入一件代发业务模块',
    icon: 'tabler-user-plus',
  },
  {
    title: '提交申请',
    desc: '选择仓库并填写预估业务规模',
    icon: 'tabler-send',
  },
  {
    title: '审核开通',
    desc: '后台工作人员审核后开通服务权限',
    icon: 'tabler-shield-check',
  },
  {
    title: '创建入库',
    desc: '提交入库单并安排货物入仓',
    icon: 'tabler-package-import',
  },
  {
    title: '创建订单',
    desc: '服务开通后即可创建订单并发货',
    icon: 'tabler-rocket',
  },
]

const form = ref({
  warehouseId: null,
  weeklyShipments: '',
  weeklyWeight: '',
  goodsType: '',
  saleType: '',
})

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

async function initBaseData() {
  loading.value = true
  try {
    warehouseOptions.value = await loadWarehouseOptions()
    form.value.warehouseId = resolveInitialWarehouseId(warehouseOptions.value, { preferFirstWhenNoCache: true })
    await nextTick()
    warehousePersistReady.value = true
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '仓库加载失败', 'error')
  }
  finally {
    loading.value = false
  }
}

watch(() => form.value.warehouseId, v => {
  if (!warehousePersistReady.value)
    return
  setPreferredWarehouseId(v)
})

async function submitApply() {
  const { valid } = await formRef.value.validate()
  if (!valid)
    return

  submitting.value = true
  try {
    const res = await $api('/user/applyService', {
      method: 'POST',
      body: {
        'warehouse_id': Number(form.value.warehouseId),
        'num': Number(form.value.weeklyShipments),
        'weight': Number(form.value.weeklyWeight),
        'goods_type': form.value.goodsType.trim(),
        'sale_type': form.value.saleType.trim(),
      },
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || '您的开通申请已提交，请等待后台工作人员审核开通，如有疑问可联系客服或者销售经理查询进度！', 'success')
    }
    else {
      toast(res?.msg || '提交失败', 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '网络请求失败', 'error')
  }
  finally {
    submitting.value = false
  }
}

onMounted(initBaseData)

const pageBlocking = computed(() => loading.value)
</script>

<template>
  <VContainer
    fluid
    class="pa-4 pa-sm-6 drop-shipping-begin-page"
  >
    <VSnackbar
      v-model="snack.show"
      :color="snack.color"
      location="top"
      :timeout="2600"
    >
      {{ snack.text }}
    </VSnackbar>

    <VCard class="rounded-lg mb-4">
      <VCardItem class="pb-3 pt-5 px-6">
        <template #title>
          <span class="text-h5 font-weight-medium">一件代发步骤</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">先提交开通申请，审核通过后即可使用入库与订单能力。</span>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4 pa-sm-6">
        <div class="begin-steps-grid">
          <div
            v-for="(step, index) in serviceSteps"
            :key="step.title"
            class="begin-step-card"
          >
            <div class="d-flex align-center gap-3">
              <VAvatar
                color="primary"
                variant="tonal"
              >
                <VIcon :icon="step.icon" />
              </VAvatar>
              <div>
                <div class="text-subtitle-1 font-weight-medium">
                  {{ index + 1 }}. {{ step.title }}
                </div>
                <div class="text-body-2 text-medium-emphasis mt-1">
                  {{ step.desc }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </VCardText>
    </VCard>

    <VCard class="rounded-lg">
      <VCardItem class="pb-4 pt-6 px-6">
        <template #title>
          <span class="text-h5 font-weight-medium">服务申请</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">请如实填写计划开通仓库与业务规模，便于平台审核与后续支持。</span>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4 pa-sm-6">
        <FormPageLoadingOverlay
          :loading="pageBlocking"
          message="正在加载仓库列表..."
        >
          <VAlert
            type="info"
            variant="tonal"
            density="comfortable"
            class="mb-6"
          >
            提交后将进入人工审核流程，如有疑问可联系销售或客服查询进度。
          </VAlert>

          <VForm
            ref="formRef"
            class="drop-shipping-begin-form"
          >
            <VRow>
              <VCol
                cols="12"
                md="8"
              >
                <AppSelect
                  v-model="form.warehouseId"
                  label="需开通仓库"
                  placeholder="请选择需要开通服务的仓库"
                  :items="warehouseOptions"
                  item-title="title"
                  item-value="value"
                  :loading="loading"
                  :disabled="loading"
                  density="comfortable"
                  :rules="[v => !!v || '请选择仓库']"
                />
              </VCol>

              <VCol
                cols="12"
                sm="6"
              >
                <AppTextField
                  v-model="form.weeklyShipments"
                  type="number"
                  min="0"
                  step="1"
                  label="预计每周发货件数"
                  placeholder="请输入件数"
                  suffix="件"
                  density="comfortable"
                  :rules="[v => Number(v) > 0 || '请输入有效件数']"
                />
              </VCol>

              <VCol
                cols="12"
                sm="6"
              >
                <AppTextField
                  v-model="form.weeklyWeight"
                  type="number"
                  min="0"
                  step="0.01"
                  label="预计每周发货重量"
                  placeholder="请输入重量"
                  suffix="kg"
                  density="comfortable"
                  :rules="[v => Number(v) > 0 || '请输入有效重量']"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model="form.goodsType"
                  label="商品类型"
                  placeholder="例如：服饰、家居、3C、日用品"
                  density="comfortable"
                  :rules="[v => !!String(v || '').trim() || '请填写商品类型']"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model="form.saleType"
                  label="销售方式"
                  placeholder="例如 eBay、Amazon、独立 B2C 平台等"
                  density="comfortable"
                  :rules="[v => !!String(v || '').trim() || '请填写销售方式']"
                />
              </VCol>
            </VRow>
          </VForm>
        </FormPageLoadingOverlay>
      </VCardText>
    </VCard>

    <VCard
      class="mt-6 rounded-lg border"
      variant="flat"
    >
      <VCardText class="d-flex justify-end flex-wrap gap-3 py-5 px-6">
        <VBtn
          color="primary"
          prepend-icon="tabler-send"
          :loading="submitting"
          :disabled="loading"
          @click="submitApply"
        >
          提交开通申请
        </VBtn>
      </VCardText>
    </VCard>
  </VContainer>
</template>

<style scoped>
.begin-steps-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 1rem;
}

.begin-step-card {
  height: 100%;
  padding: 1rem;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 1rem;
  background: rgba(var(--v-theme-primary), 0.03);
}

.drop-shipping-begin-form {
  max-width: 60rem;
}

.drop-shipping-begin-form :deep(.v-messages) {
  min-height: 1.25rem;
}

@media (max-width: 959px) {
  .begin-steps-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .drop-shipping-begin-form {
    max-width: 100%;
  }
}

@media (max-width: 599px) {
  .begin-steps-grid {
    grid-template-columns: 1fr;
  }
}
</style>
