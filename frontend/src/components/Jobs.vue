<template>
  <div class="page-wrapper">

    <!-- ══ HEADER ══════════════════════════════════════════ -->
    <div class="page-header">
      <div class="header-left">
        <h4 class="page-title">
          <span class="title-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </span>
          Offres LinkedIn
        </h4>
        <p class="page-sub">Postes extraits et analysés automatiquement</p>
      </div>

      <div class="header-actions">
        <button class="sync-btn" @click="syncLinkedin" :disabled="syncing">
          <span v-if="syncing" class="spinner"></span>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {{ syncing ? syncLabel : 'Synchroniser' }}
        </button>

        <div class="count-badge">
          <span class="count-num">{{ filteredJobs.length }}</span>
          <span class="count-label">offre{{ filteredJobs.length !== 1 ? 's' : '' }}</span>
        </div>
      </div>
    </div>

    <!-- ══ BANDEAU SYNC ════════════════════════════════════ -->
    <transition name="banner-slide">
      <div v-if="syncMessage" :class="['sync-banner', syncMessage.type]">
        <span class="banner-icon">
          <span v-if="syncMessage.type === 'info'">⏳</span>
          <span v-else-if="syncMessage.type === 'success'">✅</span>
          <span v-else>❌</span>
        </span>
        <span>{{ syncMessage.text }}</span>
        <button class="banner-close" @click="syncMessage = null">✕</button>
      </div>
    </transition>

    <!-- ══ LOG EN DIRECT (pendant sync) ═══════════════════ -->
    <transition name="banner-slide">
      <div v-if="syncing && liveLog" class="live-log">
        <span class="live-dot"></span>
        {{ liveLog }}
      </div>
    </transition>

    <!-- ══ FILTRES ══════════════════════════════════════════ -->
    <div class="filters-bar">

      <div class="search-wrap">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          v-model="search"
          class="f-input"
          placeholder="Titre, entreprise, compétence..."
        />
        <button v-if="search" class="clear-search" @click="search = ''">✕</button>
      </div>

      <div class="quick-filters">
        <button
          v-for="f in quickFilters"
          :key="f.value"
          :class="['qf-btn', { active: activeFilter === f.value }]"
          @click="toggleFilter(f.value)"
        >
          {{ f.label }}
          <span class="qf-count">{{ countByFilter(f.value) }}</span>
        </button>
      </div>

      <div class="view-toggle">
        <button :class="['vtoggle', { active: viewMode === 'cards' }]" @click="viewMode = 'cards'" title="Grille">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        </button>
        <button :class="['vtoggle', { active: viewMode === 'list' }]" @click="viewMode = 'list'" title="Liste">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/>
            <circle cx="3" cy="18" r="1" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- ══ LOADING ══════════════════════════════════════════ -->
    <div v-if="loading" class="state-box">
      <div class="loading-dots">
        <span></span><span></span><span></span>
      </div>
      <p>Chargement des offres...</p>
    </div>

    <!-- ══ VIDE ════════════════════════════════════════════ -->
    <div v-else-if="paginatedJobs.length === 0 && !loading" class="state-box">
      <div class="empty-icon">🔍</div>
      <p>{{ search || activeFilter ? 'Aucun résultat pour cette recherche.' : 'Aucune offre. Lancez une synchronisation LinkedIn.' }}</p>
      <button v-if="search || activeFilter" class="reset-btn" @click="search = ''; activeFilter = null">
        Réinitialiser les filtres
      </button>
    </div>

    <!-- ══ LISTE ════════════════════════════════════════════ -->
    <div v-else>

      <!-- Grille ou liste -->
      <div :class="viewMode === 'cards' ? 'jobs-grid' : 'jobs-list'">

        <div
          v-for="job in paginatedJobs"
          :key="job.id"
          :class="['job-card', viewMode, { urgent: job.is_urgent }]"
          @click="openDetail(job)"
        >
          <!-- Barre gauche colorée selon secteur -->
          <div class="job-accent" :style="{ background: sectorColor(job.sector) }"></div>

          <div class="job-card-body">

            <!-- Ligne 1 : titre + badges urgence/score -->
            <div class="job-head">
              <div class="job-title-wrap">
                <span v-if="job.is_urgent" class="badge-urgent">🔥 Urgent</span>
                <div class="job-title">{{ job.title || 'Offre d\'emploi' }}</div>
              </div>
              <div class="job-score" v-if="job.relevance_score" :title="`Score de pertinence : ${job.relevance_score}/100`">
                <div class="score-ring" :style="{ '--p': job.relevance_score }">
                  <span>{{ job.relevance_score }}</span>
                </div>
              </div>
            </div>

            <!-- Ligne 2 : entreprise + localisation -->
            <div class="job-meta-row">
              <span v-if="job.company" class="meta-item company">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                {{ job.company }}
              </span>
              <span v-if="job.location" class="meta-item location">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                {{ job.location }}
              </span>
              <span v-if="job.work_mode" class="meta-item workmode" :class="'wm-' + slugify(job.work_mode)">
                {{ job.work_mode }}
              </span>
            </div>

            <!-- Ligne 3 : tags contrat + séniorité + secteur -->
            <div class="job-tags-row">
              <span v-if="job.contract_type" class="tag contract">{{ job.contract_type }}</span>
              <span v-if="job.seniority_level" class="tag seniority">{{ job.seniority_level }}</span>
              <span v-if="job.sector" class="tag sector" :style="{ background: sectorColor(job.sector) + '18', color: sectorColor(job.sector) }">
                {{ job.sector }}
              </span>
              <span v-if="job.experience_required" class="tag experience">
                {{ job.experience_required }}
              </span>
            </div>

            <!-- Description courte -->
            <div class="job-desc">
              {{ job.short_description || shortDesc(job.description) }}
            </div>

            <!-- Tech skills -->
            <div v-if="job.tech_skills && job.tech_skills.length" class="skills-row">
              <span
                v-for="skill in job.tech_skills.slice(0, viewMode === 'cards' ? 4 : 6)"
                :key="skill"
                class="skill-pill"
              >{{ skill }}</span>
              <span v-if="job.tech_skills.length > (viewMode === 'cards' ? 4 : 6)" class="skill-more">
                +{{ job.tech_skills.length - (viewMode === 'cards' ? 4 : 6) }}
              </span>
            </div>

            <!-- Footer -->
            <div class="job-footer">
              <div class="job-footer-left">
                <span v-if="job.salary_range" class="salary-badge">
                  💰 {{ job.salary_range }}
                </span>
                <span v-if="job.education_level" class="edu-badge">
                  🎓 {{ job.education_level }}
                </span>
                <span v-if="job.contact_email" class="email-badge">
                  📧 {{ job.contact_email }}
                </span>
              </div>
              <div class="job-footer-right">
                <span v-if="job.linkedin_profile" class="li-tag">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#0A66C2">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  {{ job.linkedin_profile.split('-').slice(0,2).join(' ') }}
                </span>
                <button class="detail-btn" @click.stop="openDetail(job)">Détail →</button>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- ── Pagination ───────────────────────────────── -->
      <div class="pagination" v-if="totalPages > 1">
        <button class="btn-page" :disabled="currentPage === 1" @click="currentPage--">← Préc.</button>
        <div class="page-numbers">
          <button
            v-for="p in pageRange"
            :key="p"
            :class="['btn-page-num', { active: p === currentPage, ellipsis: p === '…' }]"
            :disabled="p === '…'"
            @click="p !== '…' && (currentPage = p)"
          >{{ p }}</button>
        </div>
        <button class="btn-page" :disabled="currentPage === totalPages" @click="currentPage++">Suiv. →</button>
      </div>
    </div>

    <!-- ══ MODAL DÉTAIL ════════════════════════════════════ -->
    <transition name="modal-fade">
      <div v-if="selectedJob" class="modal-overlay" @click.self="selectedJob = null">
        <div class="modal-panel">

          <div class="modal-header">
            <div>
              <span v-if="selectedJob.is_urgent" class="badge-urgent">🔥 Urgent</span>
              <h2 class="modal-title">{{ selectedJob.title }}</h2>
              <div class="modal-company" v-if="selectedJob.company">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                {{ selectedJob.company }}
              </div>
            </div>
            <button class="modal-close" @click="selectedJob = null">✕</button>
          </div>

          <!-- Tags principaux -->
          <div class="modal-tags">
            <span v-if="selectedJob.contract_type"    class="tag contract">{{ selectedJob.contract_type }}</span>
            <span v-if="selectedJob.seniority_level"  class="tag seniority">{{ selectedJob.seniority_level }}</span>
            <span v-if="selectedJob.work_mode"        class="tag workmode">{{ selectedJob.work_mode }}</span>
            <span v-if="selectedJob.sector"           class="tag sector" :style="{ background: sectorColor(selectedJob.sector) + '18', color: sectorColor(selectedJob.sector) }">{{ selectedJob.sector }}</span>
          </div>

          <!-- Grille infos -->
          <div class="modal-grid">
            <div class="modal-info-block" v-if="selectedJob.location">
              <div class="mib-label">📍 Localisation</div>
              <div class="mib-value">{{ selectedJob.location }}</div>
            </div>
            <div class="modal-info-block" v-if="selectedJob.experience_required">
              <div class="mib-label">⏱ Expérience</div>
              <div class="mib-value">{{ selectedJob.experience_required }}</div>
            </div>
            <div class="modal-info-block" v-if="selectedJob.education_level">
              <div class="mib-label">🎓 Diplôme</div>
              <div class="mib-value">{{ selectedJob.education_level }} <span v-if="selectedJob.education_field">— {{ selectedJob.education_field }}</span></div>
            </div>
            <div class="modal-info-block" v-if="selectedJob.salary_range">
              <div class="mib-label">💰 Salaire</div>
              <div class="mib-value">{{ selectedJob.salary_range }}</div>
            </div>
            <div class="modal-info-block" v-if="selectedJob.languages && selectedJob.languages.length">
              <div class="mib-label">🌐 Langues</div>
              <div class="mib-value">{{ selectedJob.languages.join(', ') }}</div>
            </div>
            <div class="modal-info-block" v-if="selectedJob.relevance_score">
              <div class="mib-label">⭐ Pertinence</div>
              <div class="mib-value">{{ selectedJob.relevance_score }} / 100</div>
            </div>
          </div>

          <!-- Compétences techniques -->
          <div class="modal-section" v-if="selectedJob.tech_skills && selectedJob.tech_skills.length">
            <div class="modal-section-title">🛠 Compétences techniques</div>
            <div class="skills-row">
              <span v-for="s in selectedJob.tech_skills" :key="s" class="skill-pill">{{ s }}</span>
            </div>
          </div>

          <!-- Soft skills -->
          <div class="modal-section" v-if="selectedJob.soft_skills && selectedJob.soft_skills.length">
            <div class="modal-section-title">🤝 Soft skills</div>
            <div class="skills-row">
              <span v-for="s in selectedJob.soft_skills" :key="s" class="skill-pill soft">{{ s }}</span>
            </div>
          </div>

          <!-- Avantages -->
          <div class="modal-section" v-if="selectedJob.benefits">
            <div class="modal-section-title">🎁 Avantages</div>
            <div class="skills-row">
              <template v-if="Array.isArray(selectedJob.benefits)">
                <span v-for="b in selectedJob.benefits" :key="b" class="skill-pill benefit">{{ b }}</span>
              </template>
              <span v-else class="skill-pill benefit">{{ selectedJob.benefits }}</span>
            </div>
          </div>

          <!-- Description complète -->
          <div class="modal-section">
            <div class="modal-section-title">📄 Description complète</div>
            <div class="modal-desc">{{ selectedJob.description }}</div>
          </div>

          <!-- Contact email -->
          <div class="modal-section" v-if="selectedJob.contact_email">
            <div class="modal-section-title">📧 Contact</div>
            <a :href="'mailto:' + selectedJob.contact_email" class="mib-value" style="color:#0A66C2; text-decoration:none;">
              {{ selectedJob.contact_email }}
            </a>
          </div>

          <!-- Footer modal -->
          <div class="modal-footer">
            <span class="li-tag-modal" v-if="selectedJob.linkedin_profile">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#0A66C2">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              {{ selectedJob.linkedin_profile }}
            </span>
            <a
              v-if="selectedJob.source && selectedJob.source.includes('linkedin')"
              :href="selectedJob.source"
              target="_blank"
              class="modal-cta"
            >
              Voir sur LinkedIn →
            </a>
          </div>

        </div>
      </div>
    </transition>

  </div>
</template>

<script>
const API = "http://localhost:3000"

const SECTOR_COLORS = {
  "IT / Tech":        "#0A66C2",
  "Finance / Banque": "#10b981",
  "RH":               "#8b5cf6",
  "Marketing":        "#f59e0b",
  "Industrie":        "#6b7280",
  "BTP":              "#ea580c",
  "Santé":            "#06b6d4",
  "Conseil":          "#6366f1",
  "Commerce":         "#ec4899",
  "Éducation":        "#14b8a6",
}

export default {
  name: "Jobs",

  data() {
    return {
      jobs:        [],
      search:      "",
      activeFilter: null,
      loading:     false,
      syncing:     false,
      syncLabel:   "Synchronisation...",
      syncMessage: null,
      liveLog:     "",
      currentPage: 1,
      perPage:     9,
      pollTimer:   null,
      viewMode:    "cards",   // 'cards' | 'list'
      selectedJob: null,
      quickFilters: [
        { label: "Tous",        value: null },
        { label: "CDI",         value: "CDI" },
        { label: "Stage",       value: "Stage" },
        { label: "Alternance",  value: "Alternance" },
        { label: "Remote",      value: "Remote" },
        { label: "Urgent 🔥",   value: "urgent" },
      ],
    }
  },

  computed: {
    filteredJobs() {
      let list = [...this.jobs]

      // Filtre rapide
      if (this.activeFilter === "urgent") {
        list = list.filter(j => j.is_urgent)
      } else if (this.activeFilter === "Remote") {
        list = list.filter(j => j.work_mode === "Remote")
      } else if (this.activeFilter) {
        list = list.filter(j => j.contract_type === this.activeFilter)
      }

      // Recherche texte
      if (this.search.trim()) {
        const q = this.search.toLowerCase()
        list = list.filter(j =>
          (j.title            || "").toLowerCase().includes(q) ||
          (j.company          || "").toLowerCase().includes(q) ||
          (j.description      || "").toLowerCase().includes(q) ||
          (j.location         || "").toLowerCase().includes(q) ||
          (j.sector           || "").toLowerCase().includes(q) ||
          (j.linkedin_profile || "").toLowerCase().includes(q) ||
          (Array.isArray(j.tech_skills) && j.tech_skills.some(s => s.toLowerCase().includes(q)))
        )
      }

      // Tri : urgents d'abord, puis par score décroissant
      list.sort((a, b) => {
        if (a.is_urgent && !b.is_urgent) return -1
        if (!a.is_urgent && b.is_urgent) return 1
        return (b.relevance_score || 0) - (a.relevance_score || 0)
      })

      return list
    },

    totalPages() {
      return Math.max(1, Math.ceil(this.filteredJobs.length / this.perPage))
    },

    paginatedJobs() {
      const start = (this.currentPage - 1) * this.perPage
      return this.filteredJobs.slice(start, start + this.perPage)
    },

    pageRange() {
      const total = this.totalPages
      const cur   = this.currentPage
      if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
      const pages = [1]
      if (cur > 3) pages.push("…")
      for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) pages.push(p)
      if (cur < total - 2) pages.push("…")
      pages.push(total)
      return pages
    },
  },

  watch: {
    search()       { this.currentPage = 1 },
    activeFilter() { this.currentPage = 1 },
    viewMode()     {
      this.perPage = this.viewMode === "cards" ? 9 : 10
      this.currentPage = 1
    },
  },

  mounted() {
    this.fetchJobs()
    this.checkInitialStatus()
  },

  beforeUnmount() {
    this.stopPolling()
  },

  methods: {
    // ── Données ──────────────────────────────────────────────
    async fetchJobs() {
      this.loading = true
      try {
        const res  = await fetch(`${API}/api/jobs`)
        const data = await res.json()
        this.jobs  = Array.isArray(data) ? data : []
      } catch (err) {
        this.showMessage("error", "Impossible de charger les offres")
      } finally {
        this.loading = false
      }
    },

    async checkInitialStatus() {
      try {
        const res  = await fetch(`${API}/api/linkedin/status`)
        const data = await res.json()
        if (data.running) {
          this.syncing   = true
          this.syncLabel = "En cours..."
          this.showMessage("info", "⏳ Synchronisation LinkedIn en cours...")
          this.startPolling()
        }
      } catch {}
    },

    // ── Sync ─────────────────────────────────────────────────
    async syncLinkedin() {
      if (this.syncing) return
      this.syncing     = true
      this.syncLabel   = "Démarrage..."
      this.syncMessage = null

      try {
        const res  = await fetch(`${API}/api/linkedin/sync`, { method: "POST" })
        const data = await res.json()

        if (res.status === 409) {
          this.showMessage("info", "⏳ " + data.message)
          this.startPolling()
          return
        }

        if (data.success) {
          this.syncLabel = "En cours..."
          this.showMessage("info", "⏳ Synchronisation démarrée — mise à jour automatique")
          this.startPolling()
        } else {
          this.showMessage("error", "❌ " + (data.error || data.message))
          this.syncing = false
        }
      } catch {
        this.showMessage("error", "❌ Erreur réseau")
        this.syncing = false
      }
    },

    // ── Polling ──────────────────────────────────────────────
    startPolling() {
      this.stopPolling()
      this.pollTimer = setInterval(async () => {
        try {
          const res  = await fetch(`${API}/api/linkedin/status`)
          const data = await res.json()

          // Dernière ligne de log en live
          if (data.recentLogs?.length) {
            const last = data.recentLogs[data.recentLogs.length - 1] || ""
            this.liveLog = last.length > 60 ? last.slice(0, 60) + "…" : last
            this.syncLabel = this.liveLog || "En cours..."
          }

          if (!data.running) {
            this.stopPolling()
            this.syncing = false
            this.liveLog = ""

            if (data.lastResult?.success === false) {
              this.showMessage("error", "❌ Synchronisation échouée")
            } else {
              const n = data.lastResult?.inserted ?? "?"
              this.showMessage("success", `✅ Terminé ! ${n} offre(s) insérée(s)`)
              await this.fetchJobs()
            }
          }
        } catch {}
      }, 4000)
    },

    stopPolling() {
      if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
    },

    showMessage(type, text) {
      this.syncMessage = { type, text }
      if (type !== "info") {
        setTimeout(() => {
          if (this.syncMessage?.text === text) this.syncMessage = null
        }, 8000)
      }
    },

    // ── Filtres ──────────────────────────────────────────────
    toggleFilter(val) {
      this.activeFilter = this.activeFilter === val ? null : val
    },

    countByFilter(val) {
      if (!val) return this.jobs.length
      if (val === "urgent") return this.jobs.filter(j => j.is_urgent).length
      if (val === "Remote") return this.jobs.filter(j => j.work_mode === "Remote").length
      return this.jobs.filter(j => j.contract_type === val).length
    },

    // ── Modal ────────────────────────────────────────────────
    openDetail(job) { this.selectedJob = job },

    // ── Helpers ──────────────────────────────────────────────
    sectorColor(sector) {
      return SECTOR_COLORS[sector] || "#64748b"
    },

    slugify(str) {
      return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "-")
    },

    shortDesc(text) {
      if (!text) return "Aucune description."
      const clean = text.split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 5 && !l.match(/^(il y a|•|·|\d+\s*mois)/i))
        .join(" ").trim()
      return clean.length > 220 ? clean.slice(0, 220) + "…" : clean || "Voir l'offre."
    },

    extractEmail(text) {
      if (!text) return null
      const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
      return m ? m[0] : null
    },
  }
}
</script>

<style scoped>
/* ══ RESET / BASE ═══════════════════════════════════════════ */
*, *::before, *::after { box-sizing: border-box; }

.page-wrapper {
  padding: 28px 28px 80px;
  background: #f1f5f9;
  min-height: 100vh;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

/* ══ HEADER ═════════════════════════════════════════════════ */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}
.header-left { display: flex; flex-direction: column; gap: 3px; }
.title-icon {
  display: inline-flex; align-items: center;
  margin-right: 6px; vertical-align: middle;
}
.page-title {
  font-size: 21px; font-weight: 800; color: #0f172a; margin: 0;
  display: flex; align-items: center;
}
.page-sub { font-size: 12px; color: #94a3b8; margin: 0; }

.header-actions { display: flex; align-items: center; gap: 10px; }

.sync-btn {
  display: inline-flex; align-items: center; gap: 7px;
  background: #0A66C2; color: white; border: none;
  padding: 9px 18px; border-radius: 8px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background 0.18s, transform 0.1s;
  white-space: nowrap;
}
.sync-btn:hover:not(:disabled) { background: #0956a5; transform: translateY(-1px); }
.sync-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner {
  width: 12px; height: 12px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff; border-radius: 50%;
  animation: spin 0.8s linear infinite; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

.count-badge {
  display: flex; align-items: baseline; gap: 3px;
  background: white; border: 1px solid #e2e8f0;
  padding: 6px 14px; border-radius: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.count-num  { font-size: 16px; font-weight: 800; color: #0A66C2; }
.count-label { font-size: 11px; color: #94a3b8; font-weight: 500; }

/* ══ BANNIERES ══════════════════════════════════════════════ */
.sync-banner {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; border-radius: 9px;
  font-size: 13px; font-weight: 500;
  margin-bottom: 12px; border: 1px solid transparent;
}
.sync-banner.info    { background: #eff6ff; color: #1e40af; border-color: #bfdbfe; }
.sync-banner.success { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
.sync-banner.error   { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
.banner-icon { font-size: 15px; }
.banner-close {
  margin-left: auto; background: none; border: none;
  cursor: pointer; opacity: 0.5; font-size: 12px; padding: 2px 5px;
}
.banner-close:hover { opacity: 1; }

.live-log {
  display: flex; align-items: center; gap: 8px;
  background: #0f172a; color: #94a3b8;
  font-size: 11px; font-family: monospace;
  padding: 7px 14px; border-radius: 7px; margin-bottom: 12px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.live-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #22c55e; flex-shrink: 0;
  animation: pulse-dot 1.2s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%,100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* ══ FILTRES ════════════════════════════════════════════════ */
.filters-bar {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 16px; flex-wrap: wrap;
  background: white; padding: 10px 14px;
  border-radius: 10px; border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.search-wrap {
  position: relative; display: flex; align-items: center;
}
.search-icon { position: absolute; left: 10px; pointer-events: none; }
.f-input {
  padding: 7px 32px 7px 30px; border: 1px solid #e2e8f0;
  border-radius: 7px; font-size: 13px; outline: none; width: 230px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.f-input:focus { border-color: #0A66C2; box-shadow: 0 0 0 3px rgba(10,102,194,0.08); }
.clear-search {
  position: absolute; right: 7px; background: none; border: none;
  cursor: pointer; color: #94a3b8; font-size: 11px; padding: 2px;
}

.quick-filters { display: flex; gap: 5px; flex-wrap: wrap; }
.qf-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px; border-radius: 20px; border: 1px solid #e2e8f0;
  background: white; font-size: 12px; font-weight: 500; cursor: pointer;
  color: #475569; transition: all 0.15s;
}
.qf-btn:hover { border-color: #0A66C2; color: #0A66C2; background: #eff6ff; }
.qf-btn.active { background: #0A66C2; color: white; border-color: #0A66C2; }
.qf-count {
  background: rgba(0,0,0,0.08); border-radius: 10px;
  padding: 1px 6px; font-size: 10px; font-weight: 700;
}
.qf-btn.active .qf-count { background: rgba(255,255,255,0.25); }

.view-toggle {
  display: flex; margin-left: auto;
  border: 1px solid #e2e8f0; border-radius: 7px; overflow: hidden;
}
.vtoggle {
  padding: 6px 10px; border: none; background: white; cursor: pointer;
  color: #94a3b8; transition: all 0.15s; display: flex; align-items: center;
}
.vtoggle:hover  { background: #f8fafc; color: #475569; }
.vtoggle.active { background: #0A66C2; color: white; }

/* ══ STATES ═════════════════════════════════════════════════ */
.state-box {
  text-align: center; padding: 70px 20px;
  background: white; border-radius: 12px;
  border: 1px solid #e2e8f0; color: #94a3b8; font-size: 13px;
}
.empty-icon { font-size: 36px; margin-bottom: 12px; }
.loading-dots {
  display: flex; justify-content: center; gap: 6px; margin-bottom: 14px;
}
.loading-dots span {
  width: 8px; height: 8px; background: #0A66C2; border-radius: 50%;
  animation: bounce-dot 1.2s infinite;
}
.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce-dot {
  0%,80%,100% { transform: translateY(0); opacity: 0.6; }
  40% { transform: translateY(-8px); opacity: 1; }
}
.reset-btn {
  margin-top: 14px; padding: 7px 18px;
  border: 1px solid #e2e8f0; border-radius: 7px;
  background: white; cursor: pointer; font-size: 12px;
  color: #475569; transition: all 0.15s;
}
.reset-btn:hover { background: #f1f5f9; }

/* ══ GRILLES ════════════════════════════════════════════════ */
.jobs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}
.jobs-list { display: flex; flex-direction: column; gap: 10px; }

/* ══ CARTE JOB ══════════════════════════════════════════════ */
.job-card {
  display: flex; background: white;
  border: 1px solid #e2e8f0; border-radius: 11px;
  overflow: hidden; cursor: pointer;
  transition: box-shadow 0.18s, transform 0.15s, border-color 0.15s;
  position: relative;
}
.job-card:hover {
  box-shadow: 0 6px 20px rgba(0,0,0,0.09);
  transform: translateY(-2px);
  border-color: #cbd5e1;
}
.job-card.urgent { border-color: #fca5a5; }
.job-card.urgent:hover { border-color: #ef4444; }

.job-accent { width: 4px; flex-shrink: 0; }
.job-card.list .job-accent { width: 4px; }

.job-card-body { padding: 15px 16px; flex: 1; min-width: 0; }

/* ── Tête de carte ── */
.job-head {
  display: flex; justify-content: space-between;
  align-items: flex-start; gap: 8px; margin-bottom: 6px;
}
.job-title-wrap { flex: 1; min-width: 0; }
.badge-urgent {
  display: inline-block; font-size: 10px; font-weight: 700;
  background: #fef2f2; color: #ef4444; border: 1px solid #fecaca;
  padding: 1px 7px; border-radius: 4px; margin-bottom: 3px;
}
.job-title {
  font-size: 14px; font-weight: 700; color: #0f172a;
  line-height: 1.35; overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}

/* Score ring */
.job-score { flex-shrink: 0; }
.score-ring {
  width: 36px; height: 36px; border-radius: 50%;
  background: conic-gradient(#0A66C2 calc(var(--p) * 1%), #e2e8f0 0);
  display: flex; align-items: center; justify-content: center;
  position: relative;
}
.score-ring::before {
  content: ''; width: 26px; height: 26px;
  background: white; border-radius: 50%;
  position: absolute;
}
.score-ring span {
  font-size: 9px; font-weight: 800; color: #0A66C2;
  position: relative; z-index: 1;
}

/* ── Meta (entreprise, lieu, mode) ── */
.job-meta-row {
  display: flex; flex-wrap: wrap; gap: 8px;
  align-items: center; margin-bottom: 7px;
}
.meta-item {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 12px; color: #475569; font-weight: 500;
}
.meta-item svg { flex-shrink: 0; stroke: #94a3b8; }
.meta-item.company { color: #0f172a; font-weight: 600; }

.meta-item.workmode {
  padding: 2px 8px; border-radius: 20px;
  font-size: 11px; font-weight: 600;
}
.wm-remote    { background: #f0fdf4; color: #16a34a; }
.wm-hybride   { background: #fefce8; color: #ca8a04; }
.wm-pr-sentiel { background: #f8fafc; color: #475569; }

/* ── Tags ── */
.job-tags-row {
  display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px;
}
.tag {
  font-size: 11px; font-weight: 600; padding: 2px 9px;
  border-radius: 4px; border: 1px solid;
}
.tag.contract   { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.tag.seniority  { background: #faf5ff; color: #7c3aed; border-color: #e9d5ff; }
.tag.sector     { border: 1px solid currentColor; opacity: 0.9; }
.tag.experience { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
.tag.workmode   { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }

/* ── Description ── */
.job-desc {
  font-size: 12.5px; color: #64748b; line-height: 1.55;
  margin-bottom: 8px;
  overflow: hidden; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}

/* ── Skills ── */
.skills-row { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
.skill-pill {
  font-size: 11px; font-weight: 600;
  background: #f1f5f9; color: #334155;
  border: 1px solid #e2e8f0; padding: 2px 9px; border-radius: 4px;
  transition: background 0.12s;
}
.skill-pill:hover  { background: #e2e8f0; }
.skill-pill.soft   { background: #faf5ff; color: #7c3aed; border-color: #e9d5ff; }
.skill-pill.benefit { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
.skill-more {
  font-size: 11px; color: #94a3b8; padding: 2px 6px;
  border: 1px dashed #e2e8f0; border-radius: 4px;
}

/* ── Footer carte ── */
.job-footer {
  display: flex; align-items: center;
  justify-content: space-between; gap: 8px; flex-wrap: wrap;
  border-top: 1px solid #f1f5f9; padding-top: 8px; margin-top: 4px;
}
.job-footer-left  { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.job-footer-right { display: flex; align-items: center; gap: 8px; }

.salary-badge, .edu-badge, .email-badge {
  font-size: 11px; color: #64748b; font-weight: 500;
}
.li-tag {
  display: inline-flex; align-items: center; gap: 4px;
  background: #f0f7ff; color: #0A66C2; font-size: 10px; font-weight: 600;
  padding: 2px 8px; border-radius: 20px; max-width: 120px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.detail-btn {
  font-size: 11px; font-weight: 600; color: #0A66C2;
  background: #eff6ff; border: 1px solid #bfdbfe;
  padding: 4px 11px; border-radius: 5px; cursor: pointer;
  transition: background 0.12s;
}
.detail-btn:hover { background: #dbeafe; }

/* ══ PAGINATION ══════════════════════════════════════════════ */
.pagination {
  display: flex; justify-content: space-between;
  align-items: center; margin-top: 22px; gap: 8px;
}
.btn-page {
  padding: 7px 16px; border: 1px solid #e2e8f0;
  border-radius: 7px; background: white; cursor: pointer;
  font-size: 13px; transition: all 0.15s; font-weight: 500;
}
.btn-page:hover:not(:disabled) { background: #f1f5f9; border-color: #cbd5e1; }
.btn-page:disabled { opacity: 0.35; cursor: not-allowed; }

.page-numbers { display: flex; gap: 4px; }
.btn-page-num {
  width: 34px; height: 34px; display: flex; align-items: center;
  justify-content: center; border: 1px solid #e2e8f0;
  border-radius: 7px; background: white; cursor: pointer;
  font-size: 13px; font-weight: 600; transition: all 0.15s;
}
.btn-page-num:hover:not(:disabled):not(.ellipsis) { background: #f1f5f9; }
.btn-page-num.active { background: #0A66C2; color: white; border-color: #0A66C2; }
.btn-page-num.ellipsis { border: none; cursor: default; color: #94a3b8; }

/* ══ MODAL ═══════════════════════════════════════════════════ */
.modal-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(15, 23, 42, 0.55);
  display: flex; align-items: flex-start; justify-content: center;
  padding: 40px 16px; overflow-y: auto;
  backdrop-filter: blur(3px);
}
.modal-panel {
  background: white; border-radius: 14px;
  width: 100%; max-width: 660px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  overflow: hidden;
}

.modal-header {
  display: flex; align-items: flex-start;
  justify-content: space-between;
  padding: 22px 24px 16px;
  border-bottom: 1px solid #f1f5f9;
  background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
}
.modal-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 4px 0 0; }
.modal-company {
  display: flex; align-items: center; gap: 5px;
  font-size: 13px; color: #64748b; margin-top: 4px; font-weight: 500;
}
.modal-close {
  background: #f1f5f9; border: none; cursor: pointer;
  width: 30px; height: 30px; border-radius: 50%;
  font-size: 12px; color: #64748b; flex-shrink: 0; margin-top: 2px;
  transition: background 0.15s;
}
.modal-close:hover { background: #e2e8f0; }

.modal-tags {
  display: flex; flex-wrap: wrap; gap: 6px;
  padding: 14px 24px; border-bottom: 1px solid #f1f5f9;
}

.modal-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1px; background: #f1f5f9;
  border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;
}
.modal-info-block {
  background: white; padding: 12px 18px;
}
.mib-label { font-size: 11px; color: #94a3b8; font-weight: 600; margin-bottom: 3px; }
.mib-value { font-size: 13px; color: #0f172a; font-weight: 600; }

.modal-section { padding: 14px 24px; border-bottom: 1px solid #f1f5f9; }
.modal-section-title {
  font-size: 12px; font-weight: 700; color: #64748b;
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 10px;
}
.modal-desc {
  font-size: 13px; color: #475569; line-height: 1.65;
  white-space: pre-wrap; max-height: 300px; overflow-y: auto;
  background: #f8fafc; padding: 14px; border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.modal-footer {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
}
.li-tag-modal {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; color: #0A66C2; font-weight: 600;
}
.modal-cta {
  display: inline-flex; align-items: center;
  background: #0A66C2; color: white; text-decoration: none;
  padding: 9px 20px; border-radius: 8px;
  font-size: 13px; font-weight: 700;
  transition: background 0.15s, transform 0.1s;
}
.modal-cta:hover { background: #0956a5; transform: translateY(-1px); }

/* ══ TRANSITIONS ═════════════════════════════════════════════ */
.banner-slide-enter-active, .banner-slide-leave-active {
  transition: all 0.25s ease;
}
.banner-slide-enter-from, .banner-slide-leave-to {
  opacity: 0; transform: translateY(-8px);
}

.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-active .modal-panel,
.modal-fade-leave-active .modal-panel {
  transition: transform 0.25s ease;
}
.modal-fade-enter-from .modal-panel  { transform: translateY(20px) scale(0.97); }
.modal-fade-leave-to   .modal-panel  { transform: translateY(10px) scale(0.98); }

/* ══ RESPONSIVE ══════════════════════════════════════════════ */
@media (max-width: 640px) {
  .page-wrapper { padding: 16px 14px 60px; }
  .filters-bar  { flex-wrap: wrap; }
  .f-input      { width: 100%; }
  .quick-filters { display: none; }
  .jobs-grid    { grid-template-columns: 1fr; }
  .view-toggle  { display: none; }
  .modal-overlay { padding: 0; align-items: flex-end; }
  .modal-panel   { border-radius: 14px 14px 0 0; max-height: 90vh; overflow-y: auto; }
}
</style>                                                      