<script setup>
import { computed } from 'vue'
import PrintLabelSectionCard from '@/views/apps/print-label/PrintLabelSectionCard.vue'

/**
 * 货品明细：与模板中 VDataTable + VCard 区块规范一致（见 ecommerce 列表、订单详情）
 */
const props = defineProps({
  products: {
    type: Array,
    required: true,
  },
  unitLabel: {
    type: Object,
    required: true,
  },
  selectedCurrency: {
    type: String,
    required: true,
  },
  selectedCnNameRequired: {
    type: Boolean,
    default: true,
  },
  selectedValueRequired: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['add', 'remove'])

const headers = computed(() => {
  const w = props.unitLabel.w
  const cur = props.selectedCurrency

  return [
    {
      title: '#',
      key: 'line',
      sortable: false,
      width: '52px',
      align: 'center',
    },
    {
      title: 'SKU',
      key: 'sku',
      sortable: false,
      minWidth: '140px',
    },
    {
      title: '英文名称',
      key: 'en_name',
      sortable: false,
      minWidth: '160px',
    },
    {
      title: props.selectedCnNameRequired ? '中文名称 *' : '中文名称',
      key: 'cn_name',
      sortable: false,
      minWidth: '140px',
    },
    {
      title: '数量',
      key: 'sku_num',
      sortable: false,
      width: '132px',
      align: 'center',
    },
    {
      title: `每件重量（${w}）`,
      key: 'weight',
      sortable: false,
      width: '152px',
      align: 'end',
    },
    {
      title: props.selectedValueRequired ? `申报价值（${cur}） *` : `申报价值（${cur}）`,
      key: 'value',
      sortable: false,
      width: '152px',
      align: 'end',
    },
    {
      title: '操作',
      key: 'actions',
      sortable: false,
      width: '72px',
      align: 'center',
    },
  ]
})

function lineNo(index) {
  return index + 1
}
</script>

<template>
  <PrintLabelSectionCard
    class="print-label-products-card"
    body-class="print-label-products-body overflow-x-auto"
  >
    <template #title>
      <h6 class="text-h6 font-weight-medium text-high-emphasis">
        货品信息
      </h6>
    </template>
    <template #subtitle>
      <span class="text-body-2 text-medium-emphasis">请逐行填写 SKU、中英文品名、数量与申报；至少保留一行。</span>
    </template>
    <template #append>
      <VBtn
        variant="tonal"
        size="small"
        prepend-icon="tabler-plus"
        @click="emit('add')"
      >
        添加货品
      </VBtn>
    </template>

    <VDataTable
      :headers="headers"
      :items="products"
      :items-per-page="-1"
      hide-default-footer
      density="compact"
      class="text-no-wrap print-label-products-table"
      style="min-inline-size: min(100%, 960px)"
    >
      <template #item.line="{ index }">
        <span class="text-medium-emphasis">{{ lineNo(index) }}</span>
      </template>

      <template #item.sku="{ item }">
        <VTextField
          v-model="item.sku"
          variant="outlined"
          density="compact"
          hide-details
          placeholder="SKU"
          autocomplete="off"
          class="print-label-products-table__field"
        />
      </template>

      <template #item.en_name="{ item }">
        <VTextField
          v-model="item.en_name"
          variant="outlined"
          density="compact"
          hide-details
          placeholder="英文品名"
          autocomplete="off"
          class="print-label-products-table__field"
        />
      </template>

      <template #item.cn_name="{ item }">
        <VTextField
          v-model="item.cn_name"
          variant="outlined"
          density="compact"
          hide-details
          placeholder="中文品名"
          autocomplete="off"
          class="print-label-products-table__field"
        />
      </template>

      <template #item.sku_num="{ item }">
        <VTextField
          v-model.number="item.sku_num"
          type="number"
          min="1"
          variant="outlined"
          density="compact"
          hide-details
          class="print-label-products-table__field print-label-products-table__field--num"
        />
      </template>

      <template #item.weight="{ item }">
        <VTextField
          v-model="item.weight"
          type="number"
          step="any"
          variant="outlined"
          density="compact"
          hide-details
          class="print-label-products-table__field print-label-products-table__field--num"
        />
      </template>

      <template #item.value="{ item }">
        <VTextField
          v-model="item.value"
          type="number"
          step="any"
          variant="outlined"
          density="compact"
          hide-details
          class="print-label-products-table__field print-label-products-table__field--num"
        />
      </template>

      <template #item.actions="{ index }">
        <IconBtn
          color="error"
          size="small"
          :disabled="products.length <= 1"
          @click="emit('remove', index)"
        >
          <VIcon
            icon="tabler-trash"
            size="20"
          />
        </IconBtn>
      </template>
    </VDataTable>
  </PrintLabelSectionCard>
</template>

<style scoped>
/* 与区块其它卡片一致的内边距，表格在区域内横向滚动 */
.print-label-products-body {
  padding-block: 1.25rem 1.5rem;
  padding-inline: 1.5rem;
}

@media (min-width: 600px) {
  .print-label-products-body {
    padding-block: 1.5rem 1.75rem;
    padding-inline: 1.75rem;
  }
}

.print-label-products-table {
  border-radius: 0 0 inherit inherit;
}

/* 表头：与模板数据表区背景一致 */
.print-label-products-table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  font-size: 0.8125rem;
  letter-spacing: 0.025em;
  text-transform: none;
  background: rgba(var(--v-theme-on-surface), 0.04) !important;
  border-block-end: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
  white-space: nowrap;
}

.print-label-products-table :deep(tbody td) {
  vertical-align: middle;
  padding-block: 10px !important;
}

.print-label-products-table__field {
  min-inline-size: 0;
}

.print-label-products-table__field :deep(.v-field) {
  margin-block-end: 0;
}

.print-label-products-table__field--num {
  max-inline-size: 140px;
  margin-inline-start: auto;
}

.print-label-products-table :deep(.v-data-table__td:last-child) {
  padding-inline: 8px !important;
}
</style>
