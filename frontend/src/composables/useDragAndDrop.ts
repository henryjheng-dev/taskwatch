import { useBoardStore } from '../stores/board'
import { useToastStore } from '../stores/toast'
import type { MoveTaskRequest } from '../types'

export function useDragAndDrop() {
  const boardStore = useBoardStore()
  const toast = useToastStore()

  async function onDrop(taskId: number, data: MoveTaskRequest) {
    const snapshot = boardStore.takeSnapshot()
    try {
      await boardStore.moveTask(taskId, data)
    } catch {
      boardStore.restoreSnapshot(snapshot)
      toast.error('移動失敗，請重試')
    }
  }

  return { onDrop }
}
