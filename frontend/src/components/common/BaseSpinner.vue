<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
}>(), {
  size: 'md',
})
</script>

<template>
  <div class="flex items-center justify-center">
    <svg
      class="animate-spin text-blue-600"
      :class="{
        'h-4 w-4': size === 'sm',
        'h-8 w-8': size === 'md',
        'h-12 w-12': size === 'lg',
      }"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  </div>
</template>
