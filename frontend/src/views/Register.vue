<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'
import AuthLayout from '../layouts/AuthLayout.vue'
import BaseInput from '../components/common/BaseInput.vue'
import BaseButton from '../components/common/BaseButton.vue'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToastStore()

const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const errors = ref<{ name?: string; email?: string; password?: string }>({})

function validate() {
  const e: typeof errors.value = {}
  if (!name.value || name.value.length < 2) e.name = '姓名至少 2 個字'
  if (!email.value) e.email = '請輸入 Email'
  if (!password.value || password.value.length < 8) e.password = '密碼至少 8 個字'
  errors.value = e
  return Object.keys(e).length === 0
}

async function handleRegister() {
  if (!validate()) return

  loading.value = true
  errors.value = {}
  try {
    await authStore.register({ name: name.value, email: email.value, password: password.value })
    router.push('/boards')
  } catch (err: any) {
    const message = err.response?.data?.message
    if (Array.isArray(message)) {
      toast.error(message.join(', '))
    } else if (typeof message === 'string') {
      toast.error(message)
    } else {
      toast.error('註冊失敗，請稍後再試')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <div class="space-y-8">
      <div class="space-y-2">
        <h1 class="text-4xl font-semibold tracking-tight text-gray-1000 heading-40">
          註冊
        </h1>
        <p class="text-gray-900 copy-14">
          建立您的帳號，開始管理專案
        </p>
      </div>

      <form class="space-y-5" @submit.prevent="handleRegister">
        <BaseInput
          v-model="name"
          label="Name"
          placeholder="王小明"
          :error="errors.name"
        />

        <BaseInput
          v-model="email"
          type="email"
          label="Email"
          placeholder="user@example.com"
          :error="errors.email"
        />

        <BaseInput
          v-model="password"
          type="password"
          label="Password"
          placeholder="********"
          :error="errors.password"
        />

        <BaseButton
          type="submit"
          variant="primary"
          size="lg"
          :loading="loading"
          class="w-full"
        >
          註冊
        </BaseButton>
      </form>

      <p class="text-sm text-center text-gray-700 copy-14">
        已經有帳號了？
        <router-link
          to="/login"
          class="font-medium text-blue-700 hover:text-blue-800"
        >
          登入
        </router-link>
      </p>
    </div>
  </AuthLayout>
</template>
