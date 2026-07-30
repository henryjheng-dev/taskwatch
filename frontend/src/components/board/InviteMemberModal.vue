<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { UserSearchResult } from '../../types';
import { boardsApi } from '../../api/boards';
import { useSearch } from '../../composables/useSearch';
import BaseModal from '../common/BaseModal.vue';
import BaseButton from '../common/BaseButton.vue';

const props = defineProps<{
  show: boolean;
  boardId: number;
}>();

const emit = defineEmits<{
  close: [];
  invited: [];
}>();

const inviting = ref(false);
const selectedUser = ref<UserSearchResult | null>(null);

// ─── 邀請狀態提示（輸入匡下方顯示）────────────────────────────────
const statusMessage = ref('');
const statusType = ref<'success' | 'error'>('success');

// ─── 搜尋邏輯（debounce + abort + loading）─────────────────────
const { query, results, loading, reset } = useSearch<UserSearchResult>(
  async (q, signal) => {
    const res = await boardsApi.searchUsers(props.boardId, q, signal);
    return res.data;
  },
  { debounceMs: 200 },
);

const suppressStatusClear = ref(false);
// 下拉選單容器 ref，限縮 scrollIntoView 搜尋範圍，避免與全域其他元件撞名
const listRef = ref<HTMLElement | null>(null);

watch(query, () => {
  if (suppressStatusClear.value) {
    suppressStatusClear.value = false;
    return;
  }
  selectedUser.value = null;
  if (statusMessage.value) statusMessage.value = '';
});

// ─── 鍵盤導覽選中的索引（-1 = 無選中）────────────────────────────
const selectedIndex = ref(-1);

// 搜尋結果更新時自動選中第一項
watch(results, (val) => {
  selectedIndex.value = val.length > 0 ? 0 : -1;
});

// ─── 鍵盤導覽處理 ──────────────────────────────────────────────
// 鍵盤移動 selectedIndex 後，將選中的項目捲入可見範圍
function scrollSelectedIntoView() {
  nextTick(() => {
    const el = listRef.value?.querySelector<HTMLElement>('[data-selected="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  });
}

function handleKeydown(e: KeyboardEvent) {
  if (results.value.length === 0) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedIndex.value = (selectedIndex.value + 1) % results.value.length;
      scrollSelectedIntoView();
      break;
    case 'ArrowUp':
      e.preventDefault();
      selectedIndex.value =
        (selectedIndex.value - 1 + results.value.length) % results.value.length;
      scrollSelectedIntoView();
      break;
    case 'Enter':
      e.preventDefault();
      if (selectedIndex.value >= 0 && selectedIndex.value < results.value.length) {
        selectUser(results.value[selectedIndex.value]);
      }
      break;
    case 'Escape':
      e.preventDefault();
      e.stopPropagation();
      reset();
      break;
  }
}

// ─── 邀請按鈕點擊 ──────────────────────────────────────────────
function inviteSelected() {
  if (selectedUser.value) invite(selectedUser.value);
}

function selectUser(user: UserSearchResult) {
  selectedUser.value = user;
  query.value = user.name;
  results.value = [];
}

async function invite(user: UserSearchResult) {
  inviting.value = true;
  try {
    await boardsApi.addMember(props.boardId, { query: user.email });
    suppressStatusClear.value = true;
    query.value = '';
    statusType.value = 'success';
    statusMessage.value = '已添加成功';
    results.value = [];
    selectedIndex.value = -1;
    selectedUser.value = null;
    emit('invited');
  } catch {
    statusType.value = 'error';
    statusMessage.value = '添加失敗';
  } finally {
    inviting.value = false;
  }
}

function handleClose() {
  // dropdown 可見時先關 dropdown，不關 modal
  if (query.value.trim() && !selectedUser.value) {
    selectedUser.value = null;
    reset();
    return;
  }
  selectedUser.value = null;
  statusMessage.value = '';
  reset();
  emit('close');
}
</script>

<template>
  <BaseModal :show="show" title="邀請成員" max-width="max-w-md" @close="handleClose">
    <div class="relative pb-5" @keydown="handleKeydown">
      <div class="flex gap-2">
        <div class="relative flex-1">
          <input
            v-model="query"
            type="text"
            placeholder="搜尋名稱或 Email…"
            class="w-full border border-black/8 rounded-md px-3 py-2 text-sm outline-none focus:border-black/20 transition-colors"
          />
          <div
            v-if="query.trim() && !selectedUser"
            class="absolute top-full left-0 right-0 bg-white border border-black/8 rounded-md shadow-lg z-10 overflow-hidden"
          >
            <div
              ref="listRef"
              class="max-h-48 overflow-y-auto"
              @mouseenter="selectedIndex = -1"
            >
            <div v-if="loading" class="px-3 py-2 text-sm text-gray-600">搜尋中…</div>
            <div v-else-if="results.length === 0" class="px-3 py-2 text-sm text-gray-500">
              無符合的使用者
            </div>
            <button
              v-for="(user, i) in results"
              :key="user.id"
              :data-selected="selectedIndex === i || undefined"
              :disabled="inviting"
              :class="[
                'w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 disabled:opacity-50',
                selectedIndex === i && 'bg-gray-100',
              ]"
              @click="selectUser(user)"
            >
              <span class="font-medium">{{ user.name }}</span>
              <span class="ml-2 text-gray-700">{{ user.email }}</span>
            </button>
            </div>
          </div>
        </div>
        <BaseButton
          variant="primary"
          :disabled="!selectedUser"
          :loading="inviting"
          class="h-9"
          @click="inviteSelected"
        >
          邀請
        </BaseButton>
      </div>
      <!-- 邀請狀態提示 -->
      <p
        v-if="statusMessage"
        class="mt-1.5 text-xs text-center"
        :class="statusType === 'success' ? 'text-green-600' : 'text-red-600'"
      >
        {{ statusMessage }}
      </p>
    </div>
  </BaseModal>
</template>
