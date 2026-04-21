export default [
  { heading: 'nav.heading.business' },
  {
    title: 'nav.dashboard',
    icon: { icon: 'tabler-layout-dashboard' },
    to: 'dashboard',
  },
  {
    title: 'nav.printLabel._',
    icon: { icon: 'tabler-printer' },
    children: [
      { title: 'nav.printLabel.create', to: 'apps-print-label-create' },
      { title: 'nav.printLabel.batchUpload', to: 'apps-print-label-batch-upload' },
      { title: 'nav.printLabel.shippingList', to: 'apps-print-label-shipping-list' },
      { title: 'nav.printLabel.orders', to: 'apps-print-label-orders' },
    ],
  },
  {
    title: 'nav.dropShipping._',
    icon: { icon: 'tabler-package' },
    children: [
      { title: 'nav.dropShipping.begin', to: 'apps-drop-shipping-begin' },
      { title: 'nav.dropShipping.products', to: 'apps-product-list' },
      { title: 'nav.dropShipping.inbound', to: 'apps-drop-shipping-package-list' },
      { title: 'nav.dropShipping.orders', to: 'apps-drop-shipping-order-list' },
      { title: 'nav.dropShipping.relabel', to: 'apps-drop-shipping-order-label-list' },
    ],
  },
  {
    title: 'nav.dropShippingReturns._',
    icon: { icon: 'tabler-arrow-back-up' },
    children: [
      { title: 'nav.dropShippingReturns.orders', to: 'apps-drop-shipping-return-order-list' },
      { title: 'nav.dropShippingReturns.packages', to: 'apps-drop-shipping-return-package-list' },
    ],
  },
  {
    title: 'nav.dataCenter._',
    icon: { icon: 'tabler-chart-bar' },
    children: [
      { title: 'nav.dataCenter.sales', to: 'apps-data-center-sales-analysis' },
      { title: 'nav.dataCenter.inventory', to: 'apps-data-center-inventory-data' },
      { title: 'nav.dataCenter.returnInventory', to: 'apps-data-center-return-inventory' },
    ],
  },
  {
    title: 'nav.account._',
    icon: { icon: 'tabler-user-shield' },
    children: [
      { title: 'nav.account.personalization', to: 'apps-account-personalization' },
      { title: 'nav.account.auth', to: 'apps-account-auth-management' },
      { title: 'nav.account.funds', to: 'apps-account-fund-overview' },
      { title: 'nav.account.addresses', to: 'apps-account-address-management' },
    ],
  },
]
