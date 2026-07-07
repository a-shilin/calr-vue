<template>
  <nav class="tab-nav">
    <div class="tab-nav__primary">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.name"
        :to="tab.to"
        class="tab-link"
        :class="{ active: $route.name === tab.name }"
      >
        {{ tab.label }}
      </RouterLink>
    </div>

    <div class="tab-nav__account">
      <div v-if="store.auth.token" style="display:flex; flex-direction: column; align-items: flex-end; justify-content: center;">
        <a role="button" @click="handleLogout" style="font-size:11px; line-height: 11px;">Logout</a>
        <strong>{{ store.auth.userInfo?.user?.username }}</strong>
      </div>
      <RouterLink
        to="/account"
        class="tab-link"
        :class="{ active: $route.name === 'account' }"
      >
        Account
      </RouterLink>
    </div>
  </nav>
</template>

<script>
import { appStore } from '../store/appStore'
export default {
  name: 'TabNav',
  data() {
    return {
      store: appStore,
      tabs: [
        { name: 'dashboard', label: 'Home', to: '/' },
        { name: 'analysis', label: 'Analysis', to: '/analysis' },
        { name: 'community', label: 'Community', to: '/community' },
      ],
    }
  },
  methods:{
    handleLogout() {
      this.store.auth.password = ''
      this.store.auth.message = ''
      this.store.auth.token = null
      this.store.auth.userInfo = null
      this.store.account.userCreatingNew = false
      this.store.account.userFiles = []
      this.store.auth.mode = 'login'
    },
  }
}
</script>
