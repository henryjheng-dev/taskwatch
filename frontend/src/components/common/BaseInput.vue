<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: string
  type?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  label?: string
}>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <div class="space-y-1">
    <label v-if="label" class="block text-sm font-medium text-gray-1000">
      {{ label }}
    </label>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="block w-full h-10 px-3 bg-white text-gray-1000 text-sm rounded-sm border transition-all duration-150 placeholder:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-700"
      :class="[
        error
          ? 'border-red-400 focus-visible:ring-red-700'
          : 'border-black/8 hover:border-black/10 focus-visible:border-black/12',
      ]"
      @input="onInput"
    />
    <p v-if="error" class="text-sm text-red-800">{{ error }}</p>
  </div>
</template>
