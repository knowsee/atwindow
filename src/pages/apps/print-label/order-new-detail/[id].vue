<script setup>
/* eslint-disable camelcase -- Query/data field names must match backend APIs. */
import { $api } from '@/utils/api'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'

definePage({
  meta: {
    layout: 'default',
    action: 'read',
    subject: 'AclDemo',
  },
})

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n({ useScope: 'global' })

const loading = ref(false)
const errorText = ref('')
const detail = ref(null)
const snack = ref({ show: false, text: '', color: 'success' })
const dateLocale = computed(() => ({ zh: 'zh-CN', en: 'en-US', fr: 'fr-FR' })[locale.value] || undefined)

function formatTs(ts) {
  if (ts == null || ts === '')
    return '—'
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0)
    return '—'

  return new Date(n * 1000).toLocaleString(dateLocale.value, { hour12: false })
}

function statusText(status) {
  if (status && typeof status === 'object') {
    return status.description || status.text || status.name || t('pages.printLabelOrderNewDetail.statuses.unknown')
  }

  const m = {
    0: t('pages.printLabelOrderNewDetail.statuses.pending'),
    1: t('pages.printLabelOrderNewDetail.statuses.requesting'),
    2: t('pages.printLabelOrderNewDetail.statuses.success'),
    3: t('pages.printLabelOrderNewDetail.statuses.failed'),
    4: t('pages.printLabelOrderNewDetail.statuses.cancelled'),
  }

  return m[Number(status)] ?? (status == null || status === '' ? '—' : t('pages.printLabelOrderNewDetail.statuses.statusWithValue', { status }))
}

function statusColor(status) {
  const n = (status && typeof status === 'object') ? Number(status.value || status.code || status.id) : Number(status)
  if (n === 2) return 'success'
  if (n === 3) return 'error'
  if (n === 4) return 'secondary'
  if (n === 1) return 'info'

  return 'warning'
}

function formatMoney(v, currency) {
  if (v == null || v === '')
    return '—'
  const n = Number(v)
  const s = Number.isFinite(n) ? n.toFixed(2) : String(v)

  return currency ? `${s} ${currency}` : s
}

function formatDimensions(d) {
  if (!d)
    return '—'
  const l = d.length
  const w = d.width
  const h = d.height
  if (l == null && w == null && h == null)
    return '—'
  const unit = d.dim_unit ? ` ${d.dim_unit}` : ''

  return `${l ?? '—'} × ${w ?? '—'} × ${h ?? '—'}${unit}`
}

function joinAddress(snapshot) {
  if (!snapshot)
    return '—'

  const p = [
    snapshot.street,
    snapshot.address1,
    snapshot.address2,
    snapshot.city,
    snapshot.state || snapshot.province,
    snapshot.postcode,
    snapshot.country_code || snapshot.country,
  ].map(v => String(v || '').trim()).filter(Boolean)

  return p.join(', ') || '—'
}

function toLabelUrl(raw) {
  const s = String(raw ?? '').trim()
  if (!s)
    return ''
  if (/^https?:\/\//i.test(s))
    return s

  return resolveBackendFileUrl(s)
}

function buildQuery() {
  const orderId = Number(route.params.id)
  const orderSn = String(route.query.orderSn || '').trim()
  const trackingNumber = String(route.query.tracking_number || '').trim()

  if (Number.isFinite(orderId) && orderId > 0)
    return { order_id: orderId }
  if (orderSn)
    return { order_sn: orderSn }
  if (trackingNumber)
    return { tracking_number: trackingNumber }

  return null
}

async function loadDetail() {
  loading.value = true
  errorText.value = ''
  try {
    const query = buildQuery()
    if (!query) {
      errorText.value = t('pages.printLabelOrderNewDetail.messages.missingOrderIdentifier')
      
      return
    }

    const res = await $api('/Ordernewapi/shippingDetail', {
      method: 'GET',
      query,
    })

    if ((Number(res?.code) === 1 || Number(res?.code) === 200) && res?.data) {
      detail.value = {
        ...res.data,
        label_url: toLabelUrl(res.data.label_url),
      }
      
      return
    }
    detail.value = null
    errorText.value = res?.message || res?.msg || t('pages.printLabelOrderNewDetail.messages.detailLoadFailed')
  }
  catch (e) {
    detail.value = null
    errorText.value = e?.data?.message || e?.data?.msg || e?.message || t('pages.printLabelOrderNewDetail.messages.networkFailed')
  }
  finally {
    loading.value = false
  }
}

function backToList() {
  router.push({ name: 'apps-print-label-shipping-list' })
}

function openLabel() {
  const url = detail.value?.label_url
  if (!url)
    return
  window.open(url, '_blank', 'noopener')
}

async function copyToClipboard(text, label = t('pages.printLabelOrderNewDetail.copyLabels.content')) {
  if (!text)
    return
  try {
    await navigator.clipboard.writeText(String(text))
    snack.value = { show: true, text: t('pages.printLabelOrderNewDetail.messages.copySuccess', { label }), color: 'success' }
  }
  catch {
    snack.value = { show: true, text: t('pages.printLabelOrderNewDetail.messages.copyFailed', { label }), color: 'error' }
  }
}

onMounted(loadDetail)
</script>

<template>
  <VContainer
    fluid
    class="print-label-create pa-0"
  >
    <div class="print-label-create__inner pb-12">
      <VSnackbar
        v-model="snack.show"
        :color="snack.color"
        location="top"
        :timeout="2200"
      >
        {{ snack.text }}
      </VSnackbar>

      <div class="print-label-create__hero mb-6 d-flex align-center justify-space-between flex-wrap gap-3">
        <div>
          <h1 class="text-h4 font-weight-bold text-high-emphasis d-flex align-center gap-2">
            {{ $t('pages.printLabelOrderNewDetail.title') }}
            <VChip
              size="small"
              color="primary"
              variant="tonal"
            >
              {{ $t('pages.printLabelOrderNewDetail.readonly') }}
            </VChip>
          </h1>
          <p class="text-body-2 text-medium-emphasis mb-0 mt-1">
            {{ $t('pages.printLabelOrderNewDetail.subtitle') }}
          </p>
        </div>
        <div class="d-flex gap-2">
          <VBtn
            variant="tonal"
            prepend-icon="tabler-arrow-left"
            @click="backToList"
          >
            {{ $t('pages.printLabelOrderNewDetail.actions.backToList') }}
          </VBtn>
          <VBtn
            color="primary"
            prepend-icon="tabler-printer"
            :disabled="!detail?.label_url"
            @click="openLabel"
          >
            {{ $t('pages.printLabelOrderNewDetail.actions.printLabel') }}
          </VBtn>
        </div>
      </div>

      <VAlert
        v-if="errorText"
        type="error"
        variant="tonal"
        density="compact"
        class="mb-4"
        icon="tabler-alert-circle"
      >
        {{ errorText }}
      </VAlert>

      <VProgressLinear
        v-if="loading"
        indeterminate
        color="primary"
        class="mb-4"
      />

      <template v-if="detail && !loading">
        <VAlert
          v-if="Number(detail.cancel_status) === 1"
          type="warning"
          variant="tonal"
          border="start"
          class="mb-4"
          icon="tabler-alert-triangle"
        >
          <div class="font-weight-bold mb-1">
            {{ $t('pages.printLabelOrderNewDetail.alerts.cancellingTitle') }}
          </div>
          {{ $t('pages.printLabelOrderNewDetail.alerts.cancellingBody') }}
        </VAlert>

        <VRow>
          <VCol
            cols="12"
            md="8"
          >
            <VCard
              class="mb-4"
              elevation="0"
              border
            >
              <VCardText class="pa-5">
                <div class="d-flex flex-column flex-sm-row justify-space-between align-start">
                  <div>
                    <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase tracking-widest mb-1">
                      {{ $t('pages.printLabelOrderNewDetail.labels.trackingNumber') }}
                    </div>
                    <div class="d-flex align-center flex-wrap gap-2 mb-2">
                      <span class="text-h4 font-weight-black text-high-emphasis">
                        {{ detail.tracking_number || '—' }}
                      </span>
                      <VBtn
                        v-if="detail.tracking_number"
                        icon="tabler-copy"
                        variant="text"
                        color="primary"
                        size="small"
                        @click="copyToClipboard(detail.tracking_number, $t('pages.printLabelOrderNewDetail.copyLabels.trackingNumber'))"
                      />
                    </div>
                  </div>
                  <div class="mt-4 mt-sm-0 text-sm-right">
                    <VChip
                      :color="statusColor(detail.status)"
                      size="large"
                      class="font-weight-bold text-subtitle-1 px-4 mb-2"
                      variant="elevated"
                    >
                      {{ statusText(detail.status) }}
                    </VChip>
                  </div>
                </div>
                
                <div class="mt-2 pa-3 rounded bg-var-theme-background border border-dashed">
                  <div class="text-caption text-medium-emphasis mb-1">
                    {{ $t('pages.printLabelOrderNewDetail.labels.statusDescription') }}
                  </div>
                  <div class="text-body-1 font-weight-medium text-high-emphasis">
                    {{ (typeof detail.status === 'object' ? detail.status.description : detail.status_description) || statusText(detail.status) }}
                  </div>
                </div>

                <VDivider class="my-5" />

                <VRow dense>
                  <VCol
                    cols="12"
                    sm="3"
                  >
                    <div class="text-caption text-medium-emphasis mb-1">
                      {{ $t('pages.printLabelOrderNewDetail.labels.channelName') }}
                    </div>
                    <div class="text-body-1 font-weight-medium">
                      {{ detail.channel_name || '—' }}
                    </div>
                  </VCol>
                  <VCol
                    cols="12"
                    sm="3"
                  >
                    <div class="text-caption text-medium-emphasis mb-1">
                      {{ $t('pages.printLabelOrderNewDetail.labels.customerRef') }}
                    </div>
                    <div class="text-body-1 font-weight-medium">
                      {{ detail.cankaohao || '—' }}
                    </div>
                  </VCol>
                  <VCol
                    cols="12"
                    sm="3"
                  >
                    <div class="text-caption text-medium-emphasis mb-1">
                      {{ $t('pages.printLabelOrderNewDetail.labels.orderSn') }}
                    </div>
                    <div class="text-body-1 font-weight-medium d-flex align-center gap-1">
                      {{ detail.order_sn || '—' }}
                      <VBtn
                        v-if="detail.order_sn"
                        icon="tabler-copy"
                        variant="text"
                        size="x-small"
                        color="secondary"
                        @click="copyToClipboard(detail.order_sn, $t('pages.printLabelOrderNewDetail.copyLabels.orderSn'))"
                      />
                    </div>
                  </VCol>
                  <VCol
                    cols="12"
                    sm="3"
                  >
                    <div class="text-caption text-medium-emphasis mb-1">
                      {{ $t('pages.printLabelOrderNewDetail.labels.deductionStatus') }}
                    </div>
                    <div class="mt-1">
                      <VChip
                        size="small"
                        :color="Number(detail.is_deducted) === 1 ? 'success' : 'warning'"
                        variant="tonal"
                      >
                        <template #prepend>
                          <VIcon
                            :icon="Number(detail.is_deducted) === 1 ? 'tabler-check' : 'tabler-clock'"
                            start
                          />
                        </template>
                        {{ Number(detail.is_deducted) === 1 ? $t('pages.printLabelOrderNewDetail.statuses.deducted') : $t('pages.printLabelOrderNewDetail.statuses.notDeducted') }}
                      </VChip>
                    </div>
                  </VCol>
                </VRow>
              </VCardText>
            </VCard>

            <VAlert
              v-if="detail.fail_reason && Number(detail.status) !== 1"
              type="error"
              variant="tonal"
              border="start"
              class="mb-4"
              icon="tabler-message-report"
            >
              <div class="text-subtitle-2 font-weight-bold mb-1">
                {{ $t('pages.printLabelOrderNewDetail.labels.failReason') }}
              </div>
              <div class="text-body-2">
                {{ detail.fail_reason }}
              </div>
            </VAlert>

            <VCard
              class="mb-4"
              elevation="0"
              border
            >
              <VCardTitle class="px-5 pt-5 pb-3 text-subtitle-1 font-weight-bold d-flex align-center gap-2">
                <VIcon
                  icon="tabler-map-2"
                  size="20"
                  color="primary"
                />
                {{ $t('pages.printLabelOrderNewDetail.labels.addresses') }}
              </VCardTitle>
              <VCardText class="px-5 pb-5 pt-0">
                <div class="d-flex flex-column flex-md-row gap-4 align-md-stretch">
                  <div class="flex-grow-1 address-box rounded pa-4">
                    <div class="d-flex align-center mb-4">
                      <VAvatar
                        color="secondary"
                        variant="tonal"
                        rounded
                        size="40"
                        class="mr-3"
                      >
                        <VIcon
                          icon="tabler-package-export"
                          size="24"
                        />
                      </VAvatar>
                      <div>
                        <div class="text-subtitle-2 font-weight-bold text-high-emphasis">
                          {{ $t('pages.printLabelOrderNewDetail.labels.sender') }}
                        </div>
                      </div>
                    </div>
                    <div class="text-body-1 font-weight-bold mb-1">
                      {{ detail.sender_snapshot?.name || '—' }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis mb-2 d-flex align-center gap-1">
                      <VIcon
                        icon="tabler-phone"
                        size="16"
                      />
                      {{ detail.sender_snapshot?.telephone || '—' }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis d-flex align-start gap-1">
                      <VIcon
                        icon="tabler-map-pin"
                        size="16"
                        class="mt-1"
                      />
                      <span>{{ joinAddress(detail.sender_snapshot) }}</span>
                    </div>
                  </div>

                  <div class="d-flex align-center justify-center py-2 py-md-0">
                    <div class="arrow-divider rounded-circle d-flex align-center justify-center pa-2">
                      <VIcon
                        icon="tabler-plane-tilt"
                        size="24"
                        color="disabled"
                        class="d-none d-md-block"
                      />
                      <VIcon
                        icon="tabler-arrow-down"
                        size="24"
                        color="disabled"
                        class="d-md-none"
                      />
                    </div>
                  </div>

                  <div class="flex-grow-1 address-box rounded pa-4">
                    <div class="d-flex align-center mb-4">
                      <VAvatar
                        color="primary"
                        variant="tonal"
                        rounded
                        size="40"
                        class="mr-3"
                      >
                        <VIcon
                          icon="tabler-package-import"
                          size="24"
                        />
                      </VAvatar>
                      <div>
                        <div class="text-subtitle-2 font-weight-bold text-high-emphasis">
                          {{ $t('pages.printLabelOrderNewDetail.labels.recipient') }}
                        </div>
                      </div>
                    </div>
                    <div class="text-body-1 font-weight-bold mb-1">
                      {{ detail.recipient_snapshot?.name || '—' }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis mb-2 d-flex align-center gap-1">
                      <VIcon
                        icon="tabler-phone"
                        size="16"
                      />
                      {{ detail.recipient_snapshot?.telephone || '—' }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis d-flex align-start gap-1">
                      <VIcon
                        icon="tabler-map-pin"
                        size="16"
                        class="mt-1"
                      />
                      <span>{{ joinAddress(detail.recipient_snapshot) }}</span>
                    </div>
                  </div>
                </div>
              </VCardText>
            </VCard>

            <VCard
              class="mb-4"
              elevation="0"
              border
            >
              <VCardTitle class="px-5 pt-5 pb-3 text-subtitle-1 font-weight-bold d-flex align-center gap-2">
                <VIcon
                  icon="tabler-box"
                  size="20"
                  color="primary"
                />
                {{ $t('pages.printLabelOrderNewDetail.labels.packageSpecs') }}
              </VCardTitle>
              <VCardText class="px-5 pb-5 pt-0">
                <VRow dense>
                  <VCol
                    cols="6"
                    sm="3"
                  >
                    <div class="text-caption text-medium-emphasis mb-1">
                      {{ $t('pages.printLabelOrderNewDetail.labels.weight') }}
                    </div>
                    <div class="text-body-1 font-weight-medium">
                      {{ detail.weight != null ? `${detail.weight} ${detail.weight_unit || ''}`.trim() : '—' }}
                    </div>
                  </VCol>
                  <VCol
                    cols="6"
                    sm="3"
                  >
                    <div class="text-caption text-medium-emphasis mb-1">
                      {{ $t('pages.printLabelOrderNewDetail.labels.dimensions') }}
                    </div>
                    <div class="text-body-1 font-weight-medium">
                      {{ formatDimensions(detail) }}
                    </div>
                  </VCol>
                  <VCol
                    cols="6"
                    sm="3"
                  >
                    <div class="text-caption text-medium-emphasis mb-1">
                      {{ $t('pages.printLabelOrderNewDetail.labels.declaredValue') }}
                    </div>
                    <div class="text-body-1 font-weight-medium">
                      {{ detail.declared_value != null ? formatMoney(detail.declared_value, detail.currency) : '—' }}
                    </div>
                  </VCol>
                </VRow>
              </VCardText>
            </VCard>

            <VCard
              v-if="detail.sku_items && detail.sku_items.length"
              class="mb-4"
              elevation="0"
              border
            >
              <VCardTitle class="px-5 pt-5 pb-3 text-subtitle-1 font-weight-bold d-flex align-center gap-2">
                <VIcon
                  icon="tabler-package"
                  size="20"
                  color="primary"
                />
                {{ $t('pages.printLabelOrderNewDetail.labels.packageContents') }}
              </VCardTitle>
              <VCardText class="px-5 pb-5 pt-0">
                <VTable density="compact">
                  <thead>
                    <tr>
                      <th class="text-caption font-weight-bold text-medium-emphasis">
                        {{ $t('pages.printLabelOrderNewDetail.labels.skuCode') }}
                      </th>
                      <th class="text-caption font-weight-bold text-medium-emphasis">
                        {{ $t('pages.printLabelOrderNewDetail.labels.skuCnName') }}
                      </th>
                      <th class="text-caption font-weight-bold text-medium-emphasis">
                        {{ $t('pages.printLabelOrderNewDetail.labels.skuEnName') }}
                      </th>
                      <th class="text-caption font-weight-bold text-medium-emphasis text-right">
                        {{ $t('pages.printLabelOrderNewDetail.labels.skuQty') }}
                      </th>
                      <th class="text-caption font-weight-bold text-medium-emphasis text-right">
                        {{ $t('pages.printLabelOrderNewDetail.labels.skuValue') }}
                      </th>
                      <th class="text-caption font-weight-bold text-medium-emphasis text-right">
                        {{ $t('pages.printLabelOrderNewDetail.labels.skuWeight') }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(item, idx) in detail.sku_items"
                      :key="idx"
                    >
                      <td class="text-body-2 font-weight-medium">
                        {{ item.sku || '—' }}
                      </td>
                      <td class="text-body-2">
                        {{ item.cn_name || '—' }}
                      </td>
                      <td class="text-body-2">
                        {{ item.en_name || '—' }}
                      </td>
                      <td class="text-body-2 text-right">
                        {{ item.qty ?? '—' }}
                      </td>
                      <td class="text-body-2 text-right">
                        {{ item.value != null ? formatMoney(item.value, detail.currency) : '—' }}
                      </td>
                      <td class="text-body-2 text-right">
                        {{ item.weight != null ? `${item.weight} kg` : '—' }}
                      </td>
                    </tr>
                  </tbody>
                </VTable>
              </VCardText>
            </VCard>
          </VCol>

          <VCol
            cols="12"
            md="4"
          >
            <VCard
              class="mb-4"
              elevation="0"
              border
            >
              <VCardTitle class="px-5 pt-5 pb-3 text-subtitle-1 font-weight-bold d-flex align-center gap-2">
                <VIcon
                  icon="tabler-clock"
                  size="20"
                  color="primary"
                />
                {{ $t('pages.printLabelOrderNewDetail.labels.timeline') }}
              </VCardTitle>
              <VCardText class="px-5 pb-5 pt-2">
                <VTimeline
                  density="compact"
                  align="start"
                  truncate-line="both"
                  class="timeline-custom"
                >
                  <VTimelineItem
                    v-if="detail.createtime"
                    dot-color="primary"
                    size="small"
                  >
                    <div class="d-flex flex-column">
                      <span class="text-body-2 font-weight-bold">{{ $t('pages.printLabelOrderNewDetail.labels.orderCreated') }}</span>
                      <span class="text-caption text-medium-emphasis mt-1">{{ formatTs(detail.createtime) }}</span>
                    </div>
                  </VTimelineItem>
                  
                  <VTimelineItem
                    v-if="detail.updatetime"
                    dot-color="info"
                    size="small"
                  >
                    <div class="d-flex flex-column">
                      <span class="text-body-2 font-weight-bold">{{ $t('pages.printLabelOrderNewDetail.labels.dataUpdated') }}</span>
                      <span class="text-caption text-medium-emphasis mt-1">{{ formatTs(detail.updatetime) }}</span>
                    </div>
                  </VTimelineItem>
                  
                  <VTimelineItem
                    v-if="detail.print_time"
                    dot-color="success"
                    size="small"
                  >
                    <div class="d-flex flex-column">
                      <span class="text-body-2 font-weight-bold">{{ $t('pages.printLabelOrderNewDetail.labels.labelPrinted') }}</span>
                      <span class="text-caption text-medium-emphasis mt-1">{{ formatTs(detail.print_time) }}</span>
                    </div>
                  </VTimelineItem>
                  
                  <VTimelineItem
                    v-if="detail.cancel_time"
                    dot-color="error"
                    size="small"
                  >
                    <div class="d-flex flex-column">
                      <span class="text-body-2 font-weight-bold">{{ $t('pages.printLabelOrderNewDetail.labels.orderCancelled') }}</span>
                      <span class="text-caption text-medium-emphasis mt-1">{{ formatTs(detail.cancel_time) }}</span>
                    </div>
                  </VTimelineItem>
                </VTimeline>
              </VCardText>
            </VCard>

            <VCard
              class="mb-4"
              elevation="0"
              border
            >
              <VCardTitle class="px-5 pt-5 pb-3 text-subtitle-1 font-weight-bold d-flex align-center gap-2">
                <VIcon
                  icon="tabler-coin"
                  size="20"
                  color="warning"
                />
                {{ $t('pages.printLabelOrderNewDetail.labels.fees') }}
              </VCardTitle>
              <VCardText class="px-5 pb-5 pt-0">
                <div class="d-flex justify-space-between align-center mb-3">
                  <span class="text-body-2 text-medium-emphasis">{{ $t('pages.printLabelOrderNewDetail.labels.customerFee') }}</span>
                  <span class="text-h6 font-weight-black text-primary">{{ formatMoney(detail.customer_fee, detail.currency) }}</span>
                </div>
              </VCardText>
            </VCard>
          </VCol>
        </VRow>
      </template>
    </div>
  </VContainer>
</template>

<style scoped>
.print-label-create__inner {
  inline-size: 100%;
  max-inline-size: 100%;
  padding-inline: 0.75rem;
}

@media (min-width: 600px) {
  .print-label-create__inner {
    padding-inline: 1rem;
  }
}

@media (min-width: 1264px) {
  .print-label-create__inner {
    padding-inline: 1.25rem;
  }
}

.bg-var-theme-background {
  background-color: rgba(var(--v-theme-on-surface), 0.03);
}

.address-box {
  background-color: rgba(var(--v-theme-on-surface), 0.02);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  transition: all 0.2s ease-in-out;
}

.address-box:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.arrow-divider {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.tracking-widest {
  letter-spacing: 0.05em !important;
}

.timeline-custom :deep(.v-timeline-item__body) {
  padding-block-start: 0 !important;
}
</style>
