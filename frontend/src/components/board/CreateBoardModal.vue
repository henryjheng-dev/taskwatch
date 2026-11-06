<script setup lang="ts">
import { ref } from 'vue';
import BaseModal from '../common/BaseModal.vue';
import BaseInput from '../common/BaseInput.vue';
import BaseButton from '../common/BaseButton.vue';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
  created: [boardId: number];
}>();

const name = ref('');
const loading = ref(false);
const error = ref('');

function reset() {
  name.value = '';
  loading.value = false;
  error.value = '';
}

async function handleCreate() {
  if (!name.value.trim()) {
    error.value = '請輸入看板名稱';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    const { boardsApi } = await import('../../api');
    // console.log(boardsApi.create);
    const res = await boardsApi.create({
      name: name.value.trim(),
    });
    emit('created', res.data.id);
    reset();
  } catch (err: any) {
    const msg = err.response?.data?.message;
    error.value = Array.isArray(msg) ? msg.join(', ') : msg || '建立看板失敗';
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  reset();
  emit('close');
}
</script>

<template>
  <BaseModal :show="show" title="Create Board" max-width="max-w-sm" @close="handleClose">
    <div class="space-y-5">
      <BaseInput v-model="name" label="Board name" placeholder="My new project" :error="error" />

      <div class="flex justify-end gap-3">
        <BaseButton variant="tertiary" @click="handleClose">Cancel</BaseButton>
        <BaseButton variant="primary" :loading="loading" @click="handleCreate">Create</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
