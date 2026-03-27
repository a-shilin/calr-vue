<template>
  <nav class="tab-nav">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.name"
      :to="tab.to"
      class="tab-link"
      :class="{ active: $route.name === tab.name }"
    >
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>

<script>
export default {
  name: 'TabNav',
  data() {
    return {
      tabs: [
        { name: 'dashboard', label: 'Home', to: '/' },
        { name: 'account', label: 'Account', to: '/account' },
        { name: 'analysis', label: 'Analysis', to: '/analysis' },
        { name: 'community', label: 'Community', to: '/community' },
      ],
    }
  },
}
</script>
