<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '../common/BaseModal.vue'
import BaseInput from '../common/BaseInput.vue'
import BaseButton from '../common/BaseButton.vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  created: [boardId: number]
}>()

const name = ref('')
const selectedColor = ref('#0079BF')
const loading = ref(false)
const error = ref('')

const colors = [
  { value: '#0079BF', label: 'Blue' },
  { value: '#D29034', label: 'Orange' },
  { value: '#519839', label: 'Green' },
  { value: '#B04632', label: 'Red' },
  { value: '#89609E', label: 'Purple' },
]

function reset() {
  name.value = ''
  selectedColor.value = '#0079BF'
  loading.value = false
  error.value = ''
}

async function handleCreate() {
  if (!name.value.trim()) {
    error.value = '請輸入看板名稱'
    return
  }

  loading.value = true
  error.value = ''
  try {
    const { boardsApi } = await import('../../api')
    const res = await boardsApi.create({
      name: name.value.trim(),
      backgroundColor: selectedColor.value,
    })
    emit('created', res.data.data.id)
    reset()
  } catch (err: any) {
    const msg = err.response?.data?.message
    error.value = Array.isArray(msg) ? msg.join(', ') : msg || '建立看板失敗'
  } finally {
    loading.value = false
  }
}

function handleClose() {
  reset()
  emit('close')
}
</script>

<template>
  <BaseModal :show="show" title="Create Board" max-width="max-w-sm" @close="handleClose">
    <div class="space-y-5">
      <BaseInput
        v-model="name"
        label="Board name"
        placeholder="My new project"
        :error="error"
      />

      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-1000">Background</label>
        <div class="flex gap-2">
          <button
            v-for="c in colors"
            :key="c.value"
            :title="c.label"
            class="w-8 h-8 rounded-sm border-2 transition-all"
            :class="selectedColor === c.value ? 'border-gray-1000 scale-110' : 'border-transparent'"
            :style="{ backgroundColor: c.value }"
            @click="selectedColor = c.value"
          />
        </div>
      </div>

      <div class="flex justify-end gap-3">
        <BaseButton variant="tertiary" @click="handleClose">Cancel</BaseButton>
        <BaseButton variant="primary" :loading="loading" @click="handleCreate">Create</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
