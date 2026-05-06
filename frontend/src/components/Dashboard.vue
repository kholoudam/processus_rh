<template>
  <div class="dash-page">

    <div class="dash-header">
      <div>
        <h4 class="dash-title">Tableau de bord</h4>
        <p class="dash-sub">Vue d'ensemble du recrutement &mdash; {{ today }}</p>
      </div>
      <button class="btn-refresh" @click="fetchAll" :disabled="loading">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Actualiser
      </button>
    </div>

    <!-- KPI CARDS -->
    <div class="kpi-grid">
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <div class="kpi-value">{{ stats.total }}</div>
        <div class="kpi-label">Total candidats</div>
      </div>
      <div class="kpi-card kpi-amber">
        <div class="kpi-icon"><svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
        <div class="kpi-value">{{ stats.inProgress }}</div>
        <div class="kpi-label">En cours</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
        <div class="kpi-value">{{ stats.accepted }}</div>
        <div class="kpi-label">Admis</div>
      </div>
      <div class="kpi-card kpi-red">
        <div class="kpi-icon"><svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
        <div class="kpi-value">{{ stats.rejected }}</div>
        <div class="kpi-label">Refusés</div>
      </div>
      <div class="kpi-card kpi-indigo">
        <div class="kpi-icon"><svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></div>
        <div class="kpi-value">{{ stats.jobs }}</div>
        <div class="kpi-label">Offres actives</div>
      </div>
      <div class="kpi-card kpi-slate">
        <div class="kpi-icon"><svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.37 19a19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div>
        <div class="kpi-value">{{ stats.received }}</div>
        <div class="kpi-label">Reçus ce mois</div>
      </div>
    </div>

    <!-- CHARTS ROW -->
    <div class="charts-row">

      <!-- Statuts -->
      <div class="chart-card">
        <div class="chart-title">Répartition par statut</div>
        <div class="chart-body">
          <div v-if="loading" class="chart-loading">Chargement...</div>
          <div v-else class="bar-chart">
            <div v-for="item in statusChart" :key="item.label" class="bar-row">
              <div class="bar-label">{{ item.label }}</div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: item.pct + '%', background: item.color }"></div>
              </div>
              <div class="bar-count">{{ item.value }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top postes -->
      <div class="chart-card">
        <div class="chart-title">Candidats par poste</div>
        <div class="chart-body">
          <div v-if="loading" class="chart-loading">Chargement...</div>
          <div v-else-if="jobChart.length === 0" class="chart-empty">Aucune donnée</div>
          <div v-else class="bar-chart">
            <div v-for="item in jobChart" :key="item.label" class="bar-row">
              <div class="bar-label" :title="item.label">{{ item.label.length > 22 ? item.label.slice(0,22)+'…' : item.label }}</div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: item.pct + '%', background: '#2563eb' }"></div>
              </div>
              <div class="bar-count">{{ item.value }}</div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- RECENT CANDIDATES -->
    <div class="card-surface mt-4">
      <div class="section-header">
        <span class="section-title">Candidatures récentes</span>
        <span class="section-count">{{ recentCandidates.length }} affichés</span>
      </div>
      <table class="data-table">
        <thead>
          <tr><th>Nom</th><th>Email</th><th>Poste</th><th>Statut</th><th>Date</th></tr>
        </thead>
        <tbody>
          <tr v-if="!recentCandidates.length">
            <td colspan="5" class="empty-row">Aucune candidature récente</td>
          </tr>
          <tr v-for="c in recentCandidates" :key="c.id">
            <td>
              <div class="cand-cell">
                <div class="avatar">{{ initials(c.name) }}</div>
                <span>{{ c.name || '—' }}</span>
              </div>
            </td>
            <td class="muted">{{ c.email || '—' }}</td>
            <td><span class="job-tag">{{ c.job_title || c.subject || 'N/D' }}</span></td>
            <td><span class="status-dot" :class="statusClass(c.status)">{{ statusLabel(c.status) }}</span></td>
            <td class="muted">{{ formatDate(c.applied_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script>
export default {
  name: 'Dashboard',
  emits: ['counts'],
  data() {
    return {
      loading: false,
      candidates: [],
      jobs: [],
      admis: [],
      refuses: [],
    }
  },
  computed: {
    today() {
      return new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    },
    stats() {
      const all = this.candidates.length + this.admis.length + this.refuses.length
      return {
        total:      all,
        inProgress: this.candidates.filter(c => ['IN_PROGRESS','INTERVIEW','TEST','FINAL'].includes(c.status)).length,
        received:   this.candidates.filter(c => c.status === 'RECEIVED').length,
        accepted:   this.admis.length,
        rejected:   this.refuses.length,
        jobs:       this.jobs.length,
      }
    },
    statusChart() {
      const all = [...this.candidates, ...this.admis.map(a => ({...a, status:'ACCEPTED'})), ...this.refuses.map(r => ({...r, status:'REJECTED'}))]
      const map = { RECEIVED:0, IN_PROGRESS:0, ACCEPTED:0, REJECTED:0 }
      all.forEach(c => { if (map[c.status] !== undefined) map[c.status]++ })
      const max = Math.max(...Object.values(map), 1)
      const colors = { RECEIVED:'#64748b', IN_PROGRESS:'#d97706', ACCEPTED:'#16a34a', REJECTED:'#dc2626' }
      const labels = { RECEIVED:'Reçu', IN_PROGRESS:'En cours', ACCEPTED:'Admis', REJECTED:'Refusé' }
      return Object.entries(map).map(([k,v]) => ({ label: labels[k], value: v, pct: Math.round(v/max*100), color: colors[k] }))
    },
    jobChart() {
      const map = {}
      this.candidates.forEach(c => {
        const t = c.job_title || c.subject || 'Non défini'
        map[t] = (map[t]||0) + 1
      })
      const entries = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,6)
      const max = entries[0]?.[1] || 1
      return entries.map(([l,v]) => ({ label:l, value:v, pct: Math.round(v/max*100) }))
    },
    recentCandidates() {
      return [...this.candidates].slice(0, 8)
    }
  },
  mounted() { this.fetchAll() },
  methods: {
    async fetchAll() {
      this.loading = true
      try {
        const [cRes, jRes, aRes, rRes] = await Promise.all([
          fetch('http://localhost:3000/api/candidates').then(r=>r.json()),
          fetch('http://localhost:3000/api/jobs').then(r=>r.json()),
          fetch('http://localhost:3000/api/candidates/admis').then(r=>r.json()),
          fetch('http://localhost:3000/api/candidates/refuses').then(r=>r.json()),
        ])
        this.candidates = Array.isArray(cRes) ? cRes : []
        this.jobs       = Array.isArray(jRes) ? jRes : []
        this.admis      = Array.isArray(aRes) ? aRes : []
        this.refuses    = Array.isArray(rRes) ? rRes : []
        this.$emit('counts', { candidates: this.candidates.length, admis: this.admis.length, refuses: this.refuses.length })
      } catch(e) { console.error(e) } finally { this.loading = false }
    },
    initials(n) { if(!n) return '?'; return n.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() },
    statusClass(s) { return { 'dot-received':s==='RECEIVED','dot-progress':['IN_PROGRESS','INTERVIEW','TEST','FINAL'].includes(s),'dot-accepted':s==='ACCEPTED','dot-rejected':s==='REJECTED' } },
    statusLabel(s) { const m={RECEIVED:'Reçu',IN_PROGRESS:'En cours',INTERVIEW:'Entretien',TEST:'Test',FINAL:'Final',ACCEPTED:'Admis',REJECTED:'Refusé'}; return m[s]||s||'—' },
    formatDate(d) { if(!d) return '—'; return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) }
  }
}
</script>

<style scoped>
.dash-page { padding:32px 28px 80px; background:#f8fafc; min-height:100vh; }
.dash-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:28px; }
.dash-title { font-size:20px; font-weight:700; color:#0f172a; margin:0; }
.dash-sub { font-size:13px; color:#94a3b8; margin:3px 0 0; text-transform:capitalize; }
.btn-refresh { display:flex; align-items:center; gap:6px; padding:7px 16px; background:white; border:1px solid #e2e8f0; border-radius:7px; font-size:13px; font-weight:500; color:#475569; cursor:pointer; transition:all 0.15s; }
.btn-refresh:hover:not(:disabled) { background:#0f172a; color:white; border-color:#0f172a; }
.btn-refresh:disabled { opacity:0.5; cursor:not-allowed; }

/* KPI */
.kpi-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:14px; margin-bottom:24px; }
.kpi-card { background:white; border:1px solid #e2e8f0; border-radius:10px; padding:18px 16px; display:flex; flex-direction:column; gap:6px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
.kpi-icon { width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; margin-bottom:2px; }
.kpi-value { font-size:28px; font-weight:800; color:#0f172a; line-height:1; }
.kpi-label { font-size:11px; color:#94a3b8; font-weight:500; letter-spacing:0.03em; }
.kpi-blue .kpi-icon { background:#dbeafe; color:#1d4ed8; }
.kpi-amber .kpi-icon { background:#fef3c7; color:#d97706; }
.kpi-green .kpi-icon { background:#dcfce7; color:#16a34a; }
.kpi-red .kpi-icon { background:#fee2e2; color:#dc2626; }
.kpi-indigo .kpi-icon { background:#e0e7ff; color:#4338ca; }
.kpi-slate .kpi-icon { background:#f1f5f9; color:#475569; }

/* Charts */
.charts-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.chart-card { background:white; border:1px solid #e2e8f0; border-radius:10px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
.chart-title { font-size:13px; font-weight:700; color:#0f172a; margin-bottom:16px; letter-spacing:0.02em; }
.chart-loading,.chart-empty { font-size:13px; color:#94a3b8; text-align:center; padding:20px 0; }
.bar-chart { display:flex; flex-direction:column; gap:10px; }
.bar-row { display:flex; align-items:center; gap:10px; }
.bar-label { font-size:12px; color:#475569; width:90px; flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bar-track { flex:1; background:#f1f5f9; border-radius:99px; height:8px; overflow:hidden; }
.bar-fill { height:100%; border-radius:99px; transition:width 0.6s ease; }
.bar-count { font-size:12px; font-weight:700; color:#0f172a; width:24px; text-align:right; }

/* Table */
.card-surface { background:white; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
.section-header { display:flex; justify-content:space-between; align-items:center; padding:14px 18px; border-bottom:1px solid #f1f5f9; }
.section-title { font-size:13px; font-weight:700; color:#0f172a; }
.section-count { font-size:12px; color:#94a3b8; }
.data-table { width:100%; border-collapse:collapse; font-size:13px; }
.data-table thead th { background:#f8fafc; color:#64748b; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; padding:10px 16px; border-bottom:1px solid #e2e8f0; text-align:left; }
.data-table tbody td { padding:11px 16px; border-bottom:1px solid #f8fafc; vertical-align:middle; }
.data-table tbody tr:last-child td { border-bottom:none; }
.data-table tbody tr:hover td { background:#f8fafc; }
.empty-row { text-align:center; color:#94a3b8; padding:32px !important; }
.cand-cell { display:flex; align-items:center; gap:9px; }
.avatar { width:30px; height:30px; border-radius:7px; background:#dbeafe; color:#1e40af; font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.muted { color:#64748b; }
.job-tag { background:#f1f5f9; color:#475569; font-size:11px; padding:2px 8px; border-radius:4px; border:1px solid #e2e8f0; }
.status-dot { font-size:11px; font-weight:600; padding:2px 9px; border-radius:20px; }
.dot-received  { background:#f1f5f9; color:#475569; }
.dot-progress  { background:#fef3c7; color:#92400e; }
.dot-accepted  { background:#dcfce7; color:#15803d; }
.dot-rejected  { background:#fee2e2; color:#b91c1c; }
.mt-4 { margin-top:20px; }
</style>