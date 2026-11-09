<script setup lang="ts">
import { Image } from '@lucide/vue';
withDefaults(
  defineProps<{
    imagePlaceholder?: boolean;
    leftPanelWidth?: string;
  }>(),
  {
    imagePlaceholder: true,
    leftPanelWidth: 'lg:w-1/2',
  },
);
</script>

<template>
  <div class="min-h-screen w-full bg-gray-300 flex items-center justify-center p-4 sm:p-6 lg:p-8">
    <div
      class="w-full max-w-5xl bg-white rounded-3xl shadow-2xl flex flex-col lg:flex-row overflow-hidden min-h-150"
    >
      <div
        :class="[
          'hidden lg:flex',
          leftPanelWidth,
          'relative items-center justify-center overflow-hidden',
        ]"
      >
        <div v-if="imagePlaceholder" class="flex items-center justify-center w-full h-full">
          <div class="text-center text-gray-500">
            <Image class="w-24 h-24 mx-auto mb-4 text-gray-400" :stroke-width="1" />
            <p class="text-sm">Image Placeholder</p>
          </div>
        </div>
        <slot name="image" />
      </div>
      <div class="flex-1 flex items-center justify-center p-8 lg:p-12">
        <div class="w-full max-w-md">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>
