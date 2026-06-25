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
const { t } = useI18n({ useScope: 'global' })

const serviceSteps = computed(() => [
  {
    title: t('pages.dropShippingBegin.steps.register.title'),
    desc: t('pages.dropShippingBegin.steps.register.desc'),
    icon: 'tabler-user-plus',
  },
  {
    title: t('pages.dropShippingBegin.steps.apply.title'),
    desc: t('pages.dropShippingBegin.steps.apply.desc'),
    icon: 'tabler-send',
  },
  {
    title: t('pages.dropShippingBegin.steps.review.title'),
    desc: t('pages.dropShippingBegin.steps.review.desc'),
    icon: 'tabler-shield-check',
  },
  {
    title: t('pages.dropShippingBegin.steps.inbound.title'),
    desc: t('pages.dropShippingBegin.steps.inbound.desc'),
    icon: 'tabler-package-import',
  },
  {
    title: t('pages.dropShippingBegin.steps.order.title'),
    desc: t('pages.dropShippingBegin.steps.order.desc'),
    icon: 'tabler-rocket',
  },
])

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
    toast(e?.data?.msg || e?.message || t('pages.dropShippingBegin.messages.warehouseLoadFailed'), 'error')
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
      toast(res?.msg || t('pages.dropShippingBegin.messages.applySuccess'), 'success')
    }
    else {
      toast(res?.msg || t('pages.dropShippingBegin.messages.submitFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingBegin.messages.networkFailed'), 'error')
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
          <span class="text-h5 font-weight-medium">{{ $t('pages.dropShippingBegin.stepsTitle') }}</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingBegin.stepsSubtitle') }}</span>
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
          <span class="text-h5 font-weight-medium">{{ $t('pages.dropShippingBegin.application.title') }}</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingBegin.application.subtitle') }}</span>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4 pa-sm-6">
        <FormPageLoadingOverlay
          :loading="pageBlocking"
          :message="$t('pages.dropShippingBegin.application.loadingWarehouses')"
        >
          <VAlert
            type="info"
            variant="tonal"
            density="comfortable"
            class="mb-6"
          >
            {{ $t('pages.dropShippingBegin.application.notice') }}
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
                  :label="$t('pages.dropShippingBegin.fields.warehouse')"
                  :placeholder="$t('pages.dropShippingBegin.fields.warehousePlaceholder')"
                  :items="warehouseOptions"
                  item-title="title"
                  item-value="value"
                  :loading="loading"
                  :disabled="loading"
                  density="comfortable"
                  :rules="[v => !!v || $t('pages.dropShippingBegin.validation.warehouseRequired')]"
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
                  :label="$t('pages.dropShippingBegin.fields.weeklyShipments')"
                  :placeholder="$t('pages.dropShippingBegin.fields.weeklyShipmentsPlaceholder')"
                  :suffix="$t('pages.dropShippingBegin.units.pieces')"
                  density="comfortable"
                  :rules="[v => Number(v) > 0 || $t('pages.dropShippingBegin.validation.shipmentsRequired')]"
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
                  :label="$t('pages.dropShippingBegin.fields.weeklyWeight')"
                  :placeholder="$t('pages.dropShippingBegin.fields.weeklyWeightPlaceholder')"
                  suffix="kg"
                  density="comfortable"
                  :rules="[v => Number(v) > 0 || $t('pages.dropShippingBegin.validation.weightRequired')]"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model="form.goodsType"
                  :label="$t('pages.dropShippingBegin.fields.goodsType')"
                  :placeholder="$t('pages.dropShippingBegin.fields.goodsTypePlaceholder')"
                  density="comfortable"
                  :rules="[v => !!String(v || '').trim() || $t('pages.dropShippingBegin.validation.goodsTypeRequired')]"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <AppTextField
                  v-model="form.saleType"
                  :label="$t('pages.dropShippingBegin.fields.saleType')"
                  :placeholder="$t('pages.dropShippingBegin.fields.saleTypePlaceholder')"
                  density="comfortable"
                  :rules="[v => !!String(v || '').trim() || $t('pages.dropShippingBegin.validation.saleTypeRequired')]"
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
          {{ $t('pages.dropShippingBegin.actions.submit') }}
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
