<script setup lang="ts">
import { X } from '@lucide/vue'
import { useToastStore } from '../../stores/toast'

const toastStore = useToastStore()

const typeStyles: Record<string, string> = {
  success: 'bg-green-50 text-green-800 border-green-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
    <div
      v-for="toast in toastStore.toasts"
      :key="toast.id"
      class="flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg"
      :class="typeStyles[toast.type]"
    >
      <span class="text-xs font-light leading-relaxed">{{ toast.message }}</span>
      <button
        class="ml-2 text-current opacity-50 hover:opacity-100"
        @click="toastStore.remove(toast.id)"
      >
        <X class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

