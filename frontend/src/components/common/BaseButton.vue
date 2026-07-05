<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'tertiary' | 'error';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit';
  }>(),
  {
    variant: 'primary',
    size: 'md',
    loading: false,
    disabled: false,
    type: 'button',
  },
);

const emit = defineEmits<{
  click: [e: MouseEvent];
}>();
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="relative inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-700"
    :class="[
      variant === 'primary' && 'bg-gray-1000 text-white hover:bg-gray-900 active:bg-gray-800',
      variant === 'secondary' &&
        'bg-white text-gray-1000 border border-gray-alpha-400 hover:border-gray-500 active:border-gray-600',
      variant === 'tertiary' &&
        'bg-transparent text-gray-1000 hover:bg-gray-alpha-100 active:bg-gray-alpha-200',
      variant === 'error' && 'bg-red-800 text-white hover:bg-red-700 active:bg-red-600',
      size === 'sm' && 'h-8 px-1.5 text-sm rounded-sm',
      size === 'md' && 'h-10 px-2.5 text-sm rounded-sm',
      size === 'lg' && 'h-12 px-3.5 text-base rounded-sm',
    ]"
    :style="variant === 'secondary' ? { borderColor: 'rgba(0,0,0,0.08)' } : {}"
    @click="emit('click', $event)"
  >
    <svg v-if="loading" class="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
    <slot />
  </button>
</template>
