<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBoardStore } from '../stores/board';
import { useToastStore } from '../stores/toast';
import BoardColumn from '../components/board/BoardColumn.vue';
import TaskCreateForm from '../components/board/TaskCreateForm.vue';
import TaskDetailModal from '../components/board/TaskDetailModal.vue';
import UserMenu from '../components/common/UserMenu.vue';
import { useDragAndDrop } from '../composables/useDragAndDrop';

const route = useRoute();
const router = useRouter();
const boardStore = useBoardStore();
const toast = useToastStore();

const boardId = computed(() => Number(route.params.id));
const showCreateModal = ref(false);
const creatingColumnId = ref(0);
const newColumnName = ref('');
const addingColumn = ref(false);
const selectedTaskId = ref<number | null>(null);

const selectedTask = computed(() => {
  if (selectedTaskId.value === null) return null;
  for (const col of boardStore.board?.columns ?? []) {
    const found = col.tasks.find((t) => t.id === selectedTaskId.value);
    if (found) return found;
  }
  return null;
});

function handleSelectTask(taskId: number) {
  selectedTaskId.value = taskId;
}

function handleCloseTaskDetail() {
  selectedTaskId.value = null;
}

onMounted(async () => {
  // 清空上一張看板的殘留資料，避免畫面閃爍
  boardStore.$reset();
  try {
    await boardStore.fetchBoard(boardId.value);
  } catch {
    router.push('/boards');
  }
});

// 離開頁面時主動清除看板資料，不佔用記憶體
onUnmounted(() => {
  boardStore.$reset();
});

const { onDrop } = useDragAndDrop();

function handleAddTask(columnId: number) {
  creatingColumnId.value = columnId;
  showCreateModal.value = true;
}

function handleDropTask(taskId: number, targetColumnId: number, position: number) {
  onDrop(taskId, { targetColumnId, position });
}

async function handleAddColumn() {
  const name = newColumnName.value.trim();
  if (!name) return;
  addingColumn.value = true;
  try {
    await boardStore.createColumn(boardId.value, name);
    newColumnName.value = '';
  } catch {
    toast.error('建立欄位失敗');
  } finally {
    addingColumn.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-bg-200 flex flex-col">
    <!-- 載入中 → 顯示骨架 -->
    <div v-if="boardStore.loading" class="animate-pulse px-6">
        <div class="h-14" />
        <div class="h-16 flex items-center">
          <div class="h-8 w-48 bg-black/5 rounded-sm" />
        </div>
        <div class="flex gap-6 pt-3 overflow-x-auto">
          <div v-for="i in 3" :key="i" class="w-74 shrink-0">
            <div class="h-6 w-24 bg-black/5 rounded-sm mb-4" />
            <div class="space-y-3">
              <div v-for="j in 4" :key="j" class="h-24 bg-black/5 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
      <!-- 載入完成 → 顯示看板內容 -->
      <div v-else-if="boardStore.board" class="flex flex-col flex-1">
        <!-- Top Navigation Bar -->
        <header
      class="h-14 bg-white border-b border-black/8 flex items-center justify-between px-6 shrink-0"
    >
      <div class="flex items-center gap-2">
        <button
          class="w-8 h-8 flex items-center justify-center rounded-sm text-gray-900 hover:bg-black/5 transition-colors focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              fill="none"
            />
          </svg>
        </button>

        <nav class="flex items-center gap-2 text-sm font-medium leading-5">
          <svg class="w-4 h-4 text-gray-700" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 3.5A1.5 1.5 0 013.5 2h3.88a1.5 1.5 0 011.06.44l3.12 3.12a1.5 1.5 0 01.44 1.06V12.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 12.5v-9z"
              stroke="currentColor"
              stroke-width="1.2"
              fill="none"
            />
          </svg>
          <span class="text-gray-900">My new project</span>
        </nav>

        <span
          class="inline-flex items-center px-2 py-0.5 text-[13px] font-light leading-relaxed text-white bg-gray-1000 rounded-full"
        >
          Board
        </span>
      </div>

      <div class="flex items-center gap-3">
        <button
          class="w-8 h-8 flex items-center justify-center rounded-sm text-gray-900 hover:bg-black/5 transition-colors focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          <svg class="w-5 h-5" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="4.5" stroke="currentColor" stroke-width="1.5" />
            <path
              d="M12.5 12.5L17 17"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>

        <UserMenu />
      </div>
    </header>

    <!-- Page Title & Toolbar -->
    <div class="flex items-center justify-between px-6 h-16 shrink-0">
      <h1
        class="text-2xl font-bold tracking-tight text-gray-1000 leading-8"
        style="letter-spacing: -0.96px"
      >
        {{ boardStore.board?.name || 'New Document' }}
      </h1>
    </div>

    <!-- Board Columns -->
    <main class="flex-1 flex gap-6 px-6 pt-3 pb-6 overflow-x-auto">
      <BoardColumn
        v-for="col in boardStore.board?.columns"
        :key="col.id"
        :column="col"
        :board-id="boardId"
        @add-task="handleAddTask"
        @select-task="handleSelectTask"
        @drop-task="handleDropTask"
      />

      <div class="shrink-0 w-55 xl:w-57.5">
        <div class="flex items-center gap-2">
          <input
            v-model="newColumnName"
            placeholder="+ Add column"
            class="w-full h-8 px-2 bg-transparent text-sm text-gray-900 rounded-sm border border-dashed border-black/8 placeholder:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-200"
            @keydown.enter="handleAddColumn"
            @keydown.escape="newColumnName = ''"
          />
          <button
            v-if="newColumnName.trim()"
            :disabled="addingColumn"
            class="shrink-0 h-8 px-2 text-sm font-medium text-white bg-gray-1000 rounded-sm hover:bg-gray-900 disabled:opacity-50 transition-colors"
            @click="handleAddColumn"
          >
            Add
          </button>
        </div>
      </div>
    </main>

    <TaskCreateForm
      :show="showCreateModal"
      :board-id="boardId"
      :column-id="creatingColumnId"
      @close="showCreateModal = false"
      @created="showCreateModal = false"
    />

    <TaskDetailModal
      :show="selectedTaskId !== null"
      :task="selectedTask"
      @close="handleCloseTaskDetail"
      @updated="handleCloseTaskDetail"
      @deleted="handleCloseTaskDetail"
    />
    </div>
  </div>
</template>
