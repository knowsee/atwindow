# 客户端版本号检查

## 目标

SPA 部署新版本后，自动检测并提示用户刷新页面，避免使用旧版缓存文件。

## 设计决策

| 决策 | 选择 |
|------|------|
| 检测时机 | 仅路由切换时检查 |
| UI 提示 | 模态对话框（阻断操作，强制刷新） |
| 版本标识 | 构建时间戳，写入 `public/version.json` |

## 变更清单

### 1. `vite.config.js` — 构建时生成 version.json

在 `defineConfig` 的 `plugins` 数组中添加一个自定义插件，在 `writeBundle` 钩子中写入 `public/version.json`：

```json
{ "version": "1719234567890" }
```

- 仅在 `build` 模式下生成（`NODE_ENV === 'production'` 或 `command === 'build'`）
- 开发模式下也可生成（每次 build），但 dev server 热更新不会触发，开发时不会频繁弹窗

### 2. `src/composables/useVersionCheck.js` — 新建

核心逻辑：

```js
const VERSION_KEY = '__app_version__'
let currentVersion = ref(null)       // 从 localStorage 读取的当前版本
let newVersionAvailable = ref(false) // 是否检测到新版本

async function checkVersion() {
  // 1. 若 currentVersion 为空（首次），先 fetch 并缓存
  // 2. fetch /version.json?t=<timestamp>（防缓存）
  // 3. 比对：若不同 → newVersionAvailable = true，更新 localStorage
  // 4. 容错：fetch 失败/json 解析失败 → 静默跳过
}
```

- 导出 `newVersionAvailable`、`checkVersion()`、`applyUpdate()`（reload 页面）
- 使用 `@vueuse/core` 的 `useLocalStorage` 或原生 `localStorage`

### 3. `src/components/VersionUpdateDialog.vue` — 新建

模态对话框组件：

- Props: `modelValue` (Boolean)
- Emits: `update:modelValue`
- 内容：警告图标 + "检测到新版本" 标题 + "页面已更新，请刷新以获取最新版本" 描述
- 按钮：**立即刷新**（primary，调用 `applyUpdate` 即 `location.reload()`）
- 无取消/关闭按钮，用户必须刷新（或手动关闭浏览器标签页）

### 4. `src/layouts/default.vue` — 引入对话框

- 在模板底部添加 `<VersionUpdateDialog v-model="newVersionAvailable" />`
- 从 `useVersionCheck` 引入 `newVersionAvailable`

### 5. `src/plugins/1.router/guards.js` — 路由守卫中检查

在 `router.beforeEach` 中，登录检验通过后、导航放行前，添加版本检查：

```js
import { checkVersion, newVersionAvailable } from '@/composables/useVersionCheck'

// 在 router.beforeEach 中，放行前：
await checkVersion()
if (newVersionAvailable.value) {
  return false // 阻断导航，对话框已弹出
}
```

## 数据流

```
用户路由切换
  → router.beforeEach
    → checkVersion()
      → fetch /version.json?t=xxx
      → 比对 localStorage('__app_version__')
      → 相同: 放行
      → 不同: newVersionAvailable = true → 阻断导航
  → VersionUpdateDialog 弹出
  → 用户点击"立即刷新" → location.reload()
```

## 容错

- `/version.json` fetch 失败 → 静默跳过，不阻断导航
- JSON 解析失败 → 静默跳过
- 首次加载（localStorage 无缓存）→ 先缓存当前版本，不弹窗

## 验证

1. 正常启动项目，访问页面，路由切换无弹窗
2. 手动修改 `public/version.json` 中的时间戳，路由切换 → 弹出对话框
3. 点击"立即刷新" → 页面重新加载，新版本号缓存
4. 断网情况下路由切换 → 不弹窗，正常导航