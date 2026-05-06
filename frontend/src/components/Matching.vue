<template>
  <div class="page-wrapper">
    <div class="page-header">
      <div>
        <h4 class="page-title">Matching Candidats / Postes</h4>
        <p class="page-sub">Score de compatibilité calculé par TF-IDF</p>
      </div>
      <button class="btn-refresh" @click="fetchMatches" :disabled="loading">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Actualiser
      </button>
    </div>

    <div class="card-surface mb-3">
      <div class="filter-row">
        <div class="select-wrap">
          <label>Poste :</label>
          <select v-model="selectedJobId" class="f-select" @change="searchText=''">
            <option value="">Tous les postes</option>
            <option v-for="job in jobs" :key="job.id" :value="job.id">{{ job.title }}</option>
          </select>
        </div>
        <input v-model="searchText" class="f-input" placeholder="Rechercher un candidat..." />
        <span v-if="filtered.length" class="result-count">{{ filtered.length }} résultat(s)</span>
      </div>
    </div>

    <div v-if="loading" class="state-box">
      <div class="spinner"></div>
      <p>Calcul des correspondances...</p>
    </div>
    <div v-else-if="error" class="error-box">{{ error }}</div>
    <div v-else-if="filtered.length === 0" class="state-box">
      Aucune correspondance trouvée. Assurez-vous que les offres ont une description et que les candidats ont des compétences renseignées.
    </div>
    <div v-else class="card-surface p-0">
      <table class="data-table">
        <thead>
          <tr><th>#</th><th>Candidat</th><th>Poste</th><th>Compatibilité</th><th>Score</th><th>Mots-clés</th></tr>
        </thead>
        <tbody>
          <tr v-for="(m, i) in filtered" :key="m.candidateId+'-'+m.jobId" :class="rowClass(m.scorePercent)">
            <td class="rank">{{ i+1 }}</td>
            <td>
              <div class="cand-cell">
                <div class="avatar">{{ initials(m.candidateName) }}</div>
                <div>
                  <div class="cand-name">{{ m.candidateName }}</div>
                  <div class="cand-email">{{ m.candidateEmail }}</div>
                </div>
              </div>
            </td>
            <td><span class="job-badge">{{ m.jobTitle }}</span></td>
            <td>
              <div class="prog-wrap">
                <div class="prog-track">
                  <div class="prog-fill" :class="pillClass(m.scorePercent)" :style="{width:m.scorePercent+'%'}"></div>
                </div>
                <span class="prog-pct">{{ m.scorePercent }}%</span>
              </div>
            </td>
            <td><span class="score-pill" :class="pillClass(m.scorePercent)">{{ m.scorePercent }}%</span></td>
            <td>
              <div class="tags-row">
                <span v-for="(t,ti) in (m.matchedItems||[]).slice(0,5)" :key="ti" class="match-tag">{{ t }}</span>
                <span v-if="!m.matchedItems||m.matchedItems.length===0" class="muted">—</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Matching',
  data() { return { allMatches:[], jobs:[], selectedJobId:'', searchText:'', loading:false, error:null } },
  computed: {
    matches() { return this.selectedJobId ? this.allMatches.filter(m=>String(m.jobId)===String(this.selectedJobId)) : this.allMatches },
    filtered() {
      const q = this.searchText.toLowerCase().trim()
      if (!q) return this.matches
      return this.matches.filter(m=>(m.candidateName||'').toLowerCase().includes(q)||(m.candidateEmail||'').toLowerCase().includes(q)||(m.jobTitle||'').toLowerCase().includes(q))
    }
  },
  mounted() { this.fetchJobs(); this.fetchMatches() },
  methods: {
    async fetchJobs() {
      try { const r=await fetch('http://localhost:3000/api/jobs'); const d=await r.json(); this.jobs=Array.isArray(d)?d:[] } catch(e){}
    },
    async fetchMatches() {
      this.loading=true; this.error=null
      try {
        const r=await fetch('http://localhost:3000/api/match'); const d=await r.json()
        if(!Array.isArray(d)) { this.error='Réponse inattendue du serveur.'; this.allMatches=[]; return }
        this.allMatches=d
      } catch(e) { this.error='Impossible de contacter le serveur de matching.' } finally { this.loading=false }
    },
    pillClass(p) { return p>=60?'high':p>=30?'medium':'low' },
    rowClass(p) { return p>=60?'row-high':p>=30?'row-medium':'' },
    initials(n) { if(!n) return '?'; return n.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() }
  }
}
</script>

<style scoped>
.page-wrapper { padding:32px 28px 80px; background:#f8fafc; min-height:100vh; }
.page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }
.page-title { font-size:20px; font-weight:700; color:#0f172a; margin:0; }
.page-sub { font-size:13px; color:#94a3b8; margin:2px 0 0; }
.btn-refresh { display:flex; align-items:center; gap:6px; padding:7px 16px; background:white; border:1px solid #e2e8f0; border-radius:7px; font-size:13px; font-weight:500; color:#475569; cursor:pointer; transition:all 0.15s; }
.btn-refresh:hover:not(:disabled) { background:#0f172a; color:white; border-color:#0f172a; }
.btn-refresh:disabled { opacity:0.5; cursor:not-allowed; }
.card-surface { background:white; border:1px solid #e2e8f0; border-radius:10px; padding:14px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
.p-0{padding:0;} .mb-3{margin-bottom:14px;}
.filter-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.select-wrap { display:flex; align-items:center; gap:8px; }
.select-wrap label { font-size:13px; color:#475569; font-weight:500; white-space:nowrap; }
.f-select { padding:7px 12px; border:1px solid #e2e8f0; border-radius:7px; font-size:13px; outline:none; background:white; min-width:200px; }
.f-select:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,0.1); }
.f-input { padding:7px 12px; border:1px solid #e2e8f0; border-radius:7px; font-size:13px; outline:none; width:220px; }
.f-input:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,0.1); }
.result-count { font-size:12px; color:#94a3b8; margin-left:auto; }
.state-box { text-align:center; padding:60px 20px; background:white; border-radius:10px; border:1px solid #e2e8f0; color:#94a3b8; font-size:13px; }
.error-box { padding:16px 20px; background:#fef2f2; border:1px solid #fca5a5; border-radius:8px; color:#dc2626; font-size:13px; }
.spinner { width:32px; height:32px; margin:0 auto 12px; border:3px solid #e5e7eb; border-top-color:#3b82f6; border-radius:50%; animation:spin 0.8s linear infinite; }
@keyframes spin{to{transform:rotate(360deg)}}
.data-table { width:100%; border-collapse:collapse; font-size:13px; }
.data-table thead th { background:#f8fafc; color:#64748b; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; padding:10px 16px; border-bottom:1px solid #e2e8f0; text-align:left; }
.data-table tbody td { padding:12px 16px; vertical-align:middle; border-bottom:1px solid #f1f5f9; }
.data-table tbody tr:last-child td { border-bottom:none; }
.data-table tbody tr:hover td { background:#f8fafc; }
.row-high td { background:#f0fdf4; }
.row-medium td { background:#fffbeb; }
.rank { font-weight:700; color:#94a3b8; font-size:13px; }
.cand-cell { display:flex; align-items:center; gap:10px; }
.avatar { width:32px; height:32px; border-radius:8px; background:#dbeafe; color:#1e40af; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.cand-name { font-weight:600; color:#1e293b; font-size:13px; }
.cand-email { font-size:11px; color:#94a3b8; }
.job-badge { background:#dbeafe; color:#1d4ed8; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; white-space:nowrap; }
.prog-wrap { display:flex; align-items:center; gap:8px; }
.prog-track { flex:1; background:#f1f5f9; border-radius:99px; height:7px; overflow:hidden; min-width:80px; }
.prog-fill { height:100%; border-radius:99px; transition:width 0.6s ease; }
.prog-pct { font-size:11px; color:#64748b; width:30px; flex-shrink:0; }
.score-pill { padding:3px 10px; border-radius:20px; font-weight:700; font-size:12px; color:white; }
.high { background:#16a34a; }
.medium { background:#d97706; }
.low { background:#94a3b8; }
.tags-row { display:flex; flex-wrap:wrap; gap:4px; }
.match-tag { background:#f3f4f6; color:#374151; font-size:11px; padding:2px 7px; border-radius:4px; border:1px solid #e5e7eb; }
.muted { color:#94a3b8; font-size:13px; }
</style>