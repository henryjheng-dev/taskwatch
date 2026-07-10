import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Board, Task, Column, CreateTaskRequest, MoveTaskRequest, UpdateTaskRequest } from '../types'
import { boardsApi, columnsApi, tasksApi } from '../api'

export const useBoardStore = defineStore('board', () => {
  const board = ref<Board | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchBoard(id: number) {
    loading.value = true
    error.value = null
    try {
      const res = await boardsApi.get(id)
      board.value = res.data.data
    } catch (e: any) {
      error.value = e.response?.data?.message || '載入看板失敗'
      throw e
    } finally {
      loading.value = false
    }
  }

  function findTask(taskId: number): Task | undefined {
    if (!board.value) return
    for (const col of board.value.columns) {
      const t = col.tasks.find((x) => x.id === taskId)
      if (t) return t
    }
  }

  function updateBoardLocally(name?: string, bg?: string) {
    if (!board.value) return
    if (name) board.value.name = name
    if (bg) board.value.backgroundColor = bg
  }

  async function createTask(boardId: number, columnId: number, data: CreateTaskRequest) {
    const res = await tasksApi.create(boardId, columnId, data)
    const col = board.value?.columns.find((c) => c.id === columnId)
    if (col) {
      col.tasks.push(res.data.data)
      col.tasks.sort((a, b) => a.position - b.position)
    }
  }

  async function updateTask(taskId: number, data: UpdateTaskRequest) {
    const res = await tasksApi.update(taskId, data)
    const task = findTask(taskId)
    if (task) {
      Object.assign(task, res.data.data)
    }
  }

  async function deleteTask(taskId: number) {
    await tasksApi.delete(taskId)
    if (!board.value) return
    for (const col of board.value.columns) {
      const idx = col.tasks.findIndex((t) => t.id === taskId)
      if (idx !== -1) {
        col.tasks.splice(idx, 1)
        break
      }
    }
  }

  async function moveTask(taskId: number, data: MoveTaskRequest) {
    const task = findTask(taskId)
    if (!task) return
    const oldCol = board.value?.columns.find((c) => c.tasks.some((t) => t.id === taskId))
    if (oldCol) {
      const idx = oldCol.tasks.findIndex((t) => t.id === taskId)
      oldCol.tasks.splice(idx, 1)
    }
    if (data.targetColumnId) {
      const newCol = board.value?.columns.find((c) => c.id === data.targetColumnId)
      if (newCol) {
        task.columnId = data.targetColumnId
        task.position = data.position
        newCol.tasks.push(task)
        newCol.tasks.sort((a, b) => a.position - b.position)
      }
    }
    await tasksApi.move(taskId, data)
  }

  async function createColumn(boardId: number, name: string) {
    const res = await columnsApi.create(boardId, { name })
    const column = { ...res.data.data, tasks: res.data.data.tasks ?? [] }
    board.value?.columns.push(column)
    board.value?.columns.sort((a, b) => a.position - b.position)
  }

  function takeSnapshot() {
    return JSON.parse(JSON.stringify(board.value))
  }

  function restoreSnapshot(snapshot: Board | null) {
    board.value = snapshot
  }

  function $reset() {
    board.value = null
    loading.value = false
    error.value = null
  }

  return {
    board, loading, error,
    fetchBoard, findTask, updateBoardLocally,
    createTask, updateTask, deleteTask, moveTask,
    createColumn, takeSnapshot, restoreSnapshot, $reset,
  }
})
