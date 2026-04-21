<script setup>
/**
 * 地址新增/编辑弹窗（与 /order/addAddr、/order/editAddr 字段一致，UI 与面单创建对齐）
 */
const props = defineProps({
  /** 1 发件 2 收件 — 用于副标题与接口 type */
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
  /** 锁定国家（短码）时禁用国家下拉 */
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

const visible = defineModel({ type: Boolean, default: false })
const form = defineModel('form', { type: Object, required: true })

const emit = defineEmits(['submit'])

const formRef = ref()

function requiredField(v) {
  return String(v || '').trim() ? true : '必填项'
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

const contextLabel = computed(() => (props.addrType === 1 ? '发件地址' : '收件地址'))
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
          {{ isEdit ? '编辑地址' : '新增地址' }}
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
                label="姓名"
                :rules="[requiredField]"
              />
            </VCol>
            <VCol cols="12">
              <AppTextField
                v-model="form.address"
                label="详细地址 1"
                :rules="[requiredField]"
              />
            </VCol>
            <VCol cols="12">
              <AppTextField
                v-model="form.address2"
                label="详细地址 2"
                hint="可选"
                persistent-hint
              />
            </VCol>
            <VCol cols="12">
              <AppTextField
                v-model="form.streetno"
                label="街道 / 门牌"
                hint="可选（门牌、街道补充）"
                persistent-hint
              />
            </VCol>
            <VCol
              cols="12"
              sm="4"
            >
              <AppTextField
                v-model="form.city"
                label="城市"
                :rules="[requiredField]"
              />
            </VCol>
            <VCol
              cols="12"
              sm="4"
            >
              <AppTextField
                v-model="form.province"
                label="省 / 州"
                :rules="[requiredField]"
              />
            </VCol>
            <VCol
              cols="12"
              sm="4"
            >
              <AppTextField
                v-model="form.postcode"
                label="邮政编码"
                :rules="[requiredField]"
              />
            </VCol>
            <VCol cols="12">
              <AppSelect
                v-model="form.country"
                :items="countryItems"
                :loading="countriesLoading"
                label="国家 / 地区"
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
                label="电话"
                :rules="[requiredField]"
              />
            </VCol>
            <VCol
              cols="12"
              md="6"
            >
              <AppTextField
                v-model="form.company"
                label="公司"
              />
            </VCol>
            <VCol cols="12">
              <AppTextField
                v-model="form.email"
                label="邮箱"
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
          取消
        </VBtn>
        <VBtn
          color="primary"
          :loading="submitting"
          @click="onSave"
        >
          {{ isEdit ? '保存' : '创建' }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
