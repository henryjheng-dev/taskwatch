import api from './client'
import type {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  MoveTaskRequest,
} from '../types'

export const tasksApi = {
  create(boardId: number, columnId: number, data: CreateTaskRequest) {
    return api.post<Task>(`/boards/${boardId}/columns/${columnId}/tasks`, data)
  },

  update(id: number, data: UpdateTaskRequest) {
    return api.patch<Task>(`/tasks/${id}`, data)
  },

  delete(id: number) {
    return api.delete(`/tasks/${id}`)
  },

  move(id: number, data: MoveTaskRequest) {
    return api.patch<Task>(`/tasks/${id}/move`, data)
  },
}
