<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToastStore } from '../stores/toast';
import { boardsApi } from '../api';
import type { BoardListItem } from '../types';
import BaseButton from '../components/common/BaseButton.vue';
import CreateBoardModal from '../components/board/CreateBoardModal.vue';
import AiGenerateButton from '../components/ai/AiGenerateButton.vue';
import AiGenerateModal from '../components/ai/AiGenerateModal.vue';
import UserMenu from '../components/common/UserMenu.vue';
import { useAiGenerate } from '../composables/useAiGenerate';

const router = useRouter();
const toast = useToastStore();
const boards = ref<BoardListItem[]>([]);
const loading = ref(true);
const showCreateModal = ref(false);
const showAiModal = ref(false);
const generating = ref(false);

const { usage, fetchUsage, generate } = useAiGenerate();

function handleBoardCreated(boardId: number) {
  showCreateModal.value = false
  router.push(`/boards/${boardId}`)
}

onMounted(async () => {
  try {
    const res = await boardsApi.list();
    boards.value = res.data.data;
  } catch (error) {
    console.error('抓取看板失敗:', error);
  } finally {
    loading.value = false;
  }
  fetchUsage();
});

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
    <header class="h-14 bg-white border-b border-black/8 flex items-center justify-between px-6">
      <h1 class="text-sm font-bold tracking-tight text-gray-1000">TaskWatch</h1>
      <UserMenu />
    </header>

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
