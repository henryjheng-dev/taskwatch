<script setup lang="ts">
import { ref } from 'vue'
import type { Column } from '../../types'
import TaskCardDraggable from './TaskCardDraggable.vue'

const props = defineProps<{
  column: Column
  boardId: number
}>()

const emit = defineEmits<{
  addTask: [columnId: number]
  selectTask: [taskId: number]
  dropTask: [taskId: number, targetColumnId: number, position: number]
}>()

const dragOver = ref(false)
const columnRef = ref<HTMLElement | null>(null)

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dragOver.value = true
}

function onDragLeave(e: DragEvent) {
  const target = e.relatedTarget as Node | null
  if (columnRef.value && target && columnRef.value.contains(target)) return
  dragOver.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false

  const taskId = e.dataTransfer?.getData('text/plain')
  if (!taskId) return

  const el = columnRef.value
  if (!el) return

  const taskEls = el.querySelectorAll('[data-task-id]')
  const mouseY = e.clientY
  let insertIdx = props.column.tasks.length

  for (let i = 0; i < taskEls.length; i++) {
    const rect = taskEls[i].getBoundingClientRect()
    if (mouseY < rect.top + rect.height / 2) {
      insertIdx = i
      break
    }
  }

  emit('dropTask', Number(taskId), props.column.id, insertIdx)
}
</script>

<template>
  <div
    ref="columnRef"
    class="flex-shrink-0 w-[220px] xl:w-[230px] transition-colors duration-150"
    :class="dragOver ? 'bg-blue-100/50 rounded-sm' : ''"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="flex items-center gap-2 mb-3">
      <h3 class="text-sm font-medium text-gray-900 leading-5">{{ column.name }}</h3>
      <span
        class="inline-flex items-center px-[6px] py-[2px] text-xs font-light leading-relaxed text-gray-700 bg-gray-100 rounded-sm"
      >
        {{ column.tasks.length }}
      </span>
    </div>

    <div class="flex flex-col gap-2 min-h-[8px]">
      <TaskCardDraggable
        v-for="task in column.tasks"
        :key="task.id"
        :task="task"
        @click="emit('selectTask', $event)"
      />
    </div>

    <button
      class="mt-3 flex items-center gap-[6px] h-8 px-2 text-sm font-medium text-gray-900 rounded-sm hover:bg-black/5 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      @click="emit('addTask', column.id)"
    >
      <svg class="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <span>Add task</span>
    </button>
  </div>
</template>
