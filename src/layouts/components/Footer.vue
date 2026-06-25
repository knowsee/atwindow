<script setup>
const year = new Date().getFullYear()
</script>

<template>
  <div class="h-100 d-flex flex-wrap align-center justify-center justify-md-space-between gap-2 px-2 px-md-6">
    <span class="text-body-2 text-medium-emphasis text-center text-md-start">
      © {{ year }}
      <span class="text-high-emphasis">{{ $t('layout.footer.company') }}</span>
      <span class="d-none d-sm-inline"> · {{ $t('layout.footer.product') }}</span>
    </span>
    <span class="text-body-2 text-medium-emphasis text-center text-md-end">
      {{ $t('layout.footer.tagline') }}
    </span>
  </div>
</template>
