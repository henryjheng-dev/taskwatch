<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import AuthLayout from '../layouts/AuthLayout.vue';
import BaseInput from '../components/common/BaseInput.vue';
import BaseButton from '../components/common/BaseButton.vue';
import GoogleLoginButton from '../components/auth/GoogleLoginButton.vue';

const router = useRouter();
const authStore = useAuthStore();
const toast = useToastStore();

const email = ref('');
const password = ref('');
const loading = ref(false);
const errors = ref<{ email?: string; password?: string }>({});

function validate() {
  const e: typeof errors.value = {};
  if (!email.value) e.email = '請輸入 Email';
  if (!password.value) e.password = '請輸入密碼';
  errors.value = e;
  return Object.keys(e).length === 0;
}

async function handleLogin() {
  if (!validate()) return;

  loading.value = true;
  errors.value = {};
  try {
    await authStore.login({ email: email.value, password: password.value });
    router.push('/boards');
  } catch (err: any) {
    const message = err.response?.data?.message;
    if (Array.isArray(message)) {
      toast.error(message.join(', '));
    } else if (typeof message === 'string') {
      toast.error(message);
    } else {
      toast.error('登入失敗，請稍後再試');
    }
  } finally {
    loading.value = false;
  }
}

async function handleGoogleLogin(credential: string) {
  loading.value = true;
  try {
    await authStore.googleLogin({ credential });
    router.push('/boards');
  } catch (err: any) {
    const message = err.response?.data?.message;
    toast.error(typeof message === 'string' ? message : 'Google 登入失敗');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout :image-placeholder="false" left-panel-width="lg:w-[45%]">
    <!-- 左側圖片區塊 (加上 relative 與適當 padding) -->
    <template #image>
      <div class="relative w-full h-full p-4 lg:p-6">
        <div class="w-full h-full rounded-2xl overflow-hidden relative shadow-inner bg-gray-50">
          <img
            src="/loginBg.jpg"
            alt="Login Background"
            class="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      </div>
    </template>

    <!-- 右側表單區塊 (讓寬度更加大氣) -->
    <div class="w-full max-w-md mx-auto space-y-6">
      <!-- 標題區 -->
      <div class="space-y-2">
        <h1 class="text-3xl font-bold tracking-tight text-gray-900">登入</h1>
        <p class="text-gray-700 text-base">歡迎回來！快進來坐 ～</p>
      </div>

      <!-- 表單區 -->
      <form class="space-y-4" @submit.prevent="handleLogin">
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

        <BaseButton type="submit" variant="primary" size="lg" :loading="loading" class="w-full">
          登入
        </BaseButton>
      </form>

      <!-- 分隔線 -->
      <div class="relative py-2">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-400" />
        </div>
        <div class="relative flex justify-center text-xs uppercase">
          <span class="px-3 bg-white text-gray-700">or</span>
        </div>
      </div>

      <!-- 第三方登入 -->
      <GoogleLoginButton @credential="handleGoogleLogin" @error="(msg) => toast.error(msg)" />

      <!-- 頁尾引導連結 -->
      <p class="text-sm text-gray-700 text-center pt-2">
        還沒有帳號？
        <router-link to="/register" class="font-semibold text-gray-900 hover:underline">
          註冊
        </router-link>
      </p>
    </div>
  </AuthLayout>
</template>
