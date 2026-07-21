<script setup>
import { $api } from '@/utils/api'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'
import {
  formatTotalWeight,
  formatYundanShippingFee,
  resolveYundanStatus,
  useYundanList,
} from '@/views/apps/print-label/useYundanList'
import { useDisplay } from 'vuetify'

definePage({
  meta: {
    layout: 'default',
    action: 'read',
    subject: 'AclDemo',
  },
})

const {
  items,
  total,
  loading,
  page,
  itemsPerPage,
  loadList,
  loadError,
  filterStatus,
  filterType,
  filterCankaohao,
  filterRecipientName,
  filterCreateRange,
  statusFilterItems,
  channelTypeItems,
  searchOrders,
  resetFilters,
} = useYundanList()

const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const { platform } = useDisplay()

const isMobileDevice = computed(() => {
  const p = platform.value || {}

  return Boolean(p.android || p.ios)
})

const { copy, isSupported } = useClipboard()

const snack = ref({ show: false, text: '', color: 'success' })
const detailDialog = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const detailData = ref(null)

function clearLoadError() {
  loadError.value = ''
}

const headers = computed(() => [
  { title: t('pages.printLabelOrders.headers.createdAt'), key: 'createtime', minWidth: '158' },
  { title: t('pages.printLabelOrders.headers.orderNo'), key: 'order_sn', minWidth: '200' },
  { title: t('pages.printLabelOrders.headers.refNo'), key: 'cankaohao', minWidth: '140' },
  { title: t('pages.printLabelOrders.headers.line'), key: 'transport_line', minWidth: '140' },
  { title: t('pages.printLabelOrders.headers.trackingNo'), key: 'ht_tracking_no', minWidth: '180' },
  { title: t('pages.printLabelOrders.headers.skuQty'), key: 'sku_line', sortable: false, minWidth: '120' },
  { title: t('pages.printLabelOrders.headers.totalWeight'), key: 'total_weight', minWidth: '80' },
  { title: t('pages.printLabelOrders.headers.shippingFee'), key: 'shipping_fee', minWidth: '88' },
  { title: t('pages.printLabelOrders.headers.errorInfo'), key: 'error_message', sortable: false, minWidth: '160' },
  { title: t('pages.printLabelOrders.headers.status'), key: 'status', minWidth: '100' },
  { title: t('pages.printLabelOrders.headers.actions'), key: 'actions', sortable: false, align: 'end', width: '72', fixed: 'end' },
])

const pageLength = computed(() => {
  const ipp = itemsPerPage.value
  if (ipp <= 0)
    return 1

  return Math.max(1, Math.ceil(total.value / ipp))
})

async function copyTracking(no) {
  const s = (no && String(no).trim()) || ''
  if (!s) {
    snack.value = { show: true, text: t('pages.printLabelOrders.messages.noTracking'), color: 'warning' }

    return
  }
  try {
    if (isSupported.value)
      await copy(s)
    else
      await navigator.clipboard.writeText(s)
    snack.value = { show: true, text: t('pages.printLabelOrders.messages.trackingCopied'), color: 'success' }
  }
  catch {
    snack.value = { show: true, text: t('pages.printLabelOrders.messages.copyFailed'), color: 'error' }
  }
}

async function fetchOrderDetail({ id, orderSn }) {
  detailLoading.value = true
  detailError.value = ''
  try {
    const body = {}
    if (id != null)
      body.id = id
    else if (orderSn)
      body['order_sn'] = orderSn
    else
      throw new Error(t('pages.printLabelOrders.messages.missingOrderIdentifier'))

    const res = await $api('/ordernew/getOrderDdDetail', {
      method: 'POST',
      body,
    })

    if (Number(res?.code) === 1 && res.data) {
      detailData.value = res.data
    }
    else {
      detailData.value = null
      detailError.value = res?.msg || t('pages.printLabelOrders.messages.detailLoadFailed')
    }
  }
  catch (e) {
    detailData.value = null
    detailError.value = e?.data?.msg || e?.message || t('pages.printLabelOrders.messages.networkFailed')
  }
  finally {
    detailLoading.value = false
  }
}

function openDetailByRow(row) {
  if (isMobileDevice.value) {
    router.push({
      name: 'apps-print-label-order-detail-id',
      params: { id: String(row?.id ?? '') },
      query: row?.['order_sn'] ? { orderSn: String(row['order_sn']) } : undefined,
    })

    return
  }
  detailDialog.value = true
  fetchOrderDetail({ id: row?.id, orderSn: row?.['order_sn'] })
}

async function downloadLabelByRow(row) {
  await fetchOrderDetail({ id: row?.id, orderSn: row?.['order_sn'] })
  if (!detailError.value)
    downloadLabelPdf()
}

function closeDetailDialog() {
  detailDialog.value = false
  detailError.value = ''
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

function formatRegion(addr) {
  if (!addr)
    return '—'

  return [addr.country, addr.province, addr.city].filter(Boolean).join(' ') || '—'
}

function formatStreet(addr) {
  if (!addr)
    return '—'

  return [addr.address, addr.address2].filter(Boolean).join(' ') || '—'
}

function resolveStatus(status) {
  return resolveYundanStatus(status, t)
}
</script>

<template>
  <VSnackbar
    v-model="snack.show"
    :color="snack.color"
    location="top"
    :timeout="2200"
  >
    {{ snack.text }}
  </VSnackbar>

  <VRow>
    <VCol cols="12">
      <VCard class="rounded-lg">
        <VCardItem class="pb-3">
          <template #title>
            <span class="text-h5 font-weight-medium">{{ $t('pages.printLabelOrders.title') }}</span>
          </template>
          <template #subtitle>
            <span class="text-body-2 text-medium-emphasis">{{ $t('pages.printLabelOrders.subtitle') }}</span>
          </template>
          <template #append>
            <div class="d-flex flex-wrap gap-2 justify-end">
              <VBtn
                color="primary"
                size="small"
                prepend-icon="tabler-plus"
                :to="{ name: 'apps-print-label-create' }"
              >
                {{ $t('pages.printLabelOrders.actions.create') }}
              </VBtn>
            </div>
          </template>
        </VCardItem>

        <VDivider />

        <VCardText class="pa-4 pa-sm-6 pt-4">
          <VAlert
            type="warning"
            variant="tonal"
            border="start"
            density="comfortable"
            prominent
            class="mb-4"
            prepend-icon="tabler-alert-triangle"
          >
            <div class="text-body-2">
              {{ $t('pages.printLabelOrders.legacyNotice') }}
            </div>
          </VAlert>

          <VAlert
            v-if="loadError"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-4"
            closable
            @click:close="clearLoadError"
          >
            {{ loadError }}
          </VAlert>

          <AppQueryPanel
            class="mb-4"
            :loading="loading"
            actions-position="bottom"
            @search="searchOrders"
            @reset="resetFilters"
          >
            <VRow dense>
              <VCol
                cols="12"
                sm="6"
                lg="3"
              >
                <AppSelect
                  v-model="filterStatus"
                  :items="statusFilterItems"
                  item-title="title"
                  item-value="value"
                  :label="$t('pages.printLabelOrders.filters.status')"
                  density="compact"
                  hide-details
                />
              </VCol>
              <VCol
                cols="12"
                sm="6"
                lg="3"
              >
                <AppSelect
                  v-model="filterType"
                  :items="channelTypeItems"
                  item-title="title"
                  item-value="value"
                  :label="$t('pages.printLabelOrders.filters.channel')"
                  density="compact"
                  hide-details
                />
              </VCol>
              <VCol
                cols="12"
                sm="6"
                lg="3"
              >
                <AppTextField
                  v-model="filterRecipientName"
                  :label="$t('pages.printLabelOrders.filters.recipient')"
                  density="compact"
                  hide-details
                  :placeholder="$t('pages.printLabelOrders.filters.recipientPlaceholder')"
                  @keyup.enter="searchOrders"
                />
              </VCol>
              <VCol
                cols="12"
                sm="6"
                lg="3"
              >
                <AppDateTimePicker
                  v-model="filterCreateRange"
                  :label="$t('pages.printLabelOrders.filters.createdAt')"
                  density="compact"
                  hide-details
                  :placeholder="$t('pages.printLabelOrders.filters.dateRange')"
                  :config="{ mode: 'range', dateFormat: 'Y-m-d' }"
                  @keyup.enter="searchOrders"
                />
              </VCol>
              <VCol cols="12">
                <AppTextarea
                  v-model="filterCankaohao"
                  :label="$t('pages.printLabelOrders.filters.refNoMultiline')"
                  density="compact"
                  rows="2"
                  variant="outlined"
                  hide-details
                  :placeholder="$t('pages.printLabelOrders.filters.refNoPerLine')"
                  class="order-dd-filter-ref"
                />
              </VCol>
            </VRow>
          </AppQueryPanel>

          <VDataTableServer
            disable-sort
            v-model:items-per-page="itemsPerPage"
            v-model:page="page"
            :headers="headers"
            :items="items"
            :items-length="total"
            :loading="loading"
            :loading-text="$t('pages.printLabelOrders.empty.loading')"
            item-value="id"
            density="comfortable"
            class="text-body-2 yundan-list-table"
            fixed-header
            :height="520"
            :items-per-page-options="[
              { value: 10, title: '10' },
              { value: 20, title: '20' },
              { value: 50, title: '50' },
            ]"
          >
            <template #item.order_sn="{ item }">
              <button
                type="button"
                class="order-dd-link text-high-emphasis font-weight-medium text-truncate d-inline-block"
                style="max-inline-size: 220px;"
                :title="item.order_sn"
                @click="openDetailByRow(item)"
              >
                {{ item.order_sn }}
              </button>
            </template>

            <template #item.cankaohao="{ item }">
              <span
                class="text-truncate d-inline-block"
                style="max-inline-size: 160px;"
                :title="item.cankaohao"
              >{{ item.cankaohao || '—' }}</span>
            </template>

            <template #item.transport_line="{ item }">
              <span
                class="text-truncate d-inline-block"
                style="max-inline-size: 200px;"
                :title="item.transport_line"
              >{{ item.transport_line || '—' }}</span>
            </template>

            <template #item.ht_tracking_no="{ item }">
              <div class="d-flex align-center gap-1">
                <span
                  class="text-truncate"
                  style="max-inline-size: 200px;"
                  :title="item.ht_tracking_no"
                >{{ item.ht_tracking_no || '—' }}</span>
                <IconBtn
                  v-if="item.ht_tracking_no"
                  size="small"
                  :aria-label="$t('pages.printLabelOrders.aria.copyTracking')"
                  @click="copyTracking(item.ht_tracking_no)"
                >
                  <VIcon
                    icon="tabler-copy"
                    size="18"
                  />
                </IconBtn>
              </div>
            </template>

            <template #item.sku_line="{ item }">
              <span class="text-medium-emphasis">
                <template v-if="item.sku || item.sku_num">
                  {{ item.sku || '—' }} / {{ item.sku_num || '—' }}
                </template>
                <template v-else>
                  —
                </template>
              </span>
            </template>

            <template #item.total_weight="{ item }">
              {{ formatTotalWeight(item.total_weight) }}
            </template>

            <template #item.shipping_fee="{ item }">
              {{ formatYundanShippingFee(item.shipping_fee) }}
            </template>

            <template #item.error_message="{ item }">
              <span
                v-if="item.error_message"
                class="text-error text-truncate d-inline-block"
                style="max-inline-size: 220px;"
                :title="String(item.error_message)"
              >{{ item.error_message }}</span>
              <span
                v-else
                class="text-disabled"
              >—</span>
            </template>

            <template #item.status="{ item }">
              <VChip
                :color="resolveStatus(item.status).color"
                label
                size="small"
                class="font-weight-medium"
              >
                {{ resolveStatus(item.status).text }}
              </VChip>
            </template>

            <template #item.actions="{ item }">
              <div class="d-flex align-center justify-end gap-1">
                <VTooltip :text="$t('pages.printLabelOrders.tooltips.detail')">
                  <template #activator="{ props }">
                    <IconBtn
                      v-bind="props"
                      size="small"
                      color="primary"
                      @click="openDetailByRow(item)"
                    >
                      <VIcon
                        icon="tabler-eye"
                        size="20"
                      />
                    </IconBtn>
                  </template>
                </VTooltip>
                <VTooltip :text="$t('pages.printLabelOrders.tooltips.downloadLabel')">
                  <template #activator="{ props }">
                    <IconBtn
                      v-bind="props"
                      size="small"
                      color="secondary"
                      @click="downloadLabelByRow(item)"
                    >
                      <VIcon
                        icon="tabler-download"
                        size="20"
                      />
                    </IconBtn>
                  </template>
                </VTooltip>
              </div>
            </template>

            <template #no-data>
              <div class="text-center text-medium-emphasis py-12">
                {{ $t('pages.printLabelOrders.empty.noOrderData') }}
              </div>
            </template>

            <template #bottom>
              <VDivider />
              <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-6 py-4">
                <div class="text-body-2 text-medium-emphasis">
                  {{ $t('pages.printLabelOrders.pagination.total', { total }) }}
                </div>
                <div class="d-flex align-center gap-3">
                  <AppSelect
                    v-model="itemsPerPage"
                    :items="[10, 20, 50, 100]"
                    density="compact"
                    hide-details
                    style="inline-size: 100px"
                  />
                  <VPagination
                    v-model="page"
                    :length="pageLength"
                    :total-visible="5"
                    active-color="primary"
                    size="small"
                  />
                </div>
              </div>
            </template>
          </VDataTableServer>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>

  <VDialog
    v-model="detailDialog"
    max-width="980"
    scrollable
  >
    <VCard class="rounded-lg order-detail-dialog">
      <VCardItem class="px-6 pt-5 pb-3">
        <template #title>
          <span class="text-h6 font-weight-medium">{{ $t('pages.printLabelOrders.detail.title') }}</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">{{ $t('pages.printLabelOrders.detail.orderNo', { orderNo: detailData?.order_sn || '—' }) }}</span>
        </template>
        <template #append>
          <div class="d-flex align-center gap-2">
            <VBtn
              variant="tonal"
              size="small"
              prepend-icon="tabler-download"
              :disabled="detailLoading || !detailData"
              @click="downloadLabelPdf"
            >
              {{ $t('pages.printLabelOrders.actions.downloadLabel') }}
            </VBtn>
            <IconBtn @click="closeDetailDialog">
              <VIcon icon="tabler-x" />
            </IconBtn>
          </div>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4 pa-sm-6">
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
          <VSheet
            rounded="lg"
            class="order-detail-hero pa-4 pa-sm-5 mb-4"
          >
            <div class="d-flex flex-wrap align-center justify-space-between gap-3">
              <div class="min-w-0">
                <div class="text-caption text-medium-emphasis mb-1">
                  {{ $t('pages.printLabelOrders.detail.refNo') }}
                </div>
                <div
                  class="text-h5 font-weight-bold text-high-emphasis text-truncate"
                  :title="detailData?.order_meta?.cankaohao || '—'"
                >
                  {{ detailData?.order_meta?.cankaohao || '—' }}
                </div>
                <div class="text-body-2 text-medium-emphasis mt-1">
                  {{ $t('pages.printLabelOrders.detail.createdAt', { time: detailData?.order_meta?.createtime_text || '—' }) }}
                </div>
              </div>
              <div class="d-flex flex-wrap justify-end gap-2">
                <VChip
                  color="primary"
                  variant="tonal"
                  label
                  size="small"
                >
                  {{ resolveStatus(detailData?.status).text }}
                </VChip>
                <VChip
                  color="secondary"
                  variant="tonal"
                  label
                  size="small"
                >
                  {{ detailData?.transport_line || '—' }}
                </VChip>
              </div>
            </div>
          </VSheet>

          <VRow class="mt-1">
            <VCol cols="12">
              <VSheet
                border
                rounded="lg"
                class="pa-3 pa-sm-4"
              >
                <div class="order-detail-kpis">
                  <div class="order-detail-kpi">
                    <div class="order-detail-kpi__label">
                      {{ $t('pages.printLabelOrders.detail.status') }}
                    </div>
                    <div class="order-detail-kpi__value">
                      {{ resolveStatus(detailData?.status).text }}
                    </div>
                  </div>
                  <div class="order-detail-kpi">
                    <div class="order-detail-kpi__label">
                      {{ $t('pages.printLabelOrders.detail.line') }}
                    </div>
                    <div
                      class="order-detail-kpi__value text-truncate"
                      :title="detailData?.transport_line || '—'"
                    >
                      {{ detailData?.transport_line || '—' }}
                    </div>
                  </div>
                  <div class="order-detail-kpi">
                    <div class="order-detail-kpi__label">
                      {{ $t('pages.printLabelOrders.detail.shippingFee') }}
                    </div>
                    <div class="order-detail-kpi__value">
                      {{ detailData?.price?.shipping_fee ?? '—' }}
                    </div>
                  </div>
                  <div class="order-detail-kpi">
                    <div class="order-detail-kpi__label">
                      {{ $t('pages.printLabelOrders.detail.trackingNo') }}
                    </div>
                    <div
                      class="order-detail-kpi__value text-truncate"
                      :title="detailData?.label?.ht_tracking_no || '—'"
                    >
                      {{ detailData?.label?.ht_tracking_no || '—' }}
                    </div>
                  </div>
                </div>
              </VSheet>
            </VCol>
          </VRow>

          <div class="order-detail-bottom-grid mt-4">
            <VCard
              variant="outlined"
              class="h-100"
            >
              <VCardText>
                <div class="text-subtitle-2 font-weight-medium mb-3 d-flex align-center gap-2">
                  <VIcon
                    icon="tabler-send"
                    size="18"
                  />
                  {{ $t('pages.printLabelOrders.detail.sender') }}
                </div>
                <div class="text-body-1 font-weight-medium">
                  {{ detailData?.send?.name || '—' }}
                </div>
                <div class="text-body-2 text-medium-emphasis mt-1">
                  {{ formatRegion(detailData?.send) }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ formatStreet(detailData?.send) }}
                </div>
                <div class="text-body-2 text-medium-emphasis mt-2">
                  {{ detailData?.send?.telephone || '—' }}
                </div>
              </VCardText>
            </VCard>

            <VCard
              variant="outlined"
              class="h-100"
            >
              <VCardText>
                <div class="text-subtitle-2 font-weight-medium mb-3 d-flex align-center gap-2">
                  <VIcon
                    icon="tabler-package-export"
                    size="18"
                  />
                  {{ $t('pages.printLabelOrders.detail.recipient') }}
                </div>
                <div class="text-body-1 font-weight-medium">
                  {{ detailData?.receive?.name || '—' }}
                </div>
                <div class="text-body-2 text-medium-emphasis mt-1">
                  {{ formatRegion(detailData?.receive) }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ formatStreet(detailData?.receive) }}
                </div>
                <div class="text-body-2 text-medium-emphasis mt-2">
                  {{ detailData?.receive?.telephone || '—' }}
                </div>
              </VCardText>
            </VCard>

            <VCard
              variant="outlined"
              class="h-100"
            >
              <VCardText>
                <div class="text-subtitle-2 font-weight-medium mb-3 d-flex align-center gap-2">
                  <VIcon
                    icon="tabler-box"
                    size="18"
                  />
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
                  class="order-detail-package py-2"
                >
                  <div class="text-body-2 font-weight-medium mb-1">
                    {{ $t('pages.printLabelOrders.detail.packageNo', { index: idx + 1 }) }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis">
                    {{ $t('pages.printLabelOrders.detail.packageMetrics', { weight: p.weight ?? '—', length: p.length ?? '—', width: p.width ?? '—', height: p.height ?? '—' }) }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis">
                    {{ $t('pages.printLabelOrders.detail.packageDeclaration', { value: p.value ?? '—' }) }}
                  </div>
                </div>
              </VCardText>
            </VCard>
          </div>
        </template>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.order-dd-link {
  border: 0;
  padding: 0;
  background: transparent;
  text-align: start;
  cursor: pointer;
}

.order-dd-link:hover {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
}

.order-dd-filter-ref :deep(textarea) {
  resize: none;
  max-block-size: 5.5rem;
}

.order-detail-dialog {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.order-detail-hero {
  border: 1px solid rgba(var(--v-theme-primary), 0.18);
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.08), rgba(var(--v-theme-primary), 0.03));
}

.order-detail-kpis {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (min-width: 960px) {
  .order-detail-kpis {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.order-detail-kpi {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
  background: rgba(var(--v-theme-on-surface), 0.015);
  padding: 0.625rem 0.75rem;
}

.order-detail-kpi__label {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.62);
  margin-block-end: 0.2rem;
}

.order-detail-kpi__value {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.order-detail-package + .order-detail-package {
  border-top: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
}

.order-detail-bottom-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
}

@media (min-width: 960px) {
  .order-detail-bottom-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .order-detail-bottom-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.yundan-list-table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  font-size: 0.8125rem;
  letter-spacing: 0.02em;
  text-transform: none;
  white-space: nowrap;
}
</style>
