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
      <div v-for="job in jobs" :key="job.job_id" class="job-block">

        <div class="job-header">
          <div class="job-info">
            <span class="job-title">{{ job.job_title }}</span>
            <span v-if="job.company"              class="job-meta">🏢 {{ job.company }}</span>
            <span v-if="job.location"             class="job-meta">📍 {{ job.location }}</span>
            <span v-if="job.education_level"      class="job-meta">🎓 {{ job.education_level }}</span>
            <span v-if="job.experience_required"  class="job-meta">⏱ {{ job.experience_required }}</span>
          </div>
          <span class="cand-count">{{ job.candidates.length }} candidat(s)</span>
        </div>

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

              <td>
                <div class="cand-cell">
                  <div class="avatar">{{ initials(c.name) }}</div>
                  <div>
                    <div class="cand-name">{{ c.name || '—' }}</div>
                    <div class="cand-email">{{ c.email || '—' }}</div>
                  </div>
                </div>
              </td>

              <td class="muted small">{{ c.applied_subject || '—' }}</td>

              <td>
                <div class="score-wrap">
                  <div class="score-bar-bg">
                    <div class="score-bar-fill" :style="{ width: c.score + '%' }" :class="scoreBarClass(c.score)"></div>
                  </div>
                  <span class="score-val" :class="scoreBadgeClass(c.score)">{{ c.score }}%</span>
                </div>
              </td>

              <td>
                <span class="decision-badge" :class="decisionClass(c.score)">
                  {{ decisionLabel(c.score) }}
                </span>
              </td>

              <td>
                <div class="action-btns">
                  <button class="btn-accept" @click="openAcceptModal(c)">✓ Accepter</button>
                  <button class="btn-reject" @click="openRejectModal(c)">✗ Refuser</button>
                </div>
              </td>

            </tr>
          </tbody>
        </table>

      </div>
    </div>

    <!-- ═══════════════════════════════════════════════
         MODAL ACCEPTER
    ════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="acceptModal.visible" class="modal-overlay" @click.self="closeAcceptModal">
        <div class="modal-box">
          <div class="modal-icon modal-icon--accept">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h3 class="modal-title">Confirmer l'acceptation</h3>
          <p class="modal-body">
            Vous êtes sur le point d'accepter
            <strong>{{ acceptModal.candidate?.name }}</strong>.
            Cette action est définitive et retirera le candidat de la liste de matching.
          </p>
          <div class="modal-actions">
            <button class="modal-btn modal-btn--cancel" @click="closeAcceptModal">
              Annuler
            </button>
            <button class="modal-btn modal-btn--accept" :disabled="actionLoading" @click="confirmAccept">
              <span v-if="actionLoading" class="btn-spinner"></span>
              <span v-else>✓ Confirmer l'acceptation</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ═══════════════════════════════════════════════
         MODAL REFUSER
    ════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="rejectModal.visible" class="modal-overlay" @click.self="closeRejectModal">
        <div class="modal-box">
          <div class="modal-icon modal-icon--reject">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </div>
          <h3 class="modal-title">Confirmer le refus</h3>
          <p class="modal-body">
            Vous êtes sur le point de refuser
            <strong>{{ rejectModal.candidate?.name }}</strong>.
          </p>
          <div class="modal-field">
            <label class="field-label">Motif du refus <span class="field-optional">(optionnel)</span></label>
            <textarea
              v-model="rejectModal.reason"
              class="field-textarea"
              placeholder="Ex : profil ne correspond pas aux critères requis..."
              rows="3"
            ></textarea>
          </div>
          <div class="modal-actions">
            <button class="modal-btn modal-btn--cancel" @click="closeRejectModal">
              Annuler
            </button>
            <button class="modal-btn modal-btn--reject" :disabled="actionLoading" @click="confirmReject">
              <span v-if="actionLoading" class="btn-spinner"></span>
              <span v-else>✗ Confirmer le refus</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"

const API = "http://localhost:3000/api"
const jobs         = ref([])
const loading      = ref(false)
const actionLoading = ref(false)

// ─── État des modals ────────────────────────────────────────
const acceptModal = ref({ visible: false, candidate: null })
const rejectModal = ref({ visible: false, candidate: null, reason: "" })

// ─── Chargement du matching ─────────────────────────────────
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

// ─── Modal Accepter ─────────────────────────────────────────
function openAcceptModal(candidate) {
  acceptModal.value = { visible: true, candidate }
}

function closeAcceptModal() {
  acceptModal.value = { visible: false, candidate: null }
}

async function confirmAccept() {
  if (!acceptModal.value.candidate) return
  actionLoading.value = true
  try {
    await fetch(`${API}/candidates/${acceptModal.value.candidate.id}/accept`, { method: "POST" })
    closeAcceptModal()
    await loadMatching()
  } catch (err) {
    console.error(err)
  } finally {
    actionLoading.value = false
  }
}

// ─── Modal Refuser ──────────────────────────────────────────
function openRejectModal(candidate) {
  rejectModal.value = { visible: true, candidate, reason: "" }
}

function closeRejectModal() {
  rejectModal.value = { visible: false, candidate: null, reason: "" }
}

async function confirmReject() {
  if (!rejectModal.value.candidate) return
  actionLoading.value = true
  try {
    await fetch(`${API}/candidates/${rejectModal.value.candidate.id}/reject`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ reason: rejectModal.value.reason }),
    })
    closeRejectModal()
    await loadMatching()
  } catch (err) {
    console.error(err)
  } finally {
    actionLoading.value = false
  }
}

// ─── Utilitaires d'affichage ────────────────────────────────
const initials      = (n) => n ? n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : "?"
const scoreBarClass   = (s) => s >= 75 ? "bar-green"  : s >= 50 ? "bar-amber"  : "bar-red"
const scoreBadgeClass = (s) => s >= 75 ? "val-green"  : s >= 50 ? "val-amber"  : "val-red"
const rowClass        = (s) => s >= 75 ? "row-green"  : s >= 50 ? "row-amber"  : ""
const decisionClass   = (s) => s >= 75 ? "dec-strong" : s >= 50 ? "dec-medium" : "dec-low"
const decisionLabel   = (s) => s >= 75 ? "Forte adéquation" : s >= 50 ? "À examiner" : "Faible adéquation"

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
.state-box   { text-align:center; padding:60px 24px; color:#94a3b8; font-size:14px; display:flex; flex-direction:column; align-items:center; gap:12px; }
.state-empty { background:white; border:1px solid #e2e8f0; border-radius:12px; }
.spinner     { width:28px; height:28px; border:3px solid #e2e8f0; border-top-color:#2563eb; border-radius:50%; animation:spin .7s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

/* Bloc job */
.job-block  { background:white; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:20px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.04); }
.job-header { display:flex; justify-content:space-between; align-items:center; padding:14px 18px; background:#f8fafc; border-bottom:1px solid #e2e8f0; flex-wrap:wrap; gap:8px; }
.job-info   { display:flex; align-items:center; flex-wrap:wrap; gap:10px; }
.job-title  { font-size:14px; font-weight:700; color:#0f172a; }
.job-meta   { font-size:12px; color:#64748b; background:#f1f5f9; padding:2px 8px; border-radius:4px; border:1px solid #e2e8f0; }
.cand-count { font-size:12px; font-weight:600; color:#2563eb; background:#dbeafe; padding:3px 10px; border-radius:20px; }

/* Table */
.match-table          { width:100%; border-collapse:collapse; font-size:13px; }
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
.score-wrap    { display:flex; align-items:center; gap:10px; }
.score-bar-bg  { flex:1; height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden; min-width:80px; }
.score-bar-fill { height:100%; border-radius:3px; transition:width .4s; }
.bar-green { background:#16a34a; }
.bar-amber { background:#d97706; }
.bar-red   { background:#dc2626; }
.score-val { font-size:13px; font-weight:700; min-width:38px; text-align:right; }
.val-green { color:#16a34a; }
.val-amber { color:#d97706; }
.val-red   { color:#dc2626; }

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

/* ════════════════════════════════
   MODALS
════════════════════════════════ */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn .15s ease;
}

@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

.modal-box {
  background: white;
  border-radius: 16px;
  padding: 32px 28px 24px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(15,23,42,.18);
  animation: slideUp .18s ease;
}

@keyframes slideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }

.modal-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 18px;
}

.modal-icon--accept { background: #dcfce7; color: #15803d; }
.modal-icon--reject { background: #fee2e2; color: #b91c1c; }

.modal-title {
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
  text-align: center;
  margin: 0 0 10px;
}

.modal-body {
  font-size: 13.5px;
  color: #475569;
  text-align: center;
  line-height: 1.6;
  margin: 0 0 20px;
}

.modal-body strong { color: #0f172a; }

/* Champ textarea (modal refus) */
.modal-field    { margin-bottom: 20px; }
.field-label    { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px; }
.field-optional { font-weight: 400; color: #94a3b8; }
.field-textarea {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  color: #0f172a;
  resize: vertical;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color .15s;
}
.field-textarea:focus { border-color: #94a3b8; }

/* Boutons modal */
.modal-actions { display: flex; gap: 10px; }

.modal-btn {
  flex: 1;
  padding: 10px 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all .15s;
}

.modal-btn:disabled { opacity: .6; cursor: not-allowed; }

.modal-btn--cancel {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}
.modal-btn--cancel:hover:not(:disabled) { background: #e2e8f0; }

.modal-btn--accept {
  background: #16a34a;
  color: white;
}
.modal-btn--accept:hover:not(:disabled) { background: #15803d; }

.modal-btn--reject {
  background: #dc2626;
  color: white;
}
.modal-btn--reject:hover:not(:disabled) { background: #b91c1c; }

/* Spinner dans les boutons */
.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin .6s linear infinite;
  display: inline-block;
}
</style>