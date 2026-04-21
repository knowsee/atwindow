var baseUrl = 'https://backend.atwindow.com/api'
var imgUrl = 'https://backend.atwindow.com'
var common = {
  loginUrl: baseUrl + '/user/login' /* 登录 */,
  getCaptcha: baseUrl + '/user/getCaptcha' /* 获取验证码 */,
  sendCaptcha: baseUrl + '/user/sendCaptcha' /* 获取验证码 */,
  resetpwd: baseUrl + '/user/resetpwd' /* 获取验证码 */,
  uploadFile: baseUrl + '/order/uploadFile' /* 文件上传 */,
  queryCountry: baseUrl + '/order/queryCountry' /* 国家列表 */,
  queryCountry2: baseUrl + '/order/queryCountry2' /* 国家列表2=>美国 */,
  queryCountry3: baseUrl + '/order/queryCountry3' /* 国家列表3=>香港 */,
  getExpress: baseUrl + '/order/getExpress' /* 快递列表 */,
  queryWarehouses: baseUrl + '/package/queryWarehouses' /* 仓库列表 */,
  queryFba: baseUrl + '/order/queryFba' /* 获取FBA仓库列表 */,

  getProductCate: baseUrl + '/product/category' /* 产品分类 */,
  /* 虚拟仓 */
  /* 收发件人地址管理 */
  addAddr: baseUrl + '/order/addAddr' /* 添加地址 */,
  addrDetail: baseUrl + '/order/addrDetail' /* 地址详情 */,
  editAddr: baseUrl + '/order/editAddr' /* 编辑地址 */,
  delAddr: baseUrl + '/order/delAddr' /* 删除地址 */,
  queryAddr: baseUrl + '/order/queryAddr' /* 地址列表 */,
  queryAddrFba: baseUrl + '/order/queryAddrFba' /* 地址列表 */,
  beianAddr: baseUrl + '/order/beianAddr' /* 备案地址列表 */,

  /* 新建订单 */
  addvwh: baseUrl + '/order/addvwh' /* 单个新建 */,
  addvwhGuSuan: baseUrl + '/order/addvwhGuSuan' /* 虚拟仓估算运费 */,
  batchaddvwh: baseUrl + '/order/batchaddvwh' /* 批量新建 */,
  batchvwhkg: baseUrl + '/order/batchvwhkg' /* 批量录入重量 */,

  /* 订单列表 */
  vwhList: baseUrl + '/order/vwhList' /* 订单列表 */,
  changeStatus: baseUrl + '/order/changeStatus' /* 已打印 */,
  vwhDetail: baseUrl + '/order/vwhDetail' /* 查看 */,
  delVwh: baseUrl + '/order/delVwh' /* 删除 */,
  editVwh: baseUrl + '/order/editVwh' /* 虚拟仓订单编辑 */,
  excelVwh: baseUrl + '/order/excelVwh',
  excelVwhWeight: baseUrl + '/order/excelVwhWeight', //导出预报重量
  yujifei: baseUrl + '/order/yujifei', //预计费
  tuikuan: baseUrl + '/order/tuikuan', //退款操作
  transportType: baseUrl + '/ordertwo/transportType', //获取线路


  /* 问题订单 */
  // batchaddvwh: baseUrl + "order/vwhList" /* 批量新建 */
  report: baseUrl + '/order/report' /* 数据报告(天) */,
  excelReport: baseUrl + '/order/excelReport' /* 数据导出(天) */,

  reportNum: baseUrl + '/ordertwo/reportNum' /* 数据报告(批次号) */,
  excelReportNum: baseUrl + '/ordertwo/excelReportNum' /* 数据导出(批次号) */,

  /* 一件代发接口 */
  applyService: baseUrl + '/user/applyService' /* 开通账户 */,
  account: baseUrl + '/user/account' /* 我的仓储 */,
  erpAuth: baseUrl + '/erp/erpAuth' /* erp授权 */,
  sendProductMb: baseUrl + '/erp/sendProductMb' /* 马帮erp->商品库存同步 */,
  /* 产品管理 */
  proBatchDayin: baseUrl + '/product/proBatchDayin' /* 打印 */,
  proDayin: baseUrl + '/product/proDayin' /* 打印 */,
  addPro: baseUrl + '/product/add' /* 添加产品 */,
  batchaddPro: baseUrl + '/product/excel' /* 批量添加 */,
  proList: baseUrl + '/product/all' /* 产品列表 */,
  editPro: baseUrl + '/product/edit' /* 编辑产品 */,
  detailPro: baseUrl + '/product/detail' /* 产品详情 */,
  delPro: baseUrl + '/product/del' /* 删除 */,
  disablePro: baseUrl + '/product/disable' /* 禁用 */,
  ablePro: baseUrl + '/product/able' /* 启用 */,
  checkPro: baseUrl + '/product/checksku',

  /* 入库管理 */
  warnNum: baseUrl + '/package/getWarnNum' /* 获取预警提示 */,
  getAddress: baseUrl + '/package/getPackAddress' /* 获取入库预报地址 */,
  addRuku: baseUrl + '/package/ruku' /* 添加入库 */,
  batchaddRuku: baseUrl + '/package/batchruku' /* 批量添加 */,
  rukuList: baseUrl + '/package/all' /* 入库列表 */,
  kucunList: baseUrl + '/package/kucun' /* 库存列表 */,
  excelKuncun: baseUrl + '/package/excelKuncun' /* 库存列表 */,
  rukuDetail: baseUrl + '/package/detail', /*入库清单详情*/
  editRuku: baseUrl + '/package/editruku' /* 编辑 */,
  dayinPl: baseUrl + '/package/dayinPl' /* 批量打印箱唛 */,
  delBatch: baseUrl + '/package/delBatch' /* 批量删除 */,


  /* 订单管理 */
  skuData: baseUrl + '/package/getSku' /* 获取SKU */,
  skuDataTh: baseUrl + '/package/getSkuTh' /* 获取退货SKU库存列表 */,
  getSkuCKG: baseUrl + '/package/getSkuCKG' /* 获取SKU的长宽高 */,
  addOrder: baseUrl + '/order/add' /* 新建订单 */,
  addOrderGuSuan: baseUrl + '/order/addGuSuan' /* 运费估算 */,
  batchaddOrder: baseUrl + '/order/batchorder' /* 批量添加 */,
  orderList: baseUrl + '/order/orderList' /* 订单列表 */,
  excelYjdf: baseUrl + '/order/excelYjdf' /* 导出订单列表 */,
  detailOrder: baseUrl + '/order/detail' /* 订单详情 */,
  delOrder: baseUrl + '/order/del' /* 删除 */,
  editOrder: baseUrl + '/order/edit' /* 编辑 */,
  getOrderFeeDf: baseUrl + '/order/getOrderFeeDf', /* 订单费用*/
  payOrderDf: baseUrl + '/order/payOrderDf', /* 支付订单代发 */
  uploadPdf: baseUrl + '/order/uploadPdf', /* 自提上传面单 */


  getOrderFee: baseUrl + '/order/getOrderFee', /* 订单费用*/
  payOrder: baseUrl + '/order/payOrder', /* 支付订单 */
    
  //换标
  orderLabelList: baseUrl + '/orderv2/orderLabelList' /* 订单列表 */,
  addOrderLabel: baseUrl + '/orderv2/addOrderLabel' /* 换标新建订单 */,
  delOrderLabel: baseUrl + '/orderv2/del' /* 删除 */,
  payOrderLabel: baseUrl + '/orderv2/pay' /* 支付 */,
  detailOrderLabel: baseUrl + '/orderv2/detail' /* 订单详情 */,
  editOrderLabel: baseUrl + '/orderv2/edit' /* 编辑 */,
  excelExport: baseUrl + '/orderv2/excelExport' /* 导出 */,

  /* 退货贴标转运 */
  addReturn: baseUrl + '/package/addReturn' /* 退货登记 */,
  batchaddReturn: baseUrl + '/package/batchReturn' /* 批量插入 */,
  batchRerun: baseUrl + '/package/batch' /* 退货登记列表 */,
  returnKucun: baseUrl + '/package/returnKucun' /* 退货库存 */,
  viewReturn: baseUrl + '/package/view' /* 查看 */,
  editReturn: baseUrl + '/package/edit' /* 编辑 */,
  delReturn: baseUrl + '/package/del' /* 删除 */,
  claimReturn: baseUrl + '/package/claim' /* 认领 */,
  excelList: baseUrl + '/package/excelList' /* 导出 */,
  excelThList: baseUrl + '/package/excelTHStockList' /* 导出 */,

  /* 退货订单 */
  addTbReturn: baseUrl + '/order/addReturn' /*  添加 */,
  batchaddOrderTh: baseUrl + '/order/batchThReturn' /* 批量添加 */,
  tbReturnList: baseUrl + '/order/returnOrder' /* 列表 */,
  viewTbReturn: baseUrl + '/order/viewReturnOrder' /* 查看 */,
  delTbReturn: baseUrl + '/order/delReturnOrder' /* 删除 */,
  editTbReturn: baseUrl + '/order/editReturnOrder' /* 编辑 */,
  delMulTbReturn: baseUrl + '/order/delMulReturnOrder' /* 批量删除 */,
  excelThYjdf: baseUrl + '/order/excelThYjdf' /* 导出订单列表 */,

  //运单管理
  /*yfWaybill: baseUrl + '/waybill/yunfei' /!*  运费计算 *!/,
  addWaybill: baseUrl + '/waybill/add' /!*  添加 *!/,
  yundanList: baseUrl + '/waybill/yundanList' /!*  添加 *!/,
  yundanPay: baseUrl + '/waybill/yundanPay' /!*  支付 *!/,
  yundanDel: baseUrl + '/waybill/yundanDel' /!*  删除 *!/,
  yundanCancels: baseUrl + '/waybill/yundanCancels' /!*  取消 *!/,*/
  yfWaybill: baseUrl + '/orderv3/yldUpsRate' /*  运费计算 */,
  addWaybill: baseUrl + '/orderv3/yldAdd' /*  添加 */,
  batchaddFedex: baseUrl + '/orderv3/batchaddFedex' /*  批量添加 */,
  batchaddUps: baseUrl + '/orderv3/batchaddUps' /*  批量添加 */,
  yundanList: baseUrl + '/orderv3/yundanList' /*  列表 */,
  yundanDel: baseUrl + '/orderv3/yundanDel' /*  删除 */,
  yundanDelPl: baseUrl + '/orderv3/yundanDelPl' /*  删除 */,
  yundanCancels: baseUrl + '/orderv3/yundanCancels' /*  取消 */,
  yundanCancelsPl: baseUrl + '/orderv3/yundanCancelsPl' /*  批量取消 */,
  yundanDayin: baseUrl + '/orderv3/yundanDayin' /*  打印 */,
  yundanDayinPl: baseUrl + '/orderv3/yundanDayinPl' /*  批量打印 */,
  yundanDownPl: baseUrl + '/orderv3/yundanDownPl' /*  批量下载 */,
  yundanDetails: baseUrl + '/orderv3/yundanDetails' /*  详情 */,
  yundanFapiao: baseUrl + '/orderv3/yundanFapiao' /*  发票 */,
  //ups
  yfWaybillUps: baseUrl + '/orderv3/yldUpsRateUps' /*  运费计算 */,
  addWaybillUps: baseUrl + '/orderv3/yldAddUps' /*  添加 */,
  excelFedex: baseUrl + '/orderv3/excelFedex' /*  导出 */,
  //ups2
  yfWaybillUps2: baseUrl + '/ups/rates' /*  运费计算 */,
  addWaybillUps2: baseUrl + '/ups/createLabel' /*  添加 */,
  batchaddUps2: baseUrl + '/ups/batchaddUps2' /*  批量添加 */,
  
  //ec ups
  yfWaybillUps3: baseUrl + '/ups/ratesEc' /*  运费计算 */,
  addWaybillUps3: baseUrl + '/ups/createEc' /*  添加 */,
  batchaddUps3: baseUrl + '/ups/batchaddEc' /*  批量添加 */,
  
  //ups加拿大
  upsAddCa: baseUrl + '/upsca/upsAdd' /*  添加 */,
  upsAddCaBatchAdd: baseUrl + '/upsca/upsAddCaBatchAdd' /*  批量添加 */,
  //fedex国际
  yfWaybillFedex: baseUrl + '/Fedexgj/yfWaybillFedex' /*  运费计算 */,
  addWaybillFedex: baseUrl + '/Fedexgj/addWaybillFedex' /*  下单 */,
  batchFedex: baseUrl + '/Fedexgj/batchFedex' /*  批量下单 */,
  yuyue: baseUrl + '/Fedexgj/yuyue' /*  预约 */,
  yuyueDo: baseUrl + '/Fedexgj/yuyueDo' /*  预约操作 */,
  yuyueCancel: baseUrl + '/Fedexgj/yuyueCancel' /*  预约取消 */,

  //usps
  uspsRates: baseUrl + '/orderv1/uspsRates' /*  运费计算 */,
  uspsAdd: baseUrl + '/orderv1/uspsAdd' /*  添加 */,
  uspsBatchAdd: baseUrl + '/orderv1/uspsBatchAdd' /*  批量添加 */,
  //speedx
  speedxRates: baseUrl + '/orderv1/speedxRates' /*  运费计算 */,
  speedxAdd: baseUrl + '/orderv1/speedxAdd' /*  添加 */,
  speedxBatchAdd: baseUrl + '/orderv1/speedxBatchAdd' /*  批量添加 */,
  //amazon
  amazonRates: baseUrl + '/orderv3/amazonRates' /*  运费计算 */,
  amazonAdd: baseUrl + '/orderv3/amazonAdd' /*  添加 */,
  amazonBatchAdd: baseUrl + '/orderv3/amazonBatchAdd' /*  批量添加 */,
  //GOFO  
  gofoRates: baseUrl + '/ordernew/gofoRate' /*  运费计算 */,
  gofoAdd: baseUrl + '/ordernew/gofoOrder' /*  添加 */,
  gofoBatchAdd: baseUrl + '/ordernew/gofoOrderBatch' /*  批量添加 */,
  nextdayRate: baseUrl + '/ordernew/nextdayRate' /*  运费计算 */,
  nextdayAdd: baseUrl + '/ordernew/nextdayOrder' /*  添加 */,
  nextdayBatchAdd: baseUrl + '/ordernew/nextdayOrderBatch' /*  批量添加 */,
  //dhl
  dhlAdd: baseUrl + '/dhl/dhlAdd' /*  添加 */,
  dhlBatchAdd: baseUrl + '/dhl/dhlBatchAdd' /*  批量添加 */,
  //dhl回邮单
  dhlAdd2: baseUrl + '/dhl/dhlAdd2' /*  添加 */,
  dhlBatchAdd2: baseUrl + '/dhl/dhlBatchAdd2' /*  批量添加 */,
  /* 财务管理 */
  paylog: baseUrl + '/user/paylog',
  op_pay: baseUrl + '/user/operatePay', //手动充值
  op_pay_usd: baseUrl + '/user/operatePayUsd', //手动充值
  op_pay_eur: baseUrl + '/user/operatePayEur', //手动充值
  onlinePay: baseUrl + '/user/onlinePay', //在线充值
  wxDo: baseUrl + '/user/wxDo', //在线充值
  wxCheck: baseUrl + '/user/wxCheck', //在线充值
  excelFinance: baseUrl + '/user/excelFinance',
  rateUsd: baseUrl + '/user/rateUsd',
  rateUsd2: baseUrl + '/user/rateUsd2',

  /* 账户管理接口 */
  info: baseUrl + '/user/info',
  editInfo: baseUrl + '/user/edit',

  // 头程运输
  headOrders: baseUrl + '/order/headorders',
  addHeadOrder: baseUrl + '/order/addHeadOrder',
  queryTransportion: baseUrl+'/order/queryTransportion',
  headDetail: baseUrl+ '/order/headDetail',
  editHead: baseUrl+ '/order/editHead',
  delHead: baseUrl+'/order/delHead',
  confirmHead: baseUrl+'/order/confirmHead',
  excelHead: baseUrl+'/order/excelHead',
  batchAddHead: baseUrl+'/order/batchAddHead',
  AirSeabatchAddHead: baseUrl+'/ordernew/batchHead',
  printOrder: baseUrl+ '/order/printOrder',
  control: baseUrl+ '/order/control',
  flow: baseUrl+ '/index/flow',


  // 清关
  clearanceOrders: baseUrl+'/order/clearanceorders',
  addClearance: baseUrl+'/order/addClearance',
  shenbao: baseUrl+'/order/shenbao',
  editClearanceRemark: baseUrl+'/order/editClearanceRemark',
  getClearanceDetail: baseUrl+'/order/viewClearanceOrder',
  updateClearanceFile: baseUrl+'/order/updateClearanceFile',
  uploadClearanceFile: baseUrl+'/order/uploadClearanceFile',
  getClearancePackages: baseUrl+'/order/getClearancePackages',
  clearancePackageDetail: baseUrl+'/order/clearancePackageDetail',
  excelQingguan: baseUrl+'/order/excelQingguan',
  printBill: baseUrl+'/order/printBill',
  importBillExcel: baseUrl+'/order/importBillExcel',
  printBillOrder: baseUrl+'/order/printBillOrder',
  printOneBill: baseUrl+'/order/printOneBill',
  excelLihuoReport: baseUrl+'/order/excelLihuoReport',

  //进口头程
  addHeadImports: baseUrl + '/headimports/addImports' /* 单个新建 */,
  headImportsList: baseUrl + '/headimports/importsList' /* 订单列表 */,
  headImportsDetail: baseUrl + '/headimports/importsDetail' /* 查看 */,
  delHeadImports: baseUrl + '/headimports/delImports' /* 删除 */,
  editHeadImports: baseUrl + '/headimports/editImports' /* 虚拟仓订单编辑 */,
  excelImports: baseUrl + '/headimports/excelVwh',
  countImports: baseUrl + '/headimports/checkCount', //检查待付款的订单个数
  trackingImports: baseUrl + '/headimports/checkTracking', //检查待付款的订单个数
  downfpImports: baseUrl + '/headimports/excel', //检查待付款的订单个数
  
  //工单系统
  addWork: baseUrl + '/package/addWork' /* 添加工单 */,
  workList: baseUrl + '/package/workList' /* 工单列表 */,
  delWork: baseUrl + '/package/delWork' /* 工单列表 */,
  workDetail: baseUrl + '/package/workDetail' /* 工单列表 */,
}
