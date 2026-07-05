<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'
import AuthLayout from '../layouts/AuthLayout.vue'
import BaseInput from '../components/common/BaseInput.vue'
import BaseButton from '../components/common/BaseButton.vue'
import GoogleLoginButton from '../components/auth/GoogleLoginButton.vue'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToastStore()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errors = ref<{ email?: string; password?: string }>({})

function validate() {
  const e: typeof errors.value = {}
  if (!email.value) e.email = '請輸入 Email'
  if (!password.value) e.password = '請輸入密碼'
  errors.value = e
  return Object.keys(e).length === 0
}

async function handleLogin() {
  if (!validate()) return

  loading.value = true
  errors.value = {}
  try {
    await authStore.login({ email: email.value, password: password.value })
    router.push('/boards')
  } catch (err: any) {
    const message = err.response?.data?.message
    if (Array.isArray(message)) {
      toast.error(message.join(', '))
    } else if (typeof message === 'string') {
      toast.error(message)
    } else {
      toast.error('登入失敗，請稍後再試')
    }
  } finally {
    loading.value = false
  }
}

async function handleGoogleLogin(credential: string) {
  loading.value = true
  try {
    await authStore.googleLogin({ credential })
    router.push('/boards')
  } catch (err: any) {
    const message = err.response?.data?.message
    toast.error(typeof message === 'string' ? message : 'Google 登入失敗')
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
          登入
        </h1>
        <p class="text-gray-900 copy-14">
          歡迎回來，請輸入您的帳號密碼
        </p>
      </div>

      <form class="space-y-5" @submit.prevent="handleLogin">
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
          登入
        </BaseButton>
      </form>

      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-black/8" />
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-4 bg-bg-100 text-gray-700">or</span>
        </div>
      </div>

      <GoogleLoginButton
        @credential="handleGoogleLogin"
        @error="(msg) => toast.error(msg)"
      />

      <p class="text-sm text-center text-gray-700 copy-14">
        還沒有帳號？
        <router-link
          to="/register"
          class="font-medium text-blue-700 hover:text-blue-800"
        >
          註冊
        </router-link>
      </p>
    </div>
  </AuthLayout>
</template>
