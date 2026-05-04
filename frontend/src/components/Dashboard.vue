<template>
  <div class="page-wrapper">

    <!-- ===== CANDIDATS ===== -->
    <div v-if="!currentPage || currentPage === 'dashboard'">

      <div class="page-header">
        <div>
          <h4 class="page-title">Candidats</h4>
          <p class="page-subtitle">Gestion des candidatures en cours</p>
        </div>
        <span class="count-badge">{{ filteredCandidates.length }} candidat(s)</span>
      </div>

      <div class="card-surface mb-3">
        <div class="d-flex gap-2 flex-wrap">
          <input v-model="searchText" class="form-control form-control-sm search-input" placeholder="Rechercher par nom..." />
          <select v-model="selectedJobId" class="form-select form-select-sm filter-select">
            <option value="">Tous les postes</option>
            <option v-for="job in jobs" :key="job.id" :value="job.id">{{ job.title }}</option>
          </select>
        </div>
      </div>

      <div class="card-surface p-0">
        <table class="table table-hover mb-0 data-table">
          <thead>
            <tr>
              <th>Nom</th><th>Email</th><th>Poste</th><th>Statut</th><th class="text-end">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredCandidates.length === 0">
              <td colspan="5" class="empty-row">Aucun candidat trouvé</td>
            </tr>
            <tr v-for="c in filteredCandidates" :key="c.id">
              <td>
                <div class="candidate-cell">
                  <div class="avatar">{{ initials(c.name) }}</div>
                  <span class="fw-500">{{ c.name || '—' }}</span>
                </div>
              </td>
              <td class="text-muted-sm">{{ c.email || '—' }}</td>
              <td><span class="job-tag">{{ c.job_title || c.subject || 'Non défini' }}</span></td>
              <td><span class="status-badge" :class="statusClass(c.status)">{{ statusLabel(c.status) }}</span></td>
              <td class="text-end"><button class="btn-view" @click="openModal(c)">Consulter</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="currentPage === 'jobs'"><Jobs /></div>
    <div v-if="currentPage === 'admis'"><Admis /></div>
    <div v-if="currentPage === 'refuses'"><Refuses /></div>
    <div v-if="currentPage === 'matching'"><Matching /></div>

    <!-- ===== MODAL DETAILS ===== -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-panel">
        <div class="modal-panel-header">
          <div class="modal-avatar">{{ initials(selectedCandidate.name) }}</div>
          <div>
            <div class="modal-candidate-name">{{ selectedCandidate.name }}</div>
            <div class="modal-candidate-email">{{ selectedCandidate.email }}</div>
          </div>
          <button class="modal-close" @click="closeModal">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="modal-panel-body">
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Poste</div>
              <div class="info-value">{{ selectedCandidate.job_title || selectedCandidate.subject || 'Non défini' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Téléphone</div>
              <div class="info-value">{{ selectedCandidate.phone || '—' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Adresse</div>
              <div class="info-value">{{ selectedCandidate.address || '—' }}</div>
            </div>
          </div>

          <div class="section-block">
            <div class="section-label">Curriculum Vitae</div>
            <iframe v-if="selectedCandidate.cv_link" :src="getCVUrl(selectedCandidate.cv_link)" class="cv-frame"></iframe>
            <p v-else class="no-data">Aucun CV disponible</p>
          </div>

          <div class="section-block">
            <div class="section-label">Contenu de la candidature</div>
            <div class="email-content">{{ selectedCandidate.body || 'Aucun contenu disponible' }}</div>
          </div>

          <div class="section-block">
            <div class="section-label">Compétences</div>
            <div v-if="selectedCandidate.skills && selectedCandidate.skills.length" class="tags-wrap">
              <span v-for="(s, i) in selectedCandidate.skills" :key="i" class="skill-tag">{{ s }}</span>
            </div>
            <p v-else class="no-data">Aucune compétence renseignée</p>
          </div>

          <div class="section-block">
            <div class="section-label">Expérience professionnelle</div>
            <div v-if="selectedCandidate.experience && selectedCandidate.experience.length">
              <div v-for="e in selectedCandidate.experience" :key="e.id" class="timeline-item">
                <div class="timeline-title">{{ e.position }}</div>
                <div class="timeline-sub">{{ e.company }}<span v-if="e.duration"> · {{ e.duration }}</span></div>
              </div>
            </div>
            <p v-else class="no-data">Aucune expérience renseignée</p>
          </div>

          <div class="section-block">
            <div class="section-label">Formation</div>
            <div v-if="selectedCandidate.education && selectedCandidate.education.length">
              <div v-for="ed in selectedCandidate.education" :key="ed.id" class="timeline-item">
                <div class="timeline-title">{{ ed.degree }}</div>
                <div class="timeline-sub">{{ ed.institution }}<span v-if="ed.year"> · {{ ed.year }}</span></div>
              </div>
            </div>
            <p v-else class="no-data">Aucune formation renseignée</p>
          </div>
        </div>

        <div class="modal-panel-footer">
          <button class="btn-action btn-accept" :disabled="actionLoading" @click="acceptCandidate(selectedCandidate.id)">
            <span v-if="actionLoading">Traitement...</span><span v-else>Accepter</span>
          </button>
          <button class="btn-action btn-reject" :disabled="actionLoading" @click="openRejectModal(selectedCandidate)">Refuser</button>
        </div>
      </div>
    </div>

    <!-- ===== MODAL REFUS ===== -->
    <div v-if="showRejectModal" class="modal-overlay" @click.self="closeRejectModal">
      <div class="modal-panel modal-panel-sm">
        <div class="modal-panel-header">
          <div>
            <div class="modal-candidate-name">Refuser {{ rejectTarget && rejectTarget.name }}</div>
            <div class="modal-candidate-email">Un email de refus sera envoyé au candidat</div>
          </div>
          <button class="modal-close" @click="closeRejectModal">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-panel-body">
          <label class="section-label d-block mb-2">Motif du refus <span style="font-weight:400;text-transform:none;letter-spacing:0;">(optionnel)</span></label>
          <textarea v-model="rejectReason" class="form-control reason-textarea" rows="4" placeholder="Profil ne correspondant pas aux critères requis..."></textarea>
        </div>
        <div class="modal-panel-footer">
          <button class="btn-action btn-neutral" @click="closeRejectModal">Annuler</button>
          <button class="btn-action btn-reject" :disabled="actionLoading" @click="confirmReject">
            <span v-if="actionLoading">Envoi...</span><span v-else>Confirmer le refus</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ===== TOAST ===== -->
    <div v-if="toast.show" class="toast-bar" :class="toast.type">{{ toast.message }}</div>

  </div>
</template>

<script>
import Jobs     from './Jobs.vue'
import Admis    from './Admis.vue'
import Refuses  from './Refuses.vue'
import Matching from './Matching.vue'

export default {
  components: { Jobs, Admis, Refuses, Matching },
  props: { currentPage: { type: String, default: 'dashboard' } },
  data() {
    return {
      candidates: [], jobs: [], selectedJobId: '',
      selectedCandidate: { skills: [], experience: [], education: [], cv_link: null, body: '' },
      showModal: false, showRejectModal: false, rejectTarget: null, rejectReason: '',
      actionLoading: false, searchText: '',
      toast: { show: false, message: '', type: 'success' }
    }
  },
  mounted() { this.fetchJobs(); this.fetchCandidates() },
  computed: {
    filteredCandidates() {
      const q = this.searchText.toLowerCase()
      return (this.candidates || []).filter(c => {
        const nameMatch = (c.name || '').toLowerCase().includes(q)
        const jobMatch  = this.selectedJobId ? String(c.job_id) === String(this.selectedJobId) : true
        return nameMatch && jobMatch
      })
    }
  },
  methods: {
    async fetchJobs() {
      try { const res = await fetch('http://localhost:3000/api/jobs'); this.jobs = await res.json() } catch(e){}
    },
    async fetchCandidates() {
      try { const res = await fetch('http://localhost:3000/api/candidates'); const d = await res.json(); this.candidates = Array.isArray(d) ? d : [] } catch(e){}
    },
    async openModal(c) {
      try {
        const res = await fetch(`http://localhost:3000/api/candidates/${c.id}/details`)
        const data = await res.json()
        this.selectedCandidate = { ...data.candidate, skills: (data.skills||[]).map(s=>s.skill_name), experience: data.experience||[], education: data.education||[], cv_link: data.candidate.cv_link||null, body: data.candidate.body||'' }
        this.showModal = true
      } catch(e){}
    },
    closeModal() { this.showModal = false; this.selectedCandidate = { skills:[], experience:[], education:[], cv_link:null, body:'' } },
    async acceptCandidate(id) {
      if (!confirm("Confirmer l'acceptation ?")) return
      this.actionLoading = true
      try {
        const res = await fetch(`http://localhost:3000/api/candidates/${id}/accept`, { method:'POST' })
        const data = await res.json(); if (!res.ok) throw new Error(data.message)
        this.showToast('Candidat accepté — email envoyé.', 'success'); this.closeModal(); this.fetchCandidates()
      } catch(e) { this.showToast("Erreur lors de l'acceptation", 'error') } finally { this.actionLoading = false }
    },
    openRejectModal(c) { this.rejectTarget = c; this.rejectReason = ''; this.showRejectModal = true },
    closeRejectModal() { this.showRejectModal = false; this.rejectTarget = null; this.rejectReason = '' },
    async confirmReject() {
      if (!this.rejectTarget) return
      this.actionLoading = true
      try {
        const res = await fetch(`http://localhost:3000/api/candidates/${this.rejectTarget.id}/reject`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reason: this.rejectReason }) })
        const data = await res.json(); if (!res.ok) throw new Error(data.message)
        this.showToast('Candidat refusé — email envoyé.', 'error'); this.closeRejectModal(); this.closeModal(); this.fetchCandidates()
      } catch(e) { this.showToast('Erreur lors du refus', 'error') } finally { this.actionLoading = false }
    },
    getCVUrl(link) { if (!link) return ''; const c = link.replace(/\\/g,'/'); const i = c.indexOf('uploads/'); return i===-1?'':'http://localhost:3000/'+c.substring(i) },
    showToast(message, type='success') { this.toast = { show:true, message, type }; setTimeout(()=>{ this.toast.show=false }, 3500) },
    initials(name) { if (!name) return '?'; return name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() },
    statusClass(s) { return { 'status-received': s==='RECEIVED', 'status-in-progress': s==='IN_PROGRESS', 'status-accepted': s==='ACCEPTED', 'status-rejected': s==='REJECTED' } },
    statusLabel(s) { const m={RECEIVED:'Reçu',IN_PROGRESS:'En cours',ACCEPTED:'Accepté',REJECTED:'Refusé'}; return m[s]||s||'—' }
  }
}
</script>

<style scoped>
.page-wrapper { padding: 32px 28px 80px; background: #f8fafc; min-height: 100vh; }
.page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }
.page-title { font-size:20px; font-weight:700; color:#0f172a; margin:0; }
.page-subtitle { font-size:13px; color:#94a3b8; margin:2px 0 0; }
.count-badge { background:#e0eaff; color:#1e40af; font-size:12px; font-weight:600; padding:4px 12px; border-radius:20px; }
.card-surface { background:white; border:1px solid #e2e8f0; border-radius:10px; padding:14px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
.search-input { max-width:240px; font-size:13px; border-color:#e2e8f0; }
.filter-select { max-width:220px; font-size:13px; border-color:#e2e8f0; }
.search-input:focus, .filter-select:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,0.1); }
.data-table { font-size:13.5px; }
.data-table thead th { background:#f8fafc; color:#64748b; font-weight:600; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; border-bottom:1px solid #e2e8f0; padding:10px 16px; }
.data-table tbody td { padding:12px 16px; vertical-align:middle; border-color:#f1f5f9; }
.data-table tbody tr:hover td { background:#f8fafc; }
.empty-row { text-align:center; color:#94a3b8; padding:40px !important; font-size:13px; }
.candidate-cell { display:flex; align-items:center; gap:10px; }
.avatar { width:32px; height:32px; border-radius:8px; background:#dbeafe; color:#1e40af; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.fw-500 { font-weight:500; color:#1e293b; }
.text-muted-sm { color:#64748b; font-size:13px; }
.job-tag { background:#f1f5f9; color:#475569; font-size:12px; padding:3px 8px; border-radius:4px; border:1px solid #e2e8f0; white-space:nowrap; }
.status-badge { font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px; letter-spacing:0.03em; }
.status-received    { background:#f1f5f9; color:#475569; }
.status-in-progress { background:#fef3c7; color:#92400e; }
.status-accepted    { background:#dcfce7; color:#15803d; }
.status-rejected    { background:#fee2e2; color:#b91c1c; }
.btn-view { font-size:12px; font-weight:500; padding:5px 14px; border-radius:6px; border:1px solid #e2e8f0; background:white; color:#1e293b; cursor:pointer; transition:all 0.15s; }
.btn-view:hover { background:#0f172a; color:white; border-color:#0f172a; }
.modal-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.55); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px; }
.modal-panel { background:white; width:680px; max-width:100%; max-height:90vh; border-radius:12px; display:flex; flex-direction:column; box-shadow:0 24px 60px rgba(0,0,0,0.2); }
.modal-panel-sm { width:460px; }
.modal-panel-header { display:flex; align-items:center; gap:14px; padding:20px 22px 16px; border-bottom:1px solid #f1f5f9; }
.modal-avatar { width:44px; height:44px; border-radius:10px; background:#dbeafe; color:#1e40af; font-size:14px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.modal-candidate-name { font-size:15px; font-weight:700; color:#0f172a; }
.modal-candidate-email { font-size:12px; color:#94a3b8; margin-top:1px; }
.modal-close { margin-left:auto; background:none; border:none; color:#94a3b8; cursor:pointer; padding:4px; border-radius:6px; transition:background 0.15s; }
.modal-close:hover { background:#f1f5f9; color:#475569; }
.modal-panel-body { overflow-y:auto; flex:1; padding:20px 22px; }
.modal-panel-footer { display:flex; justify-content:flex-end; gap:8px; padding:14px 22px; border-top:1px solid #f1f5f9; }
.info-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px; background:#f8fafc; border-radius:8px; padding:14px; border:1px solid #f1f5f9; }
.info-label { font-size:10px; font-weight:600; letter-spacing:0.08em; color:#94a3b8; text-transform:uppercase; margin-bottom:3px; }
.info-value { font-size:13.5px; font-weight:500; color:#1e293b; }
.section-block { margin-bottom:20px; }
.section-label { font-size:11px; font-weight:700; letter-spacing:0.08em; color:#64748b; text-transform:uppercase; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid #f1f5f9; }
.no-data { font-size:13px; color:#94a3b8; font-style:italic; }
.cv-frame { width:100%; height:380px; border:1px solid #e2e8f0; border-radius:8px; }
.email-content { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px; font-size:13px; color:#475569; max-height:160px; overflow-y:auto; white-space:pre-line; line-height:1.6; }
.tags-wrap { display:flex; flex-wrap:wrap; gap:6px; }
.skill-tag { background:#eff6ff; color:#1e40af; font-size:12px; padding:3px 10px; border-radius:4px; border:1px solid #bfdbfe; }
.timeline-item { padding:8px 0; border-bottom:1px solid #f8fafc; }
.timeline-item:last-child { border-bottom:none; }
.timeline-title { font-size:13.5px; font-weight:600; color:#1e293b; }
.timeline-sub { font-size:12px; color:#64748b; margin-top:2px; }
.btn-action { padding:8px 20px; border-radius:7px; font-size:13px; font-weight:600; border:none; cursor:pointer; transition:all 0.15s; }
.btn-accept { background:#16a34a; color:white; }
.btn-accept:hover:not(:disabled) { background:#15803d; }
.btn-reject { background:#dc2626; color:white; }
.btn-reject:hover:not(:disabled) { background:#b91c1c; }
.btn-neutral { background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; }
.btn-neutral:hover { background:#e2e8f0; }
.btn-action:disabled { opacity:0.55; cursor:not-allowed; }
.reason-textarea { font-size:13px; border-color:#e2e8f0; resize:vertical; }
.reason-textarea:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,0.1); }
.toast-bar { position:fixed; bottom:60px; right:24px; padding:12px 20px; border-radius:8px; color:white; font-size:13.5px; font-weight:500; z-index:99999; box-shadow:0 8px 24px rgba(0,0,0,0.15); animation:slideUp 0.25s ease; }
.toast-bar.success { background:#16a34a; }
.toast-bar.error   { background:#dc2626; }
@keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
</style>