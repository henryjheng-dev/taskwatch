import api from './client';
import type {
  BoardListItem,
  Board,
  CreateBoardRequest,
  UpdateBoardRequest,
  BoardMember,
  AddMemberRequest,
  UpdateMemberRoleRequest,
  Column,
  CreateColumnRequest,
  UpdateColumnRequest,
  ReorderColumnsRequest,
  BoardSearchResult,
} from '../types';

export const boardsApi = {
  list() {
    return api.get<BoardListItem[]>('/boards');
  },

  get(id: number) {
    return api.get<Board>(`/boards/${id}`);
  },

  create(data: CreateBoardRequest) {
    return api.post<Board>('/boards', data);
  },

  update(id: number, data: UpdateBoardRequest) {
    return api.patch<Board>(`/boards/${id}`, data);
  },

  delete(id: number) {
    return api.delete(`/boards/${id}`);
  },

  getMembers(boardId: number) {
    return api.get<BoardMember[]>(`/boards/${boardId}/members`);
  },

  addMember(boardId: number, data: AddMemberRequest) {
    return api.post<BoardMember>(`/boards/${boardId}/members`, data);
  },

  updateMemberRole(boardId: number, userId: number, data: UpdateMemberRoleRequest) {
    return api.patch<BoardMember>(`/boards/${boardId}/members/${userId}`, data);
  },

  removeMember(boardId: number, userId: number) {
    return api.delete(`/boards/${boardId}/members/${userId}`);
  },

  search(query: string, signal?: AbortSignal) {
    return api.get<BoardSearchResult[]>('/boards/search', { params: { q: query }, signal });
  },

  findRecent() {
    return api.get<BoardSearchResult[]>('/boards/recent');
  },

  listArchived() {
    return api.get<BoardListItem[]>('/boards/archived');
  },

  archive(id: number) {
    return api.patch<Board>(`/boards/${id}/archive`);
  },

  restore(id: number) {
    return api.patch<Board>(`/boards/${id}/restore`);
  },
};

export const columnsApi = {
  list(boardId: number) {
    return api.get<Column[]>(`/boards/${boardId}/columns`);
  },

  create(boardId: number, data: CreateColumnRequest) {
    return api.post<Column>(`/boards/${boardId}/columns`, data);
  },

  update(boardId: number, id: number, data: UpdateColumnRequest) {
    return api.patch<Column>(`/boards/${boardId}/columns/${id}`, data);
  },

  reorder(boardId: number, data: ReorderColumnsRequest) {
    return api.patch<void>(`/boards/${boardId}/columns/reorder`, data);
  },

  delete(boardId: number, id: number) {
    return api.delete(`/boards/${boardId}/columns/${id}`);
  },
};
