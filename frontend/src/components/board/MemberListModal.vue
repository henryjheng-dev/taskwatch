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

// ─── 角色下拉選單狀態 ──────────────────────────────────────────
// activeMemberId：目前哪個成員的 dropdown 開啟（null = 全部關閉）
// selectedIndex：鍵盤方向鍵選中的項目索引（-1 = 無選中，滑鼠優先）
// btnRefs：儲存每個角色按鈕的 DOM 參考，用來計算定位
// dropdownStyle：計算後的 fixed 定位，透過 Teleport 寫入 style
const activeMemberId = ref<number | null>(null);
const selectedIndex = ref(-1);
const btnRefs = ref<Map<number, HTMLElement>>(new Map());
const dropdownStyle = ref<Record<string, string>>({});

// ─── 當前使用者在看板中的角色資訊 ────────────────────────────────
const currentMember = computed(() => members.value.find((m) => m.userId === props.currentUserId));
const isOwner = computed(() => props.currentUserId === props.ownerId);
const isAdmin = computed(() => currentMember.value?.role === 'ADMIN');

// ─── 判斷是否可以編輯指定成員的角色 ──────────────────────────────
// Owner：不可編輯自己，其他都可以
// Admin：不可編輯自己、擁有者、其他 Admin，只能編輯 Member / Guest
// Member / Guest：全部不可編輯
function canEdit(member: BoardMember): boolean {
  if (member.userId === props.ownerId) return false;
  if (isOwner.value) return true;
  if (isAdmin.value && member.userId !== props.currentUserId && member.role !== 'ADMIN')
    return true;
  return false;
}

// ─── 判斷是否可以移除指定成員 ────────────────────────────────────
// Owner：可移除所有人（除了自己）
// Admin：可移除 MEMBER / GUEST（不可移除 ADMIN、Owner、自己）
// Member / Guest：全部不可移除
function canRemove(member: BoardMember): boolean {
  if (member.userId === props.ownerId) return false;
  if (isOwner.value && member.userId !== props.currentUserId) return true;
  if (isAdmin.value && member.userId !== props.currentUserId && member.role !== 'ADMIN')
    return true;
  return false;
}

// ─── 取得可指派的角色清單 ──────────────────────────────────────
// Owner 可指派全部三種角色
// Admin 只能指派 MEMBER 和 GUEST
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

// ─── 角色 enum 轉中文顯示 ──────────────────────────────────────
function displayRole(member: BoardMember): string {
  if (member.userId === props.ownerId) return '擁有者';
  const map: Record<string, string> = {
    ADMIN: '管理員',
    MEMBER: '成員',
    GUEST: '訪客',
  };
  return map[member.role] ?? member.role;
}

// ─── 開啟 / 關閉角色下拉選單 ────────────────────────────────────
// 計算按鈕位置 → 設定 fixed 定位 → 動態掛載全域 listener
function toggleDropdown(member: BoardMember) {
  if (!canEdit(member)) return;

  // 如果同一個成員再次點擊，關閉選單
  if (activeMemberId.value === member.id) {
    closeDropdown();
    return;
  }

  activeMemberId.value = member.id;
  selectedIndex.value = 0;

  // 用 getBoundingClientRect 計算按鈕在視口中的位置
  const btn = btnRefs.value.get(member.id);
  if (btn) {
    const rect = btn.getBoundingClientRect();
    dropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
    };
  }

  // ─── Click Outside：點擊選單外部時關閉 ──────────────────────
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.role-dropdown-menu') && !target.closest('.role-select-btn')) {
      closeDropdown();
    }
  }

  // ─── Scroll：Modal 內部滾動時關閉，避免選單飄走 ─────────────
  function handleScroll() {
    closeDropdown();
  }

  // 延遲掛載，避免本次點擊事件觸發 click outside
  nextTick(() => {
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);

    // 將焦點移到第一個選項，讓後續鍵盤事件能被 dropdown 的 @keydown 捕捉
    document.querySelector<HTMLElement>('.role-dropdown-menu button')?.focus();
  });

  // 儲存 listener 參考以便移除
  (window as any).__roleDropdownCleanup = () => {
    window.removeEventListener('click', handleClickOutside);
    window.removeEventListener('scroll', handleScroll, true);
  };
}

// ─── 關閉下拉選單 ──────────────────────────────────────────────
// 清除 active 狀態 + 移除全域 listener
function closeDropdown() {
  activeMemberId.value = null;
  selectedIndex.value = -1;
  (window as any).__roleDropdownCleanup?.();
}

// ─── 角色下拉選單鍵盤導覽 ─────────────────────────────────────
// ArrowUp / ArrowDown 循環切換 selectedIndex
// Escape 關閉選單
// 滑鼠移入時 selectedIndex = -1，hover 優先於鍵盤高亮
// 掛在 container (@keydown) 上而非全域 listener，DOM 移除時自動失效
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

// ─── 執行角色變更 ──────────────────────────────────────────────
// 關閉選單 → 呼叫 API → 成功後本端更新（不需通知 parent re-fetch）
async function changeRole(member: BoardMember, role: BoardRole) {
  closeDropdown();
  try {
    await boardsApi.updateMemberRole(props.boardId, member.userId, { role });
    member.role = role;
  } catch {
    // 錯誤由 axios interceptor 統一處理
  }
}

// ─── 移除成員（二次確認 + Optimistic UI）────────────────────────
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

// ─── Modal 關閉時一併清除 dropdown ─────────────────────────────
// 如果 dropdown 開啟中，優先關閉 dropdown 而非 modal
function handleClose() {
  if (showRemoveConfirm.value) return;
  if (activeMemberId.value !== null) {
    closeDropdown();
    return;
  }
  emit('close');
}

// ─── 首次開啟 Modal 時載入成員資料 ──────────────────────────────
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
