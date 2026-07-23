<script setup lang="ts">
import { X } from '@lucide/vue';
import { onMounted, onUnmounted } from 'vue';

const props = withDefaults(
  defineProps<{
    show: boolean;
    title?: string;
    maxWidth?: string;
    hideClose?: boolean;
  }>(),
  {
    title: '',
    maxWidth: 'max-w-lg',
    hideClose: false,
  },
);

const emit = defineEmits<{
  close: [];
}>();

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.show) {
    emit('close');
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-black/50" />
      <div class="relative w-full rounded-xl bg-white p-6 shadow-xl" :class="maxWidth">
        <div v-if="title" class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-medium text-gray-900">{{ title }}</h2>
          <button
            v-if="!hideClose"
            class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            @click="emit('close')"
          >
            <X class="h-5 w-5" />
          </button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>

