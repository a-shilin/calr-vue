<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-brand">
        CalRepository
      </div>
      <TabNav />
    </header>
    <main class="app-content">
      <router-view />
    </main>
  </div>
</template>

<script>
import TabNav from './components/TabNav.vue'

export default {
  name: 'App',
  components: {
    TabNav,
  },
}
</script>
