<script setup lang="ts">
import type { Column } from '../../types'
import TaskCard from './TaskCard.vue'

defineProps<{
  column: Column
  boardId: number
}>()

const emit = defineEmits<{
  addTask: [columnId: number]
  selectTask: [taskId: number]
}>()
</script>

<template>
  <div class="flex-shrink-0 w-[220px] xl:w-[230px]">
    <div class="flex items-center gap-2 mb-3">
      <h3 class="text-sm font-normal text-gray-900 leading-5">{{ column.name }}</h3>
      <span
        class="inline-flex items-center px-[6px] py-[2px] text-xs font-normal text-gray-900 bg-gray-100 rounded-sm leading-4"
      >
        {{ column.tasks.length }}
      </span>
    </div>

    <div class="flex flex-col gap-2">
      <TaskCard
        v-for="task in column.tasks"
        :key="task.id"
        :task="task"
        @click="emit('selectTask', $event)"
      />
    </div>

    <button
      class="mt-3 flex items-center gap-[6px] h-8 px-2 text-sm font-normal text-gray-900 rounded-sm hover:bg-black/5 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      @click="emit('addTask', column.id)"
    >
      <svg class="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <span>Add task</span>
    </button>
  </div>
</template>
