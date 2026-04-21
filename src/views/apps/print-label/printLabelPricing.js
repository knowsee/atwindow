/* eslint-disable camelcase -- 与后端国家列表字段一致 */
export function buildCountryOptions(countryList) {
  return (countryList || []).map(c => ({
    value: c.short_name || c.cn_name,
    label: [c.short_name, c.en_name, c.cn_name].filter(Boolean).join(' - '),
    short_name: c.short_name || '',
    cn_name: c.cn_name || '',
    en_name: c.en_name || '',
  }))
}

export function matchCountryValue(list, raw) {
  if (!raw)
    return ''
  const r = String(raw).trim().toUpperCase()

  const hit = list.find(c =>
    (c.short_name && c.short_name.toUpperCase() === r)
    || c.cn_name === raw
    || (c.en_name && c.en_name.toUpperCase() === r),
  )

  
  return hit ? hit.value : raw
}

export function extractCompareRateList(rateRespData, channels) {
  const list = Array.isArray(rateRespData?.rate_list) ? rateRespData.rate_list : []

  const rows = list.map(item => {
    const qidNum = Number(item.qid)

    const ch = Number.isFinite(qidNum)
      ? channels.find(c => String(c.qid) === String(qidNum))
      : null

    const rate = item.rate || {}
    const isList = !!rate.isList

    if (item.failed) {
      return {
        qid: qidNum,
        channelName: (ch && ch.name) || item.wuliu_name || String(qidNum),
        logo: ch ? ch.logo : null,
        currency: (ch && ch.currency) || 'USD',
        isList: false,
        routes: [],
        singleFee: null,
        singleRateName: '',
        singleNotes: '',
        minFee: Number.POSITIVE_INFINITY,
        failed: true,
        failMessage: item.failMessage || '试算失败',
      }
    }

    let singleFee = 0
    if (typeof item.fee === 'number')
      singleFee = item.fee
    else if (item.fee && typeof item.fee === 'object')
      singleFee = Number(item.fee.money) || 0
    else
      singleFee = (rate.totalFee && typeof rate.totalFee === 'object') ? Number(rate.totalFee.money) || 0 : Number(rate.totalFee) || 0

    let routes = []
    if (isList && Array.isArray(rate.channelRates)) {
      routes = rate.channelRates.map((r, idx) => ({
        key: `cmp_${r.entryport || 'LINE'}_${r.rateName || idx}_${idx}`,
        rateName: r.rateName || '',
        entryport: r.entryport || '',
        zone: r.zone,
        totalFee: Number(r.totalFee) || 0,
        notes: r.notes || '',
      }))
    }

    const minFee = (isList && routes.length) ? Math.min(...routes.map(r => r.totalFee)) : singleFee

    return {
      qid: qidNum,
      channelName: (ch && ch.name) || item.wuliu_name || String(qidNum),
      logo: ch ? ch.logo : null,
      currency: (ch && ch.currency) || 'USD',
      isList,
      routes,
      singleFee,
      singleRateName: isList ? '' : (rate.rateName || ''),
      singleNotes: isList ? '' : (rate.notes || ''),
      minFee,
    }
  }).filter(r => Number.isFinite(r.qid))

  rows.sort((a, b) => a.minFee - b.minFee)
  
  return rows.map((r, idx) => ({ ...r, rank: idx + 1 }))
}

export function extractRouteOptions(rateRespData) {
  const list = Array.isArray(rateRespData?.rate_list) ? rateRespData.rate_list : []
  if (!list.length)
    return []

  const first = list[0] || {}
  const rate = first.rate || {}
  const channelRates = Array.isArray(rate.channelRates) ? rate.channelRates : []

  if (channelRates.length) {
    return channelRates.map((r, idx) => ({
      key: `${r.entryport || 'LINE'}_${r.rateName || idx}_${idx}`,
      rateName: r.rateName || '',
      entryport: r.entryport || '',
      zone: r.zone,
      totalFee: Number(r.totalFee) || 0,
    }))
  }

  if (rate.rateName || rate.entryport || rate.totalFee !== undefined) {
    return [{
      key: `${rate.entryport || 'LINE'}_${rate.rateName || 'DEFAULT'}_0`,
      rateName: rate.rateName || '',
      entryport: rate.entryport || '',
      zone: rate.zone,
      totalFee: Number(rate.totalFee) || 0,
    }]
  }

  return []
}

/**
 * 将 `/Ordernewapi/shippingRate` 的 `data.rates[]` 转为旧版 `newbillRate` 形态，便于复用 extractRouteOptions / extractCompareRateList 与现有报价 UI。
 */
export function adaptOrdernewRateToLegacyData(apiData, channels, compareMode, compareQids) {
  if (!apiData || !Array.isArray(apiData.rates))
    return apiData

  const rates = apiData.rates
  if (!rates.length)
    return { ...apiData, rate_list: [] }

  const mapChannelRates = sub =>
    sub.map((r, idx) => ({
      entryport: r.entryport || '',
      rateName: r.rateName || '',
      zone: r.zone,
      totalFee: Number(r.totalFee) || 0,
      notes: r.notes || '',
    }))

  if (compareMode && Array.isArray(compareQids) && compareQids.length) {
    const failByProvider = new Map(
      (apiData.failed_providers || []).map(f => [Number(f.provider), String(f.message || '').trim() || '试算失败']),
    )

    const rate_list = compareQids.map(qid => {
      const ch = channels.find(c => Number(c.qid) === Number(qid))
      const providerNum = Number(ch?.provider ?? ch?.qid ?? qid)
      const sub = rates.filter(r => Number(r.provider) === providerNum)
      if (!sub.length) {
        return {
          qid,
          wuliu_name: ch?.name,
          failed: true,
          failMessage: failByProvider.get(providerNum) || '试算失败或无报价',
          fee: null,
          rate: { isList: false },
        }
      }
      if (sub.length === 1) {
        const r = sub[0]

        return {
          qid,
          wuliu_name: ch?.name,
          fee: Number(r.totalFee) || 0,
          rate: {
            isList: false,
            totalFee: Number(r.totalFee) || 0,
            rateName: r.rateName,
            entryport: r.entryport,
            zone: r.zone,
            notes: r.notes,
          },
        }
      }

      return {
        qid,
        wuliu_name: ch?.name,
        fee: Math.min(...sub.map(x => Number(x.totalFee) || 0)),
        rate: {
          isList: true,
          channelRates: mapChannelRates(sub),
        },
      }
    })

    return { ...apiData, rate_list }
  }

  const providerNum = Number(apiData.provider ?? rates[0]?.provider)
  const ch = channels.find(c => Number(c.provider) === providerNum || Number(c.qid) === providerNum)

  if (rates.length === 1) {
    const r = rates[0]

    return {
      ...apiData,
      wuliu_name: ch?.name,
      money: Number(r.totalFee) || 0,
      rate_list: [{
        qid: providerNum,
        wuliu_name: ch?.name,
        rate: {
          isList: false,
          totalFee: Number(r.totalFee) || 0,
          rateName: r.rateName,
          entryport: r.entryport,
          zone: r.zone,
          notes: r.notes,
        },
      }],
    }
  }

  return {
    ...apiData,
    wuliu_name: ch?.name,
    money: Math.min(...rates.map(x => Number(x.totalFee) || 0)),
    rate_list: [{
      qid: providerNum,
      wuliu_name: ch?.name,
      rate: {
        isList: true,
        channelRates: mapChannelRates(rates),
      },
    }],
  }
}
