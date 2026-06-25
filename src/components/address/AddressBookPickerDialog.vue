<script setup>
const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    default: '',
  },
  countryLock: {
    type: String,
    default: '',
  },
  items: {
    type: Array,
    default: () => [],
  },
  total: {
    type: Number,
    default: 0,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  pageSize: {
    type: Number,
    default: 10,
  },
  pageCount: {
    type: Number,
    default: 1,
  },
  contentClass: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'search', 'reset-search', 'select', 'load-page'])
const visible = defineModel({ type: Boolean, default: false })
const searchName = defineModel('searchName', { type: String, default: '' })
const currentPage = defineModel('currentPage', { type: Number, default: 1 })
const { t } = useI18n({ useScope: 'global' })

const tableHeaders = computed(() => [
  { title: t('components.addressForm.fields.name'), key: 'name', minWidth: '100' },
  { title: t('components.addressForm.fields.address1'), key: 'address', minWidth: '160' },
  { title: t('components.addressForm.fields.address2'), key: 'address2', minWidth: '120' },
  { title: t('components.addressForm.fields.city'), key: 'city', minWidth: '88' },
  { title: t('components.addressForm.fields.province'), key: 'province', minWidth: '80' },
  { title: t('components.addressForm.fields.postcode'), key: 'postcode', minWidth: '88' },
  { title: t('components.addressForm.fields.country'), key: 'country', minWidth: '88' },
  { title: t('components.addressForm.fields.street'), key: 'streetno', minWidth: '80' },
  { title: t('components.addressForm.fields.telephone'), key: 'telephone', minWidth: '112' },
  { title: t('pages.accountAddressManagement.headers.actions'), key: 'actions', sortable: false, align: 'end', width: '96' },
])

function rowProps({ item }) {
  return {
    class: 'addr-picker-dialog__row',
    onDblclick: () => emit('select', item),
  }
}

function onClose() {
  visible.value = false
  emit('close')
}

function onSearch() {
  emit('search')
}

function onResetSearch() {
  emit('reset-search')
}

function onLoadPage() {
  emit('load-page')
}

function onSelect(item) {
  emit('select', item)
}
</script>

<template>
  <VDialog
    v-model="visible"
    max-width="960"
    scrollable
    :content-class="contentClass || undefined"
  >
    <VCard class="addr-picker-dialog d-flex flex-column rounded-lg">
      <VCardItem class="addr-picker-dialog__head pt-5 pb-3 px-6">
        <template #title>
          <span class="text-h6 font-weight-medium text-high-emphasis">
            {{ title }}
          </span>
        </template>
        <template
          v-if="subtitle"
          #subtitle
        >
          <span class="text-body-2 text-medium-emphasis">
            {{ subtitle }}
          </span>
        </template>
        <template #append>
          <IconBtn
            :aria-label="$t('components.addressBookPicker.close')"
            @click="onClose"
          >
            <VIcon icon="tabler-x" />
          </IconBtn>
        </template>
      </VCardItem>

      <VDivider />

      <VCardText class="addr-picker-dialog__body pa-4 pa-sm-6">
        <VAlert
          v-if="countryLock"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-4 text-body-2"
        >
          {{ $t('components.addressBookPicker.countryLocked') }}
        </VAlert>

        <VSheet
          border
          rounded="lg"
          class="pa-4 mb-4 bg-surface"
        >
          <div class="d-flex flex-column gap-3 flex-sm-row align-sm-end">
            <AppTextField
              v-model="searchName"
              :label="$t('components.addressBookPicker.searchLabel')"
              :placeholder="$t('components.addressBookPicker.searchPlaceholder')"
              density="compact"
              clearable
              hide-details
              class="flex-grow-1 min-w-0"
              @keyup.enter="onSearch"
              @click:clear="onResetSearch"
            />
            <div class="d-flex gap-2 flex-shrink-0">
              <VBtn
                variant="tonal"
                size="small"
                prepend-icon="tabler-rotate"
                :disabled="loading"
                @click="onResetSearch"
              >
                {{ $t('components.addressBookPicker.reset') }}
              </VBtn>
              <VBtn
                color="primary"
                size="small"
                prepend-icon="tabler-search"
                :loading="loading"
                @click="onSearch"
              >
                {{ $t('components.addressBookPicker.search') }}
              </VBtn>
            </div>
          </div>
        </VSheet>

        <VDataTable
          :headers="tableHeaders"
          :items="items"
          :items-per-page="-1"
          hide-default-footer
          density="compact"
          :loading="loading"
          hover
          fixed-header
          :height="400"
          class="addr-picker-dialog__table text-body-2"
          :row-props="rowProps"
        >
          <template #item.address="{ item }">
            <span
              class="addr-picker-dialog__clip"
              :title="item.address"
            >{{ item.address || '—' }}</span>
          </template>
          <template #item.address2="{ item }">
            <span
              class="addr-picker-dialog__clip"
              :title="item.address2 || item.address_2 || ''"
            >{{ item.address2 || item.address_2 || '—' }}</span>
          </template>
          <template #item.streetno="{ item }">
            <span
              class="addr-picker-dialog__clip addr-picker-dialog__clip--narrow"
              :title="item.streetno || item.street_no || ''"
            >{{ item.streetno || item.street_no || '—' }}</span>
          </template>
          <template #item.telephone="{ item }">
            <span
              class="addr-picker-dialog__clip addr-picker-dialog__clip--narrow"
              :title="item.telephone"
            >{{ item.telephone }}</span>
          </template>
          <template #item.actions="{ item }">
            <VBtn
              variant="tonal"
              color="primary"
              size="small"
              class="text-none"
              @click.stop="onSelect(item)"
            >
              {{ $t('components.addressBookPicker.select') }}
            </VBtn>
          </template>
          <template #no-data>
            <div class="text-center py-10 px-4">
              <VIcon
                icon="tabler-book-upload"
                size="44"
                class="text-disabled mb-3"
              />
              <div class="text-body-1 text-medium-emphasis">
                {{ $t('components.addressBookPicker.emptyTitle') }}
              </div>
              <div class="text-body-2 text-disabled mt-1">
                {{ $t('components.addressBookPicker.emptyHint') }}
              </div>
            </div>
          </template>
        </VDataTable>
      </VCardText>

      <VDivider />

      <VCardActions class="addr-picker-dialog__footer px-4 px-sm-6 py-3">
        <span
          v-if="total > 0"
          class="text-body-2 text-medium-emphasis"
        >{{ $t('components.addressBookPicker.pagination', { total, pageSize }) }}</span>
        <VSpacer />
        <VPagination
          v-if="pageCount > 1"
          v-model="currentPage"
          :length="pageCount"
          rounded
          :total-visible="7"
          @update:model-value="onLoadPage"
        />
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.addr-picker-dialog__head :deep(.v-card-item__content) {
  gap: 0.125rem;
}

.addr-picker-dialog__row {
  cursor: pointer;
}

.addr-picker-dialog__clip {
  display: inline-block;
  max-inline-size: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.addr-picker-dialog__clip--narrow {
  max-inline-size: 140px;
}

.addr-picker-dialog__table {
  border-radius: 0.5rem;
  border: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.addr-picker-dialog__table :deep(.v-data-table__thead .v-data-table__th) {
  font-weight: 600 !important;
  font-size: 0.8125rem;
  letter-spacing: 0.025em;
  text-transform: none;
  background: rgba(var(--v-theme-on-surface), 0.04) !important;
  border-block-end: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
  white-space: nowrap;
}

.addr-picker-dialog__table :deep(tbody .v-data-table__td) {
  vertical-align: middle;
  padding-block: 10px !important;
}

.addr-picker-dialog__footer {
  flex-wrap: wrap;
}
</style>
