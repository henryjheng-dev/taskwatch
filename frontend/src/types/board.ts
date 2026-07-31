import type { User } from './auth'

export interface Label {
  id: number
  boardId: number
  name: string
  color: string
}

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH'

export type BoardRole = 'ADMIN' | 'MEMBER' | 'GUEST'

export interface TaskLabel {
  taskId: number
  labelId: number
  label: Label
}

export interface TaskAssignee {
  taskId: number
  userId: number
  assignedAt: string
  user: User
}

export interface Task {
  id: number
  columnId: number
  title: string
  description: string | null
  linkUrl: string | null
  priority: Priority
  dueDate: string | null
  position: number
  createdBy: number
  createdAt: string
  updatedAt: string
  taskLabels: TaskLabel[]
  taskAssignees: TaskAssignee[]
  creator?: { id: number; name: string }
}

export interface Column {
  id: number
  boardId: number
  name: string
  position: number
  createdAt: string
  tasks: Task[]
}

export interface Board {
  id: number
  name: string
  backgroundColor: string
  ownerId: number
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  columns: Column[]
  boardMembers: BoardMember[]
  labels: Label[]
}

export interface BoardListItem {
  id: number
  name: string
  backgroundColor: string
  ownerId: number
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  _count: {
    columns: number
    boardMembers: number
  }
}

export interface BoardMember {
  id: number
  boardId: number
  userId: number
  role: BoardRole
  joinedAt: string
  user: User
}

export interface CreateBoardRequest {
  name: string
  backgroundColor?: string
}

export interface UpdateBoardRequest {
  name?: string
  backgroundColor?: string
}

export interface AddMemberRequest {
  query: string
  role?: BoardRole
}

export interface UserSearchResult {
  id: number
  name: string
  email: string
}

export interface UpdateMemberRoleRequest {
  role: BoardRole
}

export interface BoardSearchResult {
  id: number
  name: string
  updatedAt: string
}

export interface CreateColumnRequest {
  name: string
  position?: number
}

export interface UpdateColumnRequest {
  name?: string
  position?: number
}

export interface ReorderColumnsRequest {
  columns: { id: number; position: number }[]
}

export interface CreateTaskRequest {
  title: string
  description?: string
  linkUrl?: string
  priority?: Priority
  dueDate?: string
  position?: number
}

export interface UpdateTaskRequest {
  title?: string
  description?: string | null
  linkUrl?: string
  priority?: Priority
  dueDate?: string | null
  position?: number
}

export interface MoveTaskRequest {
  targetColumnId?: number
  position: number
}

export interface CreateLabelRequest {
  name: string
  color: string
}

export interface UpdateLabelRequest {
  name?: string
  color?: string
}
