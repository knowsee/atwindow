<script setup>
import { $api } from '@/utils/api'
import { DOWNLOAD_TEMPLATES } from '@/utils/constants'
import { resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadWarehouseOptions } from '@/views/apps/drop-shipping/useDropShippingShared'
import { DROP_SHIPPING_CHANNELS as RAW_TRANSPORT_OPTIONS } from '@/views/apps/print-label/printLabelConfig'
import PrintLabelSectionCard from '@/views/apps/print-label/PrintLabelSectionCard.vue'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const submitting = ref(false)
const snack = ref({ show: false, text: '', color: 'info' })
const warehouseOptions = ref([])
const warehousePersistReady = ref(false)
const { t } = useI18n({ useScope: 'global' })

const excelInputRef = ref()
const zipInputRef = ref()

/** transport_type follows the same backend route ID contract as the single return order page. */
const transportTitleKeys = {
  99999: 'pages.dropShippingOrderCreate.transport.autoTrial',
  200: 'pages.dropShippingOrderCreate.transport.pickup',
  27: 'pages.dropShippingOrderCreate.transport.uspsT5',
}

const transportOptions = computed(() => RAW_TRANSPORT_OPTIONS.map(option => ({
  ...option,
  title: transportTitleKeys[Number(option.value)] ? t(transportTitleKeys[Number(option.value)]) : option.title,
})))

const form = ref({
  transportType: null,
  warehouseId: null,
  excelFile: null,
  zipFile: null,
})

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function goList() {
  router.push({ name: 'apps-drop-shipping-return-order-list' })
}

function pickExcel() {
  excelInputRef.value?.click()
}

function pickZip() {
  zipInputRef.value?.click()
}

function onExcelChange(event) {
  form.value.excelFile = event?.target?.files?.[0] || null
}

function onZipChange(event) {
  form.value.zipFile = event?.target?.files?.[0] || null
}

function buildFormData() {
  const data = new FormData()

  data.append('type', '2')
  data.append('transport_type', String(form.value.transportType))
  data.append('warehouse_id', String(form.value.warehouseId))
  data.append('signature_type', '0')
  data.append('file', form.value.excelFile)
  if (form.value.zipFile)
    data.append('zip', form.value.zipFile)

  return data
}

function templateName(file) {
  return t('pages.dropShippingReturnOrderBatch.upload.templateName', { ext: file.ext || 'xls' })
}

function validateForm() {
  if (form.value.transportType == null || form.value.transportType === '') {
    toast(t('pages.dropShippingReturnOrderBatch.messages.selectTransport'), 'warning')

    return false
  }
  if (!form.value.warehouseId) {
    toast(t('pages.dropShippingReturnOrderBatch.messages.selectWarehouse'), 'warning')

    return false
  }
  if (!form.value.excelFile) {
    toast(t('pages.dropShippingReturnOrderBatch.messages.selectExcel'), 'warning')

    return false
  }

  const ext = form.value.excelFile.name.split('.').pop()?.toLowerCase()
  if (!['xls', 'xlsx'].includes(ext || '')) {
    toast(t('pages.dropShippingReturnOrderBatch.messages.invalidExcel'), 'warning')

    return false
  }

  return true
}

async function submitBatch() {
  if (!validateForm())
    return

  submitting.value = true
  try {
    const res = await $api('/order/batchThReturn', {
      method: 'POST',
      body: buildFormData(),
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || t('pages.dropShippingReturnOrderBatch.messages.success'), 'success')
      setTimeout(goList, 600)
    }
    else {
      toast(res?.msg || t('pages.dropShippingReturnOrderBatch.messages.failed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingReturnOrderBatch.messages.failed'), 'error')
  }
  finally {
    submitting.value = false
  }
}

watch(() => form.value.warehouseId, v => {
  if (!warehousePersistReady.value)
    return
  setPreferredWarehouseId(v)
})

onMounted(async () => {
  warehouseOptions.value = await loadWarehouseOptions(t)
  form.value.warehouseId = resolveInitialWarehouseId(warehouseOptions.value, { preferFirstWhenNoCache: true })
  await nextTick()
  warehousePersistReady.value = true
})
</script>

<template>
  <VContainer
    fluid
    class="app-batch-page pa-0"
  >
    <div class="app-batch-page__inner pb-12">
      <div class="app-batch-page__hero mb-6">
        <h1 class="text-h4 font-weight-medium text-high-emphasis">
          {{ $t('pages.dropShippingReturnOrderBatch.title') }}
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-2">
          {{ $t('pages.dropShippingReturnOrderBatch.subtitle') }}
        </p>
      </div>

      <VSnackbar
        v-model="snack.show"
        :color="snack.color"
        location="top"
        :timeout="2600"
      >
        {{ snack.text }}
      </VSnackbar>

      <PrintLabelSectionCard
        :title="$t('pages.dropShippingReturnOrderBatch.settings.title')"
        :subtitle="$t('pages.dropShippingReturnOrderBatch.settings.subtitle')"
        class="mb-4"
      >
        <template #append>
          <VBtn
            variant="tonal"
            prepend-icon="tabler-arrow-left"
            @click="goList"
          >
            {{ $t('pages.dropShippingOrderCreate.actions.backToList') }}
          </VBtn>
        </template>
        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <AppSelect
              v-model="form.transportType"
              :items="transportOptions"
              item-title="title"
              item-value="value"
              :label="$t('pages.dropShippingReturnOrderBatch.settings.transport')"
              density="comfortable"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <AppSelect
              v-model="form.warehouseId"
              :items="warehouseOptions"
              item-title="title"
              item-value="value"
              :label="$t('pages.dropShippingReturnOrderBatch.settings.warehouse')"
              density="comfortable"
            />
          </VCol>
        </VRow>
      </PrintLabelSectionCard>

      <PrintLabelSectionCard
        :title="$t('pages.dropShippingReturnOrderBatch.upload.title')"
        :subtitle="$t('pages.dropShippingReturnOrderBatch.upload.subtitle')"
        class="mb-4"
      >
        <input
          ref="excelInputRef"
          type="file"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="d-none"
          @change="onExcelChange"
        >
        <input
          ref="zipInputRef"
          type="file"
          accept=".zip,application/zip"
          class="d-none"
          @change="onZipChange"
        >

        <VRow align="stretch">
          <VCol
            cols="12"
            md="6"
            class="d-flex"
          >
            <VSheet
              rounded="lg"
              border
              class="app-batch-upload flex-grow-1 w-100"
              @click="pickExcel"
            >
              <div class="app-batch-upload__inner">
                <VIcon
                  icon="tabler-file-spreadsheet"
                  size="30"
                  class="text-primary mb-2"
                />
                <div class="text-subtitle-2">
                  {{ $t('pages.dropShippingReturnOrderBatch.upload.pickExcel') }}
                </div>
                <div
                  v-if="form.excelFile"
                  class="text-body-2 text-primary mt-2 text-center"
                >
                  {{ form.excelFile.name }}
                </div>
                <div
                  v-else
                  class="text-caption text-medium-emphasis mt-2"
                >
                  {{ $t('pages.dropShippingReturnOrderBatch.upload.noFile') }}
                </div>
              </div>
            </VSheet>
          </VCol>
          <VCol
            cols="12"
            md="6"
            class="d-flex"
          >
            <VSheet
              rounded="lg"
              border
              class="app-batch-upload flex-grow-1 w-100"
              @click="pickZip"
            >
              <div class="app-batch-upload__inner">
                <VIcon
                  icon="tabler-file-zip"
                  size="30"
                  class="text-primary mb-2"
                />
                <div class="text-subtitle-2">
                  {{ $t('pages.dropShippingReturnOrderBatch.upload.pickZip') }}
                </div>
                <div
                  v-if="form.zipFile"
                  class="text-body-2 text-primary mt-2 text-center"
                >
                  {{ form.zipFile.name }}
                </div>
                <div
                  v-else
                  class="text-caption text-medium-emphasis mt-2"
                >
                  {{ $t('pages.dropShippingReturnOrderBatch.upload.noFile') }}
                </div>
              </div>
            </VSheet>
          </VCol>
        </VRow>

        <div class="mt-3 text-body-2 d-flex flex-wrap align-center gap-x-4 gap-y-1">
          <span>{{ $t('pages.dropShippingReturnOrderBatch.upload.templateDownload') }}</span>
          <a
            v-for="file in DOWNLOAD_TEMPLATES.RETURN_ORDER_BATCH.files"
            :key="file.path"
            :href="file.path"
            class="text-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ templateName(file) }}
          </a>
        </div>

        <div class="mt-2 text-body-2 text-medium-emphasis">
          {{ $t('pages.dropShippingReturnOrderBatch.upload.templateNote') }}
        </div>
      </PrintLabelSectionCard>

      <VCard
        class="mt-6 rounded-lg border"
        variant="flat"
      >
        <VCardText class="d-flex justify-end flex-wrap gap-3 py-5 px-6">
          <VBtn
            color="primary"
            prepend-icon="tabler-upload"
            :loading="submitting"
            @click="submitBatch"
          >
            {{ $t('pages.dropShippingReturnOrderBatch.actions.submit') }}
          </VBtn>
        </VCardText>
      </VCard>
    </div>
  </VContainer>
</template>

<style scoped>
.app-batch-page {
  background: rgb(var(--v-theme-background));
}

.app-batch-page__inner {
  max-inline-size: 1440px;
  margin-inline: auto;
  padding: 1.5rem;
}

.app-batch-upload {
  cursor: pointer;
  border-style: dashed;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  min-block-size: 200px;
}

.app-batch-upload:hover {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.04);
}

.app-batch-upload__inner {
  flex: 1;
  min-block-size: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
</style>
