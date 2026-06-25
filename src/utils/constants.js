export const COOKIE_MAX_AGE_1_YEAR = 365 * 24 * 60 * 60

/**
 * 集中管理系统所有批量操作的下载模板配置
 */
export const DOWNLOAD_TEMPLATES = {
  // 1. 一件代发订单批量创建
  ORDER_BATCH: {
    key: "order_batch",
    label: "批量一件代发模板",
    files: [
      { ext: "xls", name: "批量一件代发模板.xls", path: "/download/批量一件代发模板.xls" },
    ],
  },

  // 2. 批量出单模板 - 核心物流业务
  SHIPPING_BATCH: {
    key: "shipping_batch",
    label: "批量出单模板",
    files: [
      { ext: "xlsx", name: "批量出单模板.xlsx", path: "/download/批量出单模板.xlsx" },
    ],
  },
  
  // 3. 产品批量导入 - 基础资料设置
  PRODUCT_BATCH: {
    key: "product_batch",
    label: "产品批量添加模板",
    files: [
      { ext: "xls", name: "产品批量添加模板.xls", path: "/download/产品批量添加模板.xls" },
    ],
  },
  
  // 4. 退货订单批量 - 处理售后/退货业务
  RETURN_ORDER_BATCH: {
    key: "return_order_batch",
    label: "退货订单批量模板",
    files: [
      { ext: "xls", name: "批量一件代发模板.xls", path: "/download/批量一件代发模板.xls" },
    ],
  },

  // 5. 批量入库/收货 - 仓库实物增加
  WAREHOUSE_RECEIPT_BATCH: {
    key: "warehouse_receipt_batch",
    label: "批量入库模板",
    files: [
      { ext: "xlsx", name: "批量创建入库清单模板.xlsx", path: "/download/批量创建入库清单模板.xlsx" },
    ],
  },
}
