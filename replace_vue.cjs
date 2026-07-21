const fs = require('fs')
const file = 'src/pages/apps/data-center/inventory-data.vue'
let content = fs.readFileSync(file, 'utf8')

// Fix charts
content = content.replace(
  `legend: { data: ['Outbound Units', 'GMV ($)'] },`,
  `legend: { data: [t('pages.dataCenterInventoryAnalysis.charts.outboundUnits'), t('pages.dataCenterInventoryAnalysis.charts.gmv')], top: 0 },`
)
content = content.replace(
  `grid: { left: '3%', right: '3%', bottom: '5%', containLabel: true },`,
  `grid: { left: '3%', right: '3%', bottom: '8%', containLabel: true, top: 30 },`
)
content = content.replace(
  `xAxis: { type: 'category', data: ['W1','W2','W3','W4','W5','W6','W7','W8'] },`,
  `xAxis: { type: 'category', data: ['W1','W2','W3','W4','W5','W6','W7','W8'], axisLabel: { interval: 0 } },`
)
content = content.replace(
  `{ name: 'Outbound Units', type: 'bar', itemStyle: { color: themeColors.primary }, data: wOutbound },`,
  `{ name: t('pages.dataCenterInventoryAnalysis.charts.outboundUnits'), type: 'bar', itemStyle: { color: themeColors.primary }, data: wOutbound },`
)
content = content.replace(
  `{ name: 'GMV ($)', type: 'line', yAxisIndex: 1, itemStyle: { color: themeColors.success }, smooth: true, data: wGmv }`,
  `{ name: t('pages.dataCenterInventoryAnalysis.charts.gmv'), type: 'line', yAxisIndex: 1, itemStyle: { color: themeColors.success }, smooth: true, data: wGmv }`
)

content = content.replace(
  `const data = [
    { value: age['0_30']?.units || 0, name: '0-30 Days', itemStyle: { color: themeColors.success } },
    { value: age['31_60']?.units || 0, name: '31-60 Days', itemStyle: { color: themeColors.warning } },
    { value: age['61_90']?.units || 0, name: '61-90 Days', itemStyle: { color: themeColors.error } },
    { value: age['90_plus']?.units || 0, name: '90+ Days', itemStyle: { color: '#888888' } },
  ].filter(i => i.value > 0)`,
  `const data = [
    { value: age['0_30']?.units || 0, name: t('pages.dataCenterInventoryAnalysis.charts.days0_30'), itemStyle: { color: themeColors.success } },
    { value: age['31_60']?.units || 0, name: t('pages.dataCenterInventoryAnalysis.charts.days31_60'), itemStyle: { color: themeColors.warning } },
    { value: age['61_90']?.units || 0, name: t('pages.dataCenterInventoryAnalysis.charts.days61_90'), itemStyle: { color: themeColors.error } },
    { value: age['90_plus']?.units || 0, name: t('pages.dataCenterInventoryAnalysis.charts.days90Plus'), itemStyle: { color: '#888888' } },
  ].filter(i => i.value > 0)`
)

content = content.replace(
  `radius: ['40%', '70%'],`,
  `radius: ['35%', '60%'], center: ['50%', '45%'],`
)

// Fix template strings
const replacements = [
  ['Inventory Analysis', `{{ $t('pages.dataCenterInventoryAnalysis.title') }}`],
  ['Comprehensive overview and insights of your warehouse stock.', `{{ $t('pages.dataCenterInventoryAnalysis.subtitle') }}`],
  ['Select Warehouse', `$t('pages.dataCenterInventoryAnalysis.selectWarehouse')`],
  ['Data is Generating', `{{ $t('pages.dataCenterInventoryAnalysis.dataGenerating') }}`],
  ['No inventory data found. Analytics are currently being generated, please try again later.', `{{ $t('pages.dataCenterInventoryAnalysis.dataGeneratingDesc') }}`],
  
  ['Total SKUs Analyzed', `{{ $t('pages.dataCenterInventoryAnalysis.overview.totalSkus') }}`],
  ['Generated at:', `{{ $t('pages.dataCenterInventoryAnalysis.overview.generatedAt') }}`],
  ['60-Day GMV', `{{ $t('pages.dataCenterInventoryAnalysis.overview.gmv60d') }}`],
  ['Total Inventory Value', `{{ $t('pages.dataCenterInventoryAnalysis.overview.inventoryValue') }}`],
  ['Warehouse Turnover (60d)', `{{ $t('pages.dataCenterInventoryAnalysis.overview.turnover60d') }}`],
  ['Outbound:', `{{ $t('pages.dataCenterInventoryAnalysis.overview.outbound') }}`],
  ['Stock:', `{{ $t('pages.dataCenterInventoryAnalysis.overview.stock') }}`],
  
  ['Sales Trends (Last 8 Weeks)', `{{ $t('pages.dataCenterInventoryAnalysis.charts.salesTrends') }}`],
  ['Inventory Age Distribution (FIFO)', `{{ $t('pages.dataCenterInventoryAnalysis.charts.inventoryAge') }}`],
  
  ['Top Categories', `{{ $t('pages.dataCenterInventoryAnalysis.insights.topCategories') }}`],
  ['<th>Category</th>', `<th>{{ $t('pages.dataCenterInventoryAnalysis.insights.category') }}</th>`],
  ['<th class="text-right">Outbound (60d)</th>', `<th class="text-right">{{ $t('pages.dataCenterInventoryAnalysis.insights.outbound60d') }}</th>`],
  ['<th class="text-right">GMV (60d)</th>', `<th class="text-right">{{ $t('pages.dataCenterInventoryAnalysis.insights.gmv60d') }}</th>`],
  ['SKU Affinity (Co-occurrences)', `{{ $t('pages.dataCenterInventoryAnalysis.insights.skuAffinity') }}`],
  ['orders', `{{ $t('pages.dataCenterInventoryAnalysis.insights.orders') }}`],
  
  ['SKU Analytics List', `{{ $t('pages.dataCenterInventoryAnalysis.table.title') }}`],
  ['<VTab value="all">All SKUs</VTab>', `<VTab value="all">{{ $t('pages.dataCenterInventoryAnalysis.table.tabs.all') }}</VTab>`],
  ['<VTab value="stagnant">Stagnant Risks</VTab>', `<VTab value="stagnant">{{ $t('pages.dataCenterInventoryAnalysis.table.tabs.stagnant') }}</VTab>`],
  ['<VTab value="critical">Critical Shortages</VTab>', `<VTab value="critical">{{ $t('pages.dataCenterInventoryAnalysis.table.tabs.critical') }}</VTab>`],
  ['<VTab value="top_sellers">Top Sellers</VTab>', `<VTab value="top_sellers">{{ $t('pages.dataCenterInventoryAnalysis.table.tabs.topSellers') }}</VTab>`],
  ['label="Limit"', `:label="$t('pages.dataCenterInventoryAnalysis.table.limit')"`],
  ['Refresh', `{{ $t('pages.dataCenterInventoryAnalysis.table.refresh') }}`],
  
  ['<th>SKU</th>', `<th>{{ $t('pages.dataCenterInventoryAnalysis.table.columns.sku') }}</th>`],
  ['<th>Name / Category</th>', `<th>{{ $t('pages.dataCenterInventoryAnalysis.table.columns.nameCat') }}</th>`],
  ['<th class="text-right">Price</th>', `<th class="text-right">{{ $t('pages.dataCenterInventoryAnalysis.table.columns.price') }}</th>`],
  ['<th class="text-right">Stock (Warn)</th>', `<th class="text-right">{{ $t('pages.dataCenterInventoryAnalysis.table.columns.stockWarn') }}</th>`],
  ['<th class="text-center">Status</th>', `<th class="text-center">{{ $t('pages.dataCenterInventoryAnalysis.table.columns.status') }}</th>`],
  ['<th class="text-right">Days Left</th>', `<th class="text-right">{{ $t('pages.dataCenterInventoryAnalysis.table.columns.daysLeft') }}</th>`],
  ['<th class="text-right">60d In/Out</th>', `<th class="text-right">{{ $t('pages.dataCenterInventoryAnalysis.table.columns.inOut60d') }}</th>`],
  ['<th class="text-right">No Sale (Days)</th>', `<th class="text-right">{{ $t('pages.dataCenterInventoryAnalysis.table.columns.noSaleDays') }}</th>`],
  
  ['No SKUs found for this criteria.', `{{ $t('pages.dataCenterInventoryAnalysis.table.noData') }}`],
  ['Showing up to {{ skuLimit }} of {{ skuData.total }} total matching SKUs.', `{{ $t('pages.dataCenterInventoryAnalysis.table.showingText', { limit: skuLimit, total: skuData.total }) }}`]
]

for (const [from, to] of replacements) {
  content = content.replace(from, to)
}

fs.writeFileSync(file, content)
console.log('Vue file updated.')
