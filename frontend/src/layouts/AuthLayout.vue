<script setup lang="ts">
withDefaults(defineProps<{
  imagePlaceholder?: boolean
}>(), {
  imagePlaceholder: true,
})
</script>

<template>
  <div class="flex min-h-screen bg-bg-100">
    <div class="hidden lg:flex lg:w-1/2 bg-gray-100 items-center justify-center overflow-hidden">
      <div
        v-if="imagePlaceholder"
        class="flex items-center justify-center w-full h-full"
      >
        <div class="text-center text-gray-500">
          <svg class="w-24 h-24 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p class="text-sm">Image Placeholder</p>
        </div>
      </div>
      <slot name="image" />
    </div>

    <div class="flex-1 flex items-center justify-center px-6 py-12 lg:px-16">
      <div class="w-full max-w-sm">
        <slot />
      </div>
    </div>
  </div>
</template>
