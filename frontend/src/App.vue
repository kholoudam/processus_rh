<template>
  <div class="app-layout">

    <!-- ========== SIDEBAR ========== -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <span>🏢</span> RH Manager
      </div>

      <nav class="sidebar-nav">
        <ul>
          <li
            :class="{ active: currentPage === 'dashboard' }"
            @click="currentPage = 'dashboard'"
          >
            <span class="icon">📋</span> Candidats
          </li>
          <li
            :class="{ active: currentPage === 'matching' }"
            @click="currentPage = 'matching'"
          >
            <span class="icon">🎯</span> Matching
          </li>
          <li
            :class="{ active: currentPage === 'admis' }"
            @click="currentPage = 'admis'"
          >
            <span class="icon">✅</span> Admis
          </li>
          <li
            :class="{ active: currentPage === 'refuses' }"
            @click="currentPage = 'refuses'"
          >
            <span class="icon">❌</span> Refusés
          </li>
          <li
            :class="{ active: currentPage === 'jobs' }"
            @click="currentPage = 'jobs'"
          >
            <span class="icon">💼</span> Postes
          </li>
        </ul>
      </nav>
    </aside>

    <!-- ========== CONTENU PRINCIPAL ========== -->
    <main class="main-content">
      <Dashboard :currentPage="currentPage" />
    </main>

  </div>
</template>

<script>
import Dashboard from './components/Dashboard.vue'

export default {
  name: 'App',
  components: { Dashboard },
  data() {
    return {
      currentPage: 'dashboard'  // ← état centralisé ici, contrôle toute la navigation
    }
  }
}
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', sans-serif; background: #f3f4f6; }

.app-layout {
  display: flex;
  min-height: 100vh;
}

/* ── Sidebar ── */
.sidebar {
  width: 230px;
  min-height: 100vh;
  background: #1f2937;
  color: white;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: fixed;
  top: 0; left: 0;
  z-index: 100;
}

.sidebar-logo {
  padding: 24px 20px 18px;
  font-size: 18px;
  font-weight: 700;
  border-bottom: 1px solid #374151;
  letter-spacing: 0.5px;
}

.sidebar-nav ul {
  list-style: none;
  padding: 12px 0;
}

.sidebar-nav li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 22px;
  cursor: pointer;
  font-size: 15px;
  color: #d1d5db;
  transition: background 0.18s, color 0.18s;
  border-left: 3px solid transparent;
}

.sidebar-nav li:hover {
  background: #374151;
  color: white;
}

.sidebar-nav li.active {
  background: #374151;
  color: white;
  border-left: 3px solid #60a5fa;
  font-weight: 600;
}

.sidebar-nav .icon { font-size: 17px; }

/* ── Main content ── */
.main-content {
  margin-left: 230px;
  flex: 1;
  min-height: 100vh;
}
</style>