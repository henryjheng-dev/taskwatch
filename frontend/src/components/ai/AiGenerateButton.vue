<script setup lang="ts">
import { Plus } from '@lucide/vue';
defineProps<{
  remaining?: number
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="h-8 inline-flex items-center gap-1.5 px-2.5 text-sm font-medium leading-5 text-gray-1000 bg-white border border-black/8 rounded-sm cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
    @click="$emit('click')"
  >
    <Plus class="w-4 h-4 shrink-0" :stroke-width="1.5" />
    <span>AI</span>
    <span v-if="remaining !== undefined" class="text-xs font-light leading-relaxed text-gray-600">({{ remaining }})</span>
  </button>
</template>
