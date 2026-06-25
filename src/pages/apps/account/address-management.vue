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
const { t } = useI18n({ useScope: 'global' })

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

const tabItems = computed(() => [
  { title: t('pages.accountAddressManagement.tabs.sender'), value: 1 },
  { title: t('pages.accountAddressManagement.tabs.receiver'), value: 2 },
])

const headers = computed(() => [
  { title: 'ID', key: 'id', width: 90 },
  { title: t('pages.accountAddressManagement.headers.name'), key: 'name', minWidth: 120 },
  { title: 'Address line 1', key: 'address', minWidth: 160 },
  { title: 'Address line 2', key: 'address2', minWidth: 120 },
  { title: 'City', key: 'city', minWidth: 96 },
  { title: 'Province', key: 'province', minWidth: 88 },
  { title: 'Postal code', key: 'postcode', minWidth: 96 },
  { title: 'Country', key: 'country', minWidth: 96 },
  { title: 'Street', key: 'streetno', minWidth: 88 },
  { title: t('pages.accountAddressManagement.headers.telephone'), key: 'telephone', minWidth: 140 },
  { title: t('pages.accountAddressManagement.headers.company'), key: 'company', minWidth: 140 },
  { title: t('pages.accountAddressManagement.headers.actions'), key: 'actions', width: 90, sortable: false, align: 'end' },
])

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
    toast(res?.msg || t('pages.accountAddressManagement.messages.countryLoadFailed'), 'error')
  }
  catch (e) {
    countries.value = []
    toast(e?.data?.msg || e?.message || t('pages.accountAddressManagement.messages.countryLoadFailed'), 'error')
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
    toast(res?.msg || t('pages.accountAddressManagement.messages.listLoadFailed'), 'error')
  }
  catch (e) {
    rows.value = []
    total.value = 0
    toast(e?.data?.msg || e?.message || t('pages.accountAddressManagement.messages.networkFailed'), 'error')
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
      toast(res?.msg || (isEdit.value ? t('pages.accountAddressManagement.messages.editSuccess') : t('pages.accountAddressManagement.messages.createSuccess')), 'success')
      formDialog.value = false
      await loadList()

      return
    }

    toast(res?.msg || t('pages.accountAddressManagement.messages.saveFailed'), 'error')
  }
  catch (e) {
    toast(e?.data?.msg || e?.message || t('pages.accountAddressManagement.messages.networkFailed'), 'error')
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
          {{ $t('pages.accountAddressManagement.title') }}
        </VCardTitle>
        <VCardSubtitle>
          {{ $t('pages.accountAddressManagement.subtitle') }}
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
            {{ $t('pages.accountAddressManagement.actions.add') }}
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
            <div class="d-flex align-center justify-end gap-1">
              <VTooltip :text="$t('pages.accountAddressManagement.actions.edit')">
                <template #activator="{ props }">
                  <IconBtn
                    v-bind="props"
                    size="small"
                    color="primary"
                    @click="openEdit(item)"
                  >
                    <VIcon
                      icon="tabler-pencil"
                      size="20"
                    />
                  </IconBtn>
                </template>
              </VTooltip>
            </div>
          </template>
          <template #bottom>
            <VDivider />
            <div class="d-flex align-center justify-space-between flex-wrap gap-3 px-6 py-4">
              <div class="text-body-2 text-medium-emphasis">
                {{ $t('pages.dropShippingOrderList.pagination.total', { total }) }}
              </div>
              <div class="d-flex align-center gap-3">
                <AppSelect
                  v-model="pageSize"
                  :items="[10, 20, 50, 100]"
                  density="compact"
                  hide-details
                  style="inline-size: 100px"
                />
                <VPagination
                  v-model="currentPage"
                  :length="totalPages"
                  :total-visible="5"
                  size="small"
                  active-color="primary"
                />
              </div>
            </div>
          </template>
        </vdatatable>
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
