import api from './client';
import type {
  BoardListItem,
  Board,
  CreateBoardRequest,
  UpdateBoardRequest,
  BoardMember,
  ApiResponse,
  AddMemberRequest,
  UpdateMemberRoleRequest,
  Column,
  CreateColumnRequest,
  UpdateColumnRequest,
  ReorderColumnsRequest,
} from '../types';

export const boardsApi = {
  list() {
    return api.get<ApiResponse<BoardListItem[]>>('/boards');
  },

  get(id: number) {
    return api.get<ApiResponse<Board>>(`/boards/${id}`);
  },

  create(data: CreateBoardRequest) {
    return api.post<ApiResponse<Board>>('/boards', data);
  },

  update(id: number, data: UpdateBoardRequest) {
    return api.patch<ApiResponse<Board>>(`/boards/${id}`, data);
  },

  delete(id: number) {
    return api.delete(`/boards/${id}`);
  },

  getMembers(boardId: number) {
    return api.get<ApiResponse<BoardMember[]>>(`/boards/${boardId}/members`);
  },

  addMember(boardId: number, data: AddMemberRequest) {
    return api.post<ApiResponse<BoardMember>>(`/boards/${boardId}/members`, data);
  },

  updateMemberRole(boardId: number, userId: number, data: UpdateMemberRoleRequest) {
    return api.patch<ApiResponse<BoardMember>>(`/boards/${boardId}/members/${userId}`, data);
  },

  removeMember(boardId: number, userId: number) {
    return api.delete(`/boards/${boardId}/members/${userId}`);
  },
};

export const columnsApi = {
  list(boardId: number) {
    return api.get<ApiResponse<Column[]>>(`/boards/${boardId}/columns`);
  },

  create(boardId: number, data: CreateColumnRequest) {
    return api.post<ApiResponse<Column>>(`/boards/${boardId}/columns`, data);
  },

  update(boardId: number, id: number, data: UpdateColumnRequest) {
    return api.patch<ApiResponse<Column>>(`/boards/${boardId}/columns/${id}`, data);
  },

  reorder(boardId: number, data: ReorderColumnsRequest) {
    return api.patch<ApiResponse<void>>(`/boards/${boardId}/columns/reorder`, data);
  },

  delete(boardId: number, id: number) {
    return api.delete(`/boards/${boardId}/columns/${id}`);
  },
};
