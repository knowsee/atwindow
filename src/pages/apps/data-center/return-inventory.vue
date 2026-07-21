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
const { t } = useI18n({ useScope: 'global' })

const QUALITY_GOOD = '\u826f\u54c1'
const QUALITY_BAD = '\u4e0d\u826f\u54c1'

const typeItems = computed(() => [
  { title: t('pages.dropShippingReturnPackageList.quality.all'), value: '' },
  { title: t('pages.dropShippingReturnOrderCreate.quality.good'), value: QUALITY_GOOD },
  { title: t('pages.dropShippingReturnOrderCreate.quality.bad'), value: QUALITY_BAD },
])

const filters = ref({
  warehouseId: null,
  type: '',
  enSku: '',
})

const headers = computed(() => [
  { title: 'SKU', key: 'sku', minWidth: '140' },
  { title: t('pages.dropShippingReturnPackageList.headers.quality'), key: 'type', minWidth: '96' },
  { title: t('pages.dropShippingOrderCreate.sections.logistics.warehouse'), key: 'warehouse_name', minWidth: '160' },
  { title: t('pages.dataCenterSalesAnalysis.headers.stockQty'), key: 'sku_num', minWidth: '100', align: 'end' },
  { title: t('pages.dataCenterReturnInventory.headers.arrived31To60'), key: 'num_one', minWidth: '120', align: 'end' },
  { title: t('pages.dataCenterReturnInventory.headers.arrived61To90'), key: 'num_two', minWidth: '120', align: 'end' },
  { title: t('pages.dataCenterReturnInventory.headers.arrivedOver90'), key: 'num_three', minWidth: '120', align: 'end' },
  { title: t('pages.dataCenterReturnInventory.headers.storageBillingTime'), key: 'logTime', minWidth: '160' },
])

const pageLength = computed(() => Math.max(1, Math.ceil(total.value / itemsPerPage.value)))

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function resolveQualityType(type) {
  if (type === QUALITY_GOOD)
    return t('pages.dropShippingReturnOrderCreate.quality.good')
  if (type === QUALITY_BAD)
    return t('pages.dropShippingReturnOrderCreate.quality.bad')

  return type || '—'
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
      toast(res?.msg || t('pages.dataCenterReturnInventory.messages.loadFailed'), 'error')
    }
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
          <span class="text-h5 font-weight-medium">{{ $t('pages.dataCenterReturnInventory.title') }}</span>
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
                :label="$t('pages.dropShippingOrderCreate.sections.logistics.warehouse')"
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
                :label="$t('pages.dropShippingReturnPackageList.headers.quality')"
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
                :placeholder="$t('pages.dataCenterReturnInventory.filters.skuPlaceholder')"
                hide-details
                density="compact"
                @keyup.enter="searchList"
              />
            </VCol>
          </VRow>
        </AppQueryPanel>

        <VDataTableServer
          disable-sort
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
              :color="item.type === QUALITY_BAD ? 'error' : 'success'"
            >
              {{ resolveQualityType(item.type) }}
            </VChip>
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
.dc-return-inventory__table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  white-space: nowrap;
}
</style>
