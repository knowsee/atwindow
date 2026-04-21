<script setup>
import { $api } from '@/utils/api'

definePage({
  meta: {
    action: 'read',
    subject: 'AclDemo',
  },
})

const loading = ref(false)
const submitting = ref(false)
const tabType = ref(1)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const rows = ref([])
const countries = ref([])
const countriesLoading = ref(false)
const formDialog = ref(false)
const isEdit = ref(false)
const editingId = ref('')
const snack = ref({ show: false, text: '', color: 'info' })

const form = ref({
  name: '',
  country: '',
  province: '',
  city: '',
  streetno: '',
  address: '',
  address2: '',
  email: '',
  postcode: '',
  telephone: '',
  company: '',
})

const tabItems = [
  { title: '发件地址', value: 1 },
  { title: '收件地址', value: 2 },
]

const headers = [
  { title: 'ID', key: 'id', width: 90 },
  { title: '姓名', key: 'name', minWidth: 120 },
  { title: 'Address line 1', key: 'address', minWidth: 160 },
  { title: 'Address line 2', key: 'address2', minWidth: 120 },
  { title: 'City', key: 'city', minWidth: 96 },
  { title: 'Province', key: 'province', minWidth: 88 },
  { title: 'Postal code', key: 'postcode', minWidth: 96 },
  { title: 'Country', key: 'country', minWidth: 96 },
  { title: 'Street', key: 'streetno', minWidth: 88 },
  { title: '电话', key: 'telephone', minWidth: 140 },
  { title: '公司', key: 'company', minWidth: 140 },
  { title: '操作', key: 'actions', width: 90, sortable: false, align: 'end' },
]

const totalPages = computed(() => Math.max(1, Math.ceil((Number(total.value) || 0) / Number(pageSize.value || 10))))

const countryItems = computed(() =>
  countries.value.map(item => ({
    title: [item.short_name, item.en_name, item.cn_name].filter(Boolean).join(' - ') || item.short_name || item.cn_name || item.en_name,
    value: item.short_name || item.cn_name || item.en_name,
  })),
)

function toast(text, color = 'info') {
  snack.value = { show: true, text, color }
}

function normalizeRows(rawRows) {
  return (Array.isArray(rawRows) ? rawRows : []).map(item => ({
    ...item,
    telephone: item.telephone || item.phone || '',
  }))
}

function emptyForm() {
  return {
    name: '',
    country: '',
    province: '',
    city: '',
    streetno: '',
    address: '',
    address2: '',
    email: '',
    postcode: '',
    telephone: '',
    company: '',
  }
}

function resetForm() {
  editingId.value = ''
  isEdit.value = false
  form.value = emptyForm()
}

function openCreate() {
  resetForm()
  formDialog.value = true
}

function openEdit(row) {
  isEdit.value = true
  editingId.value = row.id
  form.value = {
    name: row.name || '',
    country: row.country_code || row.country || '',
    province: row.province || '',
    city: row.city || '',
    streetno: row.streetno || row.street_no || '',
    address: row.address || '',
    address2: row.address2 || row.address_2 || '',
    email: row.email || '',
    postcode: row.postcode || '',
    telephone: row.telephone || row.phone || '',
    company: row.company || '',
  }
  formDialog.value = true
}

async function loadCountries() {
  countriesLoading.value = true
  try {
    const res = await $api('/order/queryCountry', { method: 'POST', body: {} })
    if (Number(res?.code) === 1 && Array.isArray(res?.data)) {
      countries.value = res.data

      return
    }

    countries.value = []
    toast(res?.msg || '加载国家列表失败', 'error')
  }
  catch (e) {
    countries.value = []
    toast(e?.data?.msg || e?.message || '加载国家列表失败', 'error')
  }
  finally {
    countriesLoading.value = false
  }
}

async function loadList() {
  loading.value = true
  try {
    const res = await $api('/order/queryAddr', {
      method: 'POST',
      body: {
        'current_page': Number(currentPage.value) || 1,
        'per_page_num': Number(pageSize.value) || 10,
        type: Number(tabType.value),
      },
    })

    if (Number(res?.code) === 1 && res?.data) {
      total.value = Number(res.data.count) || 0
      currentPage.value = Number(res.data.current_page) || Number(currentPage.value) || 1
      pageSize.value = Number(res.data.per_page_num) || Number(pageSize.value) || 10
      rows.value = normalizeRows(res.data.data)

      return
    }

    rows.value = []
    total.value = 0
    toast(res?.msg || '加载地址列表失败', 'error')
  }
  catch (e) {
    rows.value = []
    total.value = 0
    toast(e?.data?.msg || e?.message || '网络请求失败', 'error')
  }
  finally {
    loading.value = false
  }
}

async function submitForm() {
  submitting.value = true
  try {
    const token = useCookie('accessToken').value || ''

    const payload = {
      name: form.value.name.trim(),
      country: form.value.country,
      province: form.value.province.trim(),
      city: form.value.city.trim(),
      streetno: (form.value.streetno || '').trim(),
      address: form.value.address.trim(),
      address2: (form.value.address2 || '').trim(),
      email: (form.value.email || '').trim(),
      postcode: form.value.postcode.trim(),
      telephone: form.value.telephone.trim(),
      company: (form.value.company || '').trim(),
      type: Number(tabType.value),
      token,
    }

    const path = isEdit.value ? '/order/editAddr' : '/order/addAddr'
    if (isEdit.value)
      payload.id = String(editingId.value)

    const res = await $api(path, { method: 'POST', body: payload })
    if (Number(res?.code) === 1) {
      toast(res?.msg || (isEdit.value ? '编辑成功' : '创建成功'), 'success')
      formDialog.value = false
      await loadList()

      return
    }

    toast(res?.msg || '保存失败', 'error')
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || '网络请求失败', 'error')
  }
  finally {
    submitting.value = false
  }
}

watch(tabType, () => {
  currentPage.value = 1
  loadList()
})

watch(currentPage, () => {
  loadList()
})

onMounted(loadList)
onMounted(loadCountries)
</script>

<template>
  <VContainer
    fluid
    class="pa-4 pa-sm-6"
  >
    <VSnackbar
      v-model="snack.show"
      :color="snack.color"
      location="top"
      :timeout="2600"
    >
      {{ snack.text }}
    </VSnackbar>

    <VCard border>
      <VCardItem>
        <VCardTitle class="text-h5 font-weight-medium">
          地址管理
        </VCardTitle>
        <VCardSubtitle>
          切换「发件地址 / 收件地址」查看对应地址簿记录。
        </VCardSubtitle>
      </VCardItem>

      <VDivider />

      <VCardText class="pt-4">
        <VTabs
          v-model="tabType"
          color="primary"
          density="comfortable"
          class="mb-4"
        >
          <VTab
            v-for="item in tabItems"
            :key="item.value"
            :value="item.value"
            class="text-none"
          >
            {{ item.title }}
          </VTab>
        </VTabs>
        <div class="d-flex justify-end mb-4">
          <VBtn
            color="primary"
            size="small"
            prepend-icon="tabler-plus"
            @click="openCreate"
          >
            新增地址
          </VBtn>
        </div>

        <VDataTable
          :headers="headers"
          :items="rows"
          :loading="loading"
          item-key="id"
          density="comfortable"
          class="text-body-2"
          hover
        >
          <template #item.address="{ item }">
            <span :title="item.address">{{ item.address || '—' }}</span>
          </template>
          <template #item.address2="{ item }">
            <span :title="item.address2 || item.address_2">{{ item.address2 || item.address_2 || '—' }}</span>
          </template>
          <template #item.streetno="{ item }">
            <span :title="item.streetno || item.street_no">{{ item.streetno || item.street_no || '—' }}</span>
          </template>
          <template #item.telephone="{ item }">
            <span>{{ item.telephone || '—' }}</span>
          </template>
          <template #item.company="{ item }">
            <span>{{ item.company || '—' }}</span>
          </template>
          <template #item.actions="{ item }">
            <IconBtn @click="openEdit(item)">
              <VIcon icon="tabler-edit" />
            </IconBtn>
          </template>
          <template #bottom />
        </VDataTable>

        <div class="d-flex flex-wrap align-center justify-space-between mt-4 gap-3">
          <div class="text-body-2 text-medium-emphasis">
            共 {{ total }} 条
          </div>
          <VPagination
            v-model="currentPage"
            :length="totalPages"
            :total-visible="$vuetify.display.xs ? 3 : 7"
            rounded
          />
        </div>
      </VCardText>
    </VCard>

    <AddressFormDialog
      v-model="formDialog"
      v-model:form="form"
      :addr-type="Number(tabType)"
      :is-edit="isEdit"
      :editing-id="String(editingId || '')"
      :country-items="countryItems"
      :countries-loading="countriesLoading"
      :submitting="submitting"
      @submit="submitForm"
    />
  </VContainer>
</template>
