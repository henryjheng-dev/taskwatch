import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/boards',
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('../views/Register.vue'),
    },
    {
      path: '/boards',
      name: 'BoardList',
      component: () => import('../views/BoardList.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/boards/:id',
      name: 'BoardDetail',
      component: () => import('../views/BoardDetail.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/403',
      name: 'Forbidden',
      component: () => import('../views/Forbidden.vue'),
    },
  ],
});

// 1. 移除了參數中的 next，只保留 (to, _from)
router.beforeEach((to, _from) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // 2. 原本的 next({ name: 'Login' }) 改成直接 return
    return { name: 'Login' };
  }

  if (to.name === 'Login' && authStore.isAuthenticated) {
    // 3. 原本的 next({ name: 'BoardList' }) 改成直接 return
    return { name: 'BoardList' };
  }

  // 4. 原本放行的 next() 改成 return true (或者什麼都不寫也可以)
  return true;
});

export default router;
