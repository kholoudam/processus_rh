import { createApp } from 'vue'
import App from './App.vue'

// CSS GLOBAL (corrige ton problème d'espace aussi)
import './style.css'

// Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css'

// IMPORTANT 👉 Bootstrap JS (modal, dropdown, etc.)
import * as bootstrap from 'bootstrap/dist/js/bootstrap.bundle'

// Rendre bootstrap accessible globalement (pour ton modal)
window.bootstrap = bootstrap

createApp(App).mount('#app')