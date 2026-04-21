<script setup>
defineProps({
  variant: {
    type: String,
    default: 'outlined',
  },
  title: {
    type: String,
    default: '',
  },
  subtitle: {
    type: String,
    default: '',
  },

  /** 不显示标题下分割线（少见） */
  noDivider: {
    type: Boolean,
    default: false,
  },
  bodyClass: {
    type: [String, Object, Array],
    default: '',
  },

  /** 对话框等场景不需要底部外边距 */
  flush: {
    type: Boolean,
    default: false,
  },
})

defineOptions({ inheritAttrs: false })
</script>

<template>
  <VCard
    :variant="variant"
    class="print-label-section rounded-lg bg-surface"
    :class="flush ? '' : 'mb-6'"
    v-bind="$attrs"
  >
    <VCardItem class="print-label-section__head align-start pb-4 pt-5 px-6">
      <template
        v-if="$slots.title || title"
        #title
      >
        <slot name="title">
          <h6 class="text-h6 font-weight-medium text-high-emphasis">
            {{ title }}
          </h6>
        </slot>
      </template>
      <template
        v-if="$slots.subtitle || subtitle"
        #subtitle
      >
        <slot name="subtitle">
          <span class="text-body-2 text-medium-emphasis">{{ subtitle }}</span>
        </slot>
      </template>
      <template
        v-if="$slots.prepend"
        #prepend
      >
        <slot name="prepend" />
      </template>
      <template
        v-if="$slots.append"
        #append
      >
        <slot name="append" />
      </template>
    </VCardItem>

    <VDivider v-if="!noDivider" />

    <VCardText :class="bodyClass || 'print-label-section__body'">
      <slot />
    </VCardText>
  </VCard>
</template>

<style scoped>
.print-label-section__head :deep(.v-card-item__content) {
  gap: 0.125rem;
}

/* 正文与卡片边框留白（避免贴线）；默认由 bodyClass 覆盖时可不传 */
.print-label-section__body {
  padding-block: 1.25rem 1.5rem;
  padding-inline: 1.5rem;
}

@media (min-width: 600px) {
  .print-label-section__body {
    padding-block: 1.5rem 1.75rem;
    /* 与标题区 px-6（1.5rem）对齐，避免卡片标题与正文字段左缘错开 */
    padding-inline: 1.5rem;
  }
}
</style>
