import { ref } from 'vue'
import { aiApi } from '../api'
import type { AiUsage } from '../types'

export function useAiGenerate() {
  const usage = ref<AiUsage | null>(null)
  const loading = ref(false)
  const error = ref('')

  async function fetchUsage() {
    try {
      const res = await aiApi.getUsage()
      usage.value = res.data.data
    } catch {
      usage.value = null
    }
  }

  async function generate(prompt: string) {
    loading.value = true
    error.value = ''
    try {
      const res = await aiApi.generate({ prompt })
      return res.data.data
    } catch (err: any) {
      const msg = err.response?.data?.message
      if (err.response?.status === 429) {
        error.value = typeof msg === 'string' ? msg : '今日 AI 生成次數已達上限'
      } else {
        error.value = Array.isArray(msg) ? msg.join(', ') : msg || 'AI 生成失敗'
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  return { usage, loading, error, fetchUsage, generate }
}
