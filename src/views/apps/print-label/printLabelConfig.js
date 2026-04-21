/**
 * 渠道与提醒文案（由旧版「比价」页面迁移，可按业务改 qid / 限制）
 * logo 为 /images/translogo/* 时由 channelLogoSrc 拼到同源 public；可选 VITE_TRANSLOGO_ORIGIN 为完整 URL 时用远程
 */
/** provider 与后端 Ordernewapi 物流商 ID 对齐；缺省时与 qid 相同 */
export const PRINT_LABEL_CHANNELS = [
  { qid: 20, provider: 20, name: 'USPS', logo: '/images/translogo/usps.png', currency: 'USD', senderCountryLock: 'US', receiverCountryLock: 'US', senderNeedBeianAddr: true, valueRequired: false, needRouteSelect: false, cnNameRequired: false },
  { qid: 50, provider: 50, name: 'UPS', logo: '/images/translogo/ups.png', currency: 'USD', senderCountryLock: 'US', receiverCountryLock: 'US', senderNeedBeianAddr: false, valueRequired: false, needRouteSelect: false, cnNameRequired: false },
  { qid: 56, provider: 56, name: '亚马逊物流', logo: '/images/translogo/amazon.png', currency: 'USD', senderCountryLock: 'US', receiverCountryLock: 'US', senderNeedBeianAddr: false, valueRequired: false, needRouteSelect: false, cnNameRequired: false },
  { qid: 2004, provider: 2004, name: 'DHLe', logo: '/images/translogo/dhle.png', currency: 'USD', senderCountryLock: 'US', receiverCountryLock: 'US', senderNeedBeianAddr: false, valueRequired: false, needRouteSelect: true, cnNameRequired: false },
  { qid: 211, provider: 211, name: 'UniUni', logo: '/images/translogo/uniuni.png', currency: 'USD', senderCountryLock: 'US', receiverCountryLock: null, senderNeedBeianAddr: false, valueRequired: false, needRouteSelect: false, cnNameRequired: false },
  { qid: 2001, provider: 2001, name: '德国DHL', logo: '/images/translogo/de_dhl.jpg', currency: 'USD', senderCountryLock: 'DE', receiverCountryLock: null, senderNeedBeianAddr: false, valueRequired: true, needRouteSelect: false, cnNameRequired: false },
  { qid: 2002, provider: 2002, name: 'Fedex国际', logo: '/images/translogo/fedex.png', currency: 'USD', senderCountryLock: null, receiverCountryLock: null, senderNeedBeianAddr: false, valueRequired: true, needRouteSelect: true, cnNameRequired: false },
]

export const CHANNEL_ALERT_CONFIG = {
  default: {
    type: 'info',
    title: '下单前提醒',
    content: '请确认地址、包裹尺寸重量、SKU 与申报信息准确后再提交订单。',
  },
  20: {
    type: 'warning',
    title: 'USPS 渠道特别说明',
    content: '1. 发件人地址请优先从地址簿选择备案地址。\n2. 收件信息需与平台订单保持一致。\n3. 重量与尺寸建议按实重填写。\n4. 若涉及敏感货，请先确认渠道可接收范围与申报要求。',
  },
  56: {
    type: 'warning',
    title: 'Amazon物流渠道特别说明',
    content: '1. 发件人地址只能选97008仓库地址。\n2. 如需其他发件地址，请联系平台客服。\n3. 重量与尺寸建议按实重填写。',
  },
  2004: {
    type: 'warning',
    title: 'DHLe 报价提醒',
    content: '使用DHLe渠道请首先联络我们客服代表，由于DHLe需要自行送件以及需提前预约、DSM生成申报等手续，请务必了解清楚后再次使用。',
  },
}
