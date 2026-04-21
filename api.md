**WMS API — 详细接口文档（首批 10 条）**

以下为优先生成的 10 个接口条目，逐个列出 URL、控制器方法、请求参数与示例出参，以及实现要点与备注。

**1. 计费试算：newbillRate**
- **URL：** /api/ordernew/newbillRate
- **方法：** POST
- **控制器：** application/api/controller/Ordernew.php::newbillRate
- **请求参数（示例/说明）：**
  - **package_info**: array 必需，包裹数组，每项包含 `weight,length,width,height,insuranceFee,sku,sku_num`。
  - **send-people-country / rec-people-country**: string 必需，通常为 "美国"。
  - **send-people-province / rec-people-province**: string 必需，二字州码。
  - **danwei**: int/enum 单位，1/2 等（代码中用于 kg/lb 转换）。
- **成功响应示例：**
  {
    "code": 1,
    "msg": "运费试算成功",
    "data": [ { "serviceType": "...", "totalAmount": 12.34, "channel": 5 } ]
  }
- **备注：** 注意 `Ordernew` 内部会根据用户 `channel` 调用不同适配器（NextApi/Repository），试算路径可能会丢失 `extra` 或 `skuInfo`。

**2. 下单：newbillOrder**
- **URL：** /api/ordernew/newbillOrder
- **方法：** POST
- **控制器：** application/api/controller/Ordernew.php::newbillOrder
- **请求参数：** 与试算类似，额外需 `num`（线路标识串）、`cankaohao`（参考号）和 `fee_detail` 等支付/线路信息。
- **成功响应示例：**
  { "code": 1, "msg": "下单成功", "data": { "order_sn": "USER_...", "ht_tracking_no": "..." } }
- **备注：** 写库（`order_waybill`/`order_waybill_de`）、扣款与 `pay_log` 置于事务中；不同渠道返回字段差异化处理。

**3. 订单添加：order/add**
- **URL：** /api/order/add
- **方法：** POST
- **控制器：** application/api/controller/Order.php::add
- **请求参数（常见）：** `package_info`, `send-people-*`, `rec-people-*`, `cankaohao`, `num`。
- **成功响应示例：**
  { "code":1, "msg":"添加成功", "data": { "order_id": 123 } }
- **备注：** 多数分支基于 `type`/`channel_type`，入库与渠道适配分散，请参照 `Order.php` 源码。

**4. 用户登录：user/login**
- **URL：** /api/user/login
- **方法：** POST
- **控制器：** application/api/controller/User.php::login
- **请求参数：** `account`, `password`，可选 `captcha`。
- **成功响应示例：**
  {
    "code": 1,
    "msg": "登录成功",
    "time": "1776303514",
    "data": {
        "userinfo": {
            "id": 1,
            "group_id": 1,
            "username": "test",
            "nickname": "test",
            "mobile": "13888888888",
            "avatar": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZlcnNpb249IjEuMSIgaGVpZ2h0PSIxMDAiIHdpZHRoPSIxMDAiPjxyZWN0IGZpbGw9InJnYigyMjksMjAxLDE2MCkiIHg9IjAiIHk9IjAiIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48L3JlY3Q+PHRleHQgeD0iNTAiIHk9IjUwIiBmb250LXNpemU9IjUwIiB0ZXh0LWNvcHk9ImZhc3QiIGZpbGw9IiNmZmZmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIHRleHQtcmlnaHRzPSJhZG1pbiIgYWxpZ25tZW50LWJhc2VsaW5lPSJjZW50cmFsIj5UPC90ZXh0Pjwvc3ZnPg==",
            "score": 0,
            "token": "24ad0f01-a245-41c8-97b9-b6bfcb4aade2",
            "user_id": 1,
            "createtime": 1776303514,
            "expiretime": 1776389914,
            "expires_in": 86400
        }
    }
}
- **备注：** 登录返回 token，用于后续鉴权（多数接口依赖 `$this->auth->id`）。

**5. 产品添加：product/add**
- **URL：** /api/product/add
- **方法：** POST
- **控制器：** application/api/controller/Product.php::add
- **请求参数：** `name`, `sku`, `weight`, `length`, `width`, `height`, `price` 等。
- **成功响应示例：**
  { "code":1, "msg":"添加成功", "data": { "product_id": 456 } }

**6. 包裹入库：package/ruku**
- **URL：** /api/package/ruku
- **方法：** POST
- **控制器：** application/api/controller/Package.php::ruku
- **请求参数：** `warehouse_id`, `sku`, `qty`, `location` 等。
- **成功响应示例：**
  { "code":1, "msg":"入库成功" }
- **备注：** 前端曾在多处硬编码仓库枚举，建议统一管理映射表。

**7. 查询仓库列表：order/queryWarehouses**
- **URL：** /api/order/queryWarehouses
- **方法：** GET
- **控制器：** application/api/controller/Order.php::queryWarehouses
- **请求参数：** 可选筛选（地域/状态）。
- **成功响应示例：**
  { "code":1, "msg":"请求成功", "data": [ {"id":22, "name":"美国仓(19137)"} ] }

**8. 订单列表（标准化查询）：orderDdList**
- **URL：** /api/ordernew/orderDdList
- **方法：** POST
- **控制器：** application/api/controller/Ordernew.php::orderDdList
- **请求参数（说明）：**
  - `current_page` (int) 必需
  - `per_page_num` (int) 必需
  - `status` (int) 可选；`6` 表示返回含 `error_message` 的异常订单
  - `type` (int) 可选，订单类型（与渠道 QID 等对应）
  - `cankaohao` (string) 可选，支持多行换行符分隔的参考号列表
  - `recipient_name` (string) 可选，收件人姓名（会映射地址表查询 id）
  - `create_time` (string) 可选，格式 `YYYY-MM-DD - YYYY-MM-DD`
- **成功响应示例：**
  {
    "code": 1,
    "msg": "请求成功",
    "data": {
      "count": 123,
      "current_page": 1,
      "per_page_num": 20,
      "data": [
        { "id": 1, "order_sn": "USER_...", "cankaohao": "...", "status": 2, "sku": "ABC123", "total_weight": 2.5, "createtime": "2026-04-16 12:00:00" }
      ]
    }
  }
- **备注：** 返回会把 `box_data` 中第一个箱的 `memo` 或 `sku` 尝试解析为 `sku` 字段，并返回 `total_weight`（来自 `weight` 字段）。前端运单列表页使用本接口与 `getChannelList` 填充「订单类型」筛选。

**9. 渠道列表：getChannelList**
- **URL：** /api/ordernew/getChannelList
- **方法：** GET
- **控制器：** application/api/controller/Ordernew.php::getChannelList
- **请求参数：** 无
- **成功响应示例：**
  { "code": 1, "msg": "获取成功", "data": [ { "qid": 210, "name": "Gofo", "fee_mode": "gofo", "extra": {} }, { "qid": 213, "name": "NextDay", "fee_mode": "api" } ] }
- **备注：** 列表基于 `Ordernew::$qidRules`；`extra` 为渠道默认 extra 模板。前端用于订单列表「订单类型（渠道 QID）」下拉选项。

---

注：以上条目基于控制器源码阅读与实现摘录。下一步可按相同模板逐条细化参数（类型/必填/示例）及补入 `NextApi` / repository 的真实返回片段。如需我现在继续精化并解析 `app/api/library/NextApi` 与 `app/api/repositorys`，请确认是否同时允许解析这些目录以补全上游返回示例。
