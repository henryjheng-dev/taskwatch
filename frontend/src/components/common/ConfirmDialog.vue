<script setup lang="ts">
import BaseModal from './BaseModal.vue';

withDefaults(
  defineProps<{
    show: boolean;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
  }>(),
  {
    title: '確認',
    message: '確定要執行此操作嗎？',
    confirmText: '刪除',
    cancelText: '取消',
  },
);

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <BaseModal :show="show" :title="title" max-width="max-w-sm" @close="emit('cancel')">
    <p class="text-sm text-gray-600 mb-6">{{ message }}</p>
    <div class="flex justify-end gap-3">
      <button
        class="h-8 px-4 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-sm transition-colors"
        @click="emit('cancel')"
      >
        {{ cancelText }}
      </button>
      <button
        class="h-8 px-4 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-sm transition-colors"
        @click="emit('confirm')"
      >
        {{ confirmText }}
      </button>
    </div>
  </BaseModal>
</template>
