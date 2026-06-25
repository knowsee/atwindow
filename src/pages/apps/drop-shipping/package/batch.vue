<script setup>
import { $api } from '@/utils/api'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'
import { DOWNLOAD_TEMPLATES } from '@/utils/constants'
import { resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadWarehouseOptions } from '@/views/apps/drop-shipping/useDropShippingShared'
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
const fileInputRef = ref()
const { t } = useI18n({ useScope: 'global' })

const form = ref({
  warehouseId: null,
  excelFile: null,
})

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function goList() {
  router.push({ name: 'apps-drop-shipping-package-list' })
}

function pickFile() {
  fileInputRef.value?.click()
}

function onFileChange(event) {
  form.value.excelFile = event?.target?.files?.[0] || null
}

function templateName(file) {
  return t('pages.dropShippingPackageBatch.upload.templateName', { ext: file.ext })
}

async function submitBatch() {
  if (!form.value.excelFile) {
    toast(t('pages.dropShippingPackageBatch.messages.selectExcel'), 'warning')

    return
  }

  const ext = form.value.excelFile.name.split('.').pop()?.toLowerCase()
  if (!['xls', 'xlsx'].includes(ext || '')) {
    toast(t('pages.dropShippingPackageBatch.messages.invalidExcel'), 'warning')

    return
  }

  submitting.value = true
  try {
    const body = new FormData()

    body.append('file', form.value.excelFile)
    if (form.value.warehouseId)
      body.append('warehouse_id', String(form.value.warehouseId))

    const res = await $api('/package/batchruku', {
      method: 'POST',
      body,
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || t('pages.dropShippingPackageBatch.messages.success'), 'success')

      const pdf = res?.data?.pdf
      if (pdf)
        window.open(resolveBackendFileUrl(pdf), '_blank', 'noopener')
      setTimeout(goList, 600)
    }
    else {
      toast(res?.msg || t('pages.dropShippingPackageBatch.messages.failed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingPackageBatch.messages.uploadFailed'), 'error')
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
  form.value.warehouseId = resolveInitialWarehouseId(warehouseOptions.value, { preferFirstWhenNoCache: false })
  await nextTick()
  warehousePersistReady.value = true
})

const currentWarehouseInfo = computed(() =>
  warehouseOptions.value.find(w => Number(w.value) === Number(form.value.warehouseId)) || null,
)
</script>

<template>
  <VContainer
    fluid
    class="app-batch-page pa-0"
  >
    <div class="app-batch-page__inner pb-12">
      <div class="app-batch-page__hero mb-6">
        <h1 class="text-h4 font-weight-medium text-high-emphasis">
          {{ $t('pages.dropShippingPackageBatch.title') }}
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-2">
          {{ $t('pages.dropShippingPackageBatch.subtitle') }}
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
        :title="$t('pages.dropShippingPackageBatch.settings.title')"
        :subtitle="$t('pages.dropShippingPackageBatch.settings.subtitle')"
        class="mb-4"
      >
        <template #append>
          <VBtn
            variant="tonal"
            prepend-icon="tabler-arrow-left"
            @click="goList"
          >
            {{ $t('pages.dropShippingPackageBatch.actions.backToList') }}
          </VBtn>
        </template>
        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <AppSelect
              v-model="form.warehouseId"
              :items="warehouseOptions"
              item-title="title"
              item-value="value"
              :label="$t('pages.dropShippingPackageBatch.settings.warehouse')"
              clearable
              density="comfortable"
            />
          </VCol>
        </VRow>
        <Transition name="wh-addr">
          <VSheet
            v-if="currentWarehouseInfo && (currentWarehouseInfo.address || currentWarehouseInfo.telephone || currentWarehouseInfo.country)"
            rounded="lg"
            border
            class="warehouse-addr-box mt-4 pa-4"
          >
            <div class="d-flex align-center gap-2 mb-2">
              <VIcon
                icon="tabler-building-warehouse"
                size="15"
                color="primary"
              />
              <span class="text-caption font-weight-semibold text-uppercase tracking-widest text-primary">
                {{ $t('pages.dropShippingPackageBatch.settings.warehouseAddress') }}
              </span>
            </div>
            <VRow dense>
              <VCol
                v-if="currentWarehouseInfo.sendName"
                cols="12"
                class="text-body-2"
              >
                <VIcon
                  icon="tabler-user"
                  size="14"
                  class="me-1 text-medium-emphasis"
                />
                {{ currentWarehouseInfo.sendName }}
              </VCol>
              <VCol
                v-if="currentWarehouseInfo.address"
                cols="12"
                class="text-body-2"
              >
                <VIcon
                  icon="tabler-map-pin"
                  size="14"
                  class="me-1 text-medium-emphasis"
                />
                {{ currentWarehouseInfo.address }}
              </VCol>
              <VCol
                v-if="currentWarehouseInfo.city || currentWarehouseInfo.state || currentWarehouseInfo.code || currentWarehouseInfo.country"
                cols="12"
                class="text-body-2 text-medium-emphasis"
              >
                <VIcon
                  icon="tabler-world"
                  size="14"
                  class="me-1 text-medium-emphasis"
                />
                {{ [currentWarehouseInfo.city, currentWarehouseInfo.state, currentWarehouseInfo.code, currentWarehouseInfo.country].filter(Boolean).join(' · ') }}
              </VCol>
              <VCol
                v-if="currentWarehouseInfo.telephone"
                cols="12"
                class="text-body-2"
              >
                <VIcon
                  icon="tabler-phone"
                  size="14"
                  class="me-1 text-medium-emphasis"
                />
                {{ currentWarehouseInfo.telephone }}
              </VCol>
            </VRow>
          </VSheet>
        </Transition>
      </PrintLabelSectionCard>

      <PrintLabelSectionCard
        :title="$t('pages.dropShippingPackageBatch.upload.title')"
        :subtitle="$t('pages.dropShippingPackageBatch.upload.subtitle')"
        class="mb-4"
      >
        <input
          ref="fileInputRef"
          type="file"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="d-none"
          @change="onFileChange"
        >

        <VSheet
          rounded="lg"
          border
          class="app-batch-upload"
          @click="pickFile"
        >
          <div class="app-batch-upload__inner">
            <VIcon
              icon="tabler-file-spreadsheet"
              size="30"
              class="text-primary mb-2"
            />
            <div class="text-subtitle-2">
              {{ $t('pages.dropShippingPackageBatch.upload.pickExcel') }}
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
              {{ $t('pages.dropShippingPackageBatch.upload.noFile') }}
            </div>
          </div>
        </VSheet>

        <div class="mt-3 text-body-2 d-flex flex-wrap align-center gap-x-4 gap-y-1">
          <span>{{ $t('pages.dropShippingPackageBatch.upload.templateDownload') }}</span>
          <a
            v-for="file in DOWNLOAD_TEMPLATES.WAREHOUSE_RECEIPT_BATCH.files"
            :key="file.path"
            :href="file.path"
            class="text-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ templateName(file) }}
          </a>
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
            {{ $t('pages.dropShippingPackageBatch.actions.submit') }}
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
}

.app-batch-upload:hover {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.04);
}

.app-batch-upload__inner {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.warehouse-addr-box {
  background: rgba(var(--v-theme-primary), 0.03);
  border-color: rgba(var(--v-theme-primary), 0.2) !important;
}

.tracking-widest {
  letter-spacing: 0.06em;
}

.wh-addr-enter-active,
.wh-addr-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.wh-addr-enter-from,
.wh-addr-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
