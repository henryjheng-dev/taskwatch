<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '../common/BaseModal.vue'
import BaseInput from '../common/BaseInput.vue'
import BaseButton from '../common/BaseButton.vue'
import type { Priority } from '../../types'

const props = defineProps<{
  show: boolean
  boardId: number
  columnId: number
}>()

const emit = defineEmits<{
  close: []
  created: []
}>()

const title = ref('')
const description = ref('')
const priority = ref<Priority>('MEDIUM')
const dueDate = ref('')
const loading = ref(false)
const error = ref('')

function reset() {
  title.value = ''
  description.value = ''
  priority.value = 'MEDIUM'
  dueDate.value = ''
  loading.value = false
  error.value = ''
}

async function handleCreate() {
  if (!title.value.trim()) {
    error.value = 'Task title is required'
    return
  }

  loading.value = true
  error.value = ''
  try {
    const { useBoardStore } = await import('../../stores/board')
    const boardStore = useBoardStore()

    await boardStore.createTask(props.boardId, props.columnId, {
      title: title.value.trim(),
      description: description.value || undefined,
      priority: priority.value,
      dueDate: dueDate.value || undefined,
    })
    emit('created')
    reset()
  } catch (err: any) {
    const msg = err.response?.data?.message
    error.value = Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to create task'
  } finally {
    loading.value = false
  }
}

function handleClose() {
  reset()
  emit('close')
}
</script>

<template>
  <BaseModal :show="show" title="Create Task" max-width="max-w-md" @close="handleClose">
    <div class="space-y-4">
      <BaseInput
        v-model="title"
        label="Title"
        placeholder="What needs to be done?"
        :error="error"
      />

      <div class="space-y-1">
        <label class="block text-sm font-medium text-gray-1000">Description</label>
        <textarea
          v-model="description"
          placeholder="Add a description..."
          rows="3"
          class="block w-full px-3 py-2 bg-white text-gray-1000 text-sm rounded-sm border border-black/8 transition-colors placeholder:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white resize-none"
        />
      </div>

      <div class="flex gap-4">
        <div class="flex-1 space-y-1">
          <label class="block text-sm font-medium text-gray-1000">Priority</label>
          <select
            v-model="priority"
            class="block w-full h-10 px-3 bg-white text-gray-1000 text-sm rounded-sm border border-black/8 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
            class="block w-full h-10 px-3 bg-white text-gray-1000 text-sm rounded-sm border border-black/8 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          />
        </div>
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <BaseButton variant="tertiary" @click="handleClose">Cancel</BaseButton>
        <BaseButton variant="primary" :loading="loading" @click="handleCreate">Create</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
