<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '../common/BaseModal.vue'
import BaseButton from '../common/BaseButton.vue'

const props = defineProps<{
  show: boolean
  remaining?: number
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  generate: [prompt: string]
}>()

const prompt = ref('')
const MAX_LENGTH = 500

function handleSubmit() {
  const text = prompt.value.trim()
  if (!text) return
  emit('generate', text)
}

function handleClose() {
  prompt.value = ''
  emit('close')
}
</script>

<template>
  <BaseModal :show="show" title="Generate Board with AI" max-width="max-w-md" @close="handleClose">
    <div class="space-y-4">
      <p class="text-sm text-gray-700 leading-5">
        Describe the project you want to manage, and AI will create a board with columns and tasks for you.
      </p>

      <div class="space-y-1">
        <textarea
          v-model="prompt"
          :maxlength="MAX_LENGTH"
          rows="4"
          placeholder="e.g. Build an e-commerce website with Vue and NestJS..."
          class="block w-full px-3 py-2 bg-white text-gray-1000 text-sm rounded-sm border border-black/8 transition-colors placeholder:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white resize-none"
        />
        <div class="flex justify-between text-xs text-gray-700">
          <span v-if="remaining !== undefined">{{ remaining }} / 5 remaining today</span>
          <span>{{ prompt.length }} / {{ MAX_LENGTH }}</span>
        </div>
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <BaseButton variant="tertiary" @click="handleClose">Cancel</BaseButton>
        <BaseButton
          variant="primary"
          :disabled="!prompt.trim()"
          :loading="loading"
          @click="handleSubmit"
        >
          Generate
        </BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
