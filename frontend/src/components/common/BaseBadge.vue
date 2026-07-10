<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'priority-low' | 'priority-medium' | 'priority-high' | 'custom'
  color?: string
}>(), {
  variant: 'priority-medium',
  color: '',
})

const variantClasses: Record<string, string> = {
  'priority-low': 'bg-gray-100 text-gray-700',
  'priority-medium': 'bg-blue-100 text-blue-700',
  'priority-high': 'bg-red-100 text-red-700',
}
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-light leading-relaxed"
    :class="variantClasses[variant] || ''"
    :style="variant === 'custom' && color ? { backgroundColor: color + '20', color: color } : {}"
  >
    <slot />
  </span>
</template>
