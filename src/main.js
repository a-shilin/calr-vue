import { createApp } from 'vue'
import { BBadge, BButton, BSpinner, BTable, createBootstrap } from 'bootstrap-vue-next'
import App from './App.vue'
import router from './router'
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue-next/dist/bootstrap-vue-next.css'
import './styles/app.css'

const app = createApp(App)

app.use(router)
app.use(createBootstrap())
app.component('BButton', BButton)
app.component('BSpinner', BSpinner)
app.component('BTable', BTable)
app.component('BBadge', BBadge)
app.mount('#app')
