<template>
  <div class="page-wrapper">
    <div class="page-header">
      <div>
        <h4 class="page-title">Recommandations</h4>
        <p class="page-sub">Candidats recommandés vers un autre poste après refus</p>
      </div>
      <span class="count-badge count-blue">{{ filtered.length }} recommandation(s)</span>
    </div>

    <div class="card-surface mb-3">
      <input
        v-model="searchText"
        class="f-input"
        placeholder="Rechercher par nom ou email..."
      />
    </div>

    <div v-if="loading" class="state-box">Chargement...</div>

    <div v-else-if="filtered.length === 0" class="state-box">
      Aucune recommandation pour l'instant.
    </div>

    <div v-else class="card-surface p-0">
      <table class="data-table">
        <thead>
          <tr>
            <th>Candidat</th>
            <th>Email</th>
            <th>Poste initial</th>
            <th>Poste recommandé</th>
            <th>Motif</th>
            <th>Date</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="r in filtered" :key="r.id">
            <td>
              <div class="cand-cell">
                <div class="avatar av-blue">{{ initials(r.name) }}</div>
                <span class="cand-name">{{ r.name || '—' }}</span>
              </div>
            </td>

            <td class="muted">{{ r.email || '—' }}</td>

            <td>
              <span class="job-tag job-tag--muted">{{ r.original_job || 'Non défini' }}</span>
            </td>

            <td>
              <span class="job-tag job-tag--blue">{{ r.recommended_job || '—' }}</span>
            </td>

            <td>
              <span v-if="r.reason" class="reason-pill" :title="r.reason">
                {{ r.reason.length > 45 ? r.reason.slice(0,45)+'…' : r.reason }}
              </span>
              <span v-else class="muted">—</span>
            </td>

            <td class="muted">{{ formatDate(r.created_at) }}</td>

            <td>
              <button
                class="mail-btn"
                :disabled="sendingId === r.id"
                @click="sendRecommendationMail(r)"
              >
                <span v-if="sendingId === r.id" class="btn-spinner"></span>
                <span v-else>📧 Envoyer mail recommandation</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="recommendations.length" class="stats-bar stats-blue">
      Total recommandations : <strong>{{ recommendations.length }}</strong>
    </div>

    <!-- Toast confirmation envoi -->
    <Teleport to="body">
      <div v-if="toast.visible" class="toast-overlay" @click.self="toast.visible = false">
        <div class="toast-box" :class="toast.success ? 'toast-box--ok' : 'toast-box--err'">
          <p>{{ toast.message }}</p>
          <button class="toast-close" @click="toast.visible = false">Fermer</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
export default {
  name: 'Recommendations',

  data() {
    return {
      recommendations: [],
      searchText: '',
      loading: true,
      sendingId: null,
      toast: { visible: false, success: true, message: '' },
    }
  },

  computed: {
    filtered() {
      const q = this.searchText.toLowerCase()

      return this.recommendations.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q)
      )
    }
  },

  mounted() {
    this.fetchRecommendations()
  },

  methods: {
    async fetchRecommendations() {
      this.loading = true
      try {
        const r = await fetch('http://localhost:3000/api/candidates/recommendations')
        const d = await r.json()
        this.recommendations = Array.isArray(d) ? d : []
      } catch (e) {
        console.error(e)
      } finally {
        this.loading = false
      }
    },

    async sendRecommendationMail(r) {
      this.sendingId = r.id
      try {
        const res = await fetch(
          `http://localhost:3000/api/candidates/${r.candidate_id}/recommend/send`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recommendationId: r.id,
              jobId: r.job_id,
            }),
          }
        )
        const data = await res.json()

        this.toast = {
          visible: true,
          success: res.ok,
          message: res.ok
            ? (data.message || `Mail envoyé à ${r.name}`)
            : (data.message || "Erreur lors de l'envoi du mail"),
        }
      } catch (e) {
        console.error(e)
        this.toast = { visible: true, success: false, message: "Erreur lors de l'envoi du mail" }
      } finally {
        this.sendingId = null
      }
    },

    formatDate(d) {
      if (!d) return '—'
      return new Date(d).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    },

    initials(n) {
      if (!n) return '?'
      return n.split(' ')
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    }
  }
}
</script>

<style scoped>
.page-wrapper { padding:32px 28px 80px; background:#f8fafc; min-height:100vh; }
.page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }
.page-title { font-size:20px; font-weight:700; color:#0f172a; margin:0; }
.page-sub { font-size:13px; color:#94a3b8; margin:2px 0 0; }
.count-badge { font-size:12px; font-weight:600; padding:4px 12px; border-radius:20px; }
.count-blue { background:#dbeafe; color:#1e40af; }
.card-surface { background:white; border:1px solid #e2e8f0; border-radius:10px; padding:14px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
.p-0{padding:0;}
.mb-3{margin-bottom:14px;}

.f-input {
  padding:7px 12px;
  border:1px solid #e2e8f0;
  border-radius:7px;
  font-size:13px;
  outline:none;
  width:280px;
}

.state-box {
  text-align:center;
  padding:60px 20px;
  background:white;
  border-radius:10px;
  color:#94a3b8;
}

.data-table { width:100%; border-collapse:collapse; font-size:13px; }

.data-table thead th {
  background:#eff6ff;
  color:#1e40af;
  font-weight:600;
  padding:10px 16px;
  text-align:left;
}

.data-table tbody td {
  padding:12px 16px;
  border-bottom:1px solid #f1f5f9;
}
.data-table tbody tr:last-child td { border-bottom:none; }
.data-table tbody tr:hover td { background:#f8fafc; }

.cand-cell { display:flex; align-items:center; gap:10px; }

.avatar {
  width:32px;
  height:32px;
  border-radius:8px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:11px;
  font-weight:700;
  flex-shrink:0;
}

.av-blue {
  background:#dbeafe;
  color:#1e40af;
}

.cand-name { font-weight:600; color:#0f172a; }
.muted { color:#64748b; }

.job-tag {
  padding:3px 8px;
  border-radius:4px;
  font-size:12px;
  display:inline-block;
}

.job-tag--muted {
  background:#f1f5f9;
  color:#64748b;
}

.job-tag--blue {
  background:#eff6ff;
  color:#1e40af;
  font-weight:600;
}

.reason-pill {
  background:#f8fafc;
  color:#475569;
  padding:3px 8px;
  border-radius:4px;
  font-size:12px;
  display:inline-block;
  cursor:help;
}

.stats-bar {
  margin-top:14px;
  padding:10px;
  border-radius:8px;
  font-size:13px;
}

.stats-blue {
  background:#dbeafe;
  color:#1e40af;
}

.mail-btn {
  padding: 6px 12px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background .15s;
}
.mail-btn:hover:not(:disabled) { background: #1d4ed8; }
.mail-btn:disabled { opacity: .6; cursor: not-allowed; }

.btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin .6s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

.toast-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15,23,42,.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.toast-box {
  background: white;
  border-radius: 12px;
  padding: 20px 22px;
  max-width: 380px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(15,23,42,.18);
}
.toast-box--ok p { color: #15803d; }
.toast-box--err p { color: #b91c1c; }
.toast-box p { font-size: 13.5px; margin: 0 0 14px; }

.toast-close {
  padding: 8px 18px;
  background: #0f172a;
  color: white;
  border: none;
  border-radius: 7px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
</style>