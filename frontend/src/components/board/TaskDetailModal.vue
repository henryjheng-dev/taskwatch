<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Task, Priority } from '../../types';
import { useBoardStore } from '../../stores/board';
import BaseModal from '../common/BaseModal.vue';
import BaseButton from '../common/BaseButton.vue';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const props = defineProps<{
  show: boolean;
  task: Task | null;
}>();

const emit = defineEmits<{
  close: [];
  updated: [];
  deleted: [taskId: number];
}>();

const title = ref('');
const description = ref('');
const priority = ref<Priority>('MEDIUM');
const dueDate = ref('');
const saving = ref(false);
const deleting = ref(false);
const error = ref('');
const editorRef = ref<HTMLDivElement | null>(null);
const editing = ref(false);

watch(
  () => props.task,
  (task) => {
    if (task) {
      title.value = task.title;
      description.value = task.description || '';
      priority.value = task.priority;
      dueDate.value = task.dueDate ? task.dueDate.split('T')[0] : today();
      error.value = '';
      editing.value = false;
    }
  },
);

watch(
  editing,
  (val) => {
    if (val && editorRef.value) {
      editorRef.value.innerHTML = description.value;
    }
  },
  { flush: 'post' },
);

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

async function handleSave() {
  if (!title.value.trim()) {
    error.value = 'Title is required';
    return;
  }
  if (!props.task) return;

  saving.value = true;
  error.value = '';
  try {
    const boardStore = useBoardStore();
    await boardStore.updateTask(props.task.id, {
      title: title.value.trim(),
      description: description.value || null,
      priority: priority.value,
      dueDate: dueDate.value || null,
    });
    emit('updated');
  } catch (err: any) {
    const msg = err.response?.data?.message;
    error.value = Array.isArray(msg) ? msg.join(', ') : msg || '更新失敗';
  } finally {
    saving.value = false;
  }
}

async function handleDelete() {
  if (!props.task || !confirm('刪除這個任務？')) return;
  deleting.value = true;
  try {
    const boardStore = useBoardStore();
    await boardStore.deleteTask(props.task.id);
    emit('deleted', props.task.id);
  } catch {
    error.value = '刪除失敗';
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <BaseModal :show="show" title="Task" max-width="max-w-md" @close="emit('close')">
    <div v-if="task" class="space-y-4">
      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <label class="block text-base font-medium text-gray-1000">Title</label>
          <button
            type="button"
            class="text-xs text-blue-700 hover:text-blue-800 font-medium transition-colors"
            @click="editing = !editing"
          >
            {{ editing ? 'Done' : 'Edit' }}
          </button>
        </div>
        <div v-if="!editing" class="w-full min-h-10 py-2 text-sm text-gray-900">
          {{ title }}
        </div>
        <input
          v-else
          :value="title"
          class="block w-full h-10 px-3 bg-white text-gray-1000 text-sm rounded-sm border border-black/8 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          :class="[error ? 'border-red-400 focus-visible:ring-red-700' : '']"
          @input="title = ($event.target as HTMLInputElement).value"
        />
        <p v-if="error" class="text-xs font-light leading-relaxed text-red-800">{{ error }}</p>
      </div>
      <hr v-if="!editing" class="h-px bg-black/8 border-0" />

      <div class="space-y-1">
        <label class="block text-base font-medium text-gray-1000">Description</label>
        <div
          class="overflow-hidden"
          :class="
            editing
              ? 'border border-black/8 rounded-sm focus-within:ring-2 focus-within:ring-gray-1000 focus-within:ring-offset-2 focus-within:ring-offset-white'
              : ''
          "
        >
          <div
            v-if="editing"
            class="flex items-center gap-0.5 px-2 py-1.5 border-b border-black/8 bg-gray-100"
          >
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
            v-if="!editing"
            class="editor py-2 text-sm font-md leading-relaxed text-gray-900 min-h-80 cursor-default"
          >
            <div v-if="description" v-html="description" />
            <span v-else class="text-sm font-light leading-relaxed text-slate-500"
              >No description</span
            >
          </div>
          <div
            v-else
            ref="editorRef"
            contenteditable="true"
            class="editor px-3 py-2 text-xs font-light leading-relaxed text-slate-850min-h-80 outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-600"
            data-placeholder="Add a description..."
            @input="syncDescription"
          />
        </div>
      </div>
      <hr v-if="!editing" class="h-px bg-black/8 border-0" />

      <div class="flex gap-4">
        <div class="flex-1 space-y-1">
          <label class="block text-base font-medium text-gray-1000">Priority</label>
          <div v-if="!editing" class="w-full min-h-10 py-2 text-sm leading-relaxed text-gray-900">
            {{ priority.toLowerCase() }}
          </div>
          <select
            v-else
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
          <div
            v-if="!editing"
            class="w-full min-h-10 py-2 text-sm leading-relaxed text-gray-900"
            :class="{ 'text-gray-600': !dueDate }"
          >
            {{ dueDate || 'Not set' }}
          </div>
          <input
            v-else
            v-model="dueDate"
            type="date"
            class="block w-full h-10 px-3 bg-white text-gray-1000 text-sm rounded-sm border border-black/8 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          />
        </div>
      </div>
      <hr v-if="!editing" class="h-px bg-black/8 border-0" />

      <div v-if="task.createdAt" class="text-xs font-light leading-relaxed text-slate-500">
        Created
        {{
          new Date(task.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        }}
      </div>

      <div class="flex justify-between pt-2">
        <BaseButton variant="error" size="sm" :loading="deleting" @click="handleDelete">
          Delete
        </BaseButton>
        <div class="flex gap-3">
          <BaseButton variant="tertiary" @click="emit('close')">Cancel</BaseButton>
          <BaseButton variant="primary" :loading="saving" @click="handleSave">Save</BaseButton>
        </div>
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
