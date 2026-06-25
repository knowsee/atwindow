<script setup>
import { computed, ref, useSlots } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  subtitle: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  searchDisabled: {
    type: Boolean,
    default: false,
  },
  showReset: {
    type: Boolean,
    default: true,
  },
  searchLabel: {
    type: String,
    default: '',
  },
  resetLabel: {
    type: String,
    default: '',
  },
  actionsPosition: {
    type: String,
    default: 'top',
    validator: v => ['top', 'bottom'].includes(v),
  },

  /**
   * 为 true 且提供 `#advanced` 插槽时：只默认展示 `#primary`，其余放入高级搜索，需手动展开。
   * 未使用展开布局时仍走默认插槽（与历史用法兼容）。
   */
  expandable: {
    type: Boolean,
    default: false,
  },

  /**
   * 快捷筛选（如订单状态胶囊）。传入 { title, value }[]，非空时展示在底部「查询」等按钮下方（无底部栏时跟在表单区后）。
   * 与 quickFilter 搭配使用，并通过 v-model:quick-filter 或 @update:quick-filter 同步。
   */
  quickFilterItems: {
    type: Array,
    default: () => [],
  },
  quickFilter: {
    type: [String, Number],
    default: undefined,
  },
})

const emit = defineEmits(['search', 'reset', 'update:quickFilter'])

defineOptions({ name: 'AppQueryPanel' })

const slots = useSlots()
const { t } = useI18n({ useScope: 'global' })
const hasAdvancedSlot = computed(() => typeof slots.advanced === 'function')
const useExpandLayout = computed(() => props.expandable && hasAdvancedSlot.value)
const advancedOpen = ref(false)

const hasQuickFilters = computed(() => props.quickFilterItems.length > 0)
const panelTitle = computed(() => props.title || t('components.queryPanel.title'))
const searchButtonLabel = computed(() => props.searchLabel || t('components.queryPanel.search'))
const resetButtonLabel = computed(() => props.resetLabel || t('components.queryPanel.reset'))

const advancedToggleLabel = computed(() => advancedOpen.value
  ? t('components.queryPanel.collapseAdvanced')
  : t('components.queryPanel.expandAdvanced'))

function toggleAdvanced() {
  advancedOpen.value = !advancedOpen.value
}

function isQuickFilterActive(item) {
  return props.quickFilter === item.value
}

function selectQuickFilter(value) {
  emit('update:quickFilter', value)
}
</script>

<template>
  <VSheet
    border
    rounded="lg"
    class="app-query-panel bg-surface"
  >
    <div class="app-query-panel__toolbar d-flex flex-column flex-sm-row flex-wrap align-stretch align-sm-center gap-3">
      <div class="app-query-panel__title flex-grow-1 min-w-0">
        <div class="text-subtitle-2 text-high-emphasis font-weight-medium">
          {{ panelTitle }}
        </div>
        <div
          v-if="subtitle"
          class="text-caption text-medium-emphasis text-wrap mt-1"
        >
          {{ subtitle }}
        </div>
      </div>
      <div
        v-if="actionsPosition === 'top'"
        class="d-flex flex-shrink-0 gap-2 align-self-stretch align-self-sm-center"
      >
        <slot name="actions">
          <VBtn
            color="primary"
            size="small"
            prepend-icon="tabler-search"
            :loading="loading"
            :disabled="searchDisabled"
            class="flex-sm-grow-0"
            @click="emit('search')"
          >
            {{ searchButtonLabel }}
          </VBtn>
          <VBtn
            v-if="showReset"
            variant="tonal"
            size="small"
            prepend-icon="tabler-filter-off"
            :disabled="loading"
            @click="emit('reset')"
          >
            {{ resetButtonLabel }}
          </VBtn>
        </slot>
        <slot name="export" />
      </div>
    </div>

    <div class="app-query-panel__body">
      <template v-if="useExpandLayout">
        <slot name="primary" />
        <div class="app-query-panel__expand-toggle d-flex justify-center justify-sm-start">
          <VBtn
            variant="text"
            size="small"
            density="comfortable"
            class="text-none px-2"
            :prepend-icon="advancedOpen ? 'tabler-chevron-up' : 'tabler-chevron-down'"
            @click="toggleAdvanced"
          >
            {{ advancedToggleLabel }}
          </VBtn>
        </div>
        <VExpandTransition>
          <div
            v-show="advancedOpen"
            class="app-query-panel__advanced"
          >
            <slot name="advanced" />
          </div>
        </VExpandTransition>
      </template>
      <slot v-else />
    </div>

    <div
      v-if="actionsPosition === 'bottom'"
      class="app-query-panel__footer d-flex flex-wrap justify-end gap-2 mt-3 pt-3"
    >
      <slot name="actions">
        <VBtn
          color="primary"
          size="small"
          prepend-icon="tabler-search"
          :loading="loading"
          :disabled="searchDisabled"
          class="flex-sm-grow-0"
          @click="emit('search')"
        >
          {{ searchButtonLabel }}
        </VBtn>
        <VBtn
          v-if="showReset"
          variant="tonal"
          size="small"
          prepend-icon="tabler-filter-off"
          :disabled="loading"
          @click="emit('reset')"
        >
          {{ resetButtonLabel }}
        </VBtn>
      </slot>
      <slot name="export" />
    </div>

    <div
      v-if="hasQuickFilters"
      class="app-query-panel__quick-filter"
    >
      <div
        class="app-query-panel__quick-filter-inner d-flex flex-wrap align-center gap-2"
        role="tablist"
        :aria-label="$t('components.queryPanel.quickFilterAria')"
      >
        <VBtn
          v-for="item in quickFilterItems"
          :key="`quick-filter-${String(item.value)}`"
          type="button"
          size="small"
          rounded="pill"
          class="text-none app-query-panel__quick-filter-chip"
          :variant="isQuickFilterActive(item) ? 'flat' : 'tonal'"
          :color="isQuickFilterActive(item) ? 'primary' : 'default'"
          @click="selectQuickFilter(item.value)"
        >
          {{ item.title }}
        </VBtn>
      </div>
    </div>
  </VSheet>
</template>

<style scoped>
.app-query-panel {
  padding-block: 0.875rem;
  padding-inline: 1rem;
}

@media (min-width: 600px) {
  .app-query-panel {
    padding-block: 1rem;
    padding-inline: 1.25rem;
  }
}

.app-query-panel__toolbar {
  margin-block-end: 0.75rem;
  padding-block-end: 0.75rem;
  border-block-end: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.app-query-panel__body :deep(.v-row) {
  margin-block: -0.25rem;
}

.app-query-panel__body :deep(.v-col) {
  padding-block: 0.25rem;
}

.app-query-panel__expand-toggle {
  margin-block: 0.125rem 0.375rem;
}

.app-query-panel__advanced :deep(.v-row) {
  margin-block: -0.25rem;
}

.app-query-panel__footer {
  border-block-start: none;
}

.app-query-panel__quick-filter {
  overflow: visible;
  margin-block-start: 0.5rem;
  padding-block-start: 0.75rem;
  border-block-start: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.app-query-panel__quick-filter-inner {
  row-gap: 0.5rem;
}

.app-query-panel__quick-filter-chip {
  min-height: 2.25rem;
  padding-inline: 0.875rem;
  line-height: 1.35;
}
</style>
