import api from './client'
import type { Label, CreateLabelRequest, UpdateLabelRequest } from '../types'

export const labelsApi = {
  list(boardId: number) {
    return api.get<Label[]>(`/boards/${boardId}/labels`)
  },

  create(boardId: number, data: CreateLabelRequest) {
    return api.post<Label>(`/boards/${boardId}/labels`, data)
  },

  update(boardId: number, id: number, data: UpdateLabelRequest) {
    return api.patch<Label>(`/boards/${boardId}/labels/${id}`, data)
  },

  delete(boardId: number, id: number) {
    return api.delete(`/boards/${boardId}/labels/${id}`)
  },
}
