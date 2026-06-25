<script setup>
import { applyUpdate } from '@/composables/useVersionCheck'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <VDialog
    max-width="450"
    :model-value="props.modelValue"
    persistent
  >
    <VCard class="text-center px-8 py-6">
      <VCardText>
        <VBtn
          icon
          variant="outlined"
          color="warning"
          class="my-4"
          style="block-size: 88px; inline-size: 88px; pointer-events: none;"
        >
          <VIcon
            icon="tabler-alert-triangle"
            size="38"
          />
        </VBtn>

        <h5 class="text-h5 mb-2">
          检测到新版本
        </h5>

        <p class="text-body-1 text-medium-emphasis">
          页面已更新，请刷新以获取最新版本
        </p>
      </VCardText>

      <VCardText>
        <VBtn
          color="primary"
          variant="elevated"
          @click="applyUpdate"
        >
          立即刷新
        </VBtn>
      </VCardText>
    </VCard>
  </VDialog>
</template>