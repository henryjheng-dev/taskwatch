<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBoardStore } from '../stores/board';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import { boardsApi } from '../api';
import InlineEdit from '../components/common/InlineEdit.vue';
import BoardColumn from '../components/board/BoardColumn.vue';
import TaskCreateForm from '../components/task/TaskCreateForm.vue';
import TaskDetailModal from '../components/task/TaskDetailModal.vue';
import AppHeader from '../components/common/AppHeader.vue';
import SearchBoardDropdown from '../components/common/SearchBoardDropdown.vue';
import BaseDropdown from '../components/common/BaseDropdown.vue';
import ConfirmDialog from '../components/common/ConfirmDialog.vue';
import { Ellipsis, Trash2, Archive } from '@lucide/vue';
import { VueDraggable } from 'vue-draggable-plus';

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
const showArchiveConfirm = ref(false);
const showDeleteBoardConfirm = ref(false);

const authStore = useAuthStore();

const isOwner = computed(() => boardStore.board?.ownerId === authStore.user?.id);
const isArchived = computed(() => !!boardStore.board?.archivedAt);

const columns = computed({
  get: () => boardStore.board?.columns ?? [],
  set: (val) => {
    if (boardStore.board) boardStore.board.columns = val;
  },
});

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
  // 初次進入看板時，清空殘留資料並載入看板
  boardStore.$reset();
  try {
    await boardStore.fetchBoard(boardId.value);
  } catch {
    router.push('/boards');
  }
});

// 監聽路由 id 變化，處理「從一個看板切換到另一個看板」的情況
// Vue 會複用同一個元件（/boards/:id），onMounted 不會再次執行
// 所以需要用 watch 在 id 改變時重新 fetch
watch(boardId, async (newId) => {
  boardStore.$reset();
  try {
    await boardStore.fetchBoard(newId);
  } catch {
    router.push('/boards');
  }
});

// 離開頁面時主動清除看板資料，不佔用記憶體
onUnmounted(() => {
  boardStore.$reset();
});

function handleAddTask(columnId: number) {
  creatingColumnId.value = columnId;
  showCreateModal.value = true;
}

async function handleArchive() {
  showArchiveConfirm.value = false;
  try {
    await boardStore.archiveBoard(boardId.value);
  } catch {
    toast.error('封存看板失敗');
  }
}

async function handleDeleteBoard() {
  showDeleteBoardConfirm.value = false;
  try {
    await boardsApi.delete(boardId.value);
    router.push('/boards');
  } catch {
    toast.error('刪除看板失敗');
  }
}

async function onColumnSortEnd() {
  const ids = boardStore.board!.columns.map((c) => c.id);
  try {
    await boardStore.reorderColumns(boardId.value, ids);
  } catch {
    await boardStore.fetchBoard(boardId.value);
    toast.error('重新排序欄位失敗');
  }
}

async function handleUpdateBoardName(name: string) {
  try {
    await boardsApi.update(boardId.value, { name });
    boardStore.updateBoardLocally(name);
  } catch {
    toast.error('更新看板名稱失敗');
  }
}

async function handleDeleteColumn(columnId: number) {
  try {
    await boardStore.deleteColumn(boardId.value, columnId);
  } catch {
    toast.error('刪除欄位失敗');
  }
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
      <AppHeader>
        <SearchBoardDropdown />
      </AppHeader>

      <!-- Page Title & Toolbar -->
      <div class="flex items-center justify-between px-6 h-16 shrink-0">
        <InlineEdit
          v-if="!isArchived"
          :model-value="boardStore.board?.name || ''"
          edit-class="text-2xl font-bold tracking-tight h-10 px-2 bg-white border border-gray-300 rounded outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent box-border"
          @update:model-value="handleUpdateBoardName"
        >
          <h1
            class="text-2xl font-bold tracking-tight text-gray-1000 leading-8"
            style="letter-spacing: -0.96px"
          >
            {{ boardStore.board?.name || 'New Document' }}
          </h1>
        </InlineEdit>
        <h1
          v-else
          class="text-2xl font-bold tracking-tight text-gray-1000 leading-8"
          style="letter-spacing: -0.96px"
        >
          {{ boardStore.board?.name || 'New Document' }}
        </h1>

        <div class="flex items-center gap-1">
          <BaseDropdown v-if="!isArchived">
            <template #trigger="{ toggle, isOpen }">
              <button
                class="flex items-center justify-center w-8 h-8 text-gray-600 hover:text-gray-900 hover:bg-black/5 rounded-sm transition-colors"
                :class="{ 'bg-black/5': isOpen }"
                @click="toggle"
              >
                <Ellipsis class="w-4 h-4" :stroke-width="1.5" />
              </button>
            </template>
            <template #dropdown="{ close }">
              <button
                class="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                @click="close(); showArchiveConfirm = true"
              >
                <Archive class="w-4 h-4" :stroke-width="1.5" />
                封存
              </button>
              <button
                v-if="isOwner"
                class="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-gray-100 whitespace-nowrap"
                @click="close(); showDeleteBoardConfirm = true"
              >
                <Trash2 class="w-4 h-4" :stroke-width="1.5" />
                刪除
              </button>
            </template>
          </BaseDropdown>
        </div>
      </div>

      <!-- Board Columns -->
      <main class="flex-1 flex px-6 pt-3 pb-6 overflow-x-auto">
        <VueDraggable
          v-model="columns"
          group="columns"
          :animation="250"
          :disabled="isArchived"
          handle=".column-header"
          direction="horizontal"
          ghost-class="column-ghost"
          class="flex gap-6"
          @end="onColumnSortEnd"
        >
          <BoardColumn
            v-for="col in columns"
            :key="col.id"
            :column="col"
            :board-id="boardId"
            :readonly="isArchived"
            @add-task="handleAddTask"
            @select-task="handleSelectTask"
            @update-column="(id, name) => !isArchived && boardStore.updateColumn(boardId, id, name)"
            @delete-column="handleDeleteColumn"
          />
        </VueDraggable>

        <div v-if="!isArchived" class="shrink-0 w-55 xl:w-57.5 ml-6">
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

      <ConfirmDialog
        :show="showArchiveConfirm"
        title="封存看板"
        message="確定要封存此看板嗎？封存後看板僅供檢視。"
        confirm-text="封存"
        @confirm="handleArchive"
        @cancel="showArchiveConfirm = false"
      />
      <ConfirmDialog
        :show="showDeleteBoardConfirm"
        title="刪除看板"
        message="確定要永久刪除此看板嗎？此操作無法復原。"
        confirm-text="刪除"
        @confirm="handleDeleteBoard"
        @cancel="showDeleteBoardConfirm = false"
      />
      <TaskDetailModal
        :show="selectedTaskId !== null"
        :task="selectedTask"
        :readonly="isArchived"
        @close="handleCloseTaskDetail"
        @updated="handleCloseTaskDetail"
        @deleted="handleCloseTaskDetail"
      />
    </div>
  </div>
</template>

<style scoped>
</style>

<style>
.column-ghost {
  background: rgba(201, 201, 201, 0.8) !important;
  border-radius: 0.125rem;
}
.column-ghost > * {
  visibility: hidden !important;
}
</style>
