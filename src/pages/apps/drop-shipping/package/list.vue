<script setup>
import AppQueryPanel from '@/@core/components/AppQueryPanel.vue'
import { $api } from '@/utils/api'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'
import { normalizeRangeText } from '@/views/apps/drop-shipping/useDropShippingShared'

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

const FILTERS_CACHE_KEY = 'ds-pkg-list-filters'

function getDefaultFilters() {
  return {
    status: '',
    sku: '',
    trackingNo: '',
    createTime: '',
    receiveTime: '',
  }
}

function loadCachedFilters() {
  try {
    const raw = sessionStorage.getItem(FILTERS_CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)

      return { ...getDefaultFilters(), ...parsed }
    }
  }
  catch {}

  return null
}

function saveCachedFilters(f) {
  try {
    sessionStorage.setItem(FILTERS_CACHE_KEY, JSON.stringify(f))
  }
  catch {}
}

function clearCachedFilters() {
  try {
    sessionStorage.removeItem(FILTERS_CACHE_KEY)
  }
  catch {}
}

function parseRouteQueryToFilters(q) {
  const base = getDefaultFilters()

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

const filters = ref(loadCachedFilters() || parseRouteQueryToFilters(route.query))

const quickStatusItems = computed(() => [
  { title: t('pages.dropShippingPackageList.statuses.all'), value: '' },
  { title: t('pages.dropShippingPackageList.statuses.pendingReceive'), value: 1 },
  { title: t('pages.dropShippingPackageList.statuses.onShelf'), value: 2 },
  { title: t('pages.dropShippingPackageList.statuses.pendingShelf'), value: 3 },
])

const headers = computed(() => [
  { title: '', key: 'data-table-expand' },
  { title: t('pages.dropShippingPackageList.headers.package'), key: 'pkg_info', minWidth: '220' },
  { title: t('pages.dropShippingPackageList.headers.warehouse'), key: 'warehouse_name', minWidth: '120' },
  { title: t('pages.dropShippingPackageList.headers.sku'), key: 'sku', minWidth: '180' },
  { title: t('pages.dropShippingPackageList.headers.status'), key: 'status', width: '110', align: 'center' },
  { title: t('pages.dropShippingPackageList.headers.receiveTime'), key: 'receivetime', minWidth: '160' },
  { title: t('pages.dropShippingPackageList.headers.actions'), key: 'actions', sortable: false, width: '130', align: 'center', fixed: 'end' },
])

const pageLength = computed(() => Math.max(1, Math.ceil(total.value / itemsPerPage.value)))

const createTimeRange = computed(() => normalizeRangeText(filters.value.createTime))
const receiveTimeRange = computed(() => normalizeRangeText(filters.value.receiveTime))

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function resolveStatusColor(status) {
  const n = Number(status)
  if (n === 1)
    return 'warning'
  if (n === 2)
    return 'success'
  if (n === 3)
    return 'info'

  return 'primary'
}

function buildSkuRows(item) {
  return Array.isArray(item.sku_list) ? item.sku_list : []
}

function totalDeclared(item) {
  const list = buildSkuRows(item)

  return list.reduce((s, r) => s + Number(r.sku_num || 0), 0)
}

function totalActual(item) {
  const list = buildSkuRows(item)

  return list.reduce((s, r) => s + Number(r.real_sku_num || 0), 0)
}

function buildBody() {
  const body = {
    current_page: page.value,
    per_page_num: itemsPerPage.value,
  }

  if (filters.value.status !== '' && filters.value.status != null)
    body.status = Number(filters.value.status)
  if (filters.value.sku.trim())
    body.sku = filters.value.sku.trim()
  if (filters.value.trackingNo.trim())
    body.tracking_no = filters.value.trackingNo.trim()
  if (createTimeRange.value)
    body.create_time = createTimeRange.value
  if (receiveTimeRange.value)
    body.receive_time = receiveTimeRange.value

  return body
}

async function loadList() {
  loading.value = true
  try {
    const res = await $api('/ordernew/packageList', {
      method: 'POST',
      body: buildBody(),
    })

    if (Number(res?.code) === 1 && res?.data) {
      rows.value = Array.isArray(res.data.list) ? res.data.list : []
      total.value = Number(res.data.total) || 0

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
  saveCachedFilters(filters.value)

  const alreadyFirst = page.value === 1

  page.value = 1
  if (alreadyFirst)
    loadList()
}

function onQuickStatusChange(v) {
  filters.value.status = v === '' ? '' : Number(v)
  saveCachedFilters(filters.value)

  const alreadyFirst = page.value === 1

  page.value = 1
  if (alreadyFirst)
    loadList()
}

function resetFilters() {
  filters.value = getDefaultFilters()
  clearCachedFilters()
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
    saveCachedFilters(filters.value)
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
              v-model="filters.createTime"
              :label="$t('pages.dropShippingPackageList.filters.createdAt')"
              hide-details
              density="compact"
              :config="{ mode: 'range', dateFormat: 'Y-m-d' }"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <AppDateTimePicker
              v-model="filters.receiveTime"
              :label="$t('pages.dropShippingPackageList.filters.receiveTime')"
              hide-details
              density="compact"
              :config="{ mode: 'range', dateFormat: 'Y-m-d' }"
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
      expand-on-click
      density="comfortable"
      hover
      class="ds-pkg-list__table"
    >
      <template #expanded-row="{ item }">
        <tr class="v-data-table__tr">
          <td :colspan="headers.length">
            <div class="pkg-expanded">
              <!-- Overview stats -->
              <div class="pkg-expanded__stats">
                <div class="pkg-expanded__stat">
                  <VIcon
                    icon="tabler-weight"
                    size="18"
                    class="pkg-expanded__stat-icon"
                  />
                  <div class="pkg-expanded__stat-body">
                    <span class="pkg-expanded__stat-label">{{ $t('pages.dropShippingPackageList.headers.weight') }}</span>
                    <span class="pkg-expanded__stat-value">{{ item.total_weight != null ? item.total_weight + ' kg' : '—' }}</span>
                  </div>
                </div>
                <div class="pkg-expanded__stat">
                  <VIcon
                    icon="tabler-currency-dollar"
                    size="18"
                    class="pkg-expanded__stat-icon"
                  />
                  <div class="pkg-expanded__stat-body">
                    <span class="pkg-expanded__stat-label">{{ $t('pages.dropShippingPackageList.headers.fee') }}</span>
                    <span class="pkg-expanded__stat-value">{{ item.total_fee != null ? item.total_fee : '—' }}</span>
                  </div>
                </div>
              </div>

              <!-- Sender card -->
              <div class="pkg-expanded__card">
                <div class="pkg-expanded__card-header">
                  <VIcon
                    icon="tabler-user"
                    size="16"
                  />
                  <span>{{ $t('pages.dropShippingPackageList.expanded.senderInfo') }}</span>
                </div>
                <div class="pkg-expanded__card-body">
                  <template v-if="item.sender && item.sender.name">
                    <div class="pkg-expanded__row">
                      <span class="pkg-expanded__row-label">{{ $t('pages.dropShippingPackageList.expanded.senderName') }}</span>
                      <span class="pkg-expanded__row-value">{{ item.sender.name }}</span>
                    </div>
                    <div class="pkg-expanded__row">
                      <span class="pkg-expanded__row-label">{{ $t('pages.dropShippingPackageList.expanded.senderTelephone') }}</span>
                      <span class="pkg-expanded__row-value">{{ item.sender.telephone || '—' }}</span>
                    </div>
                    <div class="pkg-expanded__row">
                      <span class="pkg-expanded__row-label">{{ $t('pages.dropShippingPackageList.expanded.senderCountry') }}</span>
                      <span class="pkg-expanded__row-value">{{ item.sender.country || '—' }}</span>
                    </div>
                    <div class="pkg-expanded__row">
                      <span class="pkg-expanded__row-label">{{ $t('pages.dropShippingPackageList.expanded.senderAddress') }}</span>
                      <span class="pkg-expanded__row-value">{{ item.sender.address || '—' }}</span>
                    </div>
                  </template>
                  <div
                    v-else
                    class="pkg-expanded__empty"
                  >
                    {{ $t('pages.dropShippingPackageList.expanded.noSender') }}
                  </div>
                </div>
              </div>

              <!-- SKU detail card -->
              <div class="pkg-expanded__card">
                <div class="pkg-expanded__card-header">
                  <VIcon
                    icon="tabler-packages"
                    size="16"
                  />
                  <span>{{ $t('pages.dropShippingPackageList.expanded.skuDetail') }}</span>
                  <span class="pkg-expanded__card-badge">{{ buildSkuRows(item).length }}</span>
                </div>
                <div class="pkg-expanded__card-body pkg-expanded__card-body--flush">
                  <div class="sku-detail-table">
                    <table>
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th class="text-end">
                            {{ $t('pages.dropShippingPackageList.expanded.declaredQty') }}
                          </th>
                          <th class="text-end">
                            {{ $t('pages.dropShippingPackageList.expanded.actualQty') }}
                          </th>
                          <th>{{ $t('pages.dropShippingPackageList.expanded.skuStatus') }}</th>
                          <th class="text-end">
                            {{ $t('pages.dropShippingPackageList.expanded.skuWeight') }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="(skuRow, si) in buildSkuRows(item)"
                          :key="si"
                        >
                          <td class="ds-mono">
                            {{ skuRow.sku || '—' }}
                          </td>
                          <td class="text-end">
                            {{ skuRow.sku_num ?? '—' }}
                          </td>
                          <td class="text-end">
                            <span :class="{ 'sku-detail-table__mismatch': skuRow.real_sku_num !== skuRow.sku_num }">{{ skuRow.real_sku_num ?? '—' }}</span>
                          </td>
                          <td>
                            <VChip
                              v-if="skuRow.status"
                              size="x-small"
                              variant="flat"
                              :color="skuRow.status === '已上架' || skuRow.status === 'On Shelf' ? 'success' : skuRow.status === '待上架' || skuRow.status === 'Pending Shelf' ? 'info' : 'warning'"
                            >
                              {{ skuRow.status }}
                            </VChip>
                            <span v-else>—</span>
                          </td>
                          <td class="text-end">
                            {{ skuRow.weight != null ? skuRow.weight + ' kg' : '—' }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      </template>

      <template #item.pkg_info="{ item }">
        <div
          class="pkg-info-cell"
          @click.stop="router.push({ name: 'apps-drop-shipping-package-detail', query: { id: item.id } })"
        >
          <div class="pkg-info-cell__tracking ds-mono">
            {{ item.tracking_no || '—' }}
          </div>
          <div class="pkg-info-cell__time">
            <VIcon
              icon="tabler-clock"
              size="12"
              class="me-1"
            />
            {{ item.createtime_text || item.createtime || '—' }}
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
          <span class="text-body-2">{{ item.warehouse_name }}</span>
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
          </div>
        </div>
        <div
          v-if="buildSkuRows(item).length === 1"
          class="qty-compare d-flex align-center gap-1 mt-1"
        >
          <span class="qty-compare__val text-medium-emphasis">{{ buildSkuRows(item)[0].sku_num ?? '—' }}</span>
          <VIcon
            icon="tabler-arrow-narrow-right"
            size="14"
            color="medium-emphasis"
          />
          <span
            class="qty-compare__val font-weight-semibold"
            :class="buildSkuRows(item)[0].real_sku_num !== buildSkuRows(item)[0].sku_num ? 'text-warning' : 'text-success'"
          >{{ buildSkuRows(item)[0].real_sku_num ?? '—' }}</span>
        </div>
      </template>

      <template #item.status="{ item }">
        <div class="d-flex justify-center">
          <VChip
            size="small"
            variant="tonal"
            :color="resolveStatusColor(item.status)"
          >
            {{ item.status_text || '—' }}
          </VChip>
        </div>
      </template>

      <template #item.receivetime="{ item }">
        <span class="text-body-2">{{ item.receivetime_text || '—' }}</span>
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

.qty-compare {
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.qty-compare__val {
  min-inline-size: 1.5rem;
  text-align: center;
}

.batch-action-bar {
  background: rgba(var(--v-theme-primary), 0.06);
  border: 1px solid rgba(var(--v-theme-primary), 0.18);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.ds-mono {
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
}

.pkg-expanded {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pkg-expanded__stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.pkg-expanded__stat {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(var(--v-theme-on-surface), 0.025);
  border-radius: 12px;
  border: 0.5px solid rgba(var(--v-theme-on-surface), 0.06);
}

.pkg-expanded__stat-icon {
  color: rgba(var(--v-theme-on-surface), 0.4);
  flex-shrink: 0;
  margin-top: 1px;
}

.pkg-expanded__stat-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pkg-expanded__stat-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(var(--v-theme-on-surface), 0.45);
  line-height: 1.3;
}

.pkg-expanded__stat-value {
  font-size: 0.875rem;
  font-weight: 590;
  color: rgba(var(--v-theme-on-surface), 0.9);
  line-height: 1.4;
  word-break: break-word;
}

.pkg-expanded__card {
  background: rgba(var(--v-theme-on-surface), 0.02);
  border: 0.5px solid rgba(var(--v-theme-on-surface), 0.06);
  border-radius: 12px;
  overflow: hidden;
}

.pkg-expanded__card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.5);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 0.5px solid rgba(var(--v-theme-on-surface), 0.06);
}

.pkg-expanded__card-header .v-icon {
  color: rgba(var(--v-theme-on-surface), 0.4);
}

.pkg-expanded__card-badge {
  margin-left: auto;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 100px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgba(var(--v-theme-on-surface), 0.5);
  letter-spacing: 0;
}

.pkg-expanded__card-body {
  padding: 4px 0;
}

.pkg-expanded__card-body--flush {
  padding: 0;
}

.pkg-expanded__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 14px;
}

.pkg-expanded__row + .pkg-expanded__row {
  border-top: 0.5px solid rgba(var(--v-theme-on-surface), 0.05);
}

.pkg-expanded__row-label {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  flex-shrink: 0;
  min-width: 0;
}

.pkg-expanded__row-value {
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.87);
  text-align: end;
  word-break: break-word;
  min-width: 0;
}

.pkg-expanded__empty {
  padding: 14px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.38);
  text-align: center;
}

.sku-detail-table {
  max-height: 260px;
  overflow-y: auto;
}

.sku-detail-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.sku-detail-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
}

.sku-detail-table th {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(var(--v-theme-on-surface), 0.45);
  background: rgba(var(--v-theme-on-surface), 0.03);
  padding: 8px 14px;
  white-space: nowrap;
  text-align: start;
  border-bottom: 0.5px solid rgba(var(--v-theme-on-surface), 0.06);
}

.sku-detail-table td {
  padding: 8px 14px;
  color: rgba(var(--v-theme-on-surface), 0.8);
  border-bottom: 0.5px solid rgba(var(--v-theme-on-surface), 0.04);
  white-space: nowrap;
}

.sku-detail-table tbody tr:last-child td {
  border-bottom: none;
}

.sku-detail-table__mismatch {
  color: rgb(var(--v-theme-warning));
  font-weight: 600;
}

@media (max-width: 600px) {
  .pkg-expanded__stats {
    grid-template-columns: 1fr;
  }
}
</style>