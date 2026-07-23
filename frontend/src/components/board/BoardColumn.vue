<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Column, Task, Board } from '../../types';
import { useBoardStore } from '../../stores/board';
import { useToastStore } from '../../stores/toast';
import TaskCard from '../task/TaskCard.vue';
import { Plus, Ellipsis, Trash2 } from '@lucide/vue';
import InlineEdit from '../common/InlineEdit.vue';
import BaseDropdown from '../common/BaseDropdown.vue';
import ConfirmDialog from '../common/ConfirmDialog.vue';
import { VueDraggable, type DraggableEvent } from 'vue-draggable-plus';
import { tasksApi } from '../../api';

const props = defineProps<{
  column: Column;
  boardId: number;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  addTask: [columnId: number];
  selectTask: [taskId: number];
  updateColumn: [columnId: number, name: string];
  deleteColumn: [columnId: number];
}>();

const boardStore = useBoardStore();
const toast = useToastStore();
const showDeleteConfirm = ref(false);

function handleDeleteColumn() {
  showDeleteConfirm.value = false;
  emit('deleteColumn', props.column.id);
}

const columnTasks = computed({
  get: () => props.column.tasks,
  set: (val) => {
    const col = boardStore.board?.columns.find((c) => c.id === props.column.id);
    if (col) col.tasks = val;
  },
});

let snapshot: Board | null = null;

function onTaskSortStart() {
  snapshot = boardStore.takeSnapshot();
}

// 拖曳結束時，使用 newDraggableIndex 而非 newIndex。
// newIndex 包含 VueDraggable 內所有 DOM 子元素，而 newDraggableIndex
// 只計算符合 draggable 選擇器的卡片元素，排除其他元素（如 task-ghost）。
async function onTaskSortEnd(evt: DraggableEvent<Task>) {
  if (evt.newDraggableIndex == null) return;
  const targetColumnId = Number(evt.to.dataset.columnId);
  if (!targetColumnId) return;

  const task = evt.data;
  const position = evt.newDraggableIndex;
  task.columnId = targetColumnId;
  task.position = position;

  try {
    await tasksApi.move(task.id, { targetColumnId, position });
  } catch {
    boardStore.restoreSnapshot(snapshot);
    toast.error('移動卡片失敗');
  }
}

</script>

<template>
  <div class="shrink-0 w-55 xl:w-57.5 bg-gray-100 rounded-sm p-3 flex flex-col">
    <div class="flex items-center gap-2 mb-3 column-header">
      <InlineEdit
        v-if="!readonly"
        :model-value="column.name"
        edit-class="min-w-0 max-w-32 h-7 px-1.5 py-0 text-sm font-medium text-gray-900 leading-7 bg-white border border-gray-300 rounded outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent box-border"
        @update:model-value="emit('updateColumn', column.id, $event)"
      >
        <h3
          class="h-7 px-1.5 text-sm font-medium text-gray-900 leading-7 flex items-center transition-colors select-none hover:bg-gray-100"
        >
          {{ column.name }}
        </h3>
      </InlineEdit>
      <h3
        v-else
        class="h-7 px-1.5 text-sm font-medium text-gray-900 leading-7 flex items-center"
      >
        {{ column.name }}
      </h3>
      <span
        class="inline-flex items-center px-1.5 py-0.5 text-xs font-light leading-relaxed text-gray-700 bg-gray-100 rounded-sm"
      >
        {{ column.tasks.length }}
      </span>
      <template v-if="!readonly">
        <button
          class="ml-auto flex items-center justify-center w-6 h-6 text-gray-600 hover:text-gray-900 hover:bg-black/5 rounded-sm transition-colors"
          @click="emit('addTask', column.id)"
        >
          <Plus class="w-3.5 h-3.5" :stroke-width="1.5" />
        </button>
        <BaseDropdown>
          <template #trigger="{ toggle, isOpen }">
            <button
              class="flex items-center justify-center w-6 h-6 text-gray-600 hover:text-gray-900 hover:bg-black/5 rounded-sm transition-colors"
              :class="{ 'bg-black/5': isOpen }"
              @click="toggle"
            >
              <Ellipsis class="w-3.5 h-3.5" :stroke-width="1.5" />
            </button>
          </template>
          <template #dropdown="{ close }">
          <button
            class="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-gray-100 whitespace-nowrap"
            @click="close(); showDeleteConfirm = true"
          >
            <Trash2 class="w-4 h-4" :stroke-width="1.5" />
            刪除
          </button>
          </template>
        </BaseDropdown>
      </template>
    </div>

    <template v-if="!readonly">
      <ConfirmDialog
        :show="showDeleteConfirm"
        @confirm="handleDeleteColumn"
        @cancel="showDeleteConfirm = false"
      />
    </template>

    <!--
      draggable="[data-task-id]": 只認卡片為可拖曳元素，排除 task-ghost 等非卡片元素。
      :data-task-id 不是 TaskCard 的 prop，Vue 會 fallthrough 到 root div，
      讓 SortableJS 能識別此元素為可拖曳項目，且不多產生 DOM 層級。
    -->
    <VueDraggable
      v-model="columnTasks"
      group="tasks"
      :animation="250"
      :disabled="readonly"
      ghost-class="task-ghost"
      :data-column-id="column.id"
      draggable="[data-task-id]"
      @start="onTaskSortStart"
      @end="onTaskSortEnd"
      class="flex-1 flex flex-col gap-2"
    >
      <TaskCard
        v-for="task in column.tasks"
        :key="task.id"
        :task="task"
        :data-task-id="task.id"
        @click="emit('selectTask', task.id)"
      />
    </VueDraggable>
  </div>
</template>

<style>
.task-ghost {
  background-color: rgba(201, 201, 201, 0.8);
  border-radius: 0.125rem;
}
.task-ghost > * {
  visibility: hidden;
}
</style>
