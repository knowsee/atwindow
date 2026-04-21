<script setup>
import AppQueryPanel from '@/@core/components/AppQueryPanel.vue'
import { $api } from '@/utils/api'
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
const warehousePersistReady = ref(false)

const typeItems = [
  { title: '全部品相', value: '' },
  { title: '良品', value: '良品' },
  { title: '不良品', value: '不良品' },
]

const filters = ref({
  warehouseId: null,
  type: '',
  enSku: '',
})

const headers = [
  { title: 'SKU', key: 'sku', minWidth: '140' },
  { title: '品相', key: 'type', minWidth: '96' },
  { title: '仓库', key: 'warehouse_name', minWidth: '160' },
  { title: '库存数量', key: 'sku_num', minWidth: '100', align: 'end' },
  { title: '到仓31–60天', key: 'num_one', minWidth: '120', align: 'end' },
  { title: '到仓61–90天', key: 'num_two', minWidth: '120', align: 'end' },
  { title: '到仓90天以上', key: 'num_three', minWidth: '120', align: 'end' },
  { title: '仓储计费时间', key: 'logTime', minWidth: '160' },
]

const pageLength = computed(() => Math.max(1, Math.ceil(total.value / itemsPerPage.value)))

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function buildBody() {
  const body = {
    'current_page': page.value,
    'per_page_num': itemsPerPage.value,
  }

  if (filters.value.warehouseId != null && filters.value.warehouseId !== '')
    body['warehouse_id'] = Number(filters.value.warehouseId)
  if (filters.value.type)
    body.type = filters.value.type
  if (filters.value.enSku.trim())
    body['en_sku'] = filters.value.enSku.trim()

  return body
}

async function loadList() {
  loading.value = true
  try {
    const res = await $api('/package/returnKucun', {
      method: 'POST',
      body: buildBody(),
    })

    if (Number(res?.code) === 1 && res?.data) {
      const list = Array.isArray(res.data.data) ? res.data.data : []

      rows.value = list.map((r, i) => ({
        ...r,
        id: r.id ?? `${r.sku ?? 'row'}-${r.warehouse_id ?? r.warehouse_name ?? i}-${i}`,
      }))
      total.value = Number(res.data.count) || 0
    }
    else {
      rows.value = []
      total.value = 0
      toast(res?.msg || '加载退货库存失败', 'error')
    }
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
    warehouseId: resolveInitialWarehouseId(warehouseOptions.value, { preferFirstWhenNoCache: false }),
    type: '',
    enSku: '',
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
    class="pa-4 pa-sm-6"
  >
    <VSnackbar
      v-model="snack.show"
      :color="snack.color"
      location="top"
      :timeout="2600"
    >
      {{ snack.text }}
    </VSnackbar>

    <VCard class="rounded-lg">
      <VCardItem class="pb-4 pt-6 px-6">
        <template #title>
          <span class="text-h5 font-weight-medium">退货库存</span>
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
          <VRow dense>
            <VCol
              cols="12"
              md="4"
            >
              <AppSelect
                v-model="filters.warehouseId"
                :items="warehouseOptions"
                item-title="title"
                item-value="value"
                label="仓库"
                clearable
                hide-details
                density="compact"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppSelect
                v-model="filters.type"
                :items="typeItems"
                item-title="title"
                item-value="value"
                label="品相"
                clearable
                hide-details
                density="compact"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="filters.enSku"
                label="SKU"
                placeholder="输入 SKU"
                hide-details
                density="compact"
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
          class="text-body-2 dc-return-inventory__table"
        >
          <template #item.type="{ item }">
            <VChip
              size="small"
              variant="tonal"
              :color="item.type === '不良品' ? 'error' : 'success'"
            >
              {{ item.type || '—' }}
            </VChip>
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
.dc-return-inventory__table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  white-space: nowrap;
}
</style>
