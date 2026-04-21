<script setup>
import { $api } from '@/utils/api'
import PrintLabelSectionCard from '@/views/apps/print-label/PrintLabelSectionCard.vue'
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

const excelInputRef = ref()
const zipInputRef = ref()

/** 与订单创建页线路 ID 一致 */
const transportOptions = [
  { title: '自动渠道选择（试运行）', value: 99999 },
  { title: '自提', value: 200 },
  { title: 'USPS（T5）', value: 27 },
  { title: 'SPEEDX', value: 53 },
  { title: 'Amazon', value: 56 },
  { title: 'UPS Ground（限重1-150磅，2-6个工作日签收）', value: 50 },
  { title: 'Fedex（限重1-150磅，2-6个工作日签收）', value: 59 },
  { title: 'Gofo', value: 210 },
  { title: 'UNI（重量≤13.5kg，最小尺寸:10*15cm，单边不得超过50cm，三边之和不得超过120cm）', value: 211 },
  { title: 'NEXTDAY（限重50磅）', value: 213 },
  { title: 'USPS-Y（限重5磅）', value: 214 },
]

const form = ref({
  transportType: null,
  warehouseId: null,
  excelFile: null,
  zipFile: null,
})

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function goList() {
  router.push({ name: 'apps-drop-shipping-order-list' })
}

function pickExcel() {
  excelInputRef.value?.click()
}

function pickZip() {
  zipInputRef.value?.click()
}

function onExcelChange(event) {
  form.value.excelFile = event?.target?.files?.[0] || null
}

function onZipChange(event) {
  form.value.zipFile = event?.target?.files?.[0] || null
}

function buildFormData() {
  const data = new FormData()

  data.append('type', '2')
  data.append('transport_type', String(form.value.transportType))
  data.append('warehouse_id', String(form.value.warehouseId))
  data.append('signature_type', '0')
  data.append('file', form.value.excelFile)
  if (form.value.zipFile)
    data.append('zip', form.value.zipFile)

  return data
}

function validateForm() {
  if (form.value.transportType == null || form.value.transportType === '') {
    toast('请选择线路', 'warning')

    return false
  }
  if (!form.value.warehouseId) {
    toast('请选择仓库', 'warning')

    return false
  }
  if (!form.value.excelFile) {
    toast('请先选择 Excel 文件', 'warning')

    return false
  }

  const ext = form.value.excelFile.name.split('.').pop()?.toLowerCase()
  if (!['xls', 'xlsx'].includes(ext || '')) {
    toast('仅支持 .xls / .xlsx 文件', 'warning')

    return false
  }

  return true
}

async function submitBatch() {
  if (!validateForm())
    return

  submitting.value = true
  try {
    const res = await $api('/order/batchorder', {
      method: 'POST',
      body: buildFormData(),
    })

    if (Number(res?.code) === 1) {
      toast(res?.msg || '批量创建成功', 'success')
      setTimeout(goList, 600)
    }
    else {
      toast(res?.msg || '批量创建失败', 'error')
    }
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '批量创建失败', 'error')
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
  form.value.warehouseId = resolveInitialWarehouseId(warehouseOptions.value, { preferFirstWhenNoCache: true })
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
          批量创建订单
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-2">
          选择线路与仓库，上传 Excel（及可选自提 ZIP）后提交批量下单。
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
        title="线路与仓库"
        subtitle="与单笔下单一致，将应用于本批 Excel 中的订单。"
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
              v-model="form.transportType"
              :items="transportOptions"
              item-title="title"
              item-value="value"
              label="线路"
              density="comfortable"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <AppSelect
              v-model="form.warehouseId"
              :items="warehouseOptions"
              item-title="title"
              item-value="value"
              label="仓库"
              density="comfortable"
            />
          </VCol>
        </VRow>
      </PrintLabelSectionCard>

      <PrintLabelSectionCard
        title="上传文件"
        subtitle="订单 Excel 必填；自提场景可再传面单 ZIP。仅支持 .xls / .xlsx 与 .zip。"
        class="mb-4"
      >
        <input
          ref="excelInputRef"
          type="file"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="d-none"
          @change="onExcelChange"
        >
        <input
          ref="zipInputRef"
          type="file"
          accept=".zip,application/zip"
          class="d-none"
          @change="onZipChange"
        >

        <VRow align="stretch">
          <VCol
            cols="12"
            md="6"
            class="d-flex"
          >
            <VSheet
              rounded="lg"
              border
              class="app-batch-upload flex-grow-1 w-100"
              @click="pickExcel"
            >
              <div class="app-batch-upload__inner">
                <VIcon
                  icon="tabler-file-spreadsheet"
                  size="30"
                  class="text-primary mb-2"
                />
                <div class="text-subtitle-2">
                  点击选择订单 Excel
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
          </VCol>
          <VCol
            cols="12"
            md="6"
            class="d-flex"
          >
            <VSheet
              rounded="lg"
              border
              class="app-batch-upload flex-grow-1 w-100"
              @click="pickZip"
            >
              <div class="app-batch-upload__inner">
                <VIcon
                  icon="tabler-file-zip"
                  size="30"
                  class="text-primary mb-2"
                />
                <div class="text-subtitle-2">
                  点击选择自提面单 ZIP（可选）
                </div>
                <div
                  v-if="form.zipFile"
                  class="text-body-2 text-primary mt-2 text-center"
                >
                  {{ form.zipFile.name }}
                </div>
                <div
                  v-else
                  class="text-caption text-medium-emphasis mt-2"
                >
                  未选择文件
                </div>
              </div>
            </VSheet>
          </VCol>
        </VRow>

        <div class="mt-3 text-body-2 text-medium-emphasis">
          Excel 列字段请以运营提供的批量模板为准。
        </div>
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
            提交批量创建
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
  display: flex;
  flex-direction: column;
  min-block-size: 200px;
}

.app-batch-upload:hover {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.04);
}

.app-batch-upload__inner {
  flex: 1;
  min-block-size: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
</style>
