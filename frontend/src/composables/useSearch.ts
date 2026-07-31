import { ref, watch, onUnmounted } from 'vue';

/**
 * 共用搜尋邏輯 composable
 *
 * 功能：
 *  - v-model 綁定 query，自動 debounce + abort controller
 *  - search(val) 手動觸發（跳過 debounce），供 composition input 使用
 *  - reset() 清除所有狀態
 *
 * 使用方式：
 *   const { query, results, loading, search, reset } = useSearch<T>(
 *     (q, signal) => api.search(q, signal),
 *     { debounceMs: 300 },
 *   )
 */

export function useSearch<T>(
  fetchFn: (query: string, signal: AbortSignal) => Promise<T[]>,
  options?: { debounceMs?: number },
) {
  const debounceMs = options?.debounceMs ?? 200;

  const query = ref('');
  const results = ref<T[]>([]);
  const loading = ref(false);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;

  // ─── 取消所有進行中的操作 ──────────────────────────────────────
  function cancel() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  // ─── 真正發送 API ────────────────────────────────────────────
  async function execute(val: string) {
    if (!val.trim()) return;
    loading.value = true;
    abortController = new AbortController();
    try {
      const res = await fetchFn(val.trim(), abortController.signal);
      results.value = res;
    } catch (e: any) {
      if (e?.name === 'AbortError' || e?.code === 'ERR_CANCELED') return;
      results.value = [];
    } finally {
      loading.value = false;
    }
  }

  // ─── v-model / watch 自動搜尋（含 debounce）────────────────────
  watch(query, (val) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (abortController) abortController.abort();

    if (!val.trim()) {
      results.value = [];
      loading.value = false;
      return;
    }

    debounceTimer = setTimeout(() => execute(val), debounceMs);
  });

  // ─── 手動觸發搜尋（跳過 debounce，例如 compositionend）─────────
  function search(val: string) {
    cancel();
    if (!val.trim()) {
      results.value = [];
      loading.value = false;
      return;
    }
    execute(val);
  }

  // ─── 清除狀態 ─────────────────────────────────────────────────
  function reset() {
    cancel();
    query.value = '';
    results.value = [];
    loading.value = false;
  }

  onUnmounted(cancel);

  return { query, results, loading, search, reset };
}
