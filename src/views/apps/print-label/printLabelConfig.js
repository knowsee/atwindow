/**
 * 统一物流渠道与提醒文案配置
 * logo 为 /images/translogo/* 时由 channelLogoSrc 拼到同源 public
 * modules 支持: 'drop-shipping' (一件代发), 'print-label' (运单模块)
 * 
 *   
  { title: 'Fedex（限重1-150磅，2-6个工作日签收）', value: 59, modules: ['drop-shipping'] },
  { title: 'Gofo', value: 210, modules: ['drop-shipping'] },
  { title: 'NEXTDAY（限重50磅）', value: 213, modules: ['drop-shipping'] },
  { title: 'USPS-Y（限重5磅）', value: 214, modules: ['drop-shipping'] },

 */
export const LOGISTICS_CHANNELS = [
  // ============ 仅一件代发专用 ============
  { title: '自动物流渠道选择（试运行）', value: 99999, modules: ['drop-shipping'] },
  { title: '自提', value: 200, modules: ['drop-shipping'] },
  { title: 'USPS（T5）', value: 27, modules: ['drop-shipping'] },
  { title: 'SPEEDX', value: 53, modules: ['drop-shipping'] },
  { title: 'OnTrac', name: 'OnTrac', value: 3003, qid: 3003, provider: 3003, logo: '/images/translogo/ontrac.png', currency: 'USD', senderCountryLock: 'US', receiverCountryLock: 'US', senderNeedBeianAddr: false, valueRequired: false, needRouteSelect: false, cnNameRequired: false, modules: ['drop-shipping'] },

  // ============ 仅运单模块专用 ============
  { title: 'USPS', name: 'USPS', value: 10201, qid: 10201, provider: 10201, logo: '/images/translogo/usps.png', currency: 'USD', senderCountryLock: 'US', receiverCountryLock: 'US', senderNeedBeianAddr: false, valueRequired: false, needRouteSelect: false, cnNameRequired: false, modules: ['print-label'] },
  { title: 'DHLe', name: 'DHLe', value: 2004, qid: 2004, provider: 2004, logo: '/images/translogo/dhle.png', currency: 'USD', senderCountryLock: 'US', receiverCountryLock: 'US', senderNeedBeianAddr: false, valueRequired: false, needRouteSelect: true, cnNameRequired: false, modules: ['print-label'] },
  { title: '德国DHL', name: '德国DHL', value: 2001, qid: 2001, provider: 2001, logo: '/images/translogo/de_dhl.jpg', currency: 'USD', senderCountryLock: 'DE', receiverCountryLock: null, senderNeedBeianAddr: false, valueRequired: true, needRouteSelect: false, cnNameRequired: false, modules: ['print-label'] },
  { title: 'Fedex国际', name: 'Fedex国际', value: 2002, qid: 2002, provider: 2002, logo: '/images/translogo/fedex.png', currency: 'USD', senderCountryLock: null, receiverCountryLock: null, senderNeedBeianAddr: false, valueRequired: true, needRouteSelect: true, cnNameRequired: false, modules: ['print-label'] },

  // ============ 共用（一件代发 + 运单模块） ============
  { title: 'UPS Ground', name: 'UPS', value: 50, qid: 50, provider: 50, logo: '/images/translogo/ups.png', currency: 'USD', senderCountryLock: 'US', receiverCountryLock: 'US', senderNeedBeianAddr: false, valueRequired: false, needRouteSelect: false, cnNameRequired: false, modules: ['drop-shipping', 'print-label'] },
  { title: 'Amazon', name: '亚马逊物流', value: 56, qid: 56, provider: 56, logo: '/images/translogo/amazon.png', currency: 'USD', senderCountryLock: 'US', receiverCountryLock: 'US', senderNeedBeianAddr: false, valueRequired: false, needRouteSelect: false, cnNameRequired: false, modules: ['drop-shipping', 'print-label'] },
  { title: 'UNI', name: 'UniUni', value: 211, qid: 211, provider: 211, logo: '/images/translogo/uniuni.png', currency: 'USD', senderCountryLock: 'US', receiverCountryLock: null, senderNeedBeianAddr: false, valueRequired: false, needRouteSelect: false, cnNameRequired: false, modules: ['drop-shipping', 'print-label'] },
]

export const PRINT_LABEL_CHANNELS = LOGISTICS_CHANNELS.filter(c => c.modules.includes('print-label'))
export const DROP_SHIPPING_CHANNELS = LOGISTICS_CHANNELS.filter(c => c.modules.includes('drop-shipping'))

export const CHANNEL_ALERT_CONFIG = {
  default: {
    type: 'info',
    title: '下单前提醒',
    content: '请确认地址、包裹尺寸重量、SKU 与申报信息准确后再提交订单。',
  },
  20: {
    type: 'warning',
    title: 'USPS 物流渠道特别说明',
    content: '1. 发件人地址请优先从地址簿选择备案地址。\n2. 收件信息需与平台订单保持一致。\n3. 重量与尺寸建议按实重填写。\n4. 若涉及敏感货，请先确认物流渠道可接收范围与申报要求。',
  },
  56: {
    type: 'warning',
    title: 'Amazon物流渠道特别说明',
    content: '1. 发件人地址只能选97008仓库地址。\n2. 如需其他发件地址，请联系平台客服。\n3. 重量与尺寸建议按实重填写。',
  },
  2004: {
    type: 'warning',
    title: 'DHLe 报价提醒',
    content: '使用DHLe物流渠道请首先联络我们客服代表，由于DHLe需要自行送件以及需提前预约、DSM生成申报等手续，请务必了解清楚后再次使用。',
  },
}
