<script setup lang="ts">
import type { Task } from '../../types'

defineProps<{
  task: Task
}>()

const emit = defineEmits<{
  click: [taskId: number]
}>()
</script>

<template>
  <div
    class="bg-white rounded-sm shadow-card px-3 py-3 cursor-pointer transition-shadow duration-150 hover:shadow-popover focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
    tabindex="0"
    @click="emit('click', task.id)"
    @keydown.enter="emit('click', task.id)"
  >
    <p class="text-sm text-gray-1000 leading-5 line-clamp-2">
      {{ task.title }}
    </p>
    <p v-if="task.dueDate" class="mt-1 text-[13px] text-gray-700 leading-4">
      Due {{ new Date(task.dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) }}
    </p>
  </div>
</template>
