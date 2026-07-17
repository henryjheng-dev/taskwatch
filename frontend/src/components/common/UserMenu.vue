<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const showUserMenu = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)

function onDocumentClick(e: MouseEvent) {
  if (userMenuRef.value && !userMenuRef.value.contains(e.target as Node)) {
    showUserMenu.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

async function handleLogout() {
  showUserMenu.value = false
  try {
    await authStore.logout()
  } finally {
    router.push('/login')
  }
}
</script>

<template>
  <div ref="userMenuRef" class="relative">
    <button
      class="w-8 h-8 rounded-full bg-gray-1000 text-white text-sm font-medium leading-none flex items-center justify-center hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      @click.stop="showUserMenu = !showUserMenu"
    >
      {{ authStore.user?.name.charAt(0).toUpperCase() }}
    </button>

    <Transition name="dropdown">
      <div
        v-if="showUserMenu"
        class="absolute right-0 top-full mt-2 w-48 bg-white border border-black/8 rounded-lg shadow-lg py-2 z-50"
      >
        <div class="px-4 py-2 border-b border-black/8">
          <p class="text-sm font-medium text-gray-1000 leading-5">{{ authStore.user?.name }}</p>
          <p class="text-xs text-gray-600 leading-4 mt-0.5">{{ authStore.user?.email }}</p>
        </div>
        <button
          class="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-900 hover:bg-black/5 transition-colors"
          @click="handleLogout"
        >
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          登出
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
