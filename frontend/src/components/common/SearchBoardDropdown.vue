<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Search, LayoutDashboard, LoaderCircle } from '@lucide/vue'
import { boardsApi } from '../../api/boards'
import { useSearch } from '../../composables/useSearch'
import type { BoardSearchResult } from '../../types'
import BaseDropdown from './BaseDropdown.vue'

const router = useRouter()

const isComposing = ref(false)
const recentBoards = ref<BoardSearchResult[]>([])
const inputRef = ref<HTMLInputElement | null>(null)

// ─── 搜尋邏輯（debounce + abort + loading）─────────────────────
const { query, results, loading, reset } = useSearch<BoardSearchResult>(
  async (q, signal) => {
    const res = await boardsApi.search(q, signal);
    return res.data;
  },
  { debounceMs: 300 },
)

const isSearching = computed(() => query.value.trim().length > 0)

// ─── 鍵盤導覽 ──────────────────────────────────────────────────
const selectedIndex = ref(-1)

// 結合 recent 與搜尋結果為可導覽項目（兩者互斥）
const navigableItems = computed(() => {
  if (isSearching.value) return results.value
  return recentBoards.value
})

watch(navigableItems, (val) => {
  selectedIndex.value = val.length > 0 ? 0 : -1
})

function handleKeydown(e: KeyboardEvent, close: () => void) {
  const items = navigableItems.value
  if (items.length === 0) return

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      selectedIndex.value = (selectedIndex.value + 1) % items.length
      break
    case 'ArrowUp':
      e.preventDefault()
      selectedIndex.value =
        (selectedIndex.value - 1 + items.length) % items.length
      break
    case 'Enter':
      e.preventDefault()
      if (selectedIndex.value >= 0 && selectedIndex.value < items.length) {
        selectBoard(items[selectedIndex.value].id, close)
      }
      break
  }
}

async function loadRecent() {
  try {
    const res = await boardsApi.findRecent()
    recentBoards.value = res.data
  } catch {
    recentBoards.value = []
  }
}

// ─── IME 輸入法（注音等）處理 ──────────────────────────────────
function onCompositionStart() {
  isComposing.value = true
}

function onCompositionEnd(e: CompositionEvent) {
  isComposing.value = false
  // 注音打完才觸發搜尋
  query.value = (e.target as HTMLInputElement).value
}

function onInput(e: Event) {
  if (isComposing.value) return
  query.value = (e.target as HTMLInputElement).value
}

function handleOpen() {
  loadRecent()
  nextTick(() => inputRef.value?.focus())
}

function selectBoard(boardId: number, close: () => void) {
  close()
  reset()
  router.push(`/boards/${boardId}`)
}

onUnmounted(() => {
  reset()
})
</script>

<template>
  <BaseDropdown @open="handleOpen">
    <template #trigger="{ toggle }">
      <button
        class="w-8 h-8 flex items-center justify-center rounded-sm text-gray-900 hover:bg-black/5 transition-colors focus:outline-none"
        @click.stop="toggle"
      >
        <Search class="w-5 h-5" :stroke-width="1.5" />
      </button>
    </template>
    <template #dropdown="{ close }">
      <div @keydown="(e) => handleKeydown(e, close)">
        <!-- Search Input -->
        <div class="p-2 border-b border-black/8">
          <input
            ref="inputRef"
            type="text"
            :value="query"
            placeholder="搜尋看板…"
            class="w-full h-9 px-3 text-sm bg-black/5 rounded-sm text-gray-900 placeholder:text-gray-600 focus:outline-none"
            @compositionstart="onCompositionStart"
            @compositionend="onCompositionEnd"
            @input="onInput"
          />
        </div>

        <!-- Recent Boards -->
        <div v-if="!isSearching" class="py-2">
          <p class="px-4 py-1 text-[13px] font-light leading-relaxed text-gray-600">
            最近開啟的面板
          </p>
          <button
            v-for="(board, i) in recentBoards"
            :key="board.id"
            :class="[
              'w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-900 hover:bg-gray-100 text-left focus:outline-none',
              selectedIndex === i && 'bg-gray-100',
            ]"
            @mouseenter="selectedIndex = i"
            @click="selectBoard(board.id, close)"
          >
            <span class="w-6 h-6 rounded-sm bg-black/5 flex items-center justify-center text-xs shrink-0">
              <LayoutDashboard class="w-4 h-4 text-gray-700" />
            </span>
            <span class="truncate">{{ board.name }}</span>
          </button>
          <p v-if="recentBoards.length === 0" class="px-4 py-3 text-xs font-light leading-relaxed text-slate-500 text-center">
            尚無最近開啟的看板
          </p>
        </div>

        <!-- Search Results -->
        <div v-else class="py-2">
          <!-- Loading -->
          <div v-if="loading" class="flex items-center justify-center py-6">
            <LoaderCircle class="w-5 h-5 animate-spin text-gray-600" :stroke-width="1.5" />
          </div>

          <!-- Results -->
          <template v-else-if="results.length > 0">
            <button
              v-for="(board, i) in results"
              :key="board.id"
              :class="[
                'w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-900 hover:bg-gray-100 text-left focus:outline-none',
                selectedIndex === i && 'bg-gray-100',
              ]"
              @mouseenter="selectedIndex = i"
              @click="selectBoard(board.id, close)"
            >
              <span class="w-6 h-6 rounded-sm bg-black/5 flex items-center justify-center text-xs shrink-0">
                <LayoutDashboard class="w-4 h-4 text-gray-700" />
              </span>
              <span class="truncate">{{ board.name }}</span>
            </button>
          </template>

          <!-- Empty -->
          <p v-else class="px-4 py-3 text-xs font-light leading-relaxed text-slate-500 text-center">
            未找到對應的搜尋結果。
          </p>
        </div>
      </div>
    </template>
  </BaseDropdown>
</template>
