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

router.beforeEach((to, _from) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'Login' };
  }

  if (to.name === 'Login' && authStore.isAuthenticated) {
    return { name: 'BoardList' };
  }
  return true;
});

export default router;
