<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  open: []
  close: []
}>()

defineSlots<{
  trigger(props: { toggle: () => void; isOpen: boolean }): any
  dropdown(props: { close: () => void }): any
}>()

const isOpen = ref(false)
const elRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)

const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function onDocumentClick(e: MouseEvent) {
  if (elRef.value && !elRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

function toggle() { isOpen.value = !isOpen.value }
function close()  { isOpen.value = false }

function focusableItems(): HTMLElement[] {
  if (!menuRef.value) return []
  return Array.from(menuRef.value.querySelectorAll<HTMLElement>(focusableSelector))
}

function focusIndex(dir: -1 | 1) {
  const items = focusableItems()
  if (items.length === 0) return
  const current = document.activeElement
  const idx = items.indexOf(current as HTMLElement)
  const next = (idx + dir + items.length) % items.length
  items[next].focus()
}

function onKeydown(e: KeyboardEvent) {
  if (!isOpen.value) return
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      focusIndex(1)
      break
    case 'ArrowUp':
      e.preventDefault()
      focusIndex(-1)
      break
    case 'Escape':
      e.preventDefault()
      close()
      break
  }
}

watch(isOpen, async (v) => {
  if (v) {
    emit('open')
    await nextTick()
    const items = focusableItems()
    if (items.length > 0) items[0].focus()
  } else {
    emit('close')
  }
})

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="elRef" class="relative">
    <slot name="trigger" :toggle="toggle" :is-open="isOpen" />
    <div
      v-if="isOpen"
      ref="menuRef"
      class="absolute right-0 top-full mt-2 bg-white border border-black/8 rounded-lg shadow-lg z-50"
    >
      <slot name="dropdown" :close="close" />
    </div>
  </div>
</template>
