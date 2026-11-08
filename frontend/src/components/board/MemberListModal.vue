<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import type { BoardMember, BoardRole } from '../../types';
import { boardsApi } from '../../api/boards';
import BaseModal from '../common/BaseModal.vue';
import ConfirmDialog from '../common/ConfirmDialog.vue';
import { ChevronDown } from '@lucide/vue';

const props = defineProps<{
  show: boolean;
  boardId: number;
  ownerId: number;
  currentUserId: number;
}>();

const emit = defineEmits<{
  close: [];
}>();

const members = ref<BoardMember[]>([]);
const loading = ref(false);

const showRemoveConfirm = ref(false);
const targetMember = ref<BoardMember | null>(null);

const activeMemberId = ref<number | null>(null);
const selectedIndex = ref(-1);
const btnRefs = ref<Map<number, HTMLElement>>(new Map());
const dropdownStyle = ref<Record<string, string>>({});

const currentMember = computed(() => members.value.find((m) => m.userId === props.currentUserId));
const isOwner = computed(() => props.currentUserId === props.ownerId);
const isAdmin = computed(() => currentMember.value?.role === 'ADMIN');

function canEdit(member: BoardMember): boolean {
  if (member.userId === props.ownerId) return false;
  if (isOwner.value) return true;
  if (isAdmin.value && member.userId !== props.currentUserId && member.role !== 'ADMIN')
    return true;
  return false;
}

function canRemove(member: BoardMember): boolean {
  if (member.userId === props.ownerId) return false;
  if (isOwner.value && member.userId !== props.currentUserId) return true;
  if (isAdmin.value && member.userId !== props.currentUserId && member.role !== 'ADMIN')
    return true;
  return false;
}

function assignableRoles(): { label: string; value: BoardRole }[] {
  if (isOwner.value) {
    return [
      { label: '管理員', value: 'ADMIN' },
      { label: '成員', value: 'MEMBER' },
      { label: '訪客', value: 'GUEST' },
    ];
  }
  return [
    { label: '成員', value: 'MEMBER' },
    { label: '訪客', value: 'GUEST' },
  ];
}

function displayRole(member: BoardMember): string {
  if (member.userId === props.ownerId) return '擁有者';
  const map: Record<string, string> = {
    ADMIN: '管理員',
    MEMBER: '成員',
    GUEST: '訪客',
  };
  return map[member.role] ?? member.role;
}

function toggleDropdown(member: BoardMember) {
  if (!canEdit(member)) return;
  if (activeMemberId.value === member.id) {
    closeDropdown();
    return;
  }

  activeMemberId.value = member.id;
  selectedIndex.value = 0;

  const btn = btnRefs.value.get(member.id);
  if (btn) {
    const rect = btn.getBoundingClientRect();
    dropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
    };
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.role-dropdown-menu') && !target.closest('.role-select-btn')) {
      closeDropdown();
    }
  }

  function handleScroll() {
    closeDropdown();
  }

  nextTick(() => {
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);

    document.querySelector<HTMLElement>('.role-dropdown-menu button')?.focus();
  });

  (window as any).__roleDropdownCleanup = () => {
    window.removeEventListener('click', handleClickOutside);
    window.removeEventListener('scroll', handleScroll, true);
  };
}

function closeDropdown() {
  activeMemberId.value = null;
  selectedIndex.value = -1;
  (window as any).__roleDropdownCleanup?.();
}

function handleRoleKeydown(e: KeyboardEvent) {
  const activeMember = members.value.find((m) => m.id === activeMemberId.value);
  if (!activeMember) return;

  const roles = assignableRoles();
  const total = roles.length + (canRemove(activeMember) ? 1 : 0);

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedIndex.value = (selectedIndex.value + 1) % total;
      break;
    case 'ArrowUp':
      e.preventDefault();
      selectedIndex.value = (selectedIndex.value - 1 + total) % total;
      break;
    case 'Enter':
      e.preventDefault();
      if (selectedIndex.value >= 0 && selectedIndex.value < roles.length) {
        changeRole(activeMember, roles[selectedIndex.value].value);
      } else if (canRemove(activeMember) && selectedIndex.value === roles.length) {
        confirmRemove(activeMember);
      }
      break;
    case 'Escape':
      e.preventDefault();
      e.stopPropagation();
      closeDropdown();
      break;
  }
}

async function changeRole(member: BoardMember, role: BoardRole) {
  closeDropdown();
  try {
    await boardsApi.updateMemberRole(props.boardId, member.userId, { role });
    member.role = role;
  } catch {
    // 錯誤由 axios interceptor 統一處理
  }
}

function confirmRemove(member: BoardMember) {
  closeDropdown();
  targetMember.value = member;
  showRemoveConfirm.value = true;
}

async function handleRemoveConfirm() {
  if (!targetMember.value) return;
  const member = targetMember.value;
  try {
    await boardsApi.removeMember(props.boardId, member.userId);
    members.value = members.value.filter((m) => m.id !== member.id);
  } catch {
    // error handled by axios interceptor
  } finally {
    showRemoveConfirm.value = false;
    targetMember.value = null;
  }
}

function handleRemoveCancel() {
  showRemoveConfirm.value = false;
  targetMember.value = null;
}

function handleClose() {
  if (showRemoveConfirm.value) return;
  if (activeMemberId.value !== null) {
    closeDropdown();
    return;
  }
  emit('close');
}

onMounted(async () => {
  loading.value = true;
  try {
    const res = await boardsApi.getMembers(props.boardId);
    members.value = res.data;
  } catch {
    members.value = [];
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <BaseModal :show="show" title="成員" max-width="max-w-lg" @close="handleClose">
    <div v-if="loading" class="flex items-center justify-center py-8">
      <span class="text-sm text-gray-600">載入中…</span>
    </div>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-100">
            <th class="text-left py-2 pl-4 pr-4 text-gray-1000 font-medium">名稱</th>
            <th class="text-left py-2 pr-4 text-gray-1000 font-medium">電子郵件</th>
            <th class="text-left py-2 pr-2 text-gray-1000 font-medium">角色</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="member in members"
            :key="member.id"
            class="border-b border-black/8 last:border-0"
          >
            <td class="py-2.5 pl-4 pr-4 text-gray-900">{{ member.user.name }}</td>
            <td class="py-2.5 pr-4 text-gray-900">{{ member.user.email }}</td>
            <td class="py-2.5 pr-2 text-gray-900">
              <!-- 可編輯 → 顯示可點擊的按鈕 + 下拉箭頭 -->
              <button
                v-if="canEdit(member)"
                :ref="
                  (el) => {
                    if (el) btnRefs.set(member.id, el as HTMLElement);
                  }
                "
                class="role-select-btn flex items-center gap-1 py-0.5 rounded-md cursor-pointer transition-colors whitespace-nowrap"
                @click.stop="toggleDropdown(member)"
              >
                {{ displayRole(member) }}
                <ChevronDown class="w-3 h-3 text-gray-900" :stroke-width="2" />
              </button>
              <!-- 不可編輯 → 純文字顯示 -->
              <span v-else class="py-0.5 whitespace-nowrap">{{ displayRole(member) }}</span>

              <!-- 透過 Teleport 把選單渲染到 body，避開 modal overflow -->
              <Teleport to="body">
                <div
                  v-if="activeMemberId === member.id"
                  :style="dropdownStyle"
                  class="role-dropdown-menu z-9999 bg-white border border-black/8 rounded-md shadow-lg flex flex-col py-1"
                  @keydown="handleRoleKeydown"
                  @mouseenter="selectedIndex = -1"
                >
                  <button
                    v-for="(opt, i) in assignableRoles()"
                    :key="opt.value"
                    :class="[
                      'text-left px-3 py-1.5 mx-2 my-1 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-1000 focus:outline-none whitespace-nowrap',
                      selectedIndex === i && 'bg-gray-100 text-gray-1000',
                    ]"
                    @click="changeRole(member, opt.value)"
                  >
                    {{ opt.label }}
                  </button>
                  <template v-if="canRemove(member)">
                    <button
                      :class="[
                        'text-left px-3 py-1.5 mx-2 my-1 rounded-md text-sm text-red-800 hover:bg-gray-100 whitespace-nowrap',
                        selectedIndex === assignableRoles().length && 'bg-red-50',
                      ]"
                      @click="confirmRemove(member)"
                    >
                      移除
                    </button>
                  </template>
                </div>
              </Teleport>
            </td>
          </tr>
          <tr v-if="members.length === 0">
            <td colspan="3" class="py-6 text-center text-sm text-gray-500">尚無成員</td>
          </tr>
        </tbody>
      </table>
    </div>
    <ConfirmDialog
      :show="showRemoveConfirm"
      title="移除成員"
      :message="`確定要將「${targetMember?.user.name ?? ''}」從看板中移除嗎？此操作無法撤銷。`"
      confirm-text="移除"
      @confirm="handleRemoveConfirm"
      @cancel="handleRemoveCancel"
    />
  </BaseModal>
</template>
