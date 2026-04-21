<script setup>
import { $api } from '@/utils/api'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'
import {
  formatTotalWeight,
  formatYundanShippingFee,
  ORDER_DD_STATUS_FILTER_ITEMS,
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
  channelTypeItems,
  searchOrders,
  resetFilters,
} = useYundanList()

const router = useRouter()
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

const headers = [
  { title: '创建时间', key: 'createtime', minWidth: '158' },
  { title: '订单号', key: 'order_sn', minWidth: '200' },
  { title: '参考号', key: 'cankaohao', minWidth: '140' },
  { title: '线路', key: 'transport_line', minWidth: '140' },
  { title: '跟踪号', key: 'ht_tracking_no', minWidth: '180' },
  { title: 'SKU / 件数', key: 'sku_line', sortable: false, minWidth: '120' },
  { title: '总重', key: 'total_weight', minWidth: '80' },
  { title: '运费', key: 'shipping_fee', minWidth: '88' },
  { title: '异常信息', key: 'error_message', sortable: false, minWidth: '160' },
  { title: '状态', key: 'status', minWidth: '100' },
  { title: '操作', key: 'actions', sortable: false, align: 'end', width: '72', fixed: 'end' },
]

const pageLength = computed(() => {
  const ipp = itemsPerPage.value
  if (ipp <= 0)
    return 1

  return Math.max(1, Math.ceil(total.value / ipp))
})

const zhPageMeta = computed(() => {
  const t = total.value
  if (t === 0)
    return '共 0 条'
  const p = page.value
  const ipp = itemsPerPage.value
  const start = (p - 1) * ipp + 1
  const end = Math.min(p * ipp, t)

  return `第 ${start}–${end} 条，共 ${t} 条`
})

async function copyTracking(no) {
  const s = (no && String(no).trim()) || ''
  if (!s) {
    snack.value = { show: true, text: '无跟踪号', color: 'warning' }

    return
  }
  try {
    if (isSupported.value)
      await copy(s)
    else
      await navigator.clipboard.writeText(s)
    snack.value = { show: true, text: '跟踪号已复制', color: 'success' }
  }
  catch {
    snack.value = { show: true, text: '复制失败', color: 'error' }
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
      throw new Error('缺少订单标识')

    const res = await $api('/ordernew/getOrderDdDetail', {
      method: 'POST',
      body,
    })

    if (Number(res?.code) === 1 && res.data) {
      detailData.value = res.data
    }
    else {
      detailData.value = null
      detailError.value = res?.msg || '加载详情失败'
    }
  }
  catch (e) {
    detailData.value = null
    detailError.value = e?.data?.msg || e?.message || '网络请求失败'
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
    snack.value = { show: true, text: '暂无面单文件', color: 'warning' }
    
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
</script>

<template>
  <VContainer
    fluid
    class="pa-4 pa-sm-6"
  >
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
          <VCardItem class="pb-4 pt-6 px-6">
            <template #title>
              <span class="text-h5 font-weight-medium">订单列表（旧）</span>
            </template>
            <template #subtitle>
              <span class="text-body-2 text-medium-emphasis">填写条件后点击「查询」，分页切换会自动刷新。</span>
            </template>
            <template #append>
              <div class="d-flex flex-wrap gap-2 justify-end">
                <VBtn
                  color="primary"
                  size="small"
                  prepend-icon="tabler-plus"
                  :to="{ name: 'apps-print-label-create' }"
                >
                  新建运单
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
                本列表仅为历史数据，并更名为「订单列表（旧）」。即日起，新订单将在「订单列表」中展示与处理；过往订单的取消需联络客服。
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
                    :items="ORDER_DD_STATUS_FILTER_ITEMS"
                    item-title="title"
                    item-value="value"
                    label="状态"
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
                    label="渠道"
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
                    label="收件人"
                    density="compact"
                    hide-details
                    placeholder="姓名"
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
                    label="创建时间"
                    density="compact"
                    hide-details
                    placeholder="选择日期范围"
                    :config="{ mode: 'range', dateFormat: 'Y-m-d' }"
                    @keyup.enter="searchOrders"
                  />
                </VCol>
                <VCol cols="12">
                  <AppTextarea
                    v-model="filterCankaohao"
                    label="参考号（多行）"
                    density="compact"
                    rows="2"
                    variant="outlined"
                    hide-details
                    placeholder="每行一个参考号"
                    class="order-dd-filter-ref"
                  />
                </VCol>
              </VRow>
            </AppQueryPanel>

            <VDataTableServer
              v-model:items-per-page="itemsPerPage"
              v-model:page="page"
              :headers="headers"
              :items="items"
              :items-length="total"
              :loading="loading"
              loading-text="加载中…"
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
                    aria-label="复制跟踪号"
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
                  :color="resolveYundanStatus(item.status).color"
                  label
                  size="small"
                  class="font-weight-medium"
                >
                  {{ resolveYundanStatus(item.status).text }}
                </VChip>
              </template>

              <template #item.actions="{ item }">
                <VMenu>
                  <template #activator="{ props }">
                    <IconBtn
                      v-bind="props"
                      aria-label="更多操作"
                    >
                      <VIcon
                        icon="tabler-dots-vertical"
                        size="20"
                      />
                    </IconBtn>
                  </template>
                  <VList density="compact">
                    <VListItem
                      prepend-icon="tabler-eye"
                      title="详情"
                      @click="openDetailByRow(item)"
                    />
                    <VListItem
                      prepend-icon="tabler-download"
                      title="下载面单"
                      @click="downloadLabelByRow(item)"
                    />
                  </VList>
                </VMenu>
              </template>

              <template #no-data>
                <div class="text-center text-medium-emphasis py-12">
                  暂无订单数据
                </div>
              </template>

              <template #bottom>
                <VDivider />
                <div class="d-flex align-center justify-sm-space-between justify-center flex-wrap gap-3 px-4 px-sm-6 py-3">
                  <p class="text-medium-emphasis mb-0 text-body-2">
                    {{ zhPageMeta }}
                  </p>
                  <VPagination
                    v-if="pageLength > 1"
                    v-model="page"
                    rounded
                    active-color="primary"
                    :length="pageLength"
                    :total-visible="$vuetify.display.xs ? 1 : Math.min(pageLength, 7)"
                  />
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
            <span class="text-h6 font-weight-medium">运单详情</span>
          </template>
          <template #subtitle>
            <span class="text-body-2 text-medium-emphasis">订单号：{{ detailData?.order_sn || '—' }}</span>
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
                下载面单
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
                    参考号
                  </div>
                  <div
                    class="text-h5 font-weight-bold text-high-emphasis text-truncate"
                    :title="detailData?.order_meta?.cankaohao || '—'"
                  >
                    {{ detailData?.order_meta?.cankaohao || '—' }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis mt-1">
                    创建时间：{{ detailData?.order_meta?.createtime_text || '—' }}
                  </div>
                </div>
                <div class="d-flex flex-wrap justify-end gap-2">
                  <VChip
                    color="primary"
                    variant="tonal"
                    label
                    size="small"
                  >
                    {{ resolveYundanStatus(detailData?.status).text }}
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
                        状态
                      </div>
                      <div class="order-detail-kpi__value">
                        {{ resolveYundanStatus(detailData?.status).text }}
                      </div>
                    </div>
                    <div class="order-detail-kpi">
                      <div class="order-detail-kpi__label">
                        线路
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
                        运费
                      </div>
                      <div class="order-detail-kpi__value">
                        {{ detailData?.price?.shipping_fee ?? '—' }}
                      </div>
                    </div>
                    <div class="order-detail-kpi">
                      <div class="order-detail-kpi__label">
                        跟踪号
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
                    发件人
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
                    收件人
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
                    包裹信息
                  </div>
                  <div
                    v-if="!(detailData?.packages || []).length"
                    class="text-body-2 text-medium-emphasis"
                  >
                    暂无包裹信息
                  </div>
                  <div
                    v-for="(p, idx) in (detailData?.packages || [])"
                    :key="idx"
                    class="order-detail-package py-2"
                  >
                    <div class="text-body-2 font-weight-medium mb-1">
                      包裹 #{{ idx + 1 }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      重量 {{ p.weight ?? '—' }} · 尺寸 {{ p.length ?? '—' }} × {{ p.width ?? '—' }} × {{ p.height ?? '—' }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      申报 {{ p.value ?? '—' }}
                    </div>
                  </div>
                </VCardText>
              </VCard>
            </div>
          </template>
        </VCardText>
      </VCard>
    </VDialog>
  </VContainer>
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
