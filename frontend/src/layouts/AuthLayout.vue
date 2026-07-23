<script setup lang="ts">
import { Image } from '@lucide/vue';
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
          <Image class="w-24 h-24 mx-auto mb-4 text-gray-400" :stroke-width="1" />
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
