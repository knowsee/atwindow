/* eslint-disable camelcase -- 下单/试算接口请求体字段与后端一致 */
import { $api, $apiJson } from '@/utils/api'
import { CHANNEL_ALERT_CONFIG, PRINT_LABEL_CHANNELS } from '@/views/apps/print-label/printLabelConfig'
import {
  adaptOrdernewRateToLegacyData,
  buildCountryOptions,
  extractCompareRateList,
  extractRouteOptions,
  matchCountryValue,
} from '@/views/apps/print-label/printLabelPricing'

export function usePrintLabelCreate() {
  const router = useRouter()
  const route = useRoute()
  const { t } = useI18n({ useScope: 'global' })
  const channels = PRINT_LABEL_CHANNELS

  const legacyOrigin = import.meta.env.VITE_LEGACY_ASSET_ORIGIN || 'https://www.atwindow.com'


  /**
   * 物流商 Logo：/images/translogo/* 默认走 Vite public（同源 /images/...）。
   * 需要 CDN 时在 .env 设置 VITE_TRANSLOGO_ORIGIN=https://wms.atwindow.com
   */
  const channelLogoSrc = path => {
    if (!path)
      return ''
    if (/^https?:\/\//i.test(path))
      return path
    const normalized = path.startsWith('/') ? path : `/${path}`
    if (normalized.startsWith('/images/translogo')) {
      const rawRemote = import.meta.env.VITE_TRANSLOGO_ORIGIN
      const remote = rawRemote != null ? String(rawRemote).trim() : ''
      if (remote !== '' && /^https?:\/\//i.test(remote)) {
        return `${remote.replace(/\/$/, '')}${normalized}`
      }
      const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
      
      return `${base}${normalized.replace(/^\//, '')}`.replace(/([^:]\/)\/+/g, '$1')
    }

    return `${legacyOrigin.replace(/\/$/, '')}${normalized}`
  }

  const compareMode = ref(false)
  const selectedQid = ref(channels[0]?.qid ?? null)
  const compareQids = ref(channels[0] ? [channels[0].qid] : [])

  const danwei = ref(0)
  const cankaohao = ref('')

  const sender = ref({
    id: '',
    name: '', country: '', province: '', city: '', streetno: '', address: '', address2: '',
    postCode: '', telephone: '', company: '',
  })

  const receiver = ref({
    id: '',
    name: '', country: '', province: '', city: '', streetno: '', address: '', address2: '',
    postCode: '', telephone: '', company: '',
  })

  const pkg = ref({ weight: '', length: '', width: '', height: '' })
  const products = ref([{ sku: '', sku_num: 1, en_name: '', cn_name: '', weight: '', value: '' }])

  const senderCountryList = ref([])
  const receiverCountryList = ref([])

  const addrDialog = ref(false)
  const addrDialogTarget = ref('sender')
  const addrList = ref([])
  const addrTotal = ref(0)
  const addrCurrentPage = ref(1)
  const addrPageSize = ref(10)
  const addrSearchName = ref('')
  const addrLoading = ref(false)

  /** 主界面收发件只读：从地址簿选择或浮窗新增/编辑成功后锁定 */
  const senderAddressLocked = ref(false)
  const receiverAddressLocked = ref(false)
  const senderSelectedFromBeianAddr = ref(false)

  const addrFormDialog = ref(false)
  const addrFormTarget = ref('sender')
  const addrFormIsEdit = ref(false)
  const addrFormEditingId = ref('')
  const addrFormSubmitting = ref(false)
  const addrFormCountriesLoading = ref(false)
  const addrFormCountryList = ref([])

  const addrForm = ref({
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

  const rateLoading = ref(false)
  const rateBest = ref(null)
  const rateCompareList = ref([])
  const routeOptions = ref([])
  const selectedRouteKey = ref('')

  const submitting = ref(false)
  const orderLoading = ref(false)
  const copyLoading = ref(false)

  const snack = ref({ show: false, text: '', color: 'info' })
  function toast(text, color = 'info') {
    snack.value = { show: true, text, color }
  }

  const unitLabel = computed(() => (danwei.value === 0 ? { w: 'g', l: 'cm' } : { w: 'lb', l: 'in' }))
  const selectedChannel = computed(() => channels.find(c => c.qid === selectedQid.value))
  const selectedCurrency = computed(() => selectedChannel.value?.currency || 'USD')
  const selectedValueRequired = computed(() => !!selectedChannel.value?.valueRequired)
  const selectedNeedRouteSelect = computed(() => !!selectedChannel.value?.needRouteSelect)
  const selectedCnNameRequired = computed(() => (selectedChannel.value ? selectedChannel.value.cnNameRequired !== false : true))
  const senderCountryLock = computed(() => selectedChannel.value?.senderCountryLock || null)
  const receiverCountryLock = computed(() => selectedChannel.value?.receiverCountryLock || null)
  const senderNeedBeianAddr = computed(() => !!selectedChannel.value?.senderNeedBeianAddr)

  const anySelectedNeedBeianAddr = computed(() => {
    const activeQids = compareMode.value
      ? normalizeCompareQids(compareQids.value)
      : [selectedQid.value]

    return activeQids.some(qid => {
      const channel = channels.find(c => Number(c.qid) === Number(qid))

      return !!channel?.senderNeedBeianAddr
    })
  })

  const selectedChannelAlert = computed(() => {
    if (!CHANNEL_ALERT_CONFIG)
      return null
    
    return CHANNEL_ALERT_CONFIG[selectedQid.value] || CHANNEL_ALERT_CONFIG.default || null
  })

  const hasRateResult = computed(() => (compareMode.value ? rateCompareList.value.length > 0 : !!rateBest.value))
  const selectedRoute = computed(() => routeOptions.value.find(r => r.key === selectedRouteKey.value) || null)

  /** 渠道 Logo 加载失败时降级为图标 */
  const brokenLogoQids = ref({})
  function onChannelLogoError(qid) {
    const key = String(qid)

    brokenLogoQids.value = { ...brokenLogoQids.value, [key]: true }
  }

  /** 试算主价格展示（兼容多种后端字段） */
  const primaryQuoteTitle = computed(() => {
    const d = rateBest.value
    if (!d)
      return ''
    if (d.wuliu_name)
      return d.wuliu_name
    const first = Array.isArray(d.rate_list) && d.rate_list.length ? d.rate_list[0] : null
    
    return first?.wuliu_name || first?.serviceType || t('pages.printLabelCreate.messages.rateTitleFallback')
  })

  const primaryQuoteAmount = computed(() => {
    const d = rateBest.value
    if (!d)
      return null
    if (d.money != null)
      return d.money
    if (d.totalAmount != null)
      return d.totalAmount
    const first = Array.isArray(d.rate_list) && d.rate_list.length ? d.rate_list[0] : null
    if (!first)
      return null
    if (first.fee != null)
      return typeof first.fee === 'object' && first.fee?.money != null ? first.fee.money : first.fee
    const tf = first.rate?.totalFee
    if (tf != null)
      return typeof tf === 'object' && tf?.money != null ? tf.money : tf
    
    return null
  })

  const addrPageCount = computed(() => Math.max(1, Math.ceil(addrTotal.value / addrPageSize.value)))

  const addrFormCountryItems = computed(() =>
    addrFormCountryList.value.map(item => ({
      title: [item.short_name, item.en_name, item.cn_name].filter(Boolean).join(' - ') || item.short_name || item.cn_name || item.en_name,
      value: item.short_name || item.cn_name || item.en_name,
    })),
  )

  function channelProvider(ch) {
    if (!ch)
      return 0

    return Number(ch.provider ?? ch.qid) || 0
  }

  function buildPostalAddressFromRef(addr, countryList, countryLock) {
    const cnt = countryList.value.find(c => c.value === addr.country)
    const code = countryLock || (cnt?.short_name || addr.country || '').trim()

    return {
      name: String(addr.name || '').trim(),
      telephone: String(addr.telephone || '').trim(),
      country: code,
      country_code: code,
      state: String(addr.province || '').trim(),
      province: String(addr.province || '').trim(),
      city: String(addr.city || '').trim(),
      streetno: String(addr.streetno || '').trim(),
      postcode: String(addr.postCode || '').trim(),
      code: String(addr.postCode || '').trim(),
      address1: String(addr.address || '').trim(),
      address: String(addr.address || '').trim(),
      address2: String(addr.address2 || '').trim(),
    }
  }

  function buildShippingCommonBody() {
    const sid = Number(sender.value.id)
    const rid = Number(receiver.value.id)
    const declaredSum = products.value.reduce((s, p) => s + (Number(p.value) || 0), 0)

    const body = {
      cankaohao: String(cankaohao.value || '').trim(),
      sender: buildPostalAddressFromRef(sender.value, senderCountryList, senderCountryLock.value),
      recipient: buildPostalAddressFromRef(receiver.value, receiverCountryList, receiverCountryLock.value),
      package: {
        weight: Number(pkg.value.weight) || 0,
        length: Number(pkg.value.length) || 0,
        width: Number(pkg.value.width) || 0,
        height: Number(pkg.value.height) || 0,
        declared_value: declaredSum,
        value: declaredSum,
      },
      items: products.value.map(p => ({
        sku: String(p.sku || '').trim(),
        en_name: String(p.en_name || '').trim(),
        cn_name: String(p.cn_name || '').trim(),
        qty: Number(p.sku_num) || 1,
        sku_num: Number(p.sku_num) || 1,
        weight: Number(p.weight) || 0,
        value: Number(p.value) || 0,
        values: Number(p.value) || 0,
      })),
      currency: 'USD',
      extra: {
        source: 'web',
        danwei: danwei.value,
      },
    }

    if (Number.isFinite(sid) && sid > 0)
      body.sender_address_id = sid
    if (Number.isFinite(rid) && rid > 0)
      body.recipient_address_id = rid

    return body
  }

  function resolveChannelCode(routeInfo) {
    const picked = routeInfo != null
      ? routeInfo
      : (routeOptions.value.find(r => r.key === selectedRouteKey.value) || null)

    if (picked?.rateName)
      return String(picked.rateName).trim()
    const rl = rateBest.value?.rate_list
    const first = Array.isArray(rl) && rl.length ? rl[0] : null
    const rt = first?.rate
    if (rt?.rateName)
      return String(rt.rateName).trim()
    if (typeof rt?.totalFee === 'object' && rt?.rateName)
      return String(rt.rateName).trim()

    return ''
  }

  function normalizeCompareQids(qids) {
    const existsQids = channels.map(c => Number(c.qid))

    const unique = []

    ;(qids || []).forEach(q => {
      const n = Number(q)
      if (Number.isFinite(n) && existsQids.includes(n) && !unique.includes(n))
        unique.push(n)
    })
    
    return unique
  }

  function isChannelSelected(ch) {
    const qid = Number(ch.qid)
    
    return compareMode.value ? compareQids.value.includes(qid) : selectedQid.value === qid
  }

  function onChannelCardClick(ch) {
    const qid = Number(ch.qid)
    if (!compareMode.value) {
      selectedQid.value = qid
      
      return
    }
    if (compareQids.value.includes(qid)) {
      if (compareQids.value.length <= 1) {
        toast(t('pages.printLabelCreate.messages.keepCompareChannel'), 'warning')
        
        return
      }
      compareQids.value = compareQids.value.filter(v => v !== qid)
      if (selectedQid.value === qid)
        selectedQid.value = compareQids.value[0]
      
      return
    }
    compareQids.value = normalizeCompareQids(compareQids.value.concat([qid]))
    selectedQid.value = qid
  }

  function getChannelName(qid) {
    const ch = channels.find(c => c.qid === Number(qid))
    
    return ch ? ch.name : String(qid)
  }

  function resetRateState() {
    routeOptions.value = []
    selectedRouteKey.value = ''
    rateBest.value = null
    rateCompareList.value = []
  }

  function resetSenderAddressSelection() {
    sender.value = {
      id: '',
      name: '',
      country: senderCountryLock.value && senderCountryList.value.length
        ? matchCountryValue(senderCountryList.value, senderCountryLock.value)
        : '',
      province: '',
      city: '',
      streetno: '',
      address: '',
      address2: '',
      postCode: '',
      telephone: '',
      company: '',
    }
    senderAddressLocked.value = false
    senderSelectedFromBeianAddr.value = false
  }

  watch(selectedQid, () => {
    resetRateState()
    if (compareMode.value && !compareQids.value.includes(selectedQid.value))
      compareQids.value = normalizeCompareQids(compareQids.value.concat([selectedQid.value]))
    if (senderCountryLock.value && senderCountryList.value.length)
      sender.value.country = matchCountryValue(senderCountryList.value, senderCountryLock.value)
    if (receiverCountryLock.value && receiverCountryList.value.length)
      receiver.value.country = matchCountryValue(receiverCountryList.value, receiverCountryLock.value)
  })

  watch(compareMode, v => {
    if (v)
      compareQids.value = normalizeCompareQids(compareQids.value.concat([selectedQid.value]))
    else
      compareQids.value = selectedQid.value ? [selectedQid.value] : []
    resetRateState()
  })

  watch(anySelectedNeedBeianAddr, (needsBeian, previousNeedsBeian) => {
    if (previousNeedsBeian === undefined || needsBeian === previousNeedsBeian)
      return

    if (senderAddressLocked.value)
      toast(t('pages.printLabelCreate.messages.senderAddressResetForChannelChange'), 'warning')

    resetSenderAddressSelection()
  })

  async function loadSenderCountries() {
    try {
      const res = await $api('/order/queryCountry', { method: 'POST', body: {} })
      if (Number(res?.code) === 1 && res.data) {
        senderCountryList.value = buildCountryOptions(res.data)
        if (senderCountryLock.value)
          sender.value.country = matchCountryValue(senderCountryList.value, senderCountryLock.value)
      }
    }
    catch (e) {
      console.error(e)
    }
  }

  async function loadReceiverCountries() {
    try {
      const res = await $api('/order/queryCountry', { method: 'POST', body: {} })
      if (Number(res?.code) === 1 && res.data) {
        receiverCountryList.value = buildCountryOptions(res.data)
        if (receiverCountryLock.value)
          receiver.value.country = matchCountryValue(receiverCountryList.value, receiverCountryLock.value)
      }
    }
    catch (e) {
      console.error(e)
    }
  }

  onMounted(() => {
    loadSenderCountries()
    loadReceiverCountries()
  })

  function validate() {
    if (!selectedQid.value) {
      toast(t('pages.printLabelCreate.messages.selectChannel'), 'warning')
      
      return false
    }
    cankaohao.value = String(cankaohao.value ?? '').replace(/\W/g, '')

    const ck = String(cankaohao.value).trim()
    if (!ck) {
      toast(t('pages.printLabelCreate.messages.referenceRequired'), 'warning')
      
      return false
    }
    if (!/^\w+$/.test(ck)) {
      toast(t('pages.printLabelCreate.messages.referenceInvalid'), 'warning')
      
      return false
    }
    const s = sender.value
    if (!s.name || !s.province || !s.city || !s.address || !s.postCode || !s.telephone) {
      toast(t('pages.printLabelCreate.messages.senderRequired'), 'warning')
      
      return false
    }
    const r = receiver.value
    if (!r.name || !r.province || !r.city || !r.address || !r.postCode || !r.telephone) {
      toast(t('pages.printLabelCreate.messages.receiverRequired'), 'warning')
      
      return false
    }
    if (!senderAddressLocked.value || !receiverAddressLocked.value) {
      toast(t('pages.printLabelCreate.messages.addressMustBeLocked'), 'warning')
      
      return false
    }
    if (anySelectedNeedBeianAddr.value && !senderSelectedFromBeianAddr.value) {
      toast(t('pages.printLabelCreate.messages.senderBeianRequired'), 'warning')

      return false
    }
    const p = pkg.value
    if (!p.weight || !p.length || !p.width || !p.height) {
      toast(t('pages.printLabelCreate.messages.packageRequired'), 'warning')
      
      return false
    }
    if (!products.value.length) {
      toast(t('pages.printLabelCreate.messages.productRequired'), 'warning')
      
      return false
    }
    for (let i = 0; i < products.value.length; i++) {
      const row = products.value[i] || {}
      const line = t('pages.printLabelCreate.messages.productLine', { line: i + 1 })
      if (!String(row.sku || '').trim()) {
        toast(t('pages.printLabelCreate.messages.productSkuRequired', { line }), 'warning')
        
        return false
      }
      if (!String(row.en_name || '').trim()) {
        toast(t('pages.printLabelCreate.messages.productEnNameRequired', { line }), 'warning')
        
        return false
      }
      if (selectedCnNameRequired.value && !String(row.cn_name || '').trim()) {
        toast(t('pages.printLabelCreate.messages.productCnNameRequired', { line }), 'warning')
        
        return false
      }
      const skuNum = Number(row.sku_num)
      if (!Number.isFinite(skuNum) || skuNum <= 0) {
        toast(t('pages.printLabelCreate.messages.productQtyPositive', { line }), 'warning')
        
        return false
      }
      const itemWeight = Number(row.weight)
      if (!Number.isFinite(itemWeight) || itemWeight <= 0) {
        toast(t('pages.printLabelCreate.messages.productWeightPositive', { line }), 'warning')
        
        return false
      }
      if (selectedValueRequired.value) {
        const itemValue = Number(row.value)
        if (!Number.isFinite(itemValue) || itemValue <= 0) {
          toast(t('pages.printLabelCreate.messages.productValueRequired', { line }), 'warning')
          
          return false
        }
      }
    }
    
    return true
  }

  async function doRate() {
    if (!validate())
      return
    let qidList = compareMode.value ? normalizeCompareQids(compareQids.value) : [selectedQid.value]
    if (!qidList.length) {
      toast(t('pages.printLabelCreate.messages.selectRateChannel'), 'warning')
      
      return
    }
    if (compareMode.value) {
      compareQids.value = qidList
      if (!qidList.includes(selectedQid.value))
        selectedQid.value = qidList[0]
    }

    rateLoading.value = true
    resetRateState()

    try {
      const base = buildShippingCommonBody()

      const body = compareMode.value
        ? { ...base, providers: qidList.map(q => channelProvider(channels.find(c => Number(c.qid) === Number(q)))).filter(Boolean) }
        : { ...base, provider: channelProvider(selectedChannel.value) }

      const res = await $apiJson('/Ordernewapi/shippingRate', { method: 'POST', body })

      rateLoading.value = false
      if (Number(res?.code) !== 1 || !res.data) {
        toast(res?.msg || t('pages.printLabelCreate.messages.rateFailed'), 'error')
        
        return
      }

      const legacyData = adaptOrdernewRateToLegacyData(res.data, channels, compareMode.value, qidList)

      if (compareMode.value) {
        rateCompareList.value = extractCompareRateList(legacyData, channels)
        if (!rateCompareList.value.length)
          toast(t('pages.printLabelCreate.messages.compareNoData'), 'warning')
        else
          toast(t('pages.printLabelCreate.messages.compareSuccess'), 'success')
      }
      else {
        rateBest.value = legacyData
        if (selectedNeedRouteSelect.value) {
          routeOptions.value = extractRouteOptions(legacyData)
          if (!routeOptions.value.length)
            toast(t('pages.printLabelCreate.messages.routeMissingAfterRate'), 'warning')
        }
        toast(t('pages.printLabelCreate.messages.rateSuccess'), 'success')
      }
      await nextTick()
      document.getElementById('rate-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    catch (e) {
      rateLoading.value = false
      toast(e?.data?.msg || e?.message || t('pages.printLabelCreate.messages.networkRetry'), 'error')
      console.error(e)
    }
  }

  function openAddrDialog(target) {
    addrDialogTarget.value = target
    addrSearchName.value = ''
    addrCurrentPage.value = 1
    addrList.value = []
    addrDialog.value = true
    nextTick(() => loadAddrList())
  }

  function closeAddrDialog() {
    addrDialog.value = false
  }

  async function loadAddrList() {
    addrLoading.value = true

    const addrType = addrDialogTarget.value === 'sender' ? 1 : 2
    const lock = addrDialogTarget.value === 'sender' ? senderCountryLock.value : receiverCountryLock.value
    const path = (addrDialogTarget.value === 'sender' && anySelectedNeedBeianAddr.value) ? '/order/beianAddr' : '/order/queryAddr'
    try {
      const params = {
        type: addrType,
        current_page: addrCurrentPage.value,
        per_page_num: addrPageSize.value,
      }

      if (addrSearchName.value)
        params.name = addrSearchName.value
      if (lock)
        params.country = lock

      const res = await $api(path, { method: 'POST', body: params })

      addrLoading.value = false
      if (Number(res?.code) === 1 && res.data) {
        addrList.value = res.data.data || []
        addrTotal.value = res.data.count || 0
      }
      else {
        toast(res?.msg || t('pages.printLabelCreate.messages.addressListFailed'), 'error')
      }
    }
    catch (e) {
      addrLoading.value = false
      toast(t('pages.printLabelCreate.messages.networkFailed'), 'error')
      console.error(e)
    }
  }

  function searchAddr() {
    addrCurrentPage.value = 1
    loadAddrList()
  }

  function selectAddr(row) {
    const target = addrDialogTarget.value === 'sender' ? sender : receiver
    const lock = addrDialogTarget.value === 'sender' ? senderCountryLock.value : receiverCountryLock.value
    const cntList = addrDialogTarget.value === 'sender' ? senderCountryList : receiverCountryList

    target.value.id = row.id || row.addr_id || ''
    target.value.name = row.name || ''
    target.value.country = lock
      ? matchCountryValue(cntList.value, lock)
      : matchCountryValue(cntList.value, row.country || '')
    target.value.province = row.province || ''
    target.value.city = row.city || ''
    target.value.streetno = row.streetno || row.street_no || ''
    target.value.address = row.address || ''
    target.value.address2 = row.address2 || row.address_2 || ''
    target.value.postCode = row.postcode || ''
    target.value.telephone = row.telephone || ''
    target.value.company = row.company || ''
    if (addrDialogTarget.value === 'sender') {
      senderAddressLocked.value = true
      senderSelectedFromBeianAddr.value = anySelectedNeedBeianAddr.value
    }
    else {
      receiverAddressLocked.value = true
    }
    addrDialog.value = false
    toast(t('pages.printLabelCreate.messages.addressFilled'), 'success')
  }

  function requiredAddrField(v) {
    return String(v || '').trim() ? true : t('pages.printLabelCreate.messages.requiredField')
  }

  async function loadAddrFormCountries() {
    if (addrFormCountryList.value.length)
      return
    addrFormCountriesLoading.value = true
    try {
      const res = await $api('/order/queryCountry', { method: 'POST', body: {} })
      if (Number(res?.code) === 1 && Array.isArray(res?.data))
        addrFormCountryList.value = res.data
      else
        addrFormCountryList.value = []
    }
    catch {
      addrFormCountryList.value = []
    }
    finally {
      addrFormCountriesLoading.value = false
    }
  }

  function resetAddrFormFields() {
    addrForm.value = {
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
    addrFormEditingId.value = ''
  }

  function applyAddrFormToTarget(addrIdStr) {
    const target = addrFormTarget.value === 'sender' ? sender : receiver
    const lock = addrFormTarget.value === 'sender' ? senderCountryLock.value : receiverCountryLock.value
    const cntList = addrFormTarget.value === 'sender' ? senderCountryList : receiverCountryList

    target.value.id = addrIdStr || ''
    target.value.name = addrForm.value.name.trim()
    target.value.country = lock
      ? matchCountryValue(cntList.value, lock)
      : matchCountryValue(cntList.value, addrForm.value.country || '')
    target.value.province = addrForm.value.province.trim()
    target.value.city = addrForm.value.city.trim()
    target.value.streetno = (addrForm.value.streetno || '').trim()
    target.value.address = addrForm.value.address.trim()
    target.value.address2 = (addrForm.value.address2 || '').trim()
    target.value.postCode = addrForm.value.postcode.trim()
    target.value.telephone = addrForm.value.telephone.trim()
    target.value.company = (addrForm.value.company || '').trim()
    if (addrFormTarget.value === 'sender') {
      senderAddressLocked.value = true
      senderSelectedFromBeianAddr.value = false
    }
    else {
      receiverAddressLocked.value = true
    }
  }

  async function openAddrFormDialog(target, isEdit) {
    addrFormTarget.value = target === 'receiver' ? 'receiver' : 'sender'
    if (addrFormTarget.value === 'sender' && anySelectedNeedBeianAddr.value) {
      toast(t('pages.printLabelCreate.messages.senderBeianAddressOnly'), 'warning')

      return
    }

    addrFormIsEdit.value = !!isEdit
    await loadAddrFormCountries()
    if (isEdit) {
      const src = addrFormTarget.value === 'sender' ? sender.value : receiver.value

      addrFormEditingId.value = String(src.id || '').trim()
      addrForm.value = {
        name: src.name || '',
        country: src.country || '',
        province: src.province || '',
        city: src.city || '',
        streetno: src.streetno || '',
        address: src.address || '',
        address2: src.address2 || '',
        email: '',
        postcode: src.postCode || '',
        telephone: src.telephone || '',
        company: src.company || '',
      }
    }
    else {
      resetAddrFormFields()

      const lock = addrFormTarget.value === 'sender' ? senderCountryLock.value : receiverCountryLock.value
      if (lock)
        addrForm.value.country = lock
    }
    addrFormDialog.value = true
  }

  function closeAddrFormDialog() {
    addrFormDialog.value = false
  }

  async function submitAddrFormDialog() {
    const t = addrFormTarget.value === 'sender' ? 1 : 2
    const token = useCookie('accessToken').value || ''

    const payload = {
      name: addrForm.value.name.trim(),
      country: addrForm.value.country,
      province: addrForm.value.province.trim(),
      city: addrForm.value.city.trim(),
      streetno: (addrForm.value.streetno || '').trim(),
      address: addrForm.value.address.trim(),
      address2: (addrForm.value.address2 || '').trim(),
      email: (addrForm.value.email || '').trim(),
      postcode: addrForm.value.postcode.trim(),
      telephone: addrForm.value.telephone.trim(),
      company: (addrForm.value.company || '').trim(),
      type: t,
      token,
    }

    if (addrFormIsEdit.value)
      payload.id = String(addrFormEditingId.value)

    addrFormSubmitting.value = true
    try {
      const path = addrFormIsEdit.value ? '/order/editAddr' : '/order/addAddr'
      const res = await $api(path, { method: 'POST', body: payload })
      if (Number(res?.code) !== 1) {
        toast(res?.msg || t('pages.printLabelCreate.messages.saveFailed'), 'error')
        
        return
      }
      const newId = res?.data?.id ?? res?.data?.addr_id ?? payload.id

      applyAddrFormToTarget(String(newId || ''))
      addrFormDialog.value = false
      toast(res?.msg || t('pages.printLabelCreate.messages.saveSuccess'), 'success')
    }
    catch (e) {
      toast(e?.data?.msg || e?.message || t('pages.printLabelCreate.messages.networkFailed'), 'error')
    }
    finally {
      addrFormSubmitting.value = false
    }
  }

  function addProduct() {
    products.value.push({ sku: '', sku_num: 1, en_name: '', cn_name: '', weight: '', value: '' })
  }

  function addDefaultProduct() {
    const emptyIdx = products.value.findIndex(
      p => !p.sku && !p.en_name && !p.cn_name && !p.weight && !p.value,
    )

    if (emptyIdx === -1) {
      toast(t('pages.printLabelCreate.messages.noEmptyProductRow'), 'warning')
      
      return
    }
    products.value[emptyIdx] = { sku: 'item', sku_num: 1, en_name: 'item', cn_name: '货品', weight: '100', value: '1' }
  }

  function removeProduct(idx) {
    if (products.value.length <= 1) {
      toast(t('pages.printLabelCreate.messages.keepOneProduct'), 'warning')
      
      return
    }
    products.value.splice(idx, 1)
  }

  async function submitOrder(qidStr, routeInfo) {
    const ch = channels.find(c => String(c.qid) === String(qidStr))
    const provider = channelProvider(ch)
    if (!provider) {
      toast(t('pages.printLabelCreate.messages.providerInvalid'), 'error')
      
      return
    }

    const channelCode = String(resolveChannelCode(routeInfo) || '').trim()

    const pickedRoute = routeInfo != null
      ? routeInfo
      : (routeOptions.value.find(r => r.key === selectedRouteKey.value) || null)

    const common = buildShippingCommonBody()
    const extraOrder = { ...common.extra }
    if (pickedRoute) {
      extraOrder.route = {
        rateName: pickedRoute.rateName,
        entryport: pickedRoute.entryport,
        zone: pickedRoute.zone,
        totalFee: pickedRoute.totalFee,
      }
    }

    submitting.value = true
    orderLoading.value = true
    try {
      const body = {
        ...common,
        provider,
        extra: extraOrder,
      }

      if (channelCode)
        body.channel_code = channelCode

      const res = await $apiJson('/Ordernewapi/shippingOrder', { method: 'POST', body })

      submitting.value = false
      orderLoading.value = false
      if (Number(res?.code) === 1) {
        toast(t('pages.printLabelCreate.messages.orderSuccess'), 'success')
        setTimeout(() => {
          router.push({ name: 'apps-print-label-shipping-list' })
        }, 1200)
        
        return
      }
      if (Number(res?.code) === 401) {
        toast(t('pages.printLabelCreate.messages.unauthorized'), 'error')
        
        return
      }
      toast(res?.msg || t('pages.printLabelCreate.messages.orderFailed'), 'error')
    }
    catch (e) {
      submitting.value = false
      orderLoading.value = false
      toast(e?.data?.msg || e?.message || t('pages.printLabelCreate.messages.networkRetry'), 'error')
      console.error(e)
    }
  }

  function orderFromCompare(item, routeObj) {
    if (!validate())
      return
    if (item.failed)
      return
    const feeDisplay = routeObj ? routeObj.totalFee.toFixed(2) : Number(item.singleFee ?? 0).toFixed(2)
    const routeName = routeObj ? routeObj.rateName : (item.singleRateName || t('pages.printLabelCreate.rate.standardRoute'))

    const ok = window.confirm(t('pages.printLabelCreate.messages.compareOrderConfirm', {
      channel: item.channelName,
      route: routeName,
      fee: feeDisplay,
      currency: item.currency,
    }))

    if (!ok)
      return

    const routeInfo = routeObj
      ? { rateName: routeObj.rateName, entryport: routeObj.entryport, zone: routeObj.zone, totalFee: routeObj.totalFee }
      : null

    submitOrder(String(item.qid), routeInfo)
  }

  function doSubmit() {
    if (compareMode.value) {
      toast(t('pages.printLabelCreate.messages.compareModeSubmitBlocked'), 'warning')
      
      return
    }
    if (!validate())
      return
    if (selectedNeedRouteSelect.value) {
      if (!rateBest.value) {
        toast(t('pages.printLabelCreate.messages.rateBeforeOrder'), 'warning')
        
        return
      }
      if (!routeOptions.value.length) {
        toast(t('pages.printLabelCreate.messages.noRouteForOrder'), 'warning')
        
        return
      }
      if (!selectedRouteKey.value) {
        toast(t('pages.printLabelCreate.messages.selectRouteBeforeOrder'), 'warning')
        
        return
      }
    }
    const chName = getChannelName(selectedQid.value)

    const routeMsg = (selectedNeedRouteSelect.value && selectedRoute.value)
      ? t('pages.printLabelCreate.messages.selectedRoute', {
        route: selectedRoute.value.rateName || '-',
        fee: selectedRoute.value.totalFee,
        currency: selectedCurrency.value,
      })
      : ''

    const ok = window.confirm(t('pages.printLabelCreate.messages.submitConfirm', {
      channel: chName,
      qid: selectedQid.value,
      route: routeMsg,
    }))

    if (!ok)
      return
    submitOrder(String(selectedQid.value), undefined)
  }

  function mapSnapshotToAddress(snapshot) {
    if (!snapshot)
      return null

    return {
      id: String(snapshot.id || ''),
      name: String(snapshot.name || ''),
      country: String(snapshot.country_code || snapshot.country || ''),
      province: String(snapshot.state || snapshot.province || ''),
      city: String(snapshot.city || ''),
      streetno: String(snapshot.street || ''),
      address: String(snapshot.address1 || snapshot.address || ''),
      address2: String(snapshot.address2 || ''),
      postCode: String(snapshot.postcode || ''),
      telephone: String(snapshot.telephone || ''),
      company: String(snapshot.company || ''),
    }
  }

  const copyFromId = computed(() => {
    const raw = route.query.copyFrom
    
    return raw ? Number(raw) : null
  })

  onMounted(async () => {
    if (!copyFromId.value)
      return

    copyLoading.value = true
    try {
      const res = await $api('/Ordernewapi/shippingDetail', {
        method: 'GET',
        query: { order_id: copyFromId.value },
      })

      if ((Number(res?.code) === 1 || Number(res?.code) === 200) && res?.data) {
        const detail = res.data

        if (detail.provider != null)
          selectedQid.value = Number(detail.provider)

        const senderAddr = mapSnapshotToAddress(detail.sender_snapshot)
        if (senderAddr)
          sender.value = senderAddr

        const receiverAddr = mapSnapshotToAddress(detail.recipient_snapshot)
        if (receiverAddr)
          receiver.value = receiverAddr

        if (Array.isArray(detail.sku_items) && detail.sku_items.length) {
          products.value = detail.sku_items.map(item => ({
            sku: String(item.sku || ''),
            sku_num: item.qty != null ? Number(item.qty) : 1,
            en_name: String(item.en_name || ''),
            cn_name: String(item.cn_name || ''),
            weight: item.weight != null ? String(item.weight) : '',
            value: item.value != null ? String(item.value) : '',
          }))
        }

        toast(t('pages.printLabelCreate.messages.copyLoaded'))
      }
      else {
        toast(res?.msg || t('pages.printLabelCreate.messages.copyLoadFailed'), 'error')
      }
    }
    catch (e) {
      toast(e?.data?.msg || e?.message || t('pages.printLabelCreate.messages.copyLoadFailed'), 'error')
    }
    finally {
      copyLoading.value = false
    }
  })

  return {
    channels,
    legacyOrigin,
    channelLogoSrc,
    compareMode,
    selectedQid,
    compareQids,
    danwei,
    cankaohao,
    sender,
    receiver,
    pkg,
    products,
    senderCountryList,
    receiverCountryList,
    addrDialog,
    addrDialogTarget,
    addrList,
    addrTotal,
    addrCurrentPage,
    addrPageSize,
    addrSearchName,
    addrLoading,
    senderAddressLocked,
    receiverAddressLocked,
    addrFormDialog,
    addrFormTarget,
    addrFormIsEdit,
    addrFormEditingId,
    addrForm,
    addrFormSubmitting,
    addrFormCountriesLoading,
    addrFormCountryItems,
    openAddrFormDialog,
    closeAddrFormDialog,
    submitAddrFormDialog,
    requiredAddrField,
    rateLoading,
    rateBest,
    rateCompareList,
    routeOptions,
    selectedRouteKey,
    submitting,
    orderLoading,
    copyLoading,
    snack,
    toast,
    unitLabel,
    selectedChannel,
    selectedCurrency,
    selectedValueRequired,
    selectedNeedRouteSelect,
    selectedCnNameRequired,
    senderCountryLock,
    receiverCountryLock,
    senderNeedBeianAddr,
    anySelectedNeedBeianAddr,
    selectedChannelAlert,
    hasRateResult,
    selectedRoute,
    brokenLogoQids,
    onChannelLogoError,
    primaryQuoteTitle,
    primaryQuoteAmount,
    addrPageCount,
    isChannelSelected,
    onChannelCardClick,
    getChannelName,
    doRate,
    openAddrDialog,
    closeAddrDialog,
    loadAddrList,
    searchAddr,
    selectAddr,
    addProduct,
    addDefaultProduct,
    removeProduct,
    submitOrder,
    orderFromCompare,
    doSubmit,
  }
}
