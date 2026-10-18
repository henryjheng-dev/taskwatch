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

// IME 組字狀態：組字期間 Enter／Escape 是「選字／取消選字」，不可觸發儲存或取消編輯
const isComposing = ref(false)

function onCompositionStart() {
  isComposing.value = true
}

function onCompositionEnd() {
  isComposing.value = false
}

function onEnterKey(e: KeyboardEvent) {
  if (isComposing.value || e.isComposing || e.keyCode === 229) return
  save()
}

function onEscapeKey(e: KeyboardEvent) {
  if (isComposing.value || e.isComposing || e.keyCode === 229) return
  e.preventDefault()
  cancel()
}

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
    @compositionstart="onCompositionStart"
    @compositionend="onCompositionEnd"
    @blur="save"
    @keydown.enter="onEnterKey"
    @keydown.escape="onEscapeKey"
  />
  <span v-else class="cursor-pointer select-none" @click="startEdit">
    <slot />
  </span>
</template>
