<template>
  <div class="app-layout">

    <!-- SIDEBAR -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        🏢 RH Manager
      </div>

      <nav class="sidebar-nav">
        <ul>
          <li
            :class="{ active: currentPage === 'dashboard' }"
            @click="currentPage = 'dashboard'"
          >
            Dashboard
          </li>

          <li
            :class="{ active: currentPage === 'candidates' }"
            @click="currentPage = 'candidates'"
          >
            Candidats
          </li>

          <li
            :class="{ active: currentPage === 'matching' }"
            @click="currentPage = 'matching'"
          >
            Matching
          </li>

          <li
            :class="{ active: currentPage === 'admis' }"
            @click="currentPage = 'admis'"
          >
            Admis
          </li>

          <li
            :class="{ active: currentPage === 'refuses' }"
            @click="currentPage = 'refuses'"
          >
            Refusés
          </li>

          <li
            :class="{ active: currentPage === 'jobs' }"
            @click="currentPage = 'jobs'"
          >
            Jobs
          </li>
        </ul>
      </nav>
    </aside>

    <!-- CONTENU -->
    <main class="main-content">

      <Dashboard v-if="currentPage === 'dashboard'" />

      <Candidates v-if="currentPage === 'candidates'" />

      <Matching v-if="currentPage === 'matching'" />

      <Admis v-if="currentPage === 'admis'" />

      <Refuses v-if="currentPage === 'refuses'" />

      <Jobs v-if="currentPage === 'jobs'" />

    </main>

  </div>
</template>

<script>
import Dashboard from './components/Dashboard.vue'
import Candidates from './components/Candidates.vue'
import Matching from './components/Matching.vue'
import Admis from './components/Admis.vue'
import Refuses from './components/Refuses.vue'
import Jobs from './components/Jobs.vue'

export default {
  name: 'App',

  components: {
    Dashboard,
    Candidates,
    Matching,
    Admis,
    Refuses,
    Jobs
  },

  data() {
    return {
      currentPage: 'dashboard'
    }
  }
}
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', sans-serif;
  background: #f3f4f6;
}

.app-layout {
  display: flex;
  min-height: 100vh;
}

/* SIDEBAR */
.sidebar {
  width: 230px;
  min-height: 100vh;
  background: #1f2937;
  color: white;
  position: fixed;
  left: 0;
  top: 0;
}

.sidebar-logo {
  padding: 24px 20px;
  font-size: 20px;
  font-weight: bold;
  border-bottom: 1px solid #374151;
}

.sidebar-nav ul {
  list-style: none;
  padding: 12px 0;
}

.sidebar-nav li {
  padding: 14px 22px;
  cursor: pointer;
  color: #d1d5db;
  transition: 0.2s;
}

.sidebar-nav li:hover {
  background: #374151;
  color: white;
}

.sidebar-nav li.active {
  background: #374151;
  color: white;
  border-left: 4px solid #60a5fa;
  font-weight: 600;
}

/* MAIN */
.main-content {
  margin-left: 230px;
  flex: 1;
  min-height: 100vh;
}
</style>