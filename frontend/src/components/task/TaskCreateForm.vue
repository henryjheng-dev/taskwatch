<script setup lang="ts">
import { ref, watch } from 'vue';
import BaseModal from '../common/BaseModal.vue';
import BaseButton from '../common/BaseButton.vue';
import type { Priority } from '../../types';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const props = defineProps<{
  show: boolean;
  boardId: number;
  columnId: number;
}>();

const emit = defineEmits<{
  close: [];
  created: [];
}>();

const title = ref('');
const description = ref('');
const priority = ref<Priority>('MEDIUM');
const dueDate = ref(today());
const loading = ref(false);
const error = ref('');

watch(
  () => props.show,
  (val) => {
    if (val) {
      title.value = '';
      description.value = '';
      priority.value = 'MEDIUM';
      dueDate.value = today();
      error.value = '';
    }
  },
);

async function handleCreate() {
  if (!title.value.trim()) {
    error.value = 'Task title is required';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    const { useBoardStore } = await import('../../stores/board');
    const boardStore = useBoardStore();

    await boardStore.createTask(props.boardId, props.columnId, {
      title: title.value.trim(),
      description: description.value || undefined,
      priority: priority.value,
      dueDate: dueDate.value || undefined,
    });
    emit('created');
  } catch (err: any) {
    const msg = err.response?.data?.message;
    error.value = Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to create task';
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  emit('close');
}
</script>

<template>
  <BaseModal :show="show" title="Create Task" max-width="max-w-md" @close="handleClose">
    <div class="space-y-4">
      <div class="space-y-1">
        <label class="block text-base font-medium text-gray-1000">Title</label>
        <input
          :value="title"
          class="block w-full h-10 px-3 bg-white text-gray-1000 text-sm rounded-sm border border-black/8 transition-all duration-150 placeholder:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          :class="[error ? 'border-red-400 focus-visible:ring-red-700' : '']"
          placeholder="What needs to be done?"
          @input="title = ($event.target as HTMLInputElement).value"
        />
        <p v-if="error" class="text-xs font-light leading-relaxed text-red-800">{{ error }}</p>
      </div>

      <div class="space-y-1">
        <label class="block text-base font-medium text-gray-1000">Description</label>
        <textarea
          v-model="description"
          class="block w-full min-h-48 px-3 py-2 bg-white text-gray-1000 text-sm rounded-sm border border-black/8 transition-all duration-150 placeholder:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white resize-vertical"
          placeholder="Add a description..."
        />
      </div>

      <div class="flex gap-4">
        <div class="flex-1 space-y-1">
          <label class="block text-base font-medium text-gray-1000">Priority</label>
          <select
            v-model="priority"
            class="block w-full h-10 px-3 bg-white text-gray-1000 text-sm rounded-sm border border-black/8 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>

        <div class="flex-1 space-y-1">
          <label class="block text-base font-medium text-gray-1000">Due date</label>
          <input
            v-model="dueDate"
            type="date"
            class="block w-full h-10 px-3 bg-white text-gray-1000 text-sm rounded-sm border border-black/8 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          />
        </div>
      </div>

      <div class="flex justify-between pt-2">
        <BaseButton variant="error" size="sm" @click="handleClose"> Cancel </BaseButton>
        <BaseButton variant="primary" :loading="loading" @click="handleCreate">Create</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>


