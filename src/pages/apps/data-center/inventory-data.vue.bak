<script setup>
import AppQueryPanel from '@/@core/components/AppQueryPanel.vue'
import { $api } from '@/utils/api'
import { downloadXlsx, EXPORT_PAGE_SIZE, makeExportBasename } from '@/utils/exportXlsx'
import { resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadWarehouseOptions } from '@/views/apps/drop-shipping/useDropShippingShared'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const itemsPerPage = ref(20)
const warehouseOptions = ref([])
const snack = ref({ show: false, text: '', color: 'info' })
const exporting = ref(false)
const warehousePersistReady = ref(false)
const { t } = useI18n({ useScope: 'global' })

const filters = ref({
  cnName: '',
  enSku: '',
  warehouseId: null,
  id: '',
})

const headers = computed(() => [
  { title: '', key: 'thumb', width: '64', sortable: false },
  { title: 'ID', key: 'id', width: '88' },
  { title: 'SKU', key: 'en_sku', minWidth: '120' },
  { title: t('pages.dataCenterInventoryData.filters.productCnName'), key: 'cn_name', minWidth: '200' },
  { title: t('pages.dropShippingOrderCreate.sections.logistics.warehouse'), key: 'warehouse_name', minWidth: '150' },
  { title: t('pages.dataCenterInventoryData.headers.stock'), key: 'sku_num', minWidth: '100', align: 'end' },
  { title: t('pages.dataCenterInventoryData.headers.warningValue'), key: 'warn_num', minWidth: '96', align: 'end' },
  { title: t('pages.dataCenterInventoryData.headers.zone1'), key: 'num_one', minWidth: '72', align: 'end' },
  { title: t('pages.dataCenterInventoryData.headers.zone2'), key: 'num_two', minWidth: '72', align: 'end' },
  { title: t('pages.dataCenterInventoryData.headers.zone3'), key: 'num_three', minWidth: '72', align: 'end' },
  { title: t('pages.dataCenterInventoryData.headers.updatedAt'), key: 'logTime', minWidth: '120' },
])

const pageLength = computed(() => Math.max(1, Math.ceil(total.value / itemsPerPage.value)))

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function isLowStock(row) {
  const stock = Number(row?.sku_num)
  const warn = Number(row?.warn_num)
  if (!Number.isFinite(stock) || !Number.isFinite(warn))
    return false

  return stock < warn
}

function buildBody(pagination = null) {
  const body = {
    'current_page': pagination?.current_page ?? page.value,
    'per_page_num': pagination?.per_page_num ?? itemsPerPage.value,
  }

  if (filters.value.cnName.trim())
    body['cn_name'] = filters.value.cnName.trim()
  if (filters.value.enSku.trim())
    body['en_sku'] = filters.value.enSku.trim()
  if (filters.value.warehouseId != null && filters.value.warehouseId !== '')
    body['warehouse_id'] = Number(filters.value.warehouseId)

  const idRaw = String(filters.value.id || '').trim()
  if (idRaw) {
    const idNum = Number(idRaw)
    if (Number.isFinite(idNum))
      body.id = idNum
  }

  return body
}

async function exportToExcel() {
  if (exporting.value)
    return

  exporting.value = true
  try {
    const res = await $api('/package/kucun', {
      method: 'POST',
      body: buildBody({ 'current_page': 1, 'per_page_num': EXPORT_PAGE_SIZE }),
    })

    if (Number(res?.code) !== 1 || !res?.data) {
      toast(res?.msg || t('pages.dataCenterSalesAnalysis.messages.exportLoadFailed'), 'error')

      return
    }

    const list = Array.isArray(res.data.data) ? res.data.data : []
    if (!list.length) {
      toast(t('pages.dataCenterSalesAnalysis.messages.exportNoData'), 'warning')

      return
    }

    await downloadXlsx({
      filename: makeExportBasename(t('pages.dataCenterInventoryData.title')),
      sheetName: t('pages.dataCenterInventoryData.title'),
      columns: [
        { key: 'id', title: 'ID' },
        { key: 'en_sku', title: 'SKU' },
        { key: 'cn_name', title: t('pages.dataCenterInventoryData.filters.productCnName') },
        { key: 'warehouse_name', title: t('pages.dropShippingOrderCreate.sections.logistics.warehouse') },
        { key: 'warehouse_id', title: t('pages.dataCenterInventoryData.headers.warehouseId') },
        { key: 'sku_num', title: t('pages.dataCenterSalesAnalysis.headers.stockQty') },
        { key: 'warn_num', title: t('pages.dataCenterInventoryData.headers.warningValue') },
        { key: 'num_one', title: t('pages.dataCenterInventoryData.headers.zone1Qty') },
        { key: 'num_two', title: t('pages.dataCenterInventoryData.headers.zone2Qty') },
        { key: 'num_three', title: t('pages.dataCenterInventoryData.headers.zone3Qty') },
        { key: 'logTime', title: t('pages.dataCenterInventoryData.headers.updatedAt') },
        { key: 'img_url', title: t('pages.dataCenterInventoryData.headers.imageUrl') },
      ],
      rows: list,
    })
    toast(t('pages.dataCenterSalesAnalysis.messages.exportSuccess', { count: list.length, max: EXPORT_PAGE_SIZE }), 'success')
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.dataCenterSalesAnalysis.messages.exportFailed'), 'error')
  }
  finally {
    exporting.value = false
  }
}

async function loadList() {
  loading.value = true
  try {
    const res = await $api('/package/kucun', {
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
    toast(res?.msg || t('pages.dataCenterInventoryData.messages.loadFailed'), 'error')
  }
  catch (e) {
    rows.value = []
    total.value = 0
    toast(e?.data?.msg || e?.message || t('pages.dataCenterSalesAnalysis.messages.networkFailed'), 'error')
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

function resetFilters() {
  filters.value = {
    cnName: '',
    enSku: '',
    warehouseId: null,
    id: '',
  }
  searchList()
}

watch([page, itemsPerPage], loadList, { immediate: true })

watch(() => filters.value.warehouseId, v => {
  if (!warehousePersistReady.value)
    return
  setPreferredWarehouseId(v)
})

onMounted(async () => {
  const remote = await loadWarehouseOptions(t)

  warehouseOptions.value = [
    { title: t('pages.dropShippingOrderList.filters.allWarehouses'), value: null },
    ...remote,
  ]
  filters.value.warehouseId = resolveInitialWarehouseId(warehouseOptions.value, { preferFirstWhenNoCache: false })
  await nextTick()
  warehousePersistReady.value = true
})
</script>

<template>
  <VContainer
    fluid
    class="pa-4 pa-sm-6 dc-inventory-page"
  >
    <VSnackbar
      v-model="snack.show"
      :color="snack.color"
      location="top"
      :timeout="2600"
    >
      {{ snack.text }}
    </VSnackbar>

    <VCard class="rounded-lg dc-inventory-page__card">
      <VCardItem class="pb-4 pt-6 px-6">
        <template #title>
          <span class="text-h5 font-weight-medium">{{ $t('pages.dataCenterInventoryData.title') }}</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">
            {{ $t('pages.dataCenterInventoryData.subtitle') }}
          </span>
        </template>
      </VCardItem>
      <VDivider />
      <VCardText class="pa-4 pa-sm-6">
        <AppQueryPanel
          class="mb-4"
          :loading="loading"
          actions-position="bottom"
          @search="searchList"
          @reset="resetFilters"
        >
          <template #export>
            <VBtn
              color="primary"
              variant="tonal"
              size="small"
              prepend-icon="tabler-file-export"
              :loading="exporting"
              :disabled="loading"
              @click="exportToExcel"
            >
              {{ $t('pages.dataCenterSalesAnalysis.actions.exportExcel') }}
            </VBtn>
          </template>
          <VRow class="dc-inventory-page__filters">
            <VCol
              cols="12"
              sm="6"
              md="3"
            >
              <AppTextField
                v-model="filters.cnName"
                :label="$t('pages.dataCenterInventoryData.filters.productCnName')"
                :placeholder="$t('pages.dataCenterInventoryData.filters.productCnNamePlaceholder')"
                hide-details
                density="compact"
                @keyup.enter="searchList"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
              md="3"
            >
              <AppTextField
                v-model="filters.enSku"
                label="SKU"
                :placeholder="$t('pages.dataCenterInventoryData.filters.skuPlaceholder')"
                hide-details
                density="compact"
                @keyup.enter="searchList"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
              md="3"
            >
              <AppSelect
                v-model="filters.warehouseId"
                :items="warehouseOptions"
                item-title="title"
                item-value="value"
                :label="$t('pages.dropShippingOrderCreate.sections.logistics.warehouse')"
                hide-details
                density="compact"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
              md="3"
            >
              <AppTextField
                v-model="filters.id"
                :label="$t('pages.dataCenterInventoryData.filters.recordId')"
                :placeholder="$t('pages.dataCenterInventoryData.filters.recordIdPlaceholder')"
                hide-details
                density="compact"
                inputmode="numeric"
                @keyup.enter="searchList"
              />
            </VCol>
          </VRow>
        </AppQueryPanel>

        <VDataTableServer
          :headers="headers"
          :items="rows"
          :items-length="total"
          :loading="loading"
          item-value="id"
          class="text-body-2 dc-inventory-page__table"
        >
          <template #header.num_one>
            <span class="d-inline-flex align-center justify-end gap-1 w-100">
              {{ $t('pages.dataCenterInventoryData.headers.zone1') }}
              <VTooltip location="top">
                <template #activator="{ props }">
                  <VIcon
                    v-bind="props"
                    icon="tabler-help"
                    size="16"
                    class="text-medium-emphasis"
                  />
                </template>
                {{ $t('pages.dataCenterInventoryData.tooltips.zone1') }}
              </VTooltip>
            </span>
          </template>

          <template #header.num_two>
            <span class="d-inline-flex align-center justify-end gap-1 w-100">
              {{ $t('pages.dataCenterInventoryData.headers.zone2') }}
              <VTooltip location="top">
                <template #activator="{ props }">
                  <VIcon
                    v-bind="props"
                    icon="tabler-help"
                    size="16"
                    class="text-medium-emphasis"
                  />
                </template>
                {{ $t('pages.dataCenterInventoryData.tooltips.zone2') }}
              </VTooltip>
            </span>
          </template>

          <template #header.num_three>
            <span class="d-inline-flex align-center justify-end gap-1 w-100">
              {{ $t('pages.dataCenterInventoryData.headers.zone3') }}
              <VTooltip location="top">
                <template #activator="{ props }">
                  <VIcon
                    v-bind="props"
                    icon="tabler-help"
                    size="16"
                    class="text-medium-emphasis"
                  />
                </template>
                {{ $t('pages.dataCenterInventoryData.tooltips.zone3') }}
              </VTooltip>
            </span>
          </template>

          <template #item.thumb="{ item }">
            <div class="dc-inventory-page__thumb">
              <VAvatar
                v-if="item.img_url"
                rounded
                size="40"
              >
                <VImg
                  :src="item.img_url"
                  cover
                />
              </VAvatar>
              <VAvatar
                v-else
                rounded
                size="40"
                color="primary"
                variant="tonal"
              >
                <VIcon
                  icon="tabler-photo"
                  size="22"
                />
              </VAvatar>
            </div>
          </template>

          <template #item.cn_name="{ item }">
            <span class="dc-inventory-page__cn-name">{{ item.cn_name || '—' }}</span>
          </template>

          <template #item.en_sku="{ item }">
            <span class="text-body-2 font-weight-medium">{{ item.en_sku || '—' }}</span>
          </template>

          <template #item.sku_num="{ item }">
            <div class="d-flex flex-column align-end gap-1">
              <span class="text-h6 font-weight-semibold tabular-nums">{{ item.sku_num ?? '—' }}</span>
              <VChip
                v-if="isLowStock(item)"
                size="x-small"
                color="warning"
                variant="tonal"
                class="align-self-end"
              >
                {{ $t('pages.dataCenterInventoryData.messages.lowStock') }}
              </VChip>
            </div>
          </template>

          <template #item.warn_num="{ item }">
            <span class="text-body-2 tabular-nums text-medium-emphasis">{{ item.warn_num ?? '—' }}</span>
          </template>

          <template #item.num_one="{ item }">
            <span class="tabular-nums">{{ item.num_one ?? '—' }}</span>
          </template>

          <template #item.num_two="{ item }">
            <span class="tabular-nums">{{ item.num_two ?? '—' }}</span>
          </template>

          <template #item.num_three="{ item }">
            <span class="tabular-nums">{{ item.num_three ?? '—' }}</span>
          </template>

          <template #item.logTime="{ item }">
            <span class="text-body-2 text-medium-emphasis">{{ item.logTime || '—' }}</span>
          </template>

          <template #bottom>
            <VDivider />
            <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-6 py-4">
              <span class="text-body-2 text-medium-emphasis">{{ $t('pages.dropShippingOrderList.pagination.total', { total }) }}</span>
              <div class="d-flex align-center gap-3">
                <AppSelect
                  :model-value="itemsPerPage"
                  :items="[10, 20, 50, 100]"
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
      </VCardText>
    </VCard>
  </VContainer>
</template>

<style scoped>
.dc-inventory-page__filters :deep(.v-col) {
  padding-block: 0.375rem;
}

.dc-inventory-page__card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.dc-inventory-page__table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  white-space: nowrap;
}

.dc-inventory-page__table :deep(tbody .v-data-table__td) {
  vertical-align: middle;
}

.dc-inventory-page__thumb :deep(.v-avatar) {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.dc-inventory-page__cn-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
