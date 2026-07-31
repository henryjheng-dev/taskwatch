<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Task, Priority } from '../../types';
import { useBoardStore } from '../../stores/board';
import { useToastStore } from '../../stores/toast';
import BaseModal from '../common/BaseModal.vue';
import BaseButton from '../common/BaseButton.vue';
import ConfirmDialog from '../common/ConfirmDialog.vue';

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const props = defineProps<{
  show: boolean;
  task: Task | null;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  updated: [];
  deleted: [taskId: number];
}>();

const labelClass = 'block text-base font-medium text-gray-1000';

const inputBaseClass =
  'block w-full h-10 px-3 bg-white text-gray-1000 text-sm rounded-sm border border-black/8 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

const readonlyDisplayClass = 'w-full min-h-10 py-2 text-sm leading-relaxed text-gray-900';

const dividerClass = 'h-px bg-black/8 border-0';

const title = ref('');
const description = ref('');
const priority = ref<Priority>('MEDIUM');
const dueDate = ref('');
const saving = ref(false);
const deleting = ref(false);
const error = ref('');
const editing = ref(false);
const showDiscardConfirm = ref(false);
const showDeleteConfirm = ref(false);

const original = ref<{ title: string; description: string; priority: Priority; dueDate: string } | null>(null);

function isDirty(): boolean {
  if (!original.value) return false;
  return title.value !== original.value.title
    || description.value !== original.value.description
    || priority.value !== original.value.priority
    || dueDate.value !== original.value.dueDate;
}

function saveOriginal() {
  original.value = {
    title: title.value,
    description: description.value,
    priority: priority.value,
    dueDate: dueDate.value,
  };
}

function handleCloseAttempt() {
  if (isDirty()) {
    showDiscardConfirm.value = true;
  } else {
    emit('close');
  }
}

function confirmDiscard() {
  showDiscardConfirm.value = false;
  emit('close');
}

watch(
  () => props.task,
  (task) => {
    if (task) {
      title.value = task.title;
      description.value = (task.description || '').replace(/<[^>]*>/g, '');
      priority.value = task.priority;
      dueDate.value = task.dueDate ? task.dueDate.split('T')[0] : today();
      error.value = '';
      editing.value = false;
      showDiscardConfirm.value = false;
      saveOriginal();
    }
  },
);

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
      description: (description.value || '').replace(/<[^>]*>/g, '') || null,
      priority: priority.value,
      dueDate: dueDate.value || null,
    });
    saveOriginal();
    emit('updated');
  } catch (err: any) {
    const msg = err.response?.data?.message;
    error.value = Array.isArray(msg) ? msg.join(', ') : msg || '更新失敗';
  } finally {
    saving.value = false;
  }
}

function handleDelete() {
  showDeleteConfirm.value = true;
}

async function confirmDelete() {
  if (!props.task) return;
  showDeleteConfirm.value = false;
  const taskId = props.task.id;
  emit('deleted', taskId);
  try {
    const boardStore = useBoardStore();
    await boardStore.deleteTask(taskId);
  } catch {
    useToastStore().error('刪除失敗');
  }
}
</script>

<template>
  <BaseModal :show="show" title="Task" max-width="max-w-md" :hide-close="editing" @close="handleCloseAttempt">
    <div v-if="task" class="space-y-4">
      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <label :class="labelClass">Title</label>
          <button
            v-if="!readonly"
            type="button"
            class="text-xs text-blue-700 hover:text-blue-800 font-medium transition-colors"
            @click="editing = !editing"
          >
            {{ editing ? 'Done' : 'Edit' }}
          </button>
        </div>
        <div v-if="!editing" :class="readonlyDisplayClass">
          {{ title }}
        </div>
        <input
          v-else
          :value="title"
          :class="[inputBaseClass, error ? 'border-red-400 focus-visible:ring-red-700' : '']"
          @input="title = ($event.target as HTMLInputElement).value"
        />
        <p v-if="error" class="text-xs font-light leading-relaxed text-red-800">{{ error }}</p>
      </div>
      <hr v-if="!editing" :class="dividerClass" />

      <div class="space-y-1">
        <label :class="labelClass">Description</label>
        <div
          v-if="!editing"
          class="editor py-2 text-sm font-md leading-relaxed text-gray-900 min-h-48 cursor-default"
        >
          <div v-if="description" class="text-sm leading-relaxed whitespace-pre-wrap">{{ description }}</div>
          <span v-else class="text-sm font-light leading-relaxed text-slate-500"
            >No description</span
          >
        </div>
        <textarea
          v-else
          v-model="description"
          class="block w-full min-h-48 px-3 py-2 bg-white text-gray-1000 text-sm rounded-sm border border-black/8 transition-colors duration-150 placeholder:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white resize-vertical"
        />
      </div>
      <hr v-if="!editing" :class="dividerClass" />

      <div class="flex gap-4">
        <div class="flex-1 space-y-1">
          <label :class="labelClass">Priority</label>
          <div v-if="!editing" :class="readonlyDisplayClass">
            {{ priority.toLowerCase() }}
          </div>
          <select v-else v-model="priority" :class="inputBaseClass">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>
        <div class="flex-1 space-y-1">
          <label :class="labelClass">Due date</label>
          <div v-if="!editing" :class="[readonlyDisplayClass, { 'text-gray-600': !dueDate }]">
            {{ dueDate || 'Not set' }}
          </div>
          <input v-else v-model="dueDate" type="date" :class="inputBaseClass" />
        </div>
      </div>
      <hr v-if="!editing" :class="dividerClass" />

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

      <div v-if="!readonly && !editing" class="flex justify-between pt-2">
        <BaseButton variant="error" size="sm" :loading="deleting" @click="handleDelete">
          Delete
        </BaseButton>
        <div class="flex gap-3">
          <BaseButton variant="tertiary" @click="handleCloseAttempt">Cancel</BaseButton>
          <BaseButton variant="primary" :loading="saving" @click="handleSave">Save</BaseButton>
        </div>
      </div>
    </div>
  </BaseModal>
  <ConfirmDialog
    :show="showDiscardConfirm"
    title="未儲存變更"
    message="有未儲存變更，確定關閉？"
    confirm-text="關閉"
    cancel-text="繼續編輯"
    @confirm="confirmDiscard"
    @cancel="showDiscardConfirm = false"
  />
  <ConfirmDialog
    :show="showDeleteConfirm"
    title="刪除任務"
    message="確定要刪除這個任務？"
    confirm-text="刪除"
    cancel-text="取消"
    @confirm="confirmDelete"
    @cancel="showDeleteConfirm = false"
  />
</template>


