<script setup lang="ts">
import { LogOut } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import BaseDropdown from './BaseDropdown.vue'

const router = useRouter()
const authStore = useAuthStore()

async function handleLogout() {
  try {
    await authStore.logout()
  } finally {
    router.push('/login')
  }
}
</script>

<template>
  <BaseDropdown>
    <template #trigger="{ toggle }">
      <button
        class="w-8 h-8 rounded-full bg-gray-1000 text-white text-sm font-medium leading-none flex items-center justify-center hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        @click.stop="toggle"
      >
        {{ authStore.user?.name.charAt(0).toUpperCase() }}
      </button>
    </template>
    <template #dropdown>
      <div class="px-4 py-2 border-b border-black/8">
        <p class="text-sm font-medium text-gray-1000 leading-5">{{ authStore.user?.name }}</p>
        <p class="text-xs text-gray-600 leading-4 mt-0.5">{{ authStore.user?.email }}</p>
      </div>
      <button
        class="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-900 hover:bg-black/5 transition-colors"
        @click="handleLogout"
      >
        <LogOut class="w-4 h-4" :stroke-width="1.5" />
        登出
      </button>
    </template>
  </BaseDropdown>
</template>
