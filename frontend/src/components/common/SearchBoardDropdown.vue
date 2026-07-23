<script setup lang="ts">
import { ref, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Search, LayoutDashboard, LoaderCircle } from '@lucide/vue'
import { boardsApi } from '../../api/boards'
import type { BoardSearchResult } from '../../types'
import BaseDropdown from './BaseDropdown.vue'

const router = useRouter()

const searchInput = ref('')
const isComposing = ref(false)
const isLoading = ref(false)
const recentBoards = ref<BoardSearchResult[]>([])
const searchResults = ref<BoardSearchResult[]>([])
const isSearching = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let abortController: AbortController | null = null

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (abortController) abortController.abort()
})

async function loadRecent() {
  try {
    const res = await boardsApi.findRecent()
    recentBoards.value = res.data
  } catch {
    recentBoards.value = []
  }
}

function onCompositionStart() {
  isComposing.value = true
}

function onCompositionEnd(e: CompositionEvent) {
  isComposing.value = false
  searchInput.value = (e.target as HTMLInputElement).value
  scheduleSearch()
}

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  searchInput.value = value

  if (isComposing.value) return

  if (!value) {
    cancelPendingSearch()
    isSearching.value = false
    searchResults.value = []
    return
  }

  scheduleSearch()
}

function cancelPendingSearch() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

function scheduleSearch() {
  cancelPendingSearch()

  if (!searchInput.value) return

  debounceTimer = setTimeout(() => {
    executeSearch()
  }, 300)
}

async function executeSearch() {
  const query = searchInput.value
  if (!query) return

  isSearching.value = true
  isLoading.value = true

  if (abortController) abortController.abort()
  abortController = new AbortController()

  try {
    const res = await boardsApi.search(query, abortController.signal)
    searchResults.value = res.data
  } catch (e: any) {
    if (e?.name === 'AbortError' || e?.code === 'ERR_CANCELED') return
    searchResults.value = []
  } finally {
    isLoading.value = false
  }
}

function handleOpen() {
  loadRecent()
  nextTick(() => inputRef.value?.focus())
}

function selectBoard(boardId: number, close: () => void) {
  close()
  searchInput.value = ''
  isSearching.value = false
  searchResults.value = []
  router.push(`/boards/${boardId}`)
}
</script>

<template>
  <BaseDropdown @open="handleOpen">
    <template #trigger="{ toggle }">
      <button
        class="w-8 h-8 flex items-center justify-center rounded-sm text-gray-900 hover:bg-black/5 transition-colors focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        @click.stop="toggle"
      >
        <Search class="w-5 h-5" :stroke-width="1.5" />
      </button>
    </template>
    <template #dropdown="{ close }">
      <!-- Search Input -->
      <div class="p-2 border-b border-black/8">
        <input
          ref="inputRef"
          v-model="searchInput"
          type="text"
          placeholder="搜尋看板…"
          class="w-full h-9 px-3 text-sm bg-black/5 rounded-sm text-gray-900 placeholder:text-gray-600 outline-none focus-visible:ring-2 focus-visible:ring-gray-1000"
          @compositionstart="onCompositionStart"
          @compositionend="onCompositionEnd"
          @input="onInput"
        />
      </div>

      <!-- Not searching → Recent Boards -->
      <div v-if="!isSearching" class="py-2">
        <p class="px-4 py-1 text-[13px] font-light leading-relaxed text-gray-600">
          最近開啟的面板
        </p>
        <button
          v-for="board in recentBoards"
          :key="board.id"
          class="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-900 hover:bg-black/5 transition-colors text-left"
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

      <!-- Searching → Results -->
      <div v-else class="py-2">
        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center py-6">
          <LoaderCircle class="w-5 h-5 animate-spin text-gray-600" :stroke-width="1.5" />
        </div>

        <!-- Results -->
        <template v-else-if="searchResults.length > 0">
          <button
            v-for="board in searchResults"
            :key="board.id"
            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-900 hover:bg-black/5 transition-colors text-left"
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
    </template>
  </BaseDropdown>
</template>
