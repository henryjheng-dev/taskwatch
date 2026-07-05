import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ToastMessage {
  id: number
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

let nextId = 0

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<ToastMessage[]>([])

  function add(toast: Omit<ToastMessage, 'id'>) {
    const id = nextId++
    toasts.value.push({ ...toast, id })
    setTimeout(() => {
      remove(id)
    }, 4000)
  }

  function success(message: string) {
    add({ type: 'success', message })
  }

  function error(message: string) {
    add({ type: 'error', message })
  }

  function warning(message: string) {
    add({ type: 'warning', message })
  }

  function info(message: string) {
    add({ type: 'info', message })
  }

  function remove(id: number) {
    const idx = toasts.value.findIndex((t) => t.id === id)
    if (idx !== -1) {
      toasts.value.splice(idx, 1)
    }
  }

  return { toasts, success, error, warning, info, remove }
})
