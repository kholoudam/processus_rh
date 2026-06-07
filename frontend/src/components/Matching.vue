<template>
  <div class="matching-page">

    <div class="page-header">
      <div>
        <h2>Matching Candidats ↔ Offres</h2>
        <p>Chaque candidat est comparé uniquement au poste pour lequel il a postulé.</p>
      </div>
      <button class="btn-refresh" @click="loadMatching" :disabled="loading">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Recalculer
      </button>
    </div>

    <!-- Chargement -->
    <div v-if="loading" class="state-box">
      <div class="spinner"></div>
      <p>Calcul du matching en cours...</p>
    </div>

    <!-- Aucun résultat -->
    <div v-else-if="!jobs.length" class="state-box state-empty">
      <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" stroke-width="1.5">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <p>Aucun résultat — vérifiez que des candidatures et des offres existent en base.</p>
    </div>

    <!-- Résultats groupés par poste -->
    <div v-else>

      <!-- Un bloc par job -->
      <div
        v-for="job in jobs"
        :key="job.job_id"
        class="job-block"
      >
        <!-- En-tête du poste -->
        <div class="job-header">
          <div class="job-info">
            <span class="job-title">{{ job.job_title }}</span>
            <span v-if="job.company"  class="job-meta">🏢 {{ job.company }}</span>
            <span v-if="job.location" class="job-meta">📍 {{ job.location }}</span>
            <span v-if="job.education_level"     class="job-meta">🎓 {{ job.education_level }}</span>
            <span v-if="job.experience_required" class="job-meta">⏱ {{ job.experience_required }}</span>
          </div>
          <span class="cand-count">{{ job.candidates.length }} candidat(s)</span>
        </div>

        <!-- Table des candidats pour ce poste -->
        <table class="match-table">
          <thead>
            <tr>
              <th>Candidat</th>
              <th>Email postulé</th>
              <th>Score global</th>
              <th>Décision</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in job.candidates" :key="c.id" :class="rowClass(c.score)">

              <!-- Candidat -->
              <td>
                <div class="cand-cell">
                  <div class="avatar">{{ initials(c.name) }}</div>
                  <div>
                    <div class="cand-name">{{ c.name || '—' }}</div>
                    <div class="cand-email">{{ c.email || '—' }}</div>
                  </div>
                </div>
              </td>

              <!-- Sujet email postulé -->
              <td class="muted small">{{ c.applied_subject || '—' }}</td>

              <!-- Score avec barre de progression -->
              <td>
                <div class="score-wrap">
                  <div class="score-bar-bg">
                    <div class="score-bar-fill" :style="{ width: c.score + '%' }" :class="scoreBarClass(c.score)"></div>
                  </div>
                  <span class="score-val" :class="scoreBadgeClass(c.score)">{{ c.score }}%</span>
                </div>
              </td>

              <!-- Décision -->
              <td>
                <span class="decision-badge" :class="decisionClass(c.score)">
                  {{ decisionLabel(c.score) }}
                </span>
              </td>

              <!-- Actions -->
              <td>
                <div class="action-btns">
                  <button class="btn-accept" @click="accept(c.id)">✓ Accepter</button>
                  <button class="btn-reject" @click="reject(c.id)">✗ Refuser</button>
                </div>
              </td>

            </tr>
          </tbody>
        </table>

      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"

const API = "http://localhost:3000/api"
const jobs    = ref([])
const loading = ref(false)

async function loadMatching() {
  loading.value = true
  try {
    const res  = await fetch(`${API}/matching`)
    const data = await res.json()
    jobs.value = data.jobs || []
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function accept(id) {
  if (!confirm("Accepter ce candidat ?")) return
  await fetch(`${API}/candidates/${id}/accept`, { method: "POST" })
  await loadMatching()
}

async function reject(id) {
  const reason = prompt("Motif du refus (optionnel)") ?? ""
  await fetch(`${API}/candidates/${id}/reject`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ reason }),
  })
  await loadMatching()
}

// ─── Utilitaires d'affichage ───────────────────────────────
const initials = (n) => n ? n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : "?"

const scoreBarClass    = (s) => s >= 75 ? "bar-green"  : s >= 50 ? "bar-amber"  : "bar-red"
const scoreBadgeClass  = (s) => s >= 75 ? "val-green"  : s >= 50 ? "val-amber"  : "val-red"
const rowClass         = (s) => s >= 75 ? "row-green"  : s >= 50 ? "row-amber"  : ""
const decisionClass    = (s) => s >= 75 ? "dec-strong" : s >= 50 ? "dec-medium" : "dec-low"
const decisionLabel    = (s) => s >= 75 ? "Forte adéquation" : s >= 50 ? "À examiner" : "Faible adéquation"

onMounted(loadMatching)
</script>

<style scoped>
.matching-page  { padding: 28px 24px 80px; background: #f8fafc; min-height: 100vh; }

/* Header */
.page-header    { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; }
.page-header h2 { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
.page-header p  { font-size:13px; color:#64748b; margin:4px 0 0; }
.btn-refresh    { display:flex; align-items:center; gap:6px; padding:8px 16px; background:white; border:1px solid #e2e8f0; border-radius:8px; font-size:13px; font-weight:500; color:#475569; cursor:pointer; transition:all .15s; }
.btn-refresh:hover:not(:disabled) { background:#0f172a; color:white; border-color:#0f172a; }
.btn-refresh:disabled { opacity:.5; cursor:not-allowed; }

/* États */
.state-box  { text-align:center; padding:60px 24px; color:#94a3b8; font-size:14px; display:flex; flex-direction:column; align-items:center; gap:12px; }
.state-empty { background:white; border:1px solid #e2e8f0; border-radius:12px; }
.spinner { width:28px; height:28px; border:3px solid #e2e8f0; border-top-color:#2563eb; border-radius:50%; animation:spin .7s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

/* Bloc job */
.job-block  { background:white; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:20px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.04); }
.job-header { display:flex; justify-content:space-between; align-items:center; padding:14px 18px; background:#f8fafc; border-bottom:1px solid #e2e8f0; flex-wrap:wrap; gap:8px; }
.job-info   { display:flex; align-items:center; flex-wrap:wrap; gap:10px; }
.job-title  { font-size:14px; font-weight:700; color:#0f172a; }
.job-meta   { font-size:12px; color:#64748b; background:#f1f5f9; padding:2px 8px; border-radius:4px; border:1px solid #e2e8f0; }
.cand-count { font-size:12px; font-weight:600; color:#2563eb; background:#dbeafe; padding:3px 10px; border-radius:20px; }

/* Table */
.match-table { width:100%; border-collapse:collapse; font-size:13px; }
.match-table thead th { background:#f8fafc; color:#64748b; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:10px 16px; border-bottom:1px solid #e2e8f0; text-align:left; }
.match-table tbody td { padding:12px 16px; border-bottom:1px solid #f8fafc; vertical-align:middle; }
.match-table tbody tr:last-child td { border-bottom:none; }
.match-table tbody tr:hover td { background:#f8fafc; }
.row-green td { border-left:3px solid #16a34a; }
.row-amber td { border-left:3px solid #d97706; }

/* Candidat cell */
.cand-cell  { display:flex; align-items:center; gap:10px; }
.avatar     { width:32px; height:32px; border-radius:8px; background:#dbeafe; color:#1e40af; font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.cand-name  { font-weight:600; color:#0f172a; }
.cand-email { font-size:11px; color:#94a3b8; }
.muted      { color:#64748b; }
.small      { font-size:12px; }

/* Score */
.score-wrap   { display:flex; align-items:center; gap:10px; }
.score-bar-bg { flex:1; height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden; min-width:80px; }
.score-bar-fill { height:100%; border-radius:3px; transition:width .4s; }
.bar-green  { background:#16a34a; }
.bar-amber  { background:#d97706; }
.bar-red    { background:#dc2626; }
.score-val  { font-size:13px; font-weight:700; min-width:38px; text-align:right; }
.val-green  { color:#16a34a; }
.val-amber  { color:#d97706; }
.val-red    { color:#dc2626; }

/* Décision */
.decision-badge { font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px; }
.dec-strong { background:#dcfce7; color:#15803d; }
.dec-medium { background:#fef3c7; color:#92400e; }
.dec-low    { background:#fee2e2; color:#b91c1c; }

/* Actions */
.action-btns { display:flex; gap:6px; }
.btn-accept  { padding:5px 12px; background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; }
.btn-accept:hover { background:#16a34a; color:white; border-color:#16a34a; }
.btn-reject  { padding:5px 12px; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; }
.btn-reject:hover { background:#dc2626; color:white; border-color:#dc2626; }
</style>