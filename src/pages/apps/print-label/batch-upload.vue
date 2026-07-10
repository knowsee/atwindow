<script setup>
/* eslint-disable camelcase -- /Ordernewapi/shippingBatches query params match backend field names */
import { $api } from '@/utils/api'
import { DOWNLOAD_TEMPLATES } from '@/utils/constants'
import ShippingBatchStatusDialog from '@/components/print-label/ShippingBatchStatusDialog.vue'
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

const batchStatus = ref(null)
const batchStatusLoading = ref(false)
const batchStatusError = ref('')
const batchDownloading = ref(false)
let batchPollTimer = null

const batchDialogOpen = ref(false)

const batchDialogProps = ref({
  initialBatchSn: '',
  initialBatchId: null,
  autoOpenBatchDetail: false,
})

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
      const bid = res?.data?.batch_id

      toast(sn ? t('pages.printLabelBatchUpload.messages.batchCreated', { sn, id: bid }) : (res?.msg || t('pages.printLabelBatchUpload.messages.uploadSuccess')), 'success')

      fetchBatchStatus(bid, sn)

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

function normalizeBatchesPayload(raw) {
  if (raw == null)
    return { list: [], total: 0 }
  if (Array.isArray(raw))
    return { list: raw, total: raw.length }
  if (typeof raw !== 'object')
    return { list: [], total: 0 }

  const list = Array.isArray(raw.data)
    ? raw.data
    : Array.isArray(raw.records)
      ? raw.records
      : Array.isArray(raw.list)
        ? raw.list
        : Array.isArray(raw.items)
          ? raw.items
          : []

  const total = Number(raw.total ?? raw.count ?? list.length) || 0

  return { list, total }
}

async function fetchBatchStatus(batchId, batchSn) {
  batchStatusLoading.value = true
  batchStatusError.value = ''
  try {
    const q = { per_page: 1, page: 1 }
    if (batchId != null && Number.isFinite(Number(batchId)) && Number(batchId) > 0)
      q.batch_id = Number(batchId)
    else if (batchSn)
      q.batch_sn = String(batchSn).trim()

    const res = await $api('/Ordernewapi/shippingBatches', {
      method: 'GET',
      query: q,
    })

    if (Number(res?.code) === 1 && res?.data != null) {
      const { list } = normalizeBatchesPayload(res.data)
      if (list.length > 0) {
        batchStatus.value = list[0]
        if (Number(batchStatus.value.status) === 0)
          startBatchPolling(batchId, batchSn)
        else
          stopBatchPolling()

        return
      }
    }
    batchStatusError.value = t('pages.printLabelBatchUpload.batchStatus.messages.loadFailed')
  }
  catch (e) {
    batchStatusError.value = e?.data?.msg || e?.message || t('pages.printLabelBatchUpload.batchStatus.messages.loadFailed')
  }
  finally {
    batchStatusLoading.value = false
  }
}

function startBatchPolling(batchId, batchSn) {
  stopBatchPolling()
  batchPollTimer = setInterval(() => {
    fetchBatchStatus(batchId, batchSn)
  }, 10000)
}

function stopBatchPolling() {
  if (batchPollTimer) {
    clearInterval(batchPollTimer)
    batchPollTimer = null
  }
}

function pickBatchZipDownloadUrl(data) {
  if (data == null || typeof data !== 'object')
    return ''
  const raw = data.download_url ?? data.url

  return String(raw ?? '').trim()
}

function openDownloadUrlInNewTab(url) {
  let href = String(url ?? '').trim()
  if (!href)
    return false
  if (!/^https?:\/\//i.test(href))
    href = new URL(href, window.location.origin).href

  const a = document.createElement('a')

  a.href = href
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()

  return true
}

async function downloadBatchZip() {
  if (!batchStatus.value?.id) {
    toast(t('pages.printLabelBatchUpload.batchStatus.messages.loadFailed'), 'warning')

    return
  }
  batchDownloading.value = true
  try {
    const res = await $api('/Ordernewapi/shippingBatchDownload', {
      method: 'GET',
      query: { batch_id: batchStatus.value.id },
    })

    if (Number(res?.code) !== 1) {
      toast(res?.msg || t('pages.printLabelBatchUpload.batchStatus.messages.loadFailed'), 'error')

      return
    }
    const downloadUrl = pickBatchZipDownloadUrl(res.data)
    if (!downloadUrl) {
      toast(t('pages.printLabelBatchUpload.batchStatus.messages.loadFailed'), 'warning')

      return
    }
    openDownloadUrlInNewTab(downloadUrl)
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.printLabelBatchUpload.batchStatus.messages.loadFailed'), 'error')
  }
  finally {
    batchDownloading.value = false
  }
}

function dismissBatchCard() {
  stopBatchPolling()
  batchStatus.value = null
  batchStatusError.value = ''
}

function openBatchDetail() {
  if (!batchStatus.value)
    return
  const bid = Number(batchStatus.value.id)
  const sn = String(batchStatus.value.batch_sn ?? '').trim()

  batchDialogProps.value = {
    initialBatchSn: sn && sn !== '0' ? sn : '',
    initialBatchId: Number.isFinite(bid) && bid > 0 ? bid : null,
    autoOpenBatchDetail: true,
  }
  batchDialogOpen.value = true
}

function onBatchDialogUpdate(v) {
  batchDialogOpen.value = v
  if (!v) {
    batchDialogProps.value = {
      initialBatchSn: '',
      initialBatchId: null,
      autoOpenBatchDetail: false,
    }
  }
}

function batchStatusColor(s) {
  const n = Number(s)
  if (n === 1)
    return 'success'
  if (n === 2)
    return 'error'

  return 'info'
}

function batchStatusLabel(s) {
  const m = {
    0: t('pages.printLabelBatchUpload.batchStatus.statusLabels.processing'),
    1: t('pages.printLabelBatchUpload.batchStatus.statusLabels.completed'),
    2: t('pages.printLabelBatchUpload.batchStatus.statusLabels.failed'),
  }

  return m[Number(s)] ?? '—'
}

function formatTs(ts) {
  if (ts == null || ts === '')
    return '—'
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0)
    return '—'

  return new Date(n * 1000).toLocaleString()
}

onBeforeUnmount(() => {
  stopBatchPolling()
})
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
        v-if="batchStatus"
        class="mt-4 rounded-lg"
        variant="flat"
        border
      >
        <VProgressLinear
          v-if="batchStatusLoading || Number(batchStatus.status) === 0"
          indeterminate
          color="primary"
        />
        <VCardItem class="pb-2 pt-4 px-5">
          <template #prepend>
            <VAvatar
              :color="batchStatusColor(batchStatus.status)"
              variant="tonal"
              rounded
              size="40"
            >
              <VIcon
                icon="tabler-packages"
                size="22"
              />
            </VAvatar>
          </template>
          <template #title>
            <span class="text-subtitle-1 font-weight-medium">{{ $t('pages.printLabelBatchUpload.batchStatus.title') }}</span>
          </template>
          <template #subtitle>
            <span class="text-body-2 text-medium-emphasis">{{ batchStatus.batch_sn || `#${batchStatus.id}` }}</span>
          </template>
          <template #append>
            <VBtn
              icon
              size="small"
              variant="text"
              :aria-label="$t('pages.printLabelBatchUpload.batchStatus.actions.close')"
              @click="dismissBatchCard"
            >
              <VIcon icon="tabler-x" />
            </VBtn>
          </template>
        </VCardItem>
        <VDivider />
        <VCardText class="pa-5">
          <VAlert
            v-if="batchStatusError"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            {{ batchStatusError }}
          </VAlert>
          <div class="d-flex flex-wrap gap-3 mb-3">
            <div class="d-flex align-center gap-2">
              <VChip
                size="small"
                variant="tonal"
                :color="batchStatusColor(batchStatus.status)"
              >
                <template
                  v-if="Number(batchStatus.status) === 0"
                  #prepend
                >
                  <VProgressCircular
                    indeterminate
                    size="12"
                    width="2"
                    color="info"
                    class="me-1"
                  />
                </template>
                {{ batchStatusLabel(batchStatus.status) }}
              </VChip>
            </div>
            <div class="d-flex align-center gap-1 text-body-2 text-medium-emphasis">
              <span>{{ $t('pages.printLabelBatchUpload.batchStatus.counts.total') }}:</span>
              <span class="font-weight-medium">{{ batchStatus.total_count ?? '—' }}</span>
            </div>
            <div class="d-flex align-center gap-1 text-body-2 text-medium-emphasis">
              <span>{{ $t('pages.printLabelBatchUpload.batchStatus.counts.success') }}:</span>
              <span class="font-weight-medium text-success">{{ batchStatus.success_count ?? '—' }}</span>
            </div>
            <div class="d-flex align-center gap-1 text-body-2 text-medium-emphasis">
              <span>{{ $t('pages.printLabelBatchUpload.batchStatus.counts.fail') }}:</span>
              <span class="font-weight-medium text-error">{{ batchStatus.fail_count ?? '—' }}</span>
            </div>
          </div>
          <div
            v-if="batchStatus.createtime"
            class="text-body-2 text-medium-emphasis mb-4"
          >
            <VIcon
              icon="tabler-clock"
              size="14"
              class="me-1"
            />
            {{ formatTs(batchStatus.createtime) }}
          </div>
          <div class="d-flex flex-wrap gap-2">
            <VBtn
              v-if="Number(batchStatus.status) === 1"
              color="primary"
              variant="tonal"
              size="small"
              prepend-icon="tabler-file-zip"
              :loading="batchDownloading"
              @click="downloadBatchZip"
            >
              {{ $t('pages.printLabelBatchUpload.batchStatus.actions.downloadZip') }}
            </VBtn>
            <VBtn
              variant="tonal"
              size="small"
              prepend-icon="tabler-list-details"
              @click="openBatchDetail"
            >
              {{ $t('pages.printLabelBatchUpload.batchStatus.actions.detail') }}
            </VBtn>
            <VBtn
              variant="tonal"
              size="small"
              prepend-icon="tabler-list"
              @click="goShippingList"
            >
              {{ $t('pages.printLabelBatchUpload.batchStatus.actions.viewOrders') }}
            </VBtn>
          </div>
        </VCardText>
      </VCard>

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

      <ShippingBatchStatusDialog
        :model-value="batchDialogOpen"
        :initial-batch-sn="batchDialogProps.initialBatchSn"
        :initial-batch-id="batchDialogProps.initialBatchId"
        :auto-open-batch-detail="batchDialogProps.autoOpenBatchDetail"
        @update:model-value="onBatchDialogUpdate"
      />
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
