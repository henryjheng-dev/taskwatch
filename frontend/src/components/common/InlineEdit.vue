<script setup lang="ts">
import { ref, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  editClass?: string
}>(), {
  editClass: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editing = ref(false)
const editValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

function startEdit() {
  editValue.value = props.modelValue
  editing.value = true
  nextTick(() => inputRef.value?.select())
}

function save() {
  if (!editing.value) return
  editing.value = false
  const trimmed = editValue.value.trim()
  if (trimmed && trimmed !== props.modelValue) {
    emit('update:modelValue', trimmed)
  }
}

function cancel() {
  editing.value = false
}
</script>

<template>
  <input
    v-if="editing"
    ref="inputRef"
    :value="editValue"
    :class="editClass"
    @input="editValue = ($event.target as HTMLInputElement).value"
    @blur="save"
    @keydown.enter="save"
    @keydown.escape.prevent="cancel"
  />
  <span v-else class="cursor-pointer select-none" @click="startEdit">
    <slot />
  </span>
</template>
