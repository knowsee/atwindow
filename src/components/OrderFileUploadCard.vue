<script setup>
import { $api } from '@/utils/api'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  accept: {
    type: String,
    default: '.pdf,.png,.jpg,.jpeg,.webp',
  },
  maxSizeMb: {
    type: Number,
    default: 5,
  },
  uploadLabel: {
    type: String,
    default: '',
  },
  tips: {
    type: String,
    default: '',
  },
  uploadedText: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue', 'uploaded', 'error'])
const { t } = useI18n({ useScope: 'global' })

const inputRef = ref(null)
const uploading = ref(false)
const isDisabled = computed(() => props.disabled || uploading.value)
const uploadLabelText = computed(() => props.uploadLabel || t('components.upload.label'))
const tipsText = computed(() => props.tips || t('components.upload.tips', { max: props.maxSizeMb }))
const uploadedLabel = computed(() => props.uploadedText || t('components.upload.uploaded'))

function openFilePicker() {
  if (isDisabled.value)
    return
  inputRef.value?.click()
}

async function uploadOrderFile(file) {
  const fd = new FormData()

  fd.append('file', file)

  const res = await $api('/order/uploadFile', {
    method: 'POST',
    body: fd,
  })

  if (Number(res?.code) === 1 && res?.data?.file_url)
    return String(res.data.file_url)

  throw new Error(res?.msg || t('components.upload.failed'))
}

async function onPickFile(event) {
  const file = event?.target?.files?.[0]
  if (!file)
    return

  const maxSizeBytes = props.maxSizeMb * 1024 * 1024
  if (file.size > maxSizeBytes) {
    emit('error', t('components.upload.maxSize', { max: props.maxSizeMb }))
    event.target.value = ''

    return
  }

  uploading.value = true
  try {
    const url = await uploadOrderFile(file)

    emit('update:modelValue', url)
    emit('uploaded', url)
  }
  catch (e) {
    emit('error', e?.message || t('components.upload.failed'))
  }
  finally {
    uploading.value = false
    event.target.value = ''
  }
}

function clearFile() {
  if (isDisabled.value)
    return
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="order-upload-card">
    <button
      type="button"
      class="order-upload-card__trigger"
      :disabled="isDisabled"
      @click="openFilePicker"
    >
      <VProgressCircular
        v-if="uploading"
        indeterminate
        size="24"
        width="2"
        color="primary"
        class="mb-2"
      />
      <VIcon
        v-else
        icon="tabler-cloud-upload"
        size="24"
        color="primary"
        class="mb-2"
      />
      <div class="text-primary text-body-2 font-weight-medium">
        {{ uploadLabelText }}
      </div>
      <div class="text-medium-emphasis text-body-2 whitespace-pre-line">
        {{ tipsText }}
      </div>
    </button>

    <input
      ref="inputRef"
      class="d-none"
      type="file"
      :accept="accept"
      :disabled="isDisabled"
      @change="onPickFile"
    >

    <div
      v-if="modelValue"
      class="d-flex align-center gap-2 flex-wrap mt-3"
    >
      <VChip
        size="small"
        variant="tonal"
        color="primary"
      >
        {{ uploadedLabel }}
      </VChip>
      <VBtn
        size="small"
        variant="text"
        color="primary"
        class="text-none"
        :href="resolveBackendFileUrl(modelValue)"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ $t('common.actions.preview') }}
      </VBtn>
      <VBtn
        size="small"
        variant="text"
        color="error"
        class="text-none"
        :disabled="isDisabled"
        @click="clearFile"
      >
        {{ $t('common.actions.clear') }}
      </VBtn>
    </div>
  </div>
</template>

<style scoped>
.order-upload-card__trigger {
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  inline-size: 128px;
  block-size: 128px;
  border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  background: transparent;
  transition: border-color 0.2s ease;
}

.order-upload-card__trigger:hover:not(:disabled) {
  border-color: rgb(var(--v-theme-primary));
}

.order-upload-card__trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
