import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  Board,
  BoardListItem,
  Task,
  Column,
  CreateTaskRequest,
  UpdateTaskRequest,
} from '../types';
import { boardsApi, columnsApi, tasksApi } from '../api';

export const useBoardStore = defineStore('board', () => {
  const board = ref<Board | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const archivedBoards = ref<BoardListItem[]>([]);

  async function fetchBoard(id: number) {
    loading.value = true;
    error.value = null;
    try {
      const res = await boardsApi.get(id);
      board.value = res.data;
    } catch (e: any) {
      error.value = e.response?.data?.message || '載入看板失敗';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchArchivedBoards() {
    const res = await boardsApi.listArchived();
    archivedBoards.value = res.data;
  }

  function findTask(taskId: number): Task | undefined {
    if (!board.value) return;
    for (const col of board.value.columns) {
      const t = col.tasks.find((x) => x.id === taskId);
      if (t) return t;
    }
  }

  function updateBoardLocally(name?: string, archivedAt?: string | null) {
    if (!board.value) return;
    if (name) board.value.name = name;
    if (archivedAt !== undefined) board.value.archivedAt = archivedAt;
  }

  async function archiveBoard(boardId: number) {
    const res = await boardsApi.archive(boardId);
    if (board.value && board.value.id === boardId) {
      board.value.archivedAt = res.data.archivedAt;
    }
  }

  async function createTask(boardId: number, columnId: number, data: CreateTaskRequest) {
    const res = await tasksApi.create(boardId, columnId, data);
    const col = board.value?.columns.find((c) => c.id === columnId);
    if (col) {
      col.tasks.push(res.data);
      col.tasks.sort((a, b) => a.position - b.position);
    }
  }

  async function updateTask(taskId: number, data: UpdateTaskRequest) {
    const res = await tasksApi.update(taskId, data);
    const task = findTask(taskId);
    if (task) {
      Object.assign(task, res.data);
    }
  }

  async function deleteTask(taskId: number) {
    await tasksApi.delete(taskId);
    if (!board.value) return;
    for (const col of board.value.columns) {
      const idx = col.tasks.findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        col.tasks.splice(idx, 1);
        break;
      }
    }
  }

  async function reorderColumns(boardId: number, columnIds: number[]) {
    const data = { columns: columnIds.map((id, i) => ({ id, position: i })) };
    await columnsApi.reorder(boardId, data);
    if (board.value) {
      const map = new Map(board.value.columns.map((c) => [c.id, c]));
      board.value.columns = columnIds
        .map((id) => map.get(id))
        .filter((c): c is Column => c !== undefined);
    }
  }

  async function createColumn(boardId: number, name: string) {
    const res = await columnsApi.create(boardId, { name });
    const column = { ...res.data, tasks: res.data.tasks ?? [] };
    board.value?.columns.push(column);
    board.value?.columns.sort((a, b) => a.position - b.position);
  }

  async function deleteColumn(boardId: number, columnId: number) {
    await columnsApi.delete(boardId, columnId);
    if (!board.value) return;
    const idx = board.value.columns.findIndex((c) => c.id === columnId);
    if (idx !== -1) board.value.columns.splice(idx, 1);
  }

  async function updateColumn(boardId: number, columnId: number, name: string) {
    await columnsApi.update(boardId, columnId, { name });
    const col = board.value?.columns.find((c) => c.id === columnId);
    if (col) col.name = name;
  }

  function takeSnapshot() {
    return JSON.parse(JSON.stringify(board.value));
  }

  function restoreSnapshot(snapshot: Board | null) {
    board.value = snapshot;
  }

  function $reset() {
    board.value = null;
    loading.value = false;
    error.value = null;
  }

  return {
    board,
    loading,
    error,
    archivedBoards,
    fetchBoard,
    fetchArchivedBoards,
    findTask,
    updateBoardLocally,
    archiveBoard,
    createTask,
    updateTask,
    deleteTask,
    createColumn,
    deleteColumn,
    reorderColumns,
    updateColumn,
    takeSnapshot,
    restoreSnapshot,
    $reset,
  };
});
