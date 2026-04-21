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
    
    return first?.wuliu_name || first?.serviceType || '报价结果'
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
    if (picked?.entryport)
      return String(picked.entryport).trim()
    const rl = rateBest.value?.rate_list
    const first = Array.isArray(rl) && rl.length ? rl[0] : null
    const rt = first?.rate
    if (rt?.entryport)
      return String(rt.entryport).trim()
    if (typeof rt?.totalFee === 'object' && rt?.entryport)
      return String(rt.entryport).trim()

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
        toast('比价模式下至少保留一个渠道', 'warning')
        
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
      toast('请选择一个渠道', 'warning')
      
      return false
    }
    cankaohao.value = String(cankaohao.value ?? '').replace(/[^A-Za-z0-9_]/g, '')
    const ck = String(cankaohao.value).trim()
    if (!ck) {
      toast('请输入参考号', 'warning')
      
      return false
    }
    if (!/^[A-Za-z0-9_]+$/.test(ck)) {
      toast('参考号仅允许英文字母、数字与下划线', 'warning')
      
      return false
    }
    const s = sender.value
    if (!s.name || !s.province || !s.city || !s.address || !s.postCode || !s.telephone) {
      toast('请完善发件人必填信息（姓名、地址第 1 行、城市、省/州、邮编、电话）', 'warning')
      
      return false
    }
    const r = receiver.value
    if (!r.name || !r.province || !r.city || !r.address || !r.postCode || !r.telephone) {
      toast('请完善收件人必填信息（姓名、地址第 1 行、城市、省/州、邮编、电话）', 'warning')
      
      return false
    }
    if (!senderAddressLocked.value || !receiverAddressLocked.value) {
      toast('请通过「从地址簿选择」或「添加地址」确认发件与收件地址后再试算或下单', 'warning')
      
      return false
    }
    const p = pkg.value
    if (!p.weight || !p.length || !p.width || !p.height) {
      toast('请填写包裹的重量和尺寸（长、宽、高）', 'warning')
      
      return false
    }
    if (!products.value.length) {
      toast('请至少添加一条货品信息', 'warning')
      
      return false
    }
    for (let i = 0; i < products.value.length; i++) {
      const row = products.value[i] || {}
      const line = `第${i + 1}行货品`
      if (!String(row.sku || '').trim()) {
        toast(`${line}：请填写SKU`, 'warning')
        
        return false
      }
      if (!String(row.en_name || '').trim()) {
        toast(`${line}：请填写英文名称`, 'warning')
        
        return false
      }
      if (selectedCnNameRequired.value && !String(row.cn_name || '').trim()) {
        toast(`${line}：请填写中文名称`, 'warning')
        
        return false
      }
      const skuNum = Number(row.sku_num)
      if (!Number.isFinite(skuNum) || skuNum <= 0) {
        toast(`${line}：数量必须大于0`, 'warning')
        
        return false
      }
      const itemWeight = Number(row.weight)
      if (!Number.isFinite(itemWeight) || itemWeight <= 0) {
        toast(`${line}：重量必须大于0`, 'warning')
        
        return false
      }
      if (selectedValueRequired.value) {
        const itemValue = Number(row.value)
        if (!Number.isFinite(itemValue) || itemValue <= 0) {
          toast(`${line}：请填写有效的申报价值`, 'warning')
          
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
      toast('请选择至少一个渠道进行试算', 'warning')
      
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
        toast(res?.msg || '试算失败，请检查填写内容', 'error')
        
        return
      }

      const legacyData = adaptOrdernewRateToLegacyData(res.data, channels, compareMode.value, qidList)

      if (compareMode.value) {
        rateCompareList.value = extractCompareRateList(legacyData, channels)
        if (!rateCompareList.value.length)
          toast('比价请求成功，但未返回可展示的渠道报价数据', 'warning')
        else
          toast('比价获取成功', 'success')
      }
      else {
        rateBest.value = legacyData
        if (selectedNeedRouteSelect.value) {
          routeOptions.value = extractRouteOptions(legacyData)
          if (!routeOptions.value.length)
            toast('该渠道需要选择线路，但报价未返回可选线路，请检查地址和包裹信息', 'warning')
        }
        toast('报价获取成功', 'success')
      }
      await nextTick()
      document.getElementById('rate-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    catch (e) {
      rateLoading.value = false
      toast(e?.data?.msg || e?.message || '网络请求失败，请重试', 'error')
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
    const path = (addrDialogTarget.value === 'sender' && senderNeedBeianAddr.value) ? '/order/beianAddr' : '/order/queryAddr'
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
        toast(res?.msg || '加载地址列表失败', 'error')
      }
    }
    catch (e) {
      addrLoading.value = false
      toast('网络请求失败', 'error')
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
    if (addrDialogTarget.value === 'sender')
      senderAddressLocked.value = true
    else
      receiverAddressLocked.value = true
    addrDialog.value = false
    toast('地址已填入', 'success')
  }

  function requiredAddrField(v) {
    return String(v || '').trim() ? true : '必填项'
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
    if (addrFormTarget.value === 'sender')
      senderAddressLocked.value = true
    else
      receiverAddressLocked.value = true
  }

  async function openAddrFormDialog(target, isEdit) {
    addrFormTarget.value = target === 'receiver' ? 'receiver' : 'sender'
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
        toast(res?.msg || '保存失败', 'error')
        
        return
      }
      const newId = res?.data?.id ?? res?.data?.addr_id ?? payload.id
      applyAddrFormToTarget(String(newId || ''))
      addrFormDialog.value = false
      toast(res?.msg || '保存成功', 'success')
    }
    catch (e) {
      toast(e?.data?.msg || e?.message || '网络请求失败', 'error')
    }
    finally {
      addrFormSubmitting.value = false
    }
  }

  function addProduct() {
    products.value.push({ sku: '', sku_num: 1, en_name: '', cn_name: '', weight: '', value: '' })
  }

  function removeProduct(idx) {
    if (products.value.length <= 1) {
      toast('至少保留一行货品', 'warning')
      
      return
    }
    products.value.splice(idx, 1)
  }

  async function submitOrder(qidStr, routeInfo) {
    const ch = channels.find(c => String(c.qid) === String(qidStr))
    const provider = channelProvider(ch)
    if (!provider) {
      toast('渠道配置异常，无法下单', 'error')
      
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
        toast('订单创建成功，正在出单中，请前往订单列表查看', 'success')
        setTimeout(() => {
          router.push({ name: 'apps-print-label-orders' })
        }, 1200)
        
        return
      }
      if (Number(res?.code) === 401) {
        toast('登录已过期，请重新登录', 'error')
        
        return
      }
      toast(res?.msg || '下单失败', 'error')
    }
    catch (e) {
      submitting.value = false
      orderLoading.value = false
      toast(e?.data?.msg || e?.message || '网络请求失败，请重试', 'error')
      console.error(e)
    }
  }

  function orderFromCompare(item, routeObj) {
    if (!validate())
      return
    if (item.failed)
      return
    const feeDisplay = routeObj ? routeObj.totalFee.toFixed(2) : Number(item.singleFee ?? 0).toFixed(2)
    const routeName = routeObj ? routeObj.rateName : (item.singleRateName || '标准线路')
    const ok = window.confirm(`确认通过渠道「${item.channelName}」下单？\n线路：${routeName} · 费用：${feeDisplay} ${item.currency}`)
    if (!ok)
      return

    const routeInfo = routeObj
      ? { rateName: routeObj.rateName, entryport: routeObj.entryport, zone: routeObj.zone, totalFee: routeObj.totalFee }
      : null

    submitOrder(String(item.qid), routeInfo)
  }

  function doSubmit() {
    if (compareMode.value) {
      toast('比价模式仅用于试算。请关闭比价模式后选择单个渠道下单', 'warning')
      
      return
    }
    if (!validate())
      return
    if (selectedNeedRouteSelect.value) {
      if (!rateBest.value) {
        toast('该渠道下单前需要先试算运费并选择线路', 'warning')
        
        return
      }
      if (!routeOptions.value.length) {
        toast('该渠道未返回可选线路，暂不能下单', 'warning')
        
        return
      }
      if (!selectedRouteKey.value) {
        toast('请选择线路后再提交订单', 'warning')
        
        return
      }
    }
    const chName = getChannelName(selectedQid.value)

    const routeMsg = (selectedNeedRouteSelect.value && selectedRoute.value)
      ? `\n已选线路：${selectedRoute.value.rateName || '-'} / ${selectedRoute.value.totalFee} ${selectedCurrency.value}`
      : ''

    const ok = window.confirm(`确认通过渠道「${chName}」（QID: ${selectedQid.value}）下单？${routeMsg}`)
    if (!ok)
      return
    submitOrder(String(selectedQid.value), undefined)
  }

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
    removeProduct,
    submitOrder,
    orderFromCompare,
    doSubmit,
  }
}
