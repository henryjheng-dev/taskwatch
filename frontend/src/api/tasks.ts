import api from './client'
import type {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  MoveTaskRequest,
  TaskAssignee,
} from '../types'

export const tasksApi = {
  create(boardId: number, columnId: number, data: CreateTaskRequest) {
    return api.post<Task>(`/boards/${boardId}/columns/${columnId}/tasks`, data)
  },

  get(id: number) {
    return api.get<Task>(`/tasks/${id}`)
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

  addAssignee(taskId: number, userId: number) {
    return api.post<TaskAssignee>(`/tasks/${taskId}/assignees`, { userId })
  },

  removeAssignee(taskId: number, userId: number) {
    return api.delete(`/tasks/${taskId}/assignees/${userId}`)
  },
}
