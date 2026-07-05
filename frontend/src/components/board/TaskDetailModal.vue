<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Task, Priority } from '../../types'
import { useBoardStore } from '../../stores/board'
import BaseModal from '../common/BaseModal.vue'
import BaseInput from '../common/BaseInput.vue'
import BaseButton from '../common/BaseButton.vue'

const props = defineProps<{
  show: boolean
  task: Task | null
}>()

const emit = defineEmits<{
  close: []
  updated: []
  deleted: [taskId: number]
}>()

const title = ref('')
const description = ref('')
const priority = ref<Priority>('MEDIUM')
const dueDate = ref('')
const saving = ref(false)
const deleting = ref(false)
const error = ref('')

watch(() => props.task, (task) => {
  if (task) {
    title.value = task.title
    description.value = task.description || ''
    priority.value = task.priority
    dueDate.value = task.dueDate ? task.dueDate.split('T')[0] : ''
    error.value = ''
  }
})

async function handleSave() {
  if (!title.value.trim()) {
    error.value = 'Title is required'
    return
  }
  if (!props.task) return

  saving.value = true
  error.value = ''
  try {
    const boardStore = useBoardStore()
    await boardStore.updateTask(props.task.id, {
      title: title.value.trim(),
      description: description.value || null,
      priority: priority.value,
      dueDate: dueDate.value || null,
    })
    emit('updated')
  } catch (err: any) {
    const msg = err.response?.data?.message
    error.value = Array.isArray(msg) ? msg.join(', ') : msg || '更新失敗'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!props.task || !confirm('刪除這個任務？')) return
  deleting.value = true
  try {
    const boardStore = useBoardStore()
    await boardStore.deleteTask(props.task.id)
    emit('deleted', props.task.id)
  } catch {
    error.value = '刪除失敗'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <BaseModal :show="show" title="Task" max-width="max-w-md" @close="emit('close')">
    <div v-if="task" class="space-y-4">
      <BaseInput v-model="title" label="Title" :error="error" />

      <div class="space-y-1">
        <label class="block text-sm font-medium text-gray-1000">Description</label>
        <textarea
          v-model="description"
          rows="3"
          class="block w-full px-3 py-2 bg-white text-gray-1000 text-sm rounded-sm border border-black/8 transition-colors placeholder:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white resize-none"
        />
      </div>

      <div class="flex gap-4">
        <div class="flex-1 space-y-1">
          <label class="block text-sm font-medium text-gray-1000">Priority</label>
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
          <label class="block text-sm font-medium text-gray-1000">Due date</label>
          <input
            v-model="dueDate"
            type="date"
            class="block w-full h-10 px-3 bg-white text-gray-1000 text-sm rounded-sm border border-black/8 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          />
        </div>
      </div>

      <div v-if="task.createdAt" class="text-xs text-gray-700">
        Created {{ new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
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
