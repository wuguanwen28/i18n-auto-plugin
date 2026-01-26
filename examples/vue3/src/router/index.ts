import { createRouter, createWebHashHistory } from 'vue-router'

export const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { title: '首页' },
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('../views/About.tsx'),
    meta: { title: '关于' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes: routes,
})

export { router }
