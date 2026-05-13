<template>
  <div class="page-wrapper">

    <div class="page-header">
      <div>
        <h4 class="page-title">Offres d'emploi</h4>
        <p class="page-sub">Postes extraits depuis LinkedIn · dernier mois uniquement</p>
      </div>

      <div class="header-actions">
        <!-- Bouton Synchroniser LinkedIn -->
        <button
          class="sync-btn"
          @click="syncLinkedin"
          :disabled="syncing"
        >
          <span v-if="syncing" class="spinner"></span>
          {{ syncing ? syncLabel : '🔄 Synchroniser LinkedIn' }}
        </button>

        <span class="count-badge">
          {{ filteredJobs.length }} offre(s)
        </span>
      </div>
    </div>

    <!-- Bandeau de statut de sync -->
    <div v-if="syncMessage" :class="['sync-banner', syncMessage.type]">
      {{ syncMessage.text }}
    </div>

    <!-- Barre de recherche -->
    <div class="card-surface mb-3">
      <input
        v-model="search"
        class="f-input"
        placeholder="Rechercher un poste, entreprise..."
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="state-box">
      Chargement des offres...
    </div>

    <!-- Vide -->
    <div v-else-if="paginatedJobs.length === 0" class="state-box">
      Aucune offre trouvée. Lancez une synchronisation LinkedIn.
    </div>

    <!-- Liste des jobs -->
    <div v-else>

      <div
        v-for="job in paginatedJobs"
        :key="job.id"
        class="job-card"
      >
        <div class="job-card-left"></div>

        <div class="job-card-body">
          <div class="job-title">{{ job.title }}</div>

          <!-- Profil source -->
          <div class="job-meta" v-if="job.linkedin_profile">
            <span class="meta-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#0A66C2">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              {{ job.linkedin_profile }}
            </span>
          </div>

          <!-- Description nettoyée -->
          <div class="job-desc">
            {{ shortDesc(job.description) }}
          </div>

          <div class="job-footer">
            <span v-if="extractEmail(job.description)" class="job-contact">
              📧 {{ extractEmail(job.description) }}
            </span>

            <a
              v-if="job.source && job.source.includes('linkedin')"
              :href="job.source"
              target="_blank"
              class="job-link"
            >
              Voir sur LinkedIn →
            </a>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination">
        <button
          class="btn-page"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
          ← Précédent
        </button>

        <span class="page-info">
          Page {{ currentPage }} / {{ totalPages }}
        </span>

        <button
          class="btn-page"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >
          Suivant →
        </button>
      </div>

    </div>
  </div>
</template>

<script>
const API = "http://localhost:3000"

export default {
  name: "Jobs",

  data() {
    return {
      jobs        : [],
      search      : "",
      loading     : false,
      syncing     : false,
      syncLabel   : "Synchronisation...",
      syncMessage : null,
      currentPage : 1,
      perPage     : 6,
      pollTimer   : null,   // timer de polling du statut
    }
  },

  computed: {
    filteredJobs() {
      const q = this.search.toLowerCase()
      return this.jobs.filter(j =>
        (j.title || "").toLowerCase().includes(q) ||
        (j.description || "").toLowerCase().includes(q) ||
        (j.linkedin_profile || "").toLowerCase().includes(q)
      )
    },

    totalPages() {
      return Math.max(1, Math.ceil(this.filteredJobs.length / this.perPage))
    },

    paginatedJobs() {
      const start = (this.currentPage - 1) * this.perPage
      return this.filteredJobs.slice(start, start + this.perPage)
    }
  },

  watch: {
    search() { this.currentPage = 1 }
  },

  mounted() {
    this.fetchJobs()
    // Vérifier si une sync est déjà en cours au chargement de la page
    this.checkInitialStatus()
  },

  beforeUnmount() {
    this.stopPolling()
  },

  methods: {
    // ── Charger les jobs ────────────────────────────────────────────────────
    async fetchJobs() {
      this.loading = true
      try {
        const res  = await fetch(`${API}/api/jobs`)
        const data = await res.json()
        this.jobs  = Array.isArray(data) ? data : []
      } catch (err) {
        console.error("fetchJobs error:", err)
        this.showMessage("error", "Impossible de charger les offres")
      } finally {
        this.loading = false
      }
    },

    // ── Vérifier le statut initial (sync auto au démarrage) ─────────────────
    async checkInitialStatus() {
      try {
        const res  = await fetch(`${API}/api/linkedin/status`)
        const data = await res.json()
        if (data.isRunning) {
          this.syncing   = true
          this.syncLabel = "Synchronisation en cours..."
          this.showMessage("info", "⏳ Synchronisation LinkedIn automatique en cours...")
          this.startPolling()
        }
      } catch {}
    },

    // ── Bouton "Synchroniser LinkedIn" ──────────────────────────────────────
    async syncLinkedin() {
      if (this.syncing) return
      this.syncing     = true
      this.syncLabel   = "Démarrage..."
      this.syncMessage = null

      try {
        const res  = await fetch(`${API}/api/linkedin/sync`, { method: "POST" })
        const data = await res.json()

        if (res.status === 409) {
          // Déjà en cours
          this.showMessage("info", "⏳ " + data.message)
          this.startPolling()
          return
        }

        if (data.success) {
          this.syncLabel = "Synchronisation en cours..."
          this.showMessage("info", "⏳ Synchronisation démarrée — les offres se mettront à jour automatiquement")
          // Polling toutes les 5s jusqu'à la fin
          this.startPolling()
        } else {
          this.showMessage("error", "❌ Erreur : " + (data.error || data.message))
          this.syncing = false
        }
      } catch (err) {
        console.error("syncLinkedin error:", err)
        this.showMessage("error", "❌ Erreur réseau lors de la synchronisation")
        this.syncing = false
      }
    },

    // ── Polling du statut ────────────────────────────────────────────────────
    startPolling() {
      this.stopPolling()
      this.pollTimer = setInterval(async () => {
        try {
          const res  = await fetch(`${API}/api/linkedin/status`)
          const data = await res.json()

          if (!data.isRunning) {
            // Sync terminée
            this.stopPolling()
            this.syncing = false

            const report = data.lastReport
            if (report?.success === false) {
              this.showMessage("error", "❌ Synchronisation échouée")
            } else {
              this.showMessage("success", "✅ Synchronisation terminée ! Mise à jour des offres...")
              // Recharger les jobs
              await this.fetchJobs()
            }
          } else {
            // Toujours en cours
            const lastLine = data.lastLines?.slice(-1)[0] || ""
            this.syncLabel = lastLine.length > 40
              ? lastLine.slice(0, 40) + "..."
              : lastLine || "Synchronisation en cours..."
          }
        } catch {}
      }, 5000)
    },

    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },

    // ── Afficher un message bannière ─────────────────────────────────────────
    showMessage(type, text) {
      this.syncMessage = { type, text }
      // Auto-hide après 8s pour success/error
      if (type !== "info") {
        setTimeout(() => {
          if (this.syncMessage?.text === text) {
            this.syncMessage = null
          }
        }, 8000)
      }
    },

    // ── Helpers affichage ────────────────────────────────────────────────────
    shortDesc(text) {
      if (!text) return "Aucune description."
      // Supprimer les lignes qui ressemblent encore à du bruit LinkedIn
      const lines = text.split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 5 && !l.match(/^(il y a|•|·|\d+\s*mois)/i))
      const clean = lines.join(" ").trim()
      return clean.length > 280 ? clean.slice(0, 280) + "…" : clean || "Voir l'offre sur LinkedIn."
    },

    extractEmail(text) {
      if (!text) return null
      const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
      return match ? match[0] : null
    }
  }
}
</script>

<style scoped>
.page-wrapper {
  padding: 32px 28px 80px;
  background: #f8fafc;
  min-height: 100vh;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ── Bouton sync ── */
.sync-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: #0A66C2;
  color: white;
  border: none;
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.sync-btn:hover:not(:disabled) { background: #0958a8; }
.sync-btn:disabled { opacity: 0.65; cursor: not-allowed; }

/* Spinner animé */
.spinner {
  width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Bannière statut ── */
.sync-banner {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 14px;
  border: 1px solid transparent;
}
.sync-banner.info    { background: #eff6ff; color: #1e40af; border-color: #bfdbfe; }
.sync-banner.success { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
.sync-banner.error   { background: #fef2f2; color: #991b1b; border-color: #fecaca; }

.page-title {
  font-size: 20px; font-weight: 700; color: #0f172a; margin: 0;
}
.page-sub {
  font-size: 13px; color: #94a3b8; margin: 2px 0 0;
}
.count-badge {
  background: #e0eaff; color: #1e40af;
  font-size: 12px; font-weight: 600;
  padding: 4px 12px; border-radius: 20px;
}

.card-surface {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.mb-3 { margin-bottom: 14px; }

.f-input {
  padding: 7px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  font-size: 13px; outline: none;
  width: 320px;
}
.f-input:focus {
  border-color: #0A66C2;
  box-shadow: 0 0 0 3px rgba(10,102,194,0.1);
}

.state-box {
  text-align: center; padding: 60px 20px;
  background: white; border-radius: 10px;
  border: 1px solid #e2e8f0;
  color: #94a3b8; font-size: 13px;
}

.job-card {
  display: flex; background: white;
  border: 1px solid #e2e8f0; border-radius: 10px;
  margin-bottom: 12px; overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  transition: box-shadow 0.2s;
}
.job-card:hover { box-shadow: 0 3px 10px rgba(0,0,0,0.08); }
.job-card-left  { width: 4px; background: #0A66C2; }
.job-card-body  { padding: 16px 18px; flex: 1; }

.job-title {
  font-size: 14px; font-weight: 700;
  color: #0f172a; margin-bottom: 4px;
}
.job-meta {
  margin-bottom: 8px;
}
.meta-tag {
  display: inline-flex; align-items: center; gap: 5px;
  background: #f0f7ff; color: #0A66C2;
  font-size: 11px; font-weight: 600;
  padding: 2px 9px; border-radius: 20px;
}
.job-desc {
  font-size: 13px; color: #475569;
  line-height: 1.6; margin-bottom: 10px;
}
.job-footer {
  display: flex; align-items: center; gap: 16px;
}
.job-contact { font-size: 12px; color: #64748b; }
.job-link {
  font-size: 12px; font-weight: 600; color: #0A66C2;
  text-decoration: none; padding: 4px 12px;
  border: 1px solid #bfdbfe; border-radius: 5px;
  background: #eff6ff;
}
.job-link:hover { background: #dbeafe; }

.pagination {
  display: flex; justify-content: space-between;
  align-items: center; margin-top: 20px;
}
.btn-page {
  padding: 7px 18px; border: 1px solid #e2e8f0;
  border-radius: 7px; background: white; cursor: pointer;
  font-size: 13px; transition: background 0.15s;
}
.btn-page:hover:not(:disabled) { background: #f1f5f9; }
.btn-page:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 13px; color: #64748b; }
</style>