<script setup>
const props = defineProps({
  addrType: {
    type: Number,
    required: true,
    validator: v => v === 1 || v === 2,
  },
  isEdit: {
    type: Boolean,
    default: false,
  },
  editingId: {
    type: String,
    default: '',
  },
  countryLock: {
    type: String,
    default: null,
  },
  countryItems: {
    type: Array,
    default: () => [],
  },
  countriesLoading: {
    type: Boolean,
    default: false,
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  maxWidth: {
    type: [String, Number],
    default: 760,
  },
})

const emit = defineEmits(['submit'])
const visible = defineModel({ type: Boolean, default: false })
const form = defineModel('form', { type: Object, required: true })

const formRef = ref()
const { t } = useI18n({ useScope: 'global' })

function requiredField(v) {
  return String(v || '').trim() ? true : t('components.addressForm.required')
}

watch(visible, v => {
  if (v)
    nextTick(() => formRef.value?.resetValidation?.())
})

function onClose() {
  visible.value = false
}

async function onSave() {
  const { valid } = await formRef.value?.validate?.() || { valid: true }
  if (valid === false)
    return
  emit('submit')
}

const contextLabel = computed(() => (props.addrType === 1 ? t('components.addressForm.context.sender') : t('components.addressForm.context.receiver')))
const countryDisabled = computed(() => !!String(props.countryLock || '').trim())
</script>

<template>
  <VDialog
    v-model="visible"
    :max-width="maxWidth"
    :persistent="submitting"
    scrollable
  >
    <VCard class="rounded-lg">
      <VCardItem>
        <VCardTitle class="text-h6 font-weight-medium">
          {{ isEdit ? $t('components.addressForm.title.edit') : $t('components.addressForm.title.create') }}
        </VCardTitle>
        <VCardSubtitle>
          {{ contextLabel }}
        </VCardSubtitle>
      </VCardItem>
      <VDivider />
      <VCardText class="pt-4">
        <VForm ref="formRef">
          <VRow>
            <VCol cols="12">
              <AppTextField
                v-model="form.name"
                :label="$t('components.addressForm.fields.name')"
                :rules="[requiredField]"
              />
            </VCol>
            <VCol cols="12">
              <AppTextField
                v-model="form.address"
                :label="$t('components.addressForm.fields.address1')"
                :rules="[requiredField]"
              />
            </VCol>
            <VCol cols="12">
              <AppTextField
                v-model="form.address2"
                :label="$t('components.addressForm.fields.address2')"
                :hint="$t('components.addressForm.hints.optional')"
                persistent-hint
              />
            </VCol>
            <VCol cols="12">
              <AppTextField
                v-model="form.streetno"
                :label="$t('components.addressForm.fields.street')"
                :hint="$t('components.addressForm.hints.street')"
                persistent-hint
              />
            </VCol>
            <VCol
              cols="12"
              sm="4"
            >
              <AppTextField
                v-model="form.city"
                :label="$t('components.addressForm.fields.city')"
                :rules="[requiredField]"
              />
            </VCol>
            <VCol
              cols="12"
              sm="4"
            >
              <AppTextField
                v-model="form.province"
                :label="$t('components.addressForm.fields.province')"
                :rules="[requiredField]"
              />
            </VCol>
            <VCol
              cols="12"
              sm="4"
            >
              <AppTextField
                v-model="form.postcode"
                :label="$t('components.addressForm.fields.postcode')"
                :rules="[requiredField]"
              />
            </VCol>
            <VCol cols="12">
              <AppSelect
                v-model="form.country"
                :items="countryItems"
                :loading="countriesLoading"
                :label="$t('components.addressForm.fields.country')"
                :disabled="countryDisabled"
                :rules="[requiredField]"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="form.telephone"
                :label="$t('components.addressForm.fields.telephone')"
                :rules="[requiredField]"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="form.company"
                :label="$t('components.addressForm.fields.company')"
              />
            </VCol>
            <VCol cols="12">
              <AppTextField
                v-model="form.email"
                :label="$t('components.addressForm.fields.email')"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
      <VCardActions class="justify-end px-6 pb-5">
        <VBtn
          variant="text"
          :disabled="submitting"
          @click="onClose"
        >
          {{ $t('components.addressForm.actions.cancel') }}
        </VBtn>
        <VBtn
          color="primary"
          :loading="submitting"
          @click="onSave"
        >
          {{ isEdit ? $t('components.addressForm.actions.save') : $t('components.addressForm.actions.create') }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
