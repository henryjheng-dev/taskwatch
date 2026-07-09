<script setup lang="ts">
defineProps<{
  remaining?: number
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="h-10 inline-flex items-center gap-2 px-3 text-sm font-medium leading-5 text-blue-700 bg-blue-100 rounded-sm hover:bg-blue-200 transition-colors focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
    @click="$emit('click')"
  >
    <svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1v14M1 8h14"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </svg>
    <span>AI</span>
    <span v-if="remaining !== undefined" class="text-xs text-blue-600">({{ remaining }})</span>
  </button>
</template>
