<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { boardsApi } from '../api';
import { useBoardStore } from '../stores/board';
import { useToastStore } from '../stores/toast';
import type { BoardListItem } from '../types';
import BaseButton from '../components/common/BaseButton.vue';
import CreateBoardModal from '../components/board/CreateBoardModal.vue';
import AiGenerateButton from '../components/ai/AiGenerateButton.vue';
import AiGenerateModal from '../components/ai/AiGenerateModal.vue';
import AppHeader from '../components/common/AppHeader.vue';
import ConfirmDialog from '../components/common/ConfirmDialog.vue';
import { ChevronRight, ChevronDown } from '@lucide/vue';
import { useAiGenerate } from '../composables/useAiGenerate';

const router = useRouter();
const boardStore = useBoardStore();
const boards = ref<BoardListItem[]>([]);
const loading = ref(true);
const showCreateModal = ref(false);
const showAiModal = ref(false);
const generating = ref(false);
const showArchived = ref(false);
const showRestoreConfirm = ref(false);
const restoreTargetId = ref(0);

const toast = useToastStore();

const { usage, fetchUsage, generate } = useAiGenerate();

function handleBoardCreated(boardId: number) {
  showCreateModal.value = false
  router.push(`/boards/${boardId}`)
}

onMounted(async () => {
  try {
    const res = await boardsApi.list();
    boards.value = res.data;
  } catch (error) {
    console.error('抓取看板失敗:', error);
  } finally {
    loading.value = false;
  }
  boardStore.fetchArchivedBoards();
  fetchUsage();
});

async function handleRestoreBoard() {
  showRestoreConfirm.value = false;
  const boardId = restoreTargetId.value;
  if (!boardId) return;
  try {
    await boardsApi.restore(boardId);
    const idx = boardStore.archivedBoards.findIndex((b) => b.id === boardId);
    if (idx !== -1) boardStore.archivedBoards.splice(idx, 1);
    const res = await boardsApi.list();
    boards.value = res.data;
  } catch {
    toast.error('復原看板失敗');
  }
}

async function handleAiGenerate(prompt: string) {
  generating.value = true
  try {
    const board = await generate(prompt)
    if (board && 'id' in board) {
      showAiModal.value = false
      router.push(`/boards/${(board as any).id}`)
    }
  } catch {
    // error handled in composable
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-bg-200">
    <AppHeader />

    <main class="max-w-5xl mx-auto px-6 py-10">
      <div class="flex items-center justify-between mb-8">
        <h2 class="text-2xl font-bold tracking-tight text-gray-1000">My Boards</h2>
        <div class="flex items-center gap-3">
          <AiGenerateButton
            :remaining="usage?.remaining"
            @click="showAiModal = true"
          />
          <BaseButton variant="primary" size="sm" @click="showCreateModal = true"> New Board </BaseButton>
        </div>
      </div>

      <div v-if="loading" class="text-xs font-light leading-relaxed text-slate-500">Loading...</div>

      <div v-else-if="boards.length === 0" class="text-xs font-light leading-relaxed text-slate-500">
        No boards yet. Create one to get started.
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="board in boards"
          :key="board.id"
          class="bg-white rounded-sm border border-black/8 p-4 cursor-pointer hover:border-black/16 transition-colors"
          @click="router.push(`/boards/${board.id}`)"
        >
          <h3 class="text-sm font-medium text-gray-1000">{{ board.name }}</h3>
          <p class="mt-1 text-xs font-light leading-relaxed text-slate-500">
            {{ board._count.columns }} columns · {{ board._count.boardMembers }} members
          </p>
        </div>
      </div>

      <!-- Archived Boards -->
      <div v-if="boardStore.archivedBoards.length > 0" class="mt-10">
        <button
          class="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          @click="showArchived = !showArchived"
        >
          <ChevronRight
            v-if="!showArchived"
            class="w-4 h-4 transition-transform"
            :stroke-width="1.5"
          />
          <ChevronDown
            v-else
            class="w-4 h-4 transition-transform"
            :stroke-width="1.5"
          />
          已封存 ({{ boardStore.archivedBoards.length }})
        </button>
        <div v-if="showArchived" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          <div
            v-for="board in boardStore.archivedBoards"
            :key="board.id"
            class="bg-white rounded-sm border border-black/8 p-4 cursor-pointer hover:border-black/16 transition-colors opacity-60"
            @click="router.push(`/boards/${board.id}`)"
          >
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-gray-1000">{{ board.name }}</h3>
              <button
                class="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-sm hover:bg-gray-50 hover:border-gray-1000 hover:text-gray-1000 cursor-pointer transition-colors"
                @click.stop="restoreTargetId = board.id; showRestoreConfirm = true"
              >
                復原
              </button>
            </div>
            <p class="mt-1 text-xs font-light leading-relaxed text-slate-500">
              {{ board._count.columns }} columns · {{ board._count.boardMembers }} members
            </p>
          </div>
        </div>

        <ConfirmDialog
          :show="showRestoreConfirm"
          title="復原看板"
          message="確定要復原此看板嗎？"
          confirm-text="復原"
          @confirm="handleRestoreBoard"
          @cancel="showRestoreConfirm = false"
        />
      </div>
    </main>

    <CreateBoardModal
      :show="showCreateModal"
      @close="showCreateModal = false"
      @created="handleBoardCreated"
    />

    <AiGenerateModal
      :show="showAiModal"
      :remaining="usage?.remaining"
      :loading="generating"
      @close="showAiModal = false"
      @generate="handleAiGenerate"
    />
  </div>
</template>
