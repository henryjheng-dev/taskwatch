<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
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
const editorRef = ref<HTMLDivElement | null>(null);

function syncDescription() {
  if (editorRef.value) {
    description.value = editorRef.value.innerHTML;
  }
}

function execCmd(command: string, value?: string) {
  document.execCommand(command, false, value);
  editorRef.value?.focus();
  syncDescription();
}

watch(
  () => props.show,
  (val) => {
    if (val) {
      title.value = '';
      description.value = '';
      priority.value = 'MEDIUM';
      dueDate.value = today();
      error.value = '';
      nextTick(() => {
        if (editorRef.value) {
          editorRef.value.innerHTML = '';
        }
      });
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
        <div
          class="border border-black/8 rounded-sm overflow-hidden focus-within:ring-2 focus-within:ring-gray-1000 focus-within:ring-offset-2 focus-within:ring-offset-white"
        >
          <div class="flex items-center gap-0.5 px-2 py-1.5 border-b border-black/8 bg-gray-100">
            <select
              class="h-7 text-xs text-gray-900 bg-transparent border-none rounded px-1 outline-none cursor-pointer hover:bg-black/5 transition-colors"
              @change="
                execCmd('formatBlock', ($event.target as HTMLSelectElement).value);
                ($event.target as HTMLSelectElement).value = '';
              "
            >
              <option value="" disabled selected>Heading</option>
              <option value="<p>">Text</option>
              <option value="<h1>">H1</option>
              <option value="<h2>">H2</option>
              <option value="<h3>">H3</option>
            </select>
            <span class="w-px h-4 mx-0.5 bg-black/8" />
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center text-sm font-bold tracking-tight text-gray-900 rounded hover:bg-black/5 transition-colors"
              title="Bold"
              @click="execCmd('bold')"
            >
              B
            </button>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center text-sm font-serif italic text-gray-900 rounded hover:bg-black/5 transition-colors"
              title="Italic"
              @click="execCmd('italic')"
            >
              I
            </button>
            <span class="w-px h-4 mx-0.5 bg-black/8" />
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center text-sm text-gray-900 rounded hover:bg-black/5 transition-colors"
              title="Unordered List"
              @click="execCmd('insertUnorderedList')"
            >
              <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path
                  d="M2 4h1v1H2V4zm3 0h9v1H5V4zM2 7.5h1v1H2v-1zm3 0h9v1H5v-1zM2 11h1v1H2v-1zm3 0h9v1H5v-1z"
                />
              </svg>
            </button>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center text-sm text-gray-900 rounded hover:bg-black/5 transition-colors"
              title="Ordered List"
              @click="execCmd('insertOrderedList')"
            >
              <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path
                  d="M2.5 2.5v3H4v-1H3V3h1V2.5h-.5zM3 7.5V7h1v1.5H3zM2.5 11v.5H4V11H3zm0 2.5V14H4v-1.5h-1zM6 4h9v1H6V4zm0 7h9v1H6v-1zm0-3.5h9v1H6v-1z"
                />
              </svg>
            </button>
          </div>
          <div
            ref="editorRef"
            contenteditable="true"
            class="editor px-3 py-2 text-xs font-light leading-relaxed text-slate-850min-h-80 outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-600"
            data-placeholder="Add a description..."
            @input="syncDescription"
          />
        </div>
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

<style scoped>
.editor :deep(h1) {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.3;
  margin: 0.5em 0 0.25em;
}
.editor :deep(h2) {
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.35;
  margin: 0.4em 0 0.2em;
}
.editor :deep(h3) {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.4;
  margin: 0.3em 0 0.15em;
}
.editor :deep(p) {
  font-size: 0.9375rem;
  line-height: 1.6;
  margin: 0.25em 0;
}

@media (max-width: 640px) {
  .editor :deep(h1) {
    font-size: 1.125rem;
  }
  .editor :deep(h2) {
    font-size: 1rem;
  }
  .editor :deep(h3) {
    font-size: 0.9375rem;
  }
  .editor :deep(p) {
    font-size: 0.875rem;
  }
}
</style>
