/**
 * 權限動作清單（Permission Layer）。
 * 每個 enum 值代表「看板內」的一個具體動作，由 ROLE_PERMISSIONS 矩陣
 * 決定哪些角色擁有它。
 *
 * 注意：DELETE_BOARD 刻意不在此列——它屬於 owner 特權（關係型規則），
 * 不走角色矩陣，見 AuthorizationService.requireOwner()。
 */
export enum Permission {
  // ── Board 看板 ──
  VIEW_BOARD = 'VIEW_BOARD',
  UPDATE_BOARD = 'UPDATE_BOARD',
  ARCHIVE_BOARD = 'ARCHIVE_BOARD',
  RESTORE_BOARD = 'RESTORE_BOARD',

  // ── Member 成員 ──
  VIEW_MEMBERS = 'VIEW_MEMBERS',
  SEARCH_MEMBERS = 'SEARCH_MEMBERS',
  ADD_MEMBER = 'ADD_MEMBER',
  UPDATE_MEMBER_ROLE = 'UPDATE_MEMBER_ROLE',
  REMOVE_MEMBER = 'REMOVE_MEMBER',

  // ── Column 欄位 ──
  CREATE_COLUMN = 'CREATE_COLUMN',
  UPDATE_COLUMN = 'UPDATE_COLUMN',
  DELETE_COLUMN = 'DELETE_COLUMN',
  REORDER_COLUMNS = 'REORDER_COLUMNS',

  // ── Task 任務 ──
  CREATE_TASK = 'CREATE_TASK',
  UPDATE_TASK = 'UPDATE_TASK',
  DELETE_TASK = 'DELETE_TASK',
  MOVE_TASK = 'MOVE_TASK',
  ASSIGN_TASK = 'ASSIGN_TASK',
  REMOVE_ASSIGNEE = 'REMOVE_ASSIGNEE',
  UPDATE_TASK_LABELS = 'UPDATE_TASK_LABELS',

  // ── Label 標籤（看板層級設定）──
  MANAGE_LABELS = 'MANAGE_LABELS',
}
