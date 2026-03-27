import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AccountView from '../views/AccountView.vue'
import AnalysisView from '../views/AnalysisView.vue'
import CommunityView from '../views/CommunityView.vue'

const routes = [
  { path: '/', name: 'dashboard', component: HomeView },
  { path: '/account', name: 'account', component: AccountView },
  { path: '/analysis', name: 'analysis', component: AnalysisView },
  { path: '/community', name: 'community', component: CommunityView },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
