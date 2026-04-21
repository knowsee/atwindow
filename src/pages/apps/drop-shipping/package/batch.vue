<script setup>
import { $api } from '@/utils/api'
import PrintLabelSectionCard from '@/views/apps/print-label/PrintLabelSectionCard.vue'
import { resolveBackendFileUrl } from '@/utils/backendFileUrl'
import { resolveInitialWarehouseId, setPreferredWarehouseId } from '@/utils/warehousePreference'
import { loadWarehouseOptions } from '@/views/apps/drop-shipping/useDropShippingShared'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const router = useRouter()
const submitting = ref(false)
const snack = ref({ show: false, text: '', color: 'info' })
const warehouseOptions = ref([])
const warehousePersistReady = ref(false)
const fileInputRef = ref()

const form = ref({
  warehouseId: null,
  excelFile: null,
})

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function goList() {
  router.push({ name: 'apps-drop-shipping-package-list' })
}

function pickFile() {
  fileInputRef.value?.click()
}

function onFileChange(event) {
  form.value.excelFile = event?.target?.files?.[0] || null
}

async function submitBatch() {
  if (!form.value.excelFile) {
    toast('请先选择 Excel 文件', 'warning')

    return
  }

  const ext = form.value.excelFile.name.split('.').pop()?.toLowerCase()
  if (!['xls', 'xlsx'].includes(ext || '')) {
    toast('仅支持 .xls / .xlsx 文件', 'warning')

    return
  }

  submitting.value = true
  try {
    const body = new FormData()

    body.append('file', form.value.excelFile)
    if (form.value.warehouseId)
      body.append('warehouse_id', String(form.value.warehouseId))

    const res = await $api('/package/batchruku', {
      method: 'POST',
      body,
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || '批量创建成功', 'success')

      const pdf = res?.data?.pdf
      if (pdf)
        window.open(resolveBackendFileUrl(pdf), '_blank', 'noopener')
      setTimeout(goList, 600)
    }
    else {
      toast(res?.msg || '批量创建失败', 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '上传失败', 'error')
  }
  finally {
    submitting.value = false
  }
}

watch(() => form.value.warehouseId, v => {
  if (!warehousePersistReady.value)
    return
  setPreferredWarehouseId(v)
})

onMounted(async () => {
  warehouseOptions.value = await loadWarehouseOptions()
  form.value.warehouseId = resolveInitialWarehouseId(warehouseOptions.value, { preferFirstWhenNoCache: false })
  await nextTick()
  warehousePersistReady.value = true
})
</script>

<template>
  <VContainer
    fluid
    class="app-batch-page pa-0"
  >
    <div class="app-batch-page__inner pb-12">
      <div class="app-batch-page__hero mb-6">
        <h1 class="text-h4 font-weight-medium text-high-emphasis">
          批量创建入库单
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-2">
          可选指定仓库，上传 Excel 后系统将批量创建入库单；成功后可自动打开面单 PDF。
        </p>
      </div>

      <VSnackbar
        v-model="snack.show"
        :color="snack.color"
        location="top"
        :timeout="2600"
      >
        {{ snack.text }}
      </VSnackbar>

      <PrintLabelSectionCard
        title="入库设置"
        subtitle="未选仓库时按系统默认规则处理。"
        class="mb-4"
      >
        <template #append>
          <VBtn
            variant="tonal"
            prepend-icon="tabler-arrow-left"
            @click="goList"
          >
            返回列表
          </VBtn>
        </template>
        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <AppSelect
              v-model="form.warehouseId"
              :items="warehouseOptions"
              item-title="title"
              item-value="value"
              label="仓库（可选）"
              clearable
              density="comfortable"
            />
          </VCol>
        </VRow>
      </PrintLabelSectionCard>

      <PrintLabelSectionCard
        title="上传文件"
        subtitle="仅支持 .xls / .xlsx，列字段以运营提供的入库批量模板为准。"
        class="mb-4"
      >
        <input
          ref="fileInputRef"
          type="file"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="d-none"
          @change="onFileChange"
        >

        <VSheet
          rounded="lg"
          border
          class="app-batch-upload"
          @click="pickFile"
        >
          <div class="app-batch-upload__inner">
            <VIcon
              icon="tabler-file-spreadsheet"
              size="30"
              class="text-primary mb-2"
            />
            <div class="text-subtitle-2">
              点击选择 Excel
            </div>
            <div
              v-if="form.excelFile"
              class="text-body-2 text-primary mt-2 text-center"
            >
              {{ form.excelFile.name }}
            </div>
            <div
              v-else
              class="text-caption text-medium-emphasis mt-2"
            >
              未选择文件
            </div>
          </div>
        </VSheet>
      </PrintLabelSectionCard>

      <VCard
        class="mt-6 rounded-lg border"
        variant="flat"
      >
        <VCardText class="d-flex justify-end flex-wrap gap-3 py-5 px-6">
          <VBtn
            color="primary"
            prepend-icon="tabler-upload"
            :loading="submitting"
            @click="submitBatch"
          >
            提交导入
          </VBtn>
        </VCardText>
      </VCard>
    </div>
  </VContainer>
</template>

<style scoped>
.app-batch-page {
  background: rgb(var(--v-theme-background));
}

.app-batch-page__inner {
  max-inline-size: 1440px;
  margin-inline: auto;
  padding: 1.5rem;
}

.app-batch-upload {
  cursor: pointer;
  border-style: dashed;
  transition: all 0.2s ease;
}

.app-batch-upload:hover {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.04);
}

.app-batch-upload__inner {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
</style>
