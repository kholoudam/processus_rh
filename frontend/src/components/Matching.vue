<template>
  <div class="matching-page">

    <h3 class="page-title">🎯 Matching Candidats / Postes</h3>

    <!-- ── Sélecteur de poste ── -->
    <div class="toolbar">
      <div class="select-wrap">
        <label>Filtrer par poste :</label>
        <select v-model="selectedJobId" @change="onJobChange">
          <option value="">— Tous les postes —</option>
          <option v-for="job in jobs" :key="job.id" :value="job.id">
            {{ job.title }}
          </option>
        </select>
      </div>

      <input
        v-model="searchText"
        class="search-input"
        placeholder="🔍 Rechercher un candidat..."
      />

      <button class="btn-refresh" @click="fetchMatches" :disabled="loading">
        <span v-if="loading">⏳</span>
        <span v-else>🔄 Actualiser</span>
      </button>
    </div>

    <!-- ── Loading ── -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Calcul des correspondances en cours...</p>
    </div>

    <!-- ── Erreur ── -->
    <div v-else-if="error" class="error-state">
      ⚠️ {{ error }}
    </div>

    <!-- ── Aucun résultat ── -->
    <div v-else-if="filtered.length === 0" class="empty-state">
      <p>😕 Aucune correspondance trouvée.</p>
      <small>Assurez-vous que les offres ont une description et que les candidats ont des compétences renseignées.</small>
    </div>

    <!-- ── Résultats ── -->
    <div v-else>
      <p class="result-count">
        <strong>{{ filtered.length }}</strong> correspondance(s) trouvée(s)
      </p>

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Candidat</th>
              <th>Email</th>
              <th>Poste</th>
              <th>Score</th>
              <th>Compatibilité</th>
              <th>Éléments matchés</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(m, index) in filtered"
              :key="m.candidateId + '-' + m.jobId"
              :class="rowClass(m.scorePercent)"
            >
              <td class="rank">{{ index + 1 }}</td>
              <td>
                <span class="candidate-name">{{ m.candidateName }}</span>
                <small v-if="m.candidatePhone" class="phone">{{ m.candidatePhone }}</small>
              </td>
              <td>{{ m.candidateEmail }}</td>
              <td>
                <span class="job-badge">{{ m.jobTitle }}</span>
              </td>
              <td>
                <span class="score-pill" :class="scorePillClass(m.scorePercent)">
                  {{ m.scorePercent }}%
                </span>
              </td>
              <td>
                <div class="progress-bar-wrap">
                  <div
                    class="progress-bar-fill"
                    :style="{ width: m.scorePercent + '%' }"
                    :class="scorePillClass(m.scorePercent)"
                  ></div>
                </div>
                <small>{{ m.scorePercent }}%</small>
              </td>
              <td>
                <div class="matched-tags">
                  <span
                    v-for="(item, i) in m.matchedItems"
                    :key="i"
                    class="tag"
                  >{{ item }}</span>
                  <span v-if="!m.matchedItems || m.matchedItems.length === 0" class="tag tag-empty">—</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>

<script>
export default {
  name: 'Matching',

  data() {
    return {
      allMatches:    [],   // toutes les données brutes de l'API
      jobs:          [],
      selectedJobId: '',
      searchText:    '',
      loading:       false,
      error:         null,
    }
  },

  computed: {
    // 1. Filtre par poste sélectionné
    matches() {
      if (!this.selectedJobId) return this.allMatches
      return this.allMatches.filter(m => String(m.jobId) === String(this.selectedJobId))
    },

    // 2. Filtre par recherche texte
    filtered() {
      const q = this.searchText.toLowerCase().trim()
      if (!q) return this.matches
      return this.matches.filter(m =>
        (m.candidateName  || '').toLowerCase().includes(q) ||
        (m.candidateEmail || '').toLowerCase().includes(q) ||
        (m.jobTitle       || '').toLowerCase().includes(q)
      )
    }
  },

  mounted() {
    this.fetchJobs()
    this.fetchMatches()
  },

  methods: {

    async fetchJobs() {
      try {
        const res  = await fetch('http://localhost:3000/api/jobs')
        const data = await res.json()
        this.jobs  = Array.isArray(data) ? data : []
      } catch (err) {
        console.error('JOBS ERROR:', err)
      }
    },

    async fetchMatches() {
      this.loading = true
      this.error   = null
      try {
        const res  = await fetch('http://localhost:3000/api/match')
        const data = await res.json()

        console.log('MATCHES RAW:', data)

        if (!Array.isArray(data)) {
          this.error = 'Réponse inattendue du serveur.'
          this.allMatches = []
          return
        }

        // On garde tous les résultats (y compris score=0)
        // mais on filtre les doublons éventuels
        this.allMatches = data
      } catch (err) {
        console.error('MATCH ERROR:', err)
        this.error = 'Impossible de contacter le serveur de matching.'
      } finally {
        this.loading = false
      }
    },

    onJobChange() {
      // Le computed `matches` se recalcule automatiquement — pas besoin de refetch
      this.searchText = ''
    },

    scorePillClass(pct) {
      if (pct >= 60) return 'high'
      if (pct >= 30) return 'medium'
      return 'low'
    },

    rowClass(pct) {
      if (pct >= 60) return 'row-high'
      if (pct >= 30) return 'row-medium'
      return ''
    }
  }
}
</script>

<style scoped>
.matching-page { padding: 24px; background: #f8fafc; min-height: 100vh; }

.page-title {
  font-size: 22px; font-weight: 700; color: #1e40af; margin-bottom: 20px;
}

/* ── Toolbar ── */
.toolbar {
  display: flex; align-items: center; gap: 14px;
  flex-wrap: wrap; margin-bottom: 20px;
}

.select-wrap {
  display: flex; align-items: center; gap: 8px;
}
.select-wrap label { font-size: 14px; color: #374151; font-weight: 500; white-space: nowrap; }
.select-wrap select {
  padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 14px; background: white; outline: none; min-width: 200px;
}
.select-wrap select:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px #bfdbfe; }

.search-input {
  padding: 8px 14px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 14px; width: 240px; outline: none;
}
.search-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px #bfdbfe; }

.btn-refresh {
  padding: 8px 18px; background: #1d4ed8; color: white;
  border: none; border-radius: 8px; font-size: 14px; cursor: pointer;
  transition: background 0.2s;
}
.btn-refresh:hover:not(:disabled) { background: #1e40af; }
.btn-refresh:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Result count ── */
.result-count { font-size: 14px; color: #6b7280; margin-bottom: 12px; }

/* ── Table ── */
.table {
  width: 100%; border-collapse: collapse; background: white;
  border-radius: 12px; overflow: hidden;
  box-shadow: 0 2px 16px rgba(0,0,0,0.07);
}
thead { background: #1e3a8a; color: white; }
th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #e5e7eb; }
tbody tr:hover { background: #f0f9ff; }

.row-high   { background: #f0fdf4; }
.row-medium { background: #fffbeb; }

.rank { font-weight: 700; color: #6b7280; font-size: 13px; }

/* ── Candidate ── */
.candidate-name { font-weight: 600; color: #111827; display: block; }
.phone { color: #9ca3af; font-size: 12px; }

/* ── Job badge ── */
.job-badge {
  background: #dbeafe; color: #1d4ed8; padding: 3px 10px;
  border-radius: 20px; font-size: 12px; font-weight: 600;
  white-space: nowrap;
}

/* ── Score pill ── */
.score-pill {
  padding: 4px 12px; border-radius: 20px; font-weight: 700;
  font-size: 13px; color: white;
}
.score-pill.high,
.progress-bar-fill.high   { background: #16a34a; }
.score-pill.medium,
.progress-bar-fill.medium { background: #d97706; }
.score-pill.low,
.progress-bar-fill.low    { background: #6b7280; }

/* ── Progress bar ── */
.progress-bar-wrap {
  background: #e5e7eb; border-radius: 99px; height: 8px;
  width: 120px; overflow: hidden; margin-bottom: 3px;
}
.progress-bar-fill {
  height: 100%; border-radius: 99px;
  transition: width 0.5s ease;
}

/* ── Matched tags ── */
.matched-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.tag {
  background: #f3f4f6; color: #374151; font-size: 11px;
  padding: 2px 7px; border-radius: 4px; border: 1px solid #e5e7eb;
}
.tag-empty { color: #9ca3af; border-style: dashed; }

/* ── States ── */
.loading {
  text-align: center; padding: 60px 20px; color: #6b7280;
}
.spinner {
  width: 36px; height: 36px; margin: 0 auto 14px;
  border: 3px solid #e5e7eb; border-top-color: #3b82f6;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.error-state {
  padding: 20px; background: #fef2f2; border: 1px solid #fca5a5;
  border-radius: 8px; color: #dc2626; font-size: 14px;
}
.empty-state {
  text-align: center; padding: 60px 20px; color: #6b7280;
  background: white; border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.empty-state small { display: block; margin-top: 8px; font-size: 13px; }
</style>