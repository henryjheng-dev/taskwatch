<script setup lang="ts">
import type { Task } from '../../types'
import TaskCard from './TaskCard.vue'

const props = defineProps<{
  task: Task
}>()

const emit = defineEmits<{
  click: [taskId: number]
  dragStart: [taskId: number, event: DragEvent]
  dragEnd: []
}>()

function onDragStart(e: DragEvent) {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(props.task.id))
  }
  emit('dragStart', props.task.id, e)
}

function onDragEnd() {
  emit('dragEnd')
}
</script>

<template>
  <div
    draggable="true"
    :data-task-id="props.task.id"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <TaskCard :task="task" @click="emit('click', $event)" />
  </div>
</template>
