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
export default {
  name: 'TabNav',
  data() {
    return {
      tabs: [
        { name: 'dashboard', label: 'Home', to: '/' },
        { name: 'analysis', label: 'Analysis', to: '/analysis' },
        { name: 'community', label: 'Community', to: '/community' },
      ],
    }
  },
}
</script>
