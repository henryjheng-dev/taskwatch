<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  credential: [token: string]
  error: [message: string]
}>()

const loaded = ref(false)
const loadError = ref(false)

let scriptEl: HTMLScriptElement | null = null

function handleCredentialResponse(response: { credential: string }) {
  if (response.credential) {
    emit('credential', response.credential)
  } else {
    emit('error', 'Google 登入失敗')
  }
}

onMounted(() => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    loadError.value = true
    return
  }

  ;(window as any).onGoogleLibraryLoad = () => {
    ;(window as any).google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
    })
    ;(window as any).google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      { type: 'standard', shape: 'rectangular', size: 'large', width: 300 },
    )
    loaded.value = true
  }

  scriptEl = document.createElement('script')
  scriptEl.src = 'https://accounts.google.com/gsi/client'
  scriptEl.async = true
  scriptEl.defer = true
  scriptEl.onerror = () => {
    loadError.value = true
  }
  document.head.appendChild(scriptEl)
})

onUnmounted(() => {
  if (scriptEl) {
    document.head.removeChild(scriptEl)
  }
  delete (window as any).onGoogleLibraryLoad
})
</script>

<template>
  <div>
    <div v-if="loadError" class="text-sm text-red-800 text-center">
      Google 登入載入失敗
    </div>
    <div
      id="google-signin-button"
      class="min-h-10 flex items-center justify-center"
      :class="{ 'opacity-0': !loaded }"
    />
  </div>
</template>
