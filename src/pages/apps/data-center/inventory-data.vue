<script setup>
import { $api } from '@/utils/api'
import AppQueryPanel from '@/@core/components/AppQueryPanel.vue'
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

const filters = ref({
  cnName: '',
  enSku: '',
  warehouseId: null,
  id: '',
})

const headers = [
  { title: '', key: 'thumb', width: '64', sortable: false },
  { title: 'ID', key: 'id', width: '88' },
  { title: 'SKU', key: 'en_sku', minWidth: '120' },
  { title: '产品中文名', key: 'cn_name', minWidth: '200' },
  { title: '仓库', key: 'warehouse_name', minWidth: '150' },
  { title: '库存', key: 'sku_num', minWidth: '100', align: 'end' },
  { title: '预警值', key: 'warn_num', minWidth: '96', align: 'end' },
  { title: '区1', key: 'num_one', minWidth: '72', align: 'end' },
  { title: '区2', key: 'num_two', minWidth: '72', align: 'end' },
  { title: '区3', key: 'num_three', minWidth: '72', align: 'end' },
  { title: '更新日期', key: 'logTime', minWidth: '120' },
]

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
      toast(res?.msg || '获取导出数据失败', 'error')

      return
    }

    const list = Array.isArray(res.data.data) ? res.data.data : []
    if (!list.length) {
      toast('当前条件下无数据可导出', 'warning')

      return
    }

    await downloadXlsx({
      filename: makeExportBasename('库存数据'),
      sheetName: '库存数据',
      columns: [
        { key: 'id', title: 'ID' },
        { key: 'en_sku', title: 'SKU' },
        { key: 'cn_name', title: '产品中文名' },
        { key: 'warehouse_name', title: '仓库' },
        { key: 'warehouse_id', title: '仓库ID' },
        { key: 'sku_num', title: '库存数量' },
        { key: 'warn_num', title: '预警值' },
        { key: 'num_one', title: '区1数量' },
        { key: 'num_two', title: '区2数量' },
        { key: 'num_three', title: '区3数量' },
        { key: 'logTime', title: '更新日期' },
        { key: 'img_url', title: '图片链接' },
      ],
      rows: list,
    })
    toast(`已导出 ${list.length} 条（单次最多 ${EXPORT_PAGE_SIZE} 条）`, 'success')
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '导出失败', 'error')
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
    toast(res?.msg || '加载库存数据失败', 'error')
  }
  catch (e) {
    rows.value = []
    total.value = 0
    toast(e?.data?.msg || e?.message || '网络请求失败', 'error')
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
  const remote = await loadWarehouseOptions()

  warehouseOptions.value = [
    { title: '全部仓库', value: null },
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
          <span class="text-h5 font-weight-medium">库存数据</span>
        </template>
        <template #subtitle>
          <span class="text-body-2 text-medium-emphasis">
            按 SKU / 仓库查看在库数量、预警线与分区库存；支持筛选后分页查询。
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
              导出 Excel
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
                label="产品中文名"
                placeholder="模糊搜索中文名"
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
                placeholder="英文 SKU"
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
                label="仓库"
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
                label="记录 ID"
                placeholder="精确 ID"
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
              区1
              <VTooltip location="top">
                <template #activator="{ props }">
                  <VIcon
                    v-bind="props"
                    icon="tabler-help"
                    size="16"
                    class="text-medium-emphasis"
                  />
                </template>
                仓库分区一库存数量
              </VTooltip>
            </span>
          </template>

          <template #header.num_two>
            <span class="d-inline-flex align-center justify-end gap-1 w-100">
              区2
              <VTooltip location="top">
                <template #activator="{ props }">
                  <VIcon
                    v-bind="props"
                    icon="tabler-help"
                    size="16"
                    class="text-medium-emphasis"
                  />
                </template>
                仓库分区二库存数量
              </VTooltip>
            </span>
          </template>

          <template #header.num_three>
            <span class="d-inline-flex align-center justify-end gap-1 w-100">
              区3
              <VTooltip location="top">
                <template #activator="{ props }">
                  <VIcon
                    v-bind="props"
                    icon="tabler-help"
                    size="16"
                    class="text-medium-emphasis"
                  />
                </template>
                仓库分区三库存数量
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
                低于预警
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
            <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-4 py-3">
              <span class="text-body-2 text-medium-emphasis">共 {{ total }} 条</span>
              <div class="d-flex align-center gap-3">
                <AppSelect
                  :model-value="itemsPerPage"
                  :items="[10, 20, 50, 100]"
                  style="inline-size: 96px;"
                  density="compact"
                  hide-details
                  @update:model-value="itemsPerPage = Number($event)"
                />
                <VPagination
                  v-model="page"
                  :length="pageLength"
                  :total-visible="7"
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
