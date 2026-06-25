<script setup>
import { $api } from '@/utils/api'
import { DOWNLOAD_TEMPLATES } from '@/utils/constants'
import PrintLabelSectionCard from '@/views/apps/print-label/PrintLabelSectionCard.vue'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const fileInputRef = ref()
const selectedFile = ref(null)
const submitting = ref(false)
const snack = ref({ show: false, text: '', color: 'info' })

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function goShippingList() {
  router.push({ name: 'apps-print-label-shipping-list' })
}

function pickFile() {
  fileInputRef.value?.click()
}

function onFileChange(event) {
  const file = event?.target?.files?.[0]

  selectedFile.value = file || null
}

const ALLOWED_EXT = ['xls', 'xlsx', 'csv']

const templateFiles = computed(() => DOWNLOAD_TEMPLATES.SHIPPING_BATCH.files.map(file => ({
  ...file,
  displayName: file.ext === 'xlsx' ? t('pages.printLabelBatchUpload.upload.templateName') : file.name,
})))

async function submitUpload() {
  if (!selectedFile.value) {
    toast(t('pages.printLabelBatchUpload.messages.fileRequired'), 'warning')

    return
  }

  const ext = selectedFile.value.name.split('.').pop()?.toLowerCase()
  if (!ALLOWED_EXT.includes(ext || '')) {
    toast(t('pages.printLabelBatchUpload.messages.fileTypeInvalid'), 'warning')

    return
  }

  submitting.value = true
  try {
    const formData = new FormData()

    formData.append('file', selectedFile.value)

    const accessToken = useCookie('accessToken').value
    if (accessToken)
      formData.append('token', accessToken)

    const res = await $api('/Ordernewapi/shippingBatch', {
      method: 'POST',
      body: formData,
    })

    if (Number(res?.code) === 1) {
      const sn = res?.data?.batch_sn
      const id = res?.data?.batch_id

      toast(sn ? t('pages.printLabelBatchUpload.messages.batchCreated', { sn, id }) : (res?.msg || t('pages.printLabelBatchUpload.messages.uploadSuccess')), 'success')
      setTimeout(() => goShippingList(), 700)

      return
    }

    toast(res?.msg || t('pages.printLabelBatchUpload.messages.uploadFailed'), 'error')
  }
  catch (error) {
    toast(error?.data?.msg || error?.message || t('pages.printLabelBatchUpload.messages.uploadFailed'), 'error')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <VContainer
    fluid
    class="print-label-batch pa-0"
  >
    <div class="print-label-batch__inner pb-12">
      <div class="print-label-batch__hero mb-6">
        <h1 class="text-h4 font-weight-medium text-high-emphasis">
          {{ $t('pages.printLabelBatchUpload.hero.title') }}
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-2">
          {{ $t('pages.printLabelBatchUpload.hero.subtitle') }}
        </p>
      </div>

      <VSnackbar
        v-model="snack.show"
        :color="snack.color"
        location="top"
        :timeout="3200"
      >
        {{ snack.text }}
      </VSnackbar>

      <PrintLabelSectionCard
        :title="$t('pages.printLabelBatchUpload.upload.title')"
        :subtitle="$t('pages.printLabelBatchUpload.upload.subtitle')"
      >
        <template #append>
          <VBtn
            variant="tonal"
            prepend-icon="tabler-arrow-left"
            class="text-none"
            @click="goShippingList"
          >
            {{ $t('pages.printLabelBatchUpload.actions.backToOrders') }}
          </VBtn>
        </template>

        <input
          ref="fileInputRef"
          type="file"
          accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          class="d-none"
          @change="onFileChange"
        >

        <VSheet
          rounded="lg"
          border
          class="print-label-batch-upload"
          @click="pickFile"
        >
          <div class="print-label-batch-upload__inner">
            <VIcon
              icon="tabler-file-spreadsheet"
              size="30"
              class="text-primary mb-2"
            />
            <div class="text-subtitle-2">
              {{ $t('pages.printLabelBatchUpload.upload.choose') }}
            </div>
            <div
              v-if="selectedFile"
              class="text-body-2 text-primary mt-2 text-center"
            >
              {{ selectedFile.name }}
            </div>
            <div
              v-else
              class="text-caption text-medium-emphasis mt-2"
            >
              {{ $t('pages.printLabelBatchUpload.upload.empty') }}
            </div>
          </div>
        </VSheet>

        <div class="mt-3 text-body-2 d-flex flex-wrap align-center gap-x-4 gap-y-1">
          <span>{{ $t('pages.printLabelBatchUpload.upload.templateDownload') }}</span>
          <a
            v-for="file in templateFiles"
            :key="file.path"
            :href="file.path"
            class="text-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ file.displayName }}
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
            class="text-none"
            :loading="submitting"
            prepend-icon="tabler-upload"
            @click="submitUpload"
          >
            {{ $t('pages.printLabelBatchUpload.actions.submitImport') }}
          </VBtn>
        </VCardText>
      </VCard>
    </div>
  </VContainer>
</template>

<style scoped>
.print-label-batch {
  background: rgb(var(--v-theme-background));
}

.print-label-batch__inner {
  max-inline-size: 1440px;
  margin-inline: auto;
}

.print-label-batch-upload {
  cursor: pointer;
  border-style: dashed;
  transition: all 0.2s ease;
}

.print-label-batch-upload:hover {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.04);
}

.print-label-batch-upload__inner {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
</style>
