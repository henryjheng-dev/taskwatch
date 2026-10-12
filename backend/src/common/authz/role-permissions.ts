import type { BoardRole } from '@/generated/prisma/client';
import { Permission } from './permission.enum';

/**
 * 角色 → 權限矩陣（靜態 RBAC）。
 * 角色型規則的唯一來源：改角色能力只需改這張表。
 *
 * 三條「關係型規則」（owner 刪看板、建立者刪任務、本人移除自己）
 * 不在矩陣內，收斂在 AuthorizationService 的 policy helper。
 */
export const ROLE_PERMISSIONS: Record<BoardRole, ReadonlySet<Permission>> = {
  /** 來賓：唯讀看板 */
  GUEST: new Set<Permission>([
    Permission.VIEW_BOARD,
    Permission.VIEW_MEMBERS,
    Permission.SEARCH_MEMBERS,
  ]),

  /** 成員：可協作（建立/編輯欄位與任務） */
  MEMBER: new Set<Permission>([
    Permission.VIEW_BOARD,
    Permission.VIEW_MEMBERS,
    Permission.SEARCH_MEMBERS,
    Permission.CREATE_COLUMN,
    Permission.CREATE_TASK,
    Permission.UPDATE_TASK,
    Permission.MOVE_TASK,
    Permission.ASSIGN_TASK,
    Permission.UPDATE_TASK_LABELS,
  ]),

  /** 管理員：全權限（矩陣內的所有動作） */
  ADMIN: new Set<Permission>(Object.values(Permission)),
};
