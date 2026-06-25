<script setup>
const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  message: {
    type: String,
    default: '',
  },
})

const { t } = useI18n({ useScope: 'global' })
const displayedMessage = computed(() => props.message || t('components.loadingOverlay.defaultMessage'))
</script>

<template>
  <div class="position-relative">
    <VOverlay
      :model-value="loading"
      contained
      persistent
      scrim="rgba(15, 23, 42, 0.38)"
      class="align-center justify-center"
    >
      <div class="d-flex align-center text-body-1 font-weight-medium px-5 py-3 rounded-lg bg-surface elevation-8">
        <VProgressCircular
          indeterminate
          size="20"
          width="3"
          color="primary"
          class="me-3"
        />
        <span>{{ displayedMessage }}</span>
      </div>
    </VOverlay>
    <slot />
  </div>
</template>
