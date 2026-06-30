<script setup>
import { useConfigStore } from '@core/stores/config'

const { t } = useI18n()

const options = [
  { value: 'standard', icon: 'tabler-baseline-density-small' },
  { value: 'large', icon: 'tabler-baseline-density-medium' },
  { value: 'xlarge', icon: 'tabler-baseline-density-large' },
]

const configStore = useConfigStore()
const selectedItem = ref([configStore.fontSize])

watch(() => configStore.fontSize, () => {
  selectedItem.value = [configStore.fontSize]
}, { deep: true })
</script>

<template>
  <IconBtn color="rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity))">
    <VIcon icon="tabler-text-size" />

    <VTooltip
      activator="parent"
      open-delay="1000"
      scroll-strategy="close"
    >
      <span>{{ t('components.fontSizeSwitcher.tooltip') }}</span>
    </VTooltip>

    <VMenu
      activator="parent"
      offset="12px"
      :width="180"
    >
      <VList
        v-model:selected="selectedItem"
        mandatory
      >
        <VListItem
          v-for="{ value, icon } in options"
          :key="value"
          :value="value"
          :prepend-icon="icon"
          color="primary"
          @click="() => { configStore.fontSize = value }"
        >
          <VListItemTitle>
            {{ t(`components.fontSizeSwitcher.${value}`) }}
          </VListItemTitle>
        </VListItem>
      </VList>
    </VMenu>
  </IconBtn>
</template>