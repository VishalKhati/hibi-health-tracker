import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { startAppUpdates } from './services/appUpdate'

startAppUpdates()
createApp(App).mount('#app')
