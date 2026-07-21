const fs = require('fs')
const path = require('path')

const baseDir = path.join(__dirname, 'src/plugins/i18n/locales')

const i18nKeys = {
  en: {
    title: 'Inventory Analysis',
    subtitle: 'Comprehensive overview and insights of your warehouse stock.',
    selectWarehouse: 'Select Warehouse',
    dataGenerating: 'Data is Generating',
    dataGeneratingDesc: 'No inventory data found. Analytics are currently being generated, please try again later.',
    overview: {
      totalSkus: 'Total SKUs Analyzed',
      generatedAt: 'Generated at:',
      gmv60d: '60-Day GMV',
      inventoryValue: 'Total Inventory Value',
      turnover60d: 'Warehouse Turnover (60d)',
      outbound: 'Outbound:',
      stock: 'Stock:'
    },
    charts: {
      salesTrends: 'Sales Trends (Last 8 Weeks)',
      outboundUnits: 'Outbound Units',
      gmv: 'GMV ($)',
      inventoryAge: 'Inventory Age Distribution (FIFO)',
      days0_30: '0-30 Days',
      days31_60: '31-60 Days',
      days61_90: '61-90 Days',
      days90Plus: '90+ Days'
    },
    insights: {
      topCategories: 'Top Categories',
      category: 'Category',
      outbound60d: 'Outbound (60d)',
      gmv60d: 'GMV (60d)',
      skuAffinity: 'SKU Affinity (Co-occurrences)',
      orders: 'orders'
    },
    table: {
      title: 'SKU Analytics List',
      tabs: {
        all: 'All SKUs',
        stagnant: 'Stagnant Risks',
        critical: 'Critical Shortages',
        topSellers: 'Top Sellers'
      },
      limit: 'Limit',
      refresh: 'Refresh',
      columns: {
        sku: 'SKU',
        nameCat: 'Name / Category',
        price: 'Price',
        stockWarn: 'Stock (Warn)',
        status: 'Status',
        daysLeft: 'Days Left',
        inOut60d: '60d In/Out',
        noSaleDays: 'No Sale (Days)'
      },
      noData: 'No SKUs found for this criteria.',
      showingText: 'Showing up to {limit} of {total} total matching SKUs.'
    }
  },
  zh: {
    title: '库存分析',
    subtitle: '全面了解您的仓库库存概览和深度洞察。',
    selectWarehouse: '选择仓库',
    dataGenerating: '数据正在生成中',
    dataGeneratingDesc: '暂无库存数据，系统正在为您生成分析报告，请稍后再试。',
    overview: {
      totalSkus: '参与分析的 SKU 总数',
      generatedAt: '生成时间:',
      gmv60d: '近60天 GMV',
      inventoryValue: '当前库存总价值',
      turnover60d: '仓库流转率 (60天)',
      outbound: '出库:',
      stock: '在库:'
    },
    charts: {
      salesTrends: '销售趋势 (近8周)',
      outboundUnits: '出库件数',
      gmv: 'GMV ($)',
      inventoryAge: '库存账龄分布 (FIFO)',
      days0_30: '0-30 天',
      days31_60: '31-60 天',
      days61_90: '61-90 天',
      days90Plus: '90 天以上'
    },
    insights: {
      topCategories: '热门品类排行',
      category: '品类',
      outbound60d: '出库件数 (60天)',
      gmv60d: 'GMV (60天)',
      skuAffinity: '商品高频共购组合 (SKU 连带)',
      orders: '单'
    },
    table: {
      title: 'SKU 数据明细',
      tabs: {
        all: '全部商品',
        stagnant: '滞销风险',
        critical: '缺货警报',
        topSellers: '热销畅销'
      },
      limit: '每页条数',
      refresh: '刷新',
      columns: {
        sku: 'SKU',
        nameCat: '商品名称 / 品类',
        price: '单价',
        stockWarn: '当前库存 (预警)',
        status: '状态',
        daysLeft: '可支撑天数',
        inOut60d: '60天 入/出',
        noSaleDays: '未出单天数'
      },
      noData: '没有符合条件的商品数据。',
      showingText: '最多显示 {limit} 条数据，共匹配到 {total} 个 SKU。'
    }
  },
  fr: {
    title: 'Analyse des Stocks',
    subtitle: 'Aperçu complet et informations sur le stock de votre entrepôt.',
    selectWarehouse: 'Sélectionner l\'entrepôt',
    dataGenerating: 'Génération de données en cours',
    dataGeneratingDesc: 'Aucune donnée d\'inventaire trouvée. Les analyses sont en cours de génération, veuillez réessayer plus tard.',
    overview: {
      totalSkus: 'Total des SKU analysés',
      generatedAt: 'Généré à:',
      gmv60d: 'GMV 60 jours',
      inventoryValue: 'Valeur totale du stock',
      turnover60d: 'Taux de rotation (60j)',
      outbound: 'Sortant:',
      stock: 'Stock:'
    },
    charts: {
      salesTrends: 'Tendances des ventes (8 dernières semaines)',
      outboundUnits: 'Unités sortantes',
      gmv: 'GMV ($)',
      inventoryAge: 'Répartition de l\'âge du stock (FIFO)',
      days0_30: '0-30 jours',
      days31_60: '31-60 jours',
      days61_90: '61-90 jours',
      days90Plus: 'Plus de 90 jours'
    },
    insights: {
      topCategories: 'Top Catégories',
      category: 'Catégorie',
      outbound60d: 'Sortant (60j)',
      gmv60d: 'GMV (60j)',
      skuAffinity: 'Affinité SKU (Co-occurrences)',
      orders: 'commandes'
    },
    table: {
      title: 'Liste des analyses SKU',
      tabs: {
        all: 'Tous les SKU',
        stagnant: 'Risques de stagnation',
        critical: 'Pénuries critiques',
        topSellers: 'Meilleures ventes'
      },
      limit: 'Limite',
      refresh: 'Rafraîchir',
      columns: {
        sku: 'SKU',
        nameCat: 'Nom / Catégorie',
        price: 'Prix',
        stockWarn: 'Stock (Alerte)',
        status: 'Statut',
        daysLeft: 'Jours restants',
        inOut60d: '60j Entrée/Sortie',
        noSaleDays: 'Jours sans vente'
      },
      noData: 'Aucun SKU trouvé pour ces critères.',
      showingText: 'Affichage jusqu\'à {limit} de {total} SKU correspondants.'
    }
  }
}

for (const lang of ['en', 'zh', 'fr']) {
  const file = path.join(baseDir, `${lang}.json`)
  let data = {}
  if (fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file, 'utf8'))
  }
  if (!data.pages) data.pages = {}
  data.pages.dataCenterInventoryAnalysis = i18nKeys[lang]
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}
console.log('Locales updated.')
