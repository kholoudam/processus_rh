<template>
  <div class="page-wrapper">
    <div class="page-header">
      <div>
        <h4 class="page-title">Candidats Refusés</h4>
        <p class="page-sub">Statut : REJECTED uniquement</p>
      </div>
      <span class="count-badge count-red">{{ filtered.length }} refusé(s)</span>
    </div>
    <div class="card-surface mb-3">
      <input v-model="searchText" class="f-input" placeholder="Rechercher par nom ou email..." />
    </div>
    <div v-if="loading" class="state-box">Chargement...</div>
    <div v-else-if="filtered.length === 0" class="state-box">Aucun candidat refusé pour l'instant.</div>
    <div v-else class="card-surface p-0">
      <table class="data-table">
        <thead>
          <tr><th>Candidat</th><th>Email</th><th>Poste</th><th>Téléphone</th><th>Motif</th><th>Date de refus</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in filtered" :key="r.id">
            <td>
              <div class="cand-cell">
                <div class="avatar av-red">{{ initials(r.name) }}</div>
                <span class="cand-name">{{ r.name || '—' }}</span>
              </div>
            </td>
            <td class="muted">{{ r.email || '—' }}</td>
            <td><span class="job-tag">{{ r.subject || 'Non défini' }}</span></td>
            <td class="muted">{{ r.phone || '—' }}</td>
            <td>
              <span v-if="r.reason" class="reason-pill" :title="r.reason">{{ r.reason.length > 35 ? r.reason.slice(0,35)+'…' : r.reason }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td class="muted">{{ formatDate(r.refused_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="refuses.length" class="stats-bar stats-red">
      Total refusés : <strong>{{ refuses.length }}</strong>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Refuses',
  data() { return { refuses:[], searchText:'', loading:true } },
  computed: {
    filtered() {
      const q = this.searchText.toLowerCase()
      return this.refuses.filter(r => (r.name||'').toLowerCase().includes(q)||(r.email||'').toLowerCase().includes(q))
    }
  },
  mounted() { this.fetchRefuses() },
  methods: {
    async fetchRefuses() {
      this.loading = true
      try { const r = await fetch('http://localhost:3000/api/candidates/refuses'); const d = await r.json(); this.refuses = Array.isArray(d)?d:[] }
      catch(e){console.error(e)} finally { this.loading=false }
    },
    formatDate(d) { if(!d) return '—'; return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'}) },
    initials(n) { if(!n) return '?'; return n.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() }
  }
}
</script>

<style scoped>
.page-wrapper { padding:32px 28px 80px; background:#f8fafc; min-height:100vh; }
.page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }
.page-title { font-size:20px; font-weight:700; color:#0f172a; margin:0; }
.page-sub { font-size:13px; color:#94a3b8; margin:2px 0 0; }
.count-badge { font-size:12px; font-weight:600; padding:4px 12px; border-radius:20px; }
.count-red { background:#fee2e2; color:#b91c1c; }
.card-surface { background:white; border:1px solid #e2e8f0; border-radius:10px; padding:14px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
.p-0{padding:0;} .mb-3{margin-bottom:14px;}
.f-input { padding:7px 12px; border:1px solid #e2e8f0; border-radius:7px; font-size:13px; outline:none; width:280px; }
.f-input:focus { border-color:#dc2626; box-shadow:0 0 0 3px rgba(220,38,38,0.1); }
.state-box { text-align:center; padding:60px 20px; background:white; border-radius:10px; border:1px solid #e2e8f0; color:#94a3b8; font-size:13px; }
.data-table { width:100%; border-collapse:collapse; font-size:13px; }
.data-table thead th { background:#fff5f5; color:#b91c1c; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; padding:10px 16px; border-bottom:1px solid #fee2e2; text-align:left; }
.data-table tbody td { padding:12px 16px; vertical-align:middle; border-bottom:1px solid #fff5f5; }
.data-table tbody tr:last-child td { border-bottom:none; }
.data-table tbody tr:hover td { background:#fff5f5; }
.cand-cell { display:flex; align-items:center; gap:10px; }
.avatar { width:32px; height:32px; border-radius:8px; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.av-red { background:#fee2e2; color:#b91c1c; }
.cand-name { font-weight:600; color:#b91c1c; }
.muted { color:#64748b; font-size:13px; }
.job-tag { background:#fff5f5; color:#b91c1c; font-size:12px; padding:3px 8px; border-radius:4px; border:1px solid #fecaca; }
.reason-pill { background:#fef2f2; color:#374151; font-size:12px; padding:3px 8px; border-radius:4px; border:1px solid #fecaca; display:inline-block; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:middle; }
.stats-bar { margin-top:14px; padding:10px 16px; border-radius:8px; font-size:13px; }
.stats-red { background:#fee2e2; color:#b91c1c; }
</style>