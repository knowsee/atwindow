<script setup>
import AppQueryPanel from '@/@core/components/AppQueryPanel.vue'
import { $api } from '@/utils/api'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'
import { createDsStatusItems, normalizeRangeText } from '@/views/apps/drop-shipping/useDropShippingShared'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const itemsPerPage = ref(20)
const selectedIds = ref([])
const printingId = ref(null)
const snack = ref({ show: false, text: '', color: 'info' })
const { t } = useI18n({ useScope: 'global' })

/** Align with dashboard and other entry query params: status, tracking_no, or trackingNo. */
function parseRouteQueryToFilters(q) {
  const base = {
    status: 1,
    sku: '',
    trackingNo: '',
    timeRange: '',
  }

  if (q.status !== undefined && q.status !== null && String(q.status).trim() !== '') {
    const n = Number(q.status)
    if (Number.isFinite(n))
      base.status = n
  }

  const tr = q.tracking_no ?? q.trackingNo
  if (tr != null && String(tr).trim())
    base.trackingNo = String(tr).trim()

  return base
}

const filters = ref(parseRouteQueryToFilters(route.query))

const quickStatusItems = computed(() => createDsStatusItems(t))

const headers = computed(() => [
  { title: t('pages.dropShippingPackageList.headers.package'), key: 'pkg_info', minWidth: '230' },
  { title: t('pages.dropShippingPackageList.headers.warehouse'), key: 'warehouse_name', width: '140', minWidth: '120' },
  { title: t('pages.dropShippingPackageList.headers.sku'), key: 'sku', minWidth: '180', maxWidth: '300' },
  { title: t('pages.dropShippingPackageList.headers.qty'), key: 'qty', width: '130', minWidth: '180', align: 'center' },
  { title: t('pages.dropShippingPackageList.headers.status'), key: 'statusStr', width: '110', minWidth: '100', align: 'center' },
  { title: t('pages.dropShippingPackageList.headers.actions'), key: 'actions', sortable: false, width: '130', align: 'center', fixed: 'end' },
])

const pageLength = computed(() => Math.max(1, Math.ceil(total.value / itemsPerPage.value)))

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function resolveStatusColor(str) {
  const s = String(str || '')
  if (s.includes('\u5f02\u5e38') || s.includes('\u95ee\u9898'))
    return 'error'
  if (s.includes('\u5df2\u5230\u5e93') && !s.includes('\u672a\u4e0a\u62a5'))
    return 'success'
  if (s.includes('\u672a\u4e0a\u62a5') || s.includes('\u5f85\u4e0a\u67b6'))
    return 'info'
  if (s.includes('\u672a\u5230\u5e93') || s.includes('\u5f85\u6536\u8d27'))
    return 'warning'

  return 'primary'
}

/** Backend often joins multiple values with <br>; render as newlines instead of v-html. */
function normalizeCellBreaks(val) {
  if (val == null)
    return ''
  const s = String(val).replace(/<br\s*\/?>/gi, '\n').replace(/\r\n/g, '\n')

  return s.trim()
}

function cellDisplay(val) {
  const s = normalizeCellBreaks(val)

  return s || '—'
}

/** Merge sku/sku_num/real_sku_num/cn_name arrays into row objects. */
function buildSkuRows(item) {
  const skus = Array.isArray(item.sku) ? item.sku : []
  const cnNames = Array.isArray(item.cn_name) ? item.cn_name : []
  const declared = Array.isArray(item.sku_num) ? item.sku_num : []
  const actual = Array.isArray(item.real_sku_num) ? item.real_sku_num : []
  const len = Math.max(skus.length, 1)

  return Array.from({ length: len }, (_, i) => ({
    sku: skus[i] ?? '',
    cnName: cnNames[i] ?? null,
    declared: declared[i] ?? null,
    actual: actual[i] ?? null,
  }))
}

function totalDeclared(item) {
  const arr = Array.isArray(item.sku_num) ? item.sku_num : []

  return arr.reduce((s, n) => s + Number(n || 0), 0)
}

function totalActual(item) {
  const arr = Array.isArray(item.real_sku_num) ? item.real_sku_num : []

  return arr.reduce((s, n) => s + Number(n || 0), 0)
}

function buildBody() {
  const body = {
    'current_page': page.value,
    'per_page_num': itemsPerPage.value,
  }

  if (filters.value.status !== '' && filters.value.status != null)
    body.status = Number(filters.value.status)
  if (filters.value.sku.trim())
    body.sku = filters.value.sku.trim()
  if (filters.value.trackingNo.trim())
    body['tracking_no'] = filters.value.trackingNo.trim()

  const range = normalizeRangeText(filters.value.timeRange)
  if (range && range.includes(' - ')) {
    const [start, end] = range.split(' - ')
    if (start)
      body.starttime = start.trim()
    if (end)
      body.endtime = end.trim()
  }

  return body
}

async function loadList() {
  loading.value = true
  try {
    const res = await $api('/package/all', {
      method: 'POST',
      body: buildBody(),
    })

    if (Number(res?.code) === 1 && res?.data) {
      rows.value = Array.isArray(res.data.data) ? res.data.data : []
      total.value = Number(res.data.count) || 0
      
      return
    }

    rows.value = []
    total.value = 0
    toast(res?.msg || t('pages.dropShippingPackageList.messages.loadFailed'), 'error')
  }
  catch (e) {
    rows.value = []
    total.value = 0
    toast(e?.data?.msg || e?.message || t('pages.dropShippingPackageList.messages.networkFailed'), 'error')
  }
  finally {
    loading.value = false
  }
}

function searchList() {
  const alreadyFirst = page.value === 1

  page.value = 1
  if (alreadyFirst)
    loadList()
}

function onQuickStatusChange(v) {
  filters.value.status = v

  const alreadyFirst = page.value === 1

  page.value = 1
  if (alreadyFirst)
    loadList()
}

function resetFilters() {
  filters.value = {
    status: 1,
    sku: '',
    trackingNo: '',
    timeRange: '',
  }
  if (Object.keys(route.query).length)
    router.replace({ name: route.name, query: {} })
  searchList()
}

async function deleteOne(id) {
  if (!id)
    return

  try {
    const res = await $api('/package/del', {
      method: 'POST',
      body: { id },
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || t('pages.dropShippingPackageList.messages.deleteSuccess'), 'success')
      loadList()
    }
    else {
      toast(res?.msg || t('pages.dropShippingPackageList.messages.deleteFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingPackageList.messages.deleteFailed'), 'error')
  }
}

async function batchDelete() {
  if (!selectedIds.value.length) {
    toast(t('pages.dropShippingPackageList.messages.selectDeleteRequired'), 'warning')
    
    return
  }

  try {
    const res = await $api('/package/delBatch', {
      method: 'POST',
      body: { str: selectedIds.value.join(',') },
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || t('pages.dropShippingPackageList.messages.batchDeleteSuccess'), 'success')
      selectedIds.value = []
      loadList()
    }
    else {
      toast(res?.msg || t('pages.dropShippingPackageList.messages.batchDeleteFailed'), 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingPackageList.messages.batchDeleteFailed'), 'error')
  }
}

async function requestPrintBoxLabel(idList) {
  const str = idList.map(id => String(id)).filter(Boolean).join(',')
  if (!str)
    return false

  const res = await $api('/package/dayinPl', {
    method: 'POST',
    body: { str },
  })

  if (Number(res?.code) === 1) {
    const url = res?.data?.pdf_url

    toast(res?.msg || t('pages.dropShippingPackageList.messages.printTaskCreated'), 'success')
    if (url)
      window.open(resolveBackendFileUrl(url), '_blank', 'noopener')

    return true
  }

  toast(res?.msg || t('pages.dropShippingPackageList.messages.printFailed'), 'error')

  return false
}

async function printBoxLabel(id) {
  if (!id)
    return

  printingId.value = id
  try {
    await requestPrintBoxLabel([id])
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingPackageList.messages.printFailed'), 'error')
  }
  finally {
    printingId.value = null
  }
}

async function batchPrint() {
  if (!selectedIds.value.length) {
    toast(t('pages.dropShippingPackageList.messages.selectPrintRequired'), 'warning')

    return
  }
  try {
    await requestPrintBoxLabel(selectedIds.value)
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dropShippingPackageList.messages.batchPrintFailed'), 'error')
  }
}

function goCreate() {
  router.push({ name: 'apps-drop-shipping-package-create' })
}

function goBatch() {
  router.push({ name: 'apps-drop-shipping-package-batch' })
}

watch([page, itemsPerPage], loadList, { immediate: true })

watch(
  () => [route.query.status, route.query.tracking_no, route.query.trackingNo],
  () => {
    filters.value = parseRouteQueryToFilters(route.query)
    page.value = 1
    loadList()
  },
)
</script>

<template>
  <VSnackbar
    v-model="snack.show"
    :color="snack.color"
    location="top"
    :timeout="2600"
  >
    {{ snack.text }}
  </VSnackbar>

  <VCard class="rounded-lg ds-pkg-list">
    <VCardItem class="pb-3 pt-5 px-6">
      <template #prepend>
        <VAvatar
          color="primary"
          variant="tonal"
          rounded
          size="42"
        >
          <VIcon
            icon="tabler-package-import"
            size="24"
          />
        </VAvatar>
      </template>
      <template #title>
        <span class="text-h5 font-weight-bold">{{ $t('pages.dropShippingPackageList.title') }}</span>
      </template>
      <template #subtitle>
        <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingPackageList.subtitle') }}</span>
      </template>
      <template #append>
        <div class="d-flex flex-wrap gap-2 justify-end">
          <VBtn
            color="primary"
            size="small"
            variant="tonal"
            prepend-icon="tabler-table-import"
            @click="goBatch"
          >
            {{ $t('pages.dropShippingPackageList.actions.batchCreate') }}
          </VBtn>
          <VBtn
            color="primary"
            size="small"
            prepend-icon="tabler-plus"
            @click="goCreate"
          >
            {{ $t('pages.dropShippingPackageList.actions.create') }}
          </VBtn>
        </div>
      </template>
    </VCardItem>

    <VDivider />

    <VCardText class="px-4 pt-4 pb-0">
      <AppQueryPanel
        :loading="loading"
        actions-position="bottom"
        class="mb-4"
        :quick-filter-items="quickStatusItems"
        :quick-filter="filters.status"
        @search="searchList"
        @reset="resetFilters"
        @update:quick-filter="onQuickStatusChange"
      >
        <VRow dense>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <AppTextField
              v-model="filters.sku"
              label="SKU"
              :placeholder="$t('pages.dropShippingPackageList.filters.skuPlaceholder')"
              hide-details
              density="compact"
              prepend-inner-icon="tabler-search"
              @keyup.enter="searchList"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <AppTextField
              v-model="filters.trackingNo"
              :label="$t('pages.dropShippingPackageList.filters.trackingNo')"
              :placeholder="$t('pages.dropShippingPackageList.filters.trackingNoPlaceholder')"
              hide-details
              density="compact"
              prepend-inner-icon="tabler-barcode"
              @keyup.enter="searchList"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <AppDateTimePicker
              v-model="filters.timeRange"
              :label="$t('pages.dropShippingPackageList.filters.createdAt')"
              hide-details
              density="compact"
              :config="{ mode: 'range', dateFormat: 'Y-m-d H:i:S', enableTime: true }"
            />
          </VCol>
        </VRow>
      </AppQueryPanel>

      <Transition name="slide-down">
        <div
          v-if="selectedIds.length"
          class="batch-action-bar mb-4 px-4 py-3 rounded-lg d-flex align-center justify-space-between flex-wrap gap-3"
        >
          <div class="d-flex align-center gap-2">
            <VAvatar
              color="primary"
              variant="tonal"
              size="28"
              rounded="circle"
            >
              <VIcon
                icon="tabler-checkbox"
                size="16"
              />
            </VAvatar>
            <span class="text-body-2 font-weight-medium">
              {{ $t('pages.dropShippingPackageList.selection.selected', { count: selectedIds.length }) }}
            </span>
          </div>
          <div class="d-flex align-center gap-2">
            <VBtn
              color="primary"
              variant="flat"
              size="small"
              prepend-icon="tabler-printer"
              class="text-none"
              @click="batchPrint"
            >
              {{ $t('pages.dropShippingPackageList.actions.batchPrintBox') }}
            </VBtn>
            <VBtn
              color="error"
              variant="tonal"
              size="small"
              prepend-icon="tabler-trash"
              class="text-none"
              @click="batchDelete"
            >
              {{ $t('pages.dropShippingPackageList.actions.batchDelete') }}
            </VBtn>
            <VBtn
              variant="text"
              size="small"
              color="secondary"
              class="text-none"
              @click="selectedIds = []"
            >
              {{ $t('pages.dropShippingPackageList.actions.cancelSelection') }}
            </VBtn>
          </div>
        </div>
      </Transition>
    </VCardText>

    <VDataTableServer
      v-model="selectedIds"
      :headers="headers"
      :items="rows"
      :loading="loading"
      :items-length="total"
      item-value="id"
      show-select
      density="comfortable"
      hover
      class="ds-pkg-list__table"
    >
      <template #item.pkg_info="{ item }">
        <div
          class="pkg-info-cell"
          @click="router.push({ name: 'apps-drop-shipping-package-detail', query: { id: item.id } })"
        >
          <div class="pkg-info-cell__tracking ds-mono">
            {{ item.tracking_no || item.order_sn || '—' }}
          </div>
          <div
            v-if="item.tracking_no && item.order_sn"
            class="pkg-info-cell__sn"
          >
            {{ item.order_sn }}
          </div>
          <div class="pkg-info-cell__time">
            <VIcon
              icon="tabler-clock"
              size="12"
              class="me-1"
            />
            {{ item.createtime || '—' }}
          </div>
        </div>
      </template>

      <template #item.warehouse_name="{ item }">
        <div
          v-if="item.warehouse_name"
          class="d-flex align-center gap-1"
        >
          <VIcon
            icon="tabler-building-warehouse"
            size="14"
            color="medium-emphasis"
          />
          <span class="text-body-2">{{ cellDisplay(item.warehouse_name) }}</span>
        </div>
        <span
          v-else
          class="text-medium-emphasis"
        >—</span>
      </template>

      <template #item.sku="{ item }">
        <div class="sku-list">
          <div
            v-for="(row, i) in buildSkuRows(item)"
            :key="i"
            class="sku-row"
          >
            <span class="sku-row__code ds-mono">{{ row.sku || '—' }}</span>
            <span
              v-if="row.cnName"
              class="sku-row__cn"
            >{{ row.cnName }}</span>
          </div>
        </div>
      </template>

      <template #item.qty="{ item }">
        <div
          v-if="buildSkuRows(item).length === 1"
          class="qty-compare d-flex align-center justify-center gap-1"
        >
          <span class="qty-compare__val text-medium-emphasis">{{ buildSkuRows(item)[0].declared ?? '—' }}</span>
          <VIcon
            icon="tabler-arrow-narrow-right"
            size="14"
            color="medium-emphasis"
          />
          <span
            class="qty-compare__val font-weight-semibold"
            :class="buildSkuRows(item)[0].actual !== buildSkuRows(item)[0].declared ? 'text-warning' : 'text-success'"
          >{{ buildSkuRows(item)[0].actual ?? '—' }}</span>
          <VIcon
            v-if="buildSkuRows(item)[0].actual != null && buildSkuRows(item)[0].actual !== buildSkuRows(item)[0].declared"
            icon="tabler-alert-triangle"
            size="13"
            color="warning"
          />
        </div>
        <div
          v-else
          class="qty-compare-multi"
        >
          <div
            v-for="(row, i) in buildSkuRows(item)"
            :key="i"
            class="qty-row d-flex align-center justify-center gap-1"
          >
            <span class="qty-compare__val text-medium-emphasis">{{ row.declared ?? '—' }}</span>
            <VIcon
              icon="tabler-arrow-narrow-right"
              size="12"
              color="medium-emphasis"
            />
            <span
              class="qty-compare__val font-weight-semibold"
              :class="row.actual !== row.declared ? 'text-warning' : 'text-success'"
            >{{ row.actual ?? '—' }}</span>
          </div>
          <VDivider class="my-1" />
          <div class="qty-row d-flex align-center justify-center gap-1">
            <span class="text-caption text-medium-emphasis">{{ totalDeclared(item) }}</span>
            <VIcon
              icon="tabler-arrow-narrow-right"
              size="12"
              color="medium-emphasis"
            />
            <span
              class="text-caption font-weight-bold"
              :class="totalActual(item) !== totalDeclared(item) ? 'text-warning' : 'text-success'"
            >{{ totalActual(item) }}</span>
          </div>
        </div>
      </template>

      <template #item.statusStr="{ item }">
        <div class="d-flex justify-center">
          <VChip
            size="small"
            variant="tonal"
            :color="resolveStatusColor(item.statusStr)"
          >
            {{ item.statusStr || '—' }}
          </VChip>
        </div>
      </template>

      <template #item.actions="{ item }">
        <div class="d-flex align-center justify-center gap-1">
          <VTooltip :text="$t('pages.dropShippingPackageList.tooltips.detail')">
            <template #activator="{ props: tipProps }">
              <IconBtn
                v-bind="tipProps"
                size="small"
                color="primary"
                @click="router.push({ name: 'apps-drop-shipping-package-detail', query: { id: item.pid || item.id } })"
              >
                <VIcon
                  icon="tabler-eye"
                  size="18"
                />
              </IconBtn>
            </template>
          </VTooltip>
          <VTooltip :text="$t('pages.dropShippingPackageList.tooltips.printBox')">
            <template #activator="{ props: tipProps }">
              <IconBtn
                v-bind="tipProps"
                size="small"
                color="secondary"
                :loading="printingId === item.id"
                @click="printBoxLabel(item.id)"
              >
                <VIcon
                  icon="tabler-printer"
                  size="18"
                />
              </IconBtn>
            </template>
          </VTooltip>
          <VMenu location="bottom end">
            <template #activator="{ props: menuProps }">
              <IconBtn
                v-bind="menuProps"
                size="small"
                color="secondary"
              >
                <VIcon
                  icon="tabler-dots-vertical"
                  size="18"
                />
              </IconBtn>
            </template>
            <VList density="compact">
              <VListItem
                :title="$t('pages.dropShippingPackageList.actions.delete')"
                prepend-icon="tabler-trash"
                base-color="error"
                @click="deleteOne(item.id)"
              />
            </VList>
          </VMenu>
        </div>
      </template>

      <template #bottom>
        <VDivider />
        <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-6 py-4">
          <span class="text-body-2 text-medium-emphasis">
            {{ $t('pages.dropShippingPackageList.pagination.total', { total }) }}
          </span>
          <div class="d-flex align-center gap-3">
            <AppSelect
              :model-value="itemsPerPage"
              :items="[20, 50, 100]"
              style="inline-size: 100px;"
              density="compact"
              hide-details
              @update:model-value="itemsPerPage = Number($event)"
            />
            <VPagination
              v-model="page"
              :length="pageLength"
              :total-visible="5"
              size="small"
              active-color="primary"
            />
          </div>
        </div>
      </template>
    </VDataTableServer>
  </VCard>
</template>

<style scoped>
/* Table basics */
.ds-pkg-list__table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  white-space: nowrap;
  letter-spacing: 0.02em;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.ds-pkg-list__table :deep(tbody .v-data-table__td) {
  vertical-align: middle;
  padding-block: 0.75rem !important;
}

/* Main inbound-order info cell */
.pkg-info-cell {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  cursor: pointer;
}

.pkg-info-cell:hover .pkg-info-cell__tracking {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
  text-underline-offset: 2px;
}

.pkg-info-cell__tracking {
  font-weight: 600;
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.9);
  white-space: pre-line;
  overflow-wrap: anywhere;
  word-break: break-all;
  line-height: 1.3;
  transition: color 0.15s;
}

.pkg-info-cell__sn {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.55);
  white-space: pre-line;
  overflow-wrap: anywhere;
  word-break: break-all;
}

.pkg-info-cell__time {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 0.1rem 0.35rem;
  border-radius: 0.375rem;
  font-size: 0.6875rem;
  color: rgba(var(--v-theme-on-surface), 0.55);
  background: rgba(var(--v-theme-on-surface), 0.05);
  white-space: nowrap;
}

/* Multi-line SKU list */
.sku-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sku-row {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}

.sku-row__code {
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.87);
  white-space: pre-line;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.sku-row__cn {
  font-size: 0.6875rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

/* Multi-SKU quantity comparison */
.qty-compare-multi {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-variant-numeric: tabular-nums;
}

.qty-row {
  font-size: 0.8125rem;
}

/* Legacy SKU cell fallback */
.sku-cell {
  white-space: pre-line;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.87);
  max-inline-size: 260px;
  line-height: 1.5;
}

/* Declared/received comparison */
.qty-compare {
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.qty-compare__val {
  min-inline-size: 1.5rem;
  text-align: center;
}

/* Batch action bar */
.batch-action-bar {
  background: rgba(var(--v-theme-primary), 0.06);
  border: 1px solid rgba(var(--v-theme-primary), 0.18);
}

/* Slide-in animation */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Monospace values */
.ds-mono {
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
}
</style>
