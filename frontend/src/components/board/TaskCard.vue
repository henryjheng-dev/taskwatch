<script setup lang="ts">
import type { Task } from '../../types'
import { computed } from 'vue'

const props = defineProps<{
  task: Task
}>()

const emit = defineEmits<{
  click: [taskId: number]
}>()

const plainDescription = computed(() => {
  if (!props.task.description) return ''
  return props.task.description.replace(/<[^>]*>/g, '').trim()
})
</script>

<template>
  <div
    class="bg-white rounded-sm shadow-card px-3 py-3 min-h-28 cursor-pointer transition-shadow duration-150 hover:shadow-popover focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
    tabindex="0"
    @click="emit('click', task.id)"
    @keydown.enter="emit('click', task.id)"
  >
    <p class="text-sm text-gray-1000 leading-5 line-clamp-2">
      {{ task.title }}
    </p>
    <p
      v-if="plainDescription"
      class="mt-1 text-sm text-gray-700 leading-5 line-clamp-2"
    >
      {{ plainDescription }}
    </p>
    <div class="mt-1 flex items-center justify-between gap-2">
      <p v-if="task.dueDate" class="text-[13px] text-gray-700 leading-4 truncate">
        Due {{ new Date(task.dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) }}
      </p>
      <span
        v-if="task.priority"
        class="shrink-0 w-2.5 h-2.5 rounded-full"
        :class="{
          'bg-orange-400': task.priority === 'LOW',
          'bg-green-600': task.priority === 'MEDIUM',
          'bg-red-800': task.priority === 'HIGH',
        }"
      />
    </div>
  </div>
</template>
