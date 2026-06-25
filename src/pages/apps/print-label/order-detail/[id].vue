<script setup>
import { $api } from '@/utils/api'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'
import { resolveYundanStatus } from '@/views/apps/print-label/useYundanList'

definePage({
  meta: {
    layout: 'default',
    action: 'read',
    subject: 'AclDemo',
  },
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })

const detailLoading = ref(false)
const detailError = ref('')
const detailData = ref(null)
const snack = ref({ show: false, text: '', color: 'success' })

async function fetchOrderDetail() {
  detailLoading.value = true
  detailError.value = ''
  try {
    const body = {}
    const id = String(route.params.id || '').trim()
    const orderSn = String(route.query.orderSn || '').trim()
    if (id)
      body.id = Number(id)
    else if (orderSn)
      body['order_sn'] = orderSn
    else
      throw new Error(t('pages.printLabelOrders.messages.missingOrderIdentifier'))

    const res = await $api('/ordernew/getOrderDdDetail', {
      method: 'POST',
      body,
    })

    if (Number(res?.code) === 1 && res.data)
      detailData.value = res.data
    else
      detailError.value = res?.msg || t('pages.printLabelOrders.messages.detailLoadFailed')
  }
  catch (e) {
    detailError.value = e?.data?.msg || e?.message || t('pages.printLabelOrders.messages.networkFailed')
  }
  finally {
    detailLoading.value = false
  }
}

function backToList() {
  router.push({ name: 'apps-print-label-orders' })
}

function downloadLabelPdf() {
  const label = detailData.value?.label || {}
  const source = label.ht_pdf || label.wp_data || ''
  if (!source) {
    snack.value = { show: true, text: t('pages.printLabelOrders.messages.noLabelFile'), color: 'warning' }

    return
  }
  const filename = `${detailData.value?.['order_sn'] || 'label'}.pdf`
  const src = String(source).trim()
  if (/^https?:\/\//i.test(src)) {
    window.open(src, '_blank', 'noopener')

    return
  }
  if (/^data:/i.test(src)) {
    const a = document.createElement('a')

    a.href = src
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()

    return
  }
  if (src.startsWith('/') || /^\w+\//.test(src) || /\.(?:pdf|png|jpe?g|webp)(?:\?|#|$)/i.test(src)) {
    window.open(resolveBackendFileUrl(src), '_blank', 'noopener')

    return
  }
  const href = `data:application/pdf;base64,${src}`
  const a = document.createElement('a')

  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function resolveStatus(status) {
  return resolveYundanStatus(status, t)
}

onMounted(fetchOrderDetail)
</script>

<template>
  <VContainer
    fluid
    class="pa-4"
  >
    <VSnackbar
      v-model="snack.show"
      :color="snack.color"
      location="top"
      :timeout="2200"
    >
      {{ snack.text }}
    </VSnackbar>

    <VCard class="rounded-lg">
      <VCardItem class="px-4 pt-4 pb-2">
        <template #prepend>
          <IconBtn @click="backToList">
            <VIcon icon="tabler-arrow-left" />
          </IconBtn>
        </template>
        <template #title>
          <span class="text-h6 font-weight-medium">{{ $t('pages.printLabelOrders.detail.title') }}</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">{{ detailData?.order_sn || '—' }}</span>
        </template>
        <template #append>
          <VBtn
            variant="tonal"
            size="small"
            prepend-icon="tabler-download"
            :disabled="detailLoading || !detailData"
            @click="downloadLabelPdf"
          >
            {{ $t('pages.printLabelOrders.actions.downloadLabel') }}
          </VBtn>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4">
        <VAlert
          v-if="detailError"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          {{ detailError }}
        </VAlert>
        <VProgressLinear
          v-if="detailLoading"
          indeterminate
          color="primary"
          class="mb-4"
        />
        <template v-if="detailData && !detailLoading">
          <VCard
            variant="tonal"
            class="mb-3"
          >
            <VCardText>
              <div class="text-subtitle-2 font-weight-medium mb-2">
                {{ $t('pages.printLabelOrders.detail.basicInfo') }}
              </div>
              <div class="text-body-2 py-1">
                {{ $t('pages.printLabelOrders.detail.status') }}: {{ resolveStatus(detailData?.status).text }}
              </div>
              <div class="text-body-2 py-1">
                {{ $t('pages.printLabelOrders.detail.line') }}: {{ detailData?.transport_line || '—' }}
              </div>
              <div class="text-body-2 py-1">
                {{ $t('pages.printLabelOrders.detail.trackingNo') }}: {{ detailData?.label?.ht_tracking_no || '—' }}
              </div>
              <div class="text-body-2 py-1">
                {{ $t('pages.printLabelOrders.detail.refNo') }}: {{ detailData?.order_meta?.cankaohao || '—' }}
              </div>
            </VCardText>
          </VCard>

          <VCard
            variant="outlined"
            class="mb-3"
          >
            <VCardText>
              <div class="text-subtitle-2 font-weight-medium mb-2">
                {{ $t('pages.printLabelOrders.detail.sender') }}
              </div>
              <div class="text-body-2">
                {{ detailData?.send?.name || '—' }}
              </div>
              <div class="text-body-2 text-medium-emphasis mt-1">
                {{ detailData?.send?.country || '' }} {{ detailData?.send?.province || '' }} {{ detailData?.send?.city || '' }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ detailData?.send?.address || '—' }}
              </div>
              <div class="text-body-2 text-medium-emphasis mt-1">
                {{ detailData?.send?.telephone || '—' }}
              </div>
            </VCardText>
          </VCard>

          <VCard
            variant="outlined"
            class="mb-3"
          >
            <VCardText>
              <div class="text-subtitle-2 font-weight-medium mb-2">
                {{ $t('pages.printLabelOrders.detail.recipient') }}
              </div>
              <div class="text-body-2">
                {{ detailData?.receive?.name || '—' }}
              </div>
              <div class="text-body-2 text-medium-emphasis mt-1">
                {{ detailData?.receive?.country || '' }} {{ detailData?.receive?.province || '' }} {{ detailData?.receive?.city || '' }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ detailData?.receive?.address || '—' }}
              </div>
              <div class="text-body-2 text-medium-emphasis mt-1">
                {{ detailData?.receive?.telephone || '—' }}
              </div>
            </VCardText>
          </VCard>

          <VCard variant="outlined">
            <VCardText>
              <div class="text-subtitle-2 font-weight-medium mb-2">
                {{ $t('pages.printLabelOrders.detail.packageInfo') }}
              </div>
              <div
                v-if="!(detailData?.packages || []).length"
                class="text-body-2 text-medium-emphasis"
              >
                {{ $t('pages.printLabelOrders.empty.noPackageInfo') }}
              </div>
              <div
                v-for="(p, idx) in (detailData?.packages || [])"
                :key="idx"
                class="text-body-2 py-1"
              >
                {{ $t('pages.printLabelOrders.detail.packageNo', { index: idx + 1 }) }} {{ $t('pages.printLabelOrders.detail.packageMetrics', { weight: p.weight ?? '—', length: p.length ?? '—', width: p.width ?? '—', height: p.height ?? '—' }) }} {{ $t('pages.printLabelOrders.detail.packageDeclaration', { value: p.value ?? '—' }) }}
              </div>
            </VCardText>
          </VCard>
        </template>
      </VCardText>
    </VCard>
  </VContainer>
</template>
