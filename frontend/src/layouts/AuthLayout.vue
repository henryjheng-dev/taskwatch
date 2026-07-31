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
  <!-- 1. 最外層：全螢幕背景 + 水平垂直居中 + 四周留白 p-4 lg:p-8 -->
  <div class="min-h-screen w-full bg-gray-300 flex items-center justify-center p-4 sm:p-6 lg:p-8">
    <!-- 2. 中央卡片：白底、圓角 rounded-3xl、陰影 shadow-2xl -->
    <div
      class="w-full max-w-5xl bg-white rounded-3xl shadow-2xl flex flex-col lg:flex-row overflow-hidden min-h-150"
    >
      <!-- 3. 左側欄位：放圖片的地方 -->
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

      <!-- 4. 右側欄位：表單區域 (放寬至 max-w-md 並加上優雅間距) -->
      <div class="flex-1 flex items-center justify-center p-8 lg:p-12">
        <div class="w-full max-w-md">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>
