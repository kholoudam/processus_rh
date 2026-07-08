<template>

  <!-- ══════════════════════════════════════════
       LOGIN
  ══════════════════════════════════════════ -->
  <div v-if="!isLoggedIn" class="login-page">

    <div class="login-split">

      <!-- Panneau gauche — branding -->
      <div class="login-left">
        <div class="brand-block">
          <div class="brand-logo">
            <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="1.8">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h1 class="brand-name">RH Manager</h1>
          <p class="brand-sub">Plateforme de gestion du recrutement</p>

          <div class="feature-list">
            <div class="feature-row">
              <span class="fdot fdot-blue"></span>
              Suivi des candidatures en temps réel
            </div>
            <div class="feature-row">
              <span class="fdot fdot-green"></span>
              Parsing automatique des CV par IA
            </div>
            <div class="feature-row">
              <span class="fdot fdot-purple"></span>
              Offres LinkedIn synchronisées
            </div>
            <div class="feature-row">
              <span class="fdot fdot-amber"></span>
              Matching candidats / postes
            </div>
          </div>
        </div>
      </div>

      <!-- Panneau droit — formulaire -->
      <div class="login-right">
        <div class="login-form-wrap">

          <div class="form-header">
            <div class="form-icon">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2 class="form-title">Connexion</h2>
            <p class="form-sub">Accédez à votre espace RH Airbus</p>
          </div>

          <!-- Erreur -->
          <div v-if="error" class="form-error">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {{ error }}
          </div>

          <!-- Email -->
          <div class="field-group">
            <label class="field-label">Adresse email</label>
            <div class="field-wrap" :class="{ focused: focusEmail }">
              <svg class="ficon" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <input
                v-model="email"
                type="email"
                placeholder="prenom.nom@airbus.com"
                class="field-input"
                @focus="focusEmail=true"
                @blur="focusEmail=false"
                @keyup.enter="login"
              />
            </div>
          </div>

          <!-- Mot de passe -->
          <div class="field-group">
            <label class="field-label">Mot de passe</label>
            <div class="field-wrap" :class="{ focused: focusPass }">
              <svg class="ficon" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                v-model="password"
                :type="showPass ? 'text' : 'password'"
                placeholder="••••••••"
                class="field-input"
                @focus="focusPass=true"
                @blur="focusPass=false"
                @keyup.enter="login"
              />
              <button class="eye-btn" type="button" @click="showPass=!showPass" tabindex="-1">
                <svg v-if="!showPass" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
          </div>

          <button class="btn-connect" @click="login" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            <span v-else>Se connecter</span>
          </button>

          <p class="login-footer">Accès réservé au personnel RH autorisé</p>

        </div>
      </div>

    </div>
  </div>

  <!-- ══════════════════════════════════════════
       APPLICATION
  ══════════════════════════════════════════ -->
  <div v-else class="app-shell">

    <!-- SIDEBAR -->
    <aside class="sidebar">

      <div class="sidebar-brand">
        <div class="sb-icon">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <span class="sb-name">RH Manager</span>
      </div>

      <div class="sb-section-label">NAVIGATION</div>

      <nav class="sb-nav">
        <button
          v-for="item in menuItems" :key="item.key"
          class="sb-item"
          :class="{ 'sb-active': currentPage === item.key }"
          @click="currentPage = item.key"
        >
          <span class="sb-item-icon" v-html="item.icon"></span>
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="sb-footer">
        <div class="sb-user-mini">
          <div class="sb-avatar">{{ initials(user.fullname) }}</div>
          <div class="sb-user-info">
            <div class="sb-user-name">{{ user.fullname }}</div>
            <div class="sb-user-role">{{ roleLabel(user.role) }}</div>
          </div>
        </div>
      </div>

    </aside>

    <!-- CONTENU PRINCIPAL -->
    <div class="main-area">

      <!-- NAVBAR -->
      <header class="topbar">

        <!-- Titre de la page courante -->
        <div class="topbar-left">
          <h3 class="page-title">{{ pageTitle }}</h3>
        </div>

        <!-- Actions droite -->
        <div class="topbar-right">

          <!-- Badge Airbus -->
          <div class="airbus-badge">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#0052cc" stroke-width="2">
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
            </svg>
            Airbus Atlantic Maroc
          </div>

          <!-- Profil dropdown -->
          <div class="user-dropdown" :class="{ open: dropdownOpen }">
            <button class="user-trigger" @click="dropdownOpen = !dropdownOpen">
              <div class="user-avatar">{{ initials(user.fullname) }}</div>
              <div class="user-meta">
                <span class="user-name">{{ user.fullname }}</span>
                <span class="user-role-tag">{{ roleLabel(user.role) }}</span>
              </div>
              <svg class="chevron" :class="{ rotated: dropdownOpen }" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            <div v-if="dropdownOpen" class="dp-overlay" @click="dropdownOpen = false"></div>
            <div v-if="dropdownOpen" class="dropdown-panel">
              <!-- En-tête du dropdown -->
              <div class="dp-header">
                <div class="dp-avatar">{{ initials(user.fullname) }}</div>
                <div>
                  <div class="dp-name">{{ user.fullname }}</div>
                  <div class="dp-email">{{ user.email }}</div>
                </div>
              </div>
              <div class="dp-divider"></div>
              <!-- Mon profil -->
              <button class="dp-item" @click="goProfile">
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Mon profil
              </button>
              <div class="dp-divider"></div>
              <!-- Déconnexion -->
              <button class="dp-item dp-logout" @click="logout">
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Déconnexion
              </button>
            </div>
          </div>

        </div>
      </header>


      <!-- PAGE PROFIL -->
      <main class="page-content" :class="{ 'page-content--chat': currentPage === 'chatbot' }">
        <div v-if="currentPage === 'profile'" class="profile-wrap">

          <div class="profile-card">
            <div class="profile-banner"></div>
            <div class="profile-body">
              <div class="profile-avatar-lg">{{ initials(user.fullname) }}</div>
              <div class="profile-info">
                <h2 class="profile-name">{{ user.fullname }}</h2>
                <span class="profile-role-badge">{{ roleLabel(user.role) }}</span>
              </div>
            </div>

            <div class="profile-details">
              <div class="detail-row">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#64748b" stroke-width="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <div>
                  <div class="detail-label">Email</div>
                  <div class="detail-value">{{ user.email }}</div>
                </div>
              </div>
              <div class="detail-row">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#64748b" stroke-width="2">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                </svg>
                <div>
                  <div class="detail-label">Rôle</div>
                  <div class="detail-value">{{ roleLabel(user.role) }}</div>
                </div>
              </div>
              <div class="detail-row">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#64748b" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <div>
                  <div class="detail-label">Organisation</div>
                  <div class="detail-value">Airbus Atlantic Maroc</div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- PAGES PRINCIPALES -->
        <template v-else>
          <Dashboard       v-if="currentPage === 'dashboard'" />
          <Candidates      v-if="currentPage === 'candidates'" />
          <Matching        v-if="currentPage === 'matching'" />
          <Admis           v-if="currentPage === 'admis'" />
          <Refuses         v-if="currentPage === 'refuses'" />
          <Recommendations v-if="currentPage === 'recommendations'" />
          <Chatbot         v-if="currentPage === 'chatbot'" />
          <Jobs            v-if="currentPage === 'jobs'" />
        </template>
      </main>

    </div>
  </div>

</template>

<script>
import Dashboard      from './components/Dashboard.vue'
import Candidates     from './components/Candidates.vue'
import Matching       from './components/Matching.vue'
import Admis          from './components/Admis.vue'
import Refuses        from './components/Refuses.vue'
import Recommendations from './components/Recommendations.vue'
import Chatbot from './components/Chatbot.vue'
import Jobs           from './components/Jobs.vue'

export default {
  components: { Dashboard, Candidates, Matching, Admis, Refuses, Recommendations, Chatbot, Jobs },

  data() {
    return {
      currentPage: 'dashboard',
      email:       '',
      password:    '',
      error:       '',
      loading:     false,
      showPass:    false,
      focusEmail:  false,
      focusPass:   false,
      dropdownOpen: false,
      isLoggedIn:  localStorage.getItem('user') !== null,
      user:        JSON.parse(localStorage.getItem('user')) || {},

      menuItems: [
        { key: 'dashboard',       label: 'Dashboard',       icon: '<svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' },
        { key: 'jobs',            label: 'Offres LinkedIn', icon: '<svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>' },
        { key: 'candidates',      label: 'Candidats',       icon: '<svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
        { key: 'matching',        label: 'Matching',        icon: '<svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>' },
        { key: 'admis',           label: 'Admis',           icon: '<svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' },
        { key: 'refuses',         label: 'Refusés',         icon: '<svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' },
        { key: 'recommendations', label: 'Recommandations', icon: '<svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
        { key: 'chatbot',         label: 'Assistant RH',    icon: '<svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 18v3"/><circle cx="8.5" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1" fill="currentColor" stroke="none"/></svg>' },
      ]
    }
  },

  computed: {
    pageTitle() {
      const map = {
        dashboard: 'Tableau de bord', jobs: 'Offres LinkedIn',
        candidates: 'Candidats', matching: 'Matching',
        admis: 'Candidats Admis', refuses: 'Candidats Refusés',
        recommendations: 'Recommandations', profile: 'Mon Profil'
      }
      return map[this.currentPage] || ''
    }
  },

  methods: {
    async login() {
      this.error   = ''
      this.loading = true

      const users = [
        { fullname: 'Fatimazahra Karrak', email: 'fatimazahra.karrak@airbus.com', password: 'admin123', role: 'CHARGEE_RECRUTEMENT' },
        { fullname: 'Wiam El-Baamrani',   email: 'wiam.elbaamrani@airbus.com',    password: 'admin123', role: 'CHARGEE_RECRUTEMENT' },
        { fullname: 'Imane Abbadi',       email: 'imane.abbadi@airbus.com',       password: 'admin123', role: 'RESPONSABLE_RH' },
      ]

      await new Promise(r => setTimeout(r, 600))

      const user = users.find(u => u.email === this.email && u.password === this.password)

      if (!user) {
        this.error   = 'Email ou mot de passe incorrect.'
        this.loading = false
        return
      }

      localStorage.setItem('user', JSON.stringify(user))
      this.user        = user
      this.isLoggedIn  = true
      this.currentPage = 'dashboard'
      this.error       = ''
      this.loading     = false
    },

    logout() {
      localStorage.removeItem('user')
      this.isLoggedIn  = false
      this.email       = ''
      this.password    = ''
      this.currentPage = 'dashboard'
      this.dropdownOpen = false
    },

    goProfile() {
      this.currentPage  = 'profile'
      this.dropdownOpen = false
    },

    initials(name) {
      if (!name) return '?'
      return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    },

    roleLabel(role) {
      const map = { CHARGEE_RECRUTEMENT: 'Chargée de recrutement', RESPONSABLE_RH: 'Responsable RH' }
      return map[role] || role
    }
  }
}
</script>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8fafc; color: #0f172a; }

/* ══════════════════════════════════════
   LOGIN
══════════════════════════════════════ */
.login-page  { min-height: 100vh; display: flex; align-items: stretch; }

.login-split { display: flex; width: 100%; }

.login-left {
  flex: 1;
  background: linear-gradient(145deg, #0f172a 0%, #1e3a5f 60%, #1d4ed8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 48px;
}

.brand-block { max-width: 380px; color: white; }

.brand-logo {
  width: 68px; height: 68px;
  background: rgba(255,255,255,0.12);
  border: 1.5px solid rgba(255,255,255,0.2);
  border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 24px;
  backdrop-filter: blur(8px);
}

.brand-name { font-size: 32px; font-weight: 800; margin-bottom: 8px; }
.brand-sub  { font-size: 15px; color: rgba(255,255,255,0.65); margin-bottom: 40px; }

.feature-list { display: flex; flex-direction: column; gap: 14px; }

.feature-row {
  display: flex; align-items: center; gap: 12px;
  font-size: 14px; color: rgba(255,255,255,0.85); font-weight: 500;
}

.fdot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.fdot-blue   { background: #60a5fa; }
.fdot-green  { background: #4ade80; }
.fdot-purple { background: #c084fc; }
.fdot-amber  { background: #fbbf24; }

.login-right {
  width: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 48px;
  background: white;
}

.login-form-wrap { width: 100%; max-width: 360px; }

.form-header  { text-align: center; margin-bottom: 32px; }
.form-icon {
  width: 56px; height: 56px;
  background: linear-gradient(135deg, #1d4ed8, #3b82f6);
  border-radius: 14px;
  display: inline-flex; align-items: center; justify-content: center;
  margin-bottom: 14px;
  box-shadow: 0 6px 16px rgba(37,99,235,0.35);
}
.form-title { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
.form-sub   { font-size: 13px; color: #64748b; }

.form-error {
  background: #fef2f2; border: 1px solid #fca5a5;
  border-radius: 8px; padding: 10px 14px;
  font-size: 13px; color: #b91c1c;
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 20px;
}

.field-group  { margin-bottom: 18px; }
.field-label  { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.field-wrap {
  display: flex; align-items: center;
  border: 1.5px solid #e2e8f0; border-radius: 9px;
  padding: 0 12px; background: #f8fafc;
  transition: border-color .2s, box-shadow .2s;
}
.field-wrap.focused { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); background: white; }
.ficon      { color: #94a3b8; flex-shrink: 0; }
.field-input {
  flex: 1; border: none; background: transparent;
  padding: 11px 10px; font-size: 14px; color: #0f172a; outline: none;
}
.field-input::placeholder { color: #cbd5e1; }
.eye-btn {
  background: none; border: none; cursor: pointer;
  color: #94a3b8; padding: 4px; display: flex; align-items: center;
}
.eye-btn:hover { color: #475569; }

.btn-connect {
  width: 100%; padding: 13px;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  color: white; border: none; border-radius: 9px;
  font-size: 15px; font-weight: 700; cursor: pointer;
  transition: all .2s;
  box-shadow: 0 4px 12px rgba(37,99,235,0.35);
  display: flex; align-items: center; justify-content: center; min-height: 46px;
  margin-bottom: 16px;
}
.btn-connect:hover:not(:disabled) {
  background: linear-gradient(135deg, #1e40af, #1d4ed8);
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(37,99,235,0.45);
}
.btn-connect:disabled { opacity: .65; cursor: not-allowed; }
.login-footer { text-align: center; font-size: 12px; color: #94a3b8; }

.spinner {
  width: 18px; height: 18px;
  border: 2.5px solid rgba(255,255,255,.3);
  border-top-color: white; border-radius: 50%;
  animation: spin .7s linear infinite; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ══════════════════════════════════════
   APP SHELL
══════════════════════════════════════ */
.app-shell { display: flex; min-height: 100vh; }

/* ── SIDEBAR ────────────────────────── */
.sidebar {
  width: 245px; min-height: 100vh;
  background: #0f172a;
  display: flex; flex-direction: column;
  position: fixed; top: 0; left: 0; bottom: 0;
  z-index: 100;
}

.sidebar-brand {
  display: flex; align-items: center; gap: 10px;
  padding: 22px 20px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.sb-icon {
  width: 36px; height: 36px;
  background: #1d4ed8; border-radius: 9px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.sb-name { font-size: 15px; font-weight: 700; color: white; }

.sb-section-label {
  font-size: 10px; font-weight: 700; letter-spacing: .1em;
  color: rgba(255,255,255,.3);
  padding: 20px 20px 8px;
}

.sb-nav { display: flex; flex-direction: column; gap: 2px; padding: 0 10px; flex: 1; overflow-y: auto; }

.sb-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 8px;
  font-size: 13.5px; font-weight: 500; color: rgba(255,255,255,.6);
  background: none; border: none; cursor: pointer; text-align: left;
  transition: all .18s;
}
.sb-item:hover    { background: rgba(255,255,255,.06); color: white; }
.sb-active        { background: rgba(37,99,235,.35) !important; color: white !important; }
.sb-active .sb-item-icon { color: #60a5fa; }
.sb-item-icon { display: flex; color: rgba(255,255,255,.4); transition: color .18s; }
.sb-item:hover .sb-item-icon { color: rgba(255,255,255,.8); }

.sb-footer {
  padding: 14px 16px;
  border-top: 1px solid rgba(255,255,255,.06);
}
.sb-user-mini { display: flex; align-items: center; gap: 10px; }
.sb-avatar {
  width: 32px; height: 32px; border-radius: 8px;
  background: #1d4ed8; color: white;
  font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.sb-user-name { font-size: 12px; font-weight: 600; color: white; }
.sb-user-role { font-size: 10px; color: rgba(255,255,255,.4); }

/* ── MAIN AREA ──────────────────────── */
.main-area { margin-left: 245px; flex: 1; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

/* ── TOPBAR ─────────────────────────── */
.topbar {
  height: 62px; background: white;
  border-bottom: 1px solid #e2e8f0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; position: sticky; top: 0; z-index: 90;
  box-shadow: 0 1px 3px rgba(0,0,0,.04);
}
.topbar-left  { display: flex; align-items: center; gap: 12px; }
.page-title   { font-size: 16px; font-weight: 700; color: #0f172a; }
.topbar-right { display: flex; align-items: center; gap: 14px; }

.airbus-badge {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: #0052cc;
  background: #e8f0fe; padding: 5px 12px; border-radius: 20px;
  border: 1px solid #c7d7fb;
}

/* ── USER DROPDOWN ─────────────────── */
.user-dropdown { position: relative; z-index: 91; }

.user-trigger {
  display: flex; align-items: center; gap: 10px;
  background: #f8fafc; border: 1px solid #e2e8f0;
  border-radius: 10px; padding: 6px 12px 6px 8px;
  cursor: pointer; transition: all .15s;
}
.user-trigger:hover { background: #f1f5f9; border-color: #cbd5e1; }

.user-avatar {
  width: 30px; height: 30px; border-radius: 7px;
  background: #1d4ed8; color: white;
  font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.user-meta  { display: flex; flex-direction: column; align-items: flex-start; }
.user-name  { font-size: 12.5px; font-weight: 700; color: #0f172a; line-height: 1.2; }
.user-role-tag { font-size: 10px; color: #64748b; line-height: 1.2; }
.chevron    { color: #94a3b8; transition: transform .2s; }
.chevron.rotated { transform: rotate(180deg); }

.dropdown-panel {
  position: absolute; top: calc(100% + 8px); right: 0;
  width: 240px; background: white;
  border: 1px solid #e2e8f0; border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,.1);
  z-index: 90; overflow: hidden;
}
.dp-header {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px;
}
.dp-avatar {
  width: 36px; height: 36px; border-radius: 9px;
  background: #1d4ed8; color: white;
  font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.dp-name  { font-size: 13px; font-weight: 700; color: #0f172a; }
.dp-email { font-size: 11px; color: #64748b; }
.dp-divider { height: 1px; background: #f1f5f9; }
.dp-item {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 11px 16px;
  font-size: 13px; font-weight: 500; color: #374151;
  background: none; border: none; cursor: pointer; text-align: left;
  transition: background .15s;
}
.dp-item:hover  { background: #f8fafc; }
.dp-logout      { color: #dc2626; }
.dp-logout:hover { background: #fef2f2; }

.overlay { position: fixed; inset: 0; z-index: 88; background: transparent; }
.dp-overlay { position: fixed; inset: 0; z-index: 89; background: transparent; }

/* ── CONTENU ────────────────────────── */
.page-content {
  flex: 1;
  padding: 28px 24px 60px;
  background: #f8fafc;
  overflow-y: auto;
  min-height: 0;
}

/* Mode chat : le composant Recommendations gère son propre layout */
.page-content--chat {
  padding: 0 !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  background: transparent !important;
}

/* ── PROFIL ─────────────────────────── */
.profile-wrap { max-width: 600px; }
.profile-card {
  background: white; border: 1px solid #e2e8f0;
  border-radius: 14px; overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,.05);
}
.profile-banner {
  height: 90px;
  background: linear-gradient(135deg, #1d4ed8, #3b82f6);
}
.profile-body {
  display: flex; align-items: flex-end; gap: 16px;
  padding: 0 24px 16px;
  margin-top: -28px;
}
.profile-avatar-lg {
  width: 64px; height: 64px; border-radius: 14px;
  background: #1d4ed8; color: white;
  font-size: 20px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  border: 3px solid white;
  box-shadow: 0 4px 10px rgba(0,0,0,.12);
  flex-shrink: 0;
}
.profile-name      { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
.profile-role-badge {
  font-size: 11px; font-weight: 700;
  background: #dbeafe; color: #1d4ed8;
  padding: 3px 10px; border-radius: 20px;
}
.profile-details { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 16px; }
.detail-row { display: flex; align-items: flex-start; gap: 12px; }
.detail-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
.detail-value { font-size: 14px; color: #0f172a; font-weight: 500; margin-top: 2px; }

</style>