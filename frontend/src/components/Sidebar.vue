<template>
  <div class="sidebar">
    <div class="sidebar-brand">
      <div class="brand-mark"></div>
      <div>
        <div class="brand-name">AIRBUS</div>
        <div class="brand-sub">Recruitment System</div>
      </div>
    </div>
    <div class="sidebar-divider"></div>
    <nav class="sidebar-nav">
      <div class="nav-section-label">TABLEAU DE BORD</div>
      <a class="nav-item" :class="{ active: page === 'dashboard' }" @click="$emit('changePage', 'dashboard')">
        <span class="nav-icon"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span>
        <span>Dashboard</span>
      </a>
      <div class="nav-section-label mt-3">CANDIDATURES</div>
      <a class="nav-item" :class="{ active: page === 'candidates' }" @click="$emit('changePage', 'candidates')">
        <span class="nav-icon"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
        <span>Candidats</span>
        <span v-if="counts.candidates" class="nav-badge">{{ counts.candidates }}</span>
      </a>
      <a class="nav-item" :class="{ active: page === 'matching' }" @click="$emit('changePage', 'matching')">
        <span class="nav-icon"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
        <span>Matching</span>
      </a>
      <a class="nav-item" :class="{ active: page === 'jobs' }" @click="$emit('changePage', 'jobs')">
        <span class="nav-icon"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></span>
        <span>Offres d'emploi</span>
      </a>
      <div class="nav-section-label mt-3">DECISIONS</div>
      <a class="nav-item" :class="{ active: page === 'admis' }" @click="$emit('changePage', 'admis')">
        <span class="nav-icon"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
        <span>Admis</span>
        <span v-if="counts.admis" class="nav-badge nav-badge-green">{{ counts.admis }}</span>
      </a>
      <a class="nav-item" :class="{ active: page === 'refuses' }" @click="$emit('changePage', 'refuses')">
        <span class="nav-icon"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></span>
        <span>Refusés</span>
        <span v-if="counts.refuses" class="nav-badge nav-badge-red">{{ counts.refuses }}</span>
      </a>
    </nav>
    <div class="sidebar-footer">
      <div class="footer-version">v1.0 &mdash; 2026</div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    page: String,
    counts: { type: Object, default: () => ({ candidates: 0, admis: 0, refuses: 0 }) }
  }
}
</script>

<style scoped>
.sidebar { position:fixed; top:0; left:0; width:260px; height:100vh; background:#0f172a; color:#94a3b8; display:flex; flex-direction:column; z-index:100; border-right:1px solid #1e293b; }
.sidebar-brand { display:flex; align-items:center; gap:12px; padding:24px 20px 20px; }
.brand-mark { width:36px; height:36px; background:#2563eb; clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%); flex-shrink:0; }
.brand-name { font-size:15px; font-weight:700; letter-spacing:0.15em; color:#f1f5f9; }
.brand-sub { font-size:10px; letter-spacing:0.08em; color:#475569; margin-top:1px; text-transform:uppercase; }
.sidebar-divider { height:1px; background:#1e293b; margin:0 20px 16px; }
.sidebar-nav { flex:1; padding:0 12px; overflow-y:auto; }
.nav-section-label { font-size:10px; font-weight:600; letter-spacing:0.12em; color:#334155; padding:6px 10px 8px; }
.nav-item { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:6px; cursor:pointer; font-size:13.5px; font-weight:500; color:#64748b; transition:background 0.15s,color 0.15s; margin-bottom:2px; text-decoration:none; user-select:none; }
.nav-item:hover { background:#1e293b; color:#cbd5e1; }
.nav-item.active { background:#1e3a8a; color:#e0eaff; }
.nav-icon { display:flex; align-items:center; flex-shrink:0; color:#475569; }
.nav-item:hover .nav-icon, .nav-item.active .nav-icon { color:inherit; }
.nav-badge { margin-left:auto; background:#334155; color:#94a3b8; font-size:10px; font-weight:700; padding:1px 7px; border-radius:20px; }
.nav-badge-green { background:#14532d; color:#86efac; }
.nav-badge-red { background:#7f1d1d; color:#fca5a5; }
.sidebar-footer { padding:16px 20px; border-top:1px solid #1e293b; }
.footer-version { font-size:11px; color:#334155; letter-spacing:0.04em; }
.mt-3 { margin-top:12px; }
</style>