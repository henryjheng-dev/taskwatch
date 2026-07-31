<script setup lang="ts">
import UserMenu from './UserMenu.vue';
import logo from '../../assets/logo.jpg';
</script>

<template>
  <header
    class="sticky top-0 z-10 h-16 bg-white border-b border-black/8 flex items-center justify-between px-6 shrink-0"
  >
    <router-link to="/boards" class="flex items-center gap-2">
      <img :src="logo" alt="TaskWatch" class="h-8 rounded-lg" />
      <span class="text-sm font-bold tracking-tight text-gray-1000">TaskWatch</span>
    </router-link>

    <div class="flex items-center gap-3">
      <slot />
      <UserMenu />
    </div>
  </header>
</template>
