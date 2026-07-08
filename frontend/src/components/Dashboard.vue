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

    <!-- CHARTS ROW 1 : Doughnut + Bar horizontal -->
    <div class="charts-row">

      <!-- Doughnut : Répartition par statut -->
      <div class="chart-card">
        <div class="chart-title">Répartition par statut</div>
        <div class="chart-body chart-body--doughnut">
          <div v-if="loading" class="chart-loading">Chargement...</div>
          <canvas v-else ref="doughnutCanvas" height="220"></canvas>
        </div>
      </div>

      <!-- Bar horizontal : Candidats par poste -->
      <div class="chart-card">
        <div class="chart-title">Candidats par poste (top 6)</div>
        <div class="chart-body">
          <div v-if="loading" class="chart-loading">Chargement...</div>
          <div v-else-if="jobChart.length === 0" class="chart-empty">Aucune donnée</div>
          <canvas v-else ref="barCanvas" height="220"></canvas>
        </div>
      </div>

    </div>

    <!-- CHARTS ROW 2 : Line candidatures par mois -->
    <div class="charts-row charts-row--full mt-4">
      <div class="chart-card">
        <div class="chart-title">Candidatures reçues par mois (4 derniers mois)</div>
        <div class="chart-body">
          <div v-if="loading" class="chart-loading">Chargement...</div>
          <canvas v-else ref="lineCanvas" height="120"></canvas>
        </div>
      </div>
    </div>

    <!-- CHARTS ROW 3 : Funnel de conversion + Délai moyen -->
    <div class="charts-row mt-4">

      <!-- Funnel : Reçu → En cours → Admis -->
      <div class="chart-card">
        <div class="chart-title">Funnel de conversion</div>
        <div v-if="loading" class="chart-loading">Chargement...</div>
        <div v-else class="funnel-wrap">
          <div v-for="(step, i) in funnelData" :key="step.label" class="funnel-step">
            <div class="funnel-row">
              <span class="funnel-label">{{ step.label }}</span>
              <span class="funnel-value">{{ step.value }}</span>
            </div>
            <div class="funnel-bar-bg">
              <div
                class="funnel-bar-fill"
                :class="'funnel-fill-' + i"
                :style="{ width: step.pct + '%' }"
              ></div>
            </div>
            <div v-if="i > 0" class="funnel-rate">
              {{ step.conversionFromPrev }}% depuis "{{ funnelData[i-1].label }}"
            </div>
          </div>
        </div>
      </div>

      <!-- Délai moyen de traitement -->
      <div class="chart-card">
        <div class="chart-title">Délai moyen de traitement</div>
        <div v-if="loading" class="chart-loading">Chargement...</div>
        <div v-else-if="!processingTime.hasData" class="chart-empty">
          Pas assez de données (applied_date manquante sur les candidatures admises/refusées)
        </div>
        <div v-else class="delay-wrap">
          <div class="delay-main">
            <div class="delay-number">{{ processingTime.overall }}</div>
            <div class="delay-unit">jours en moyenne</div>
          </div>
          <div class="delay-split">
            <div class="delay-split-item">
              <span class="delay-dot delay-dot-green"></span>
              <span class="delay-split-label">Admis</span>
              <span class="delay-split-value">{{ processingTime.accepted ?? '—' }} j</span>
            </div>
            <div class="delay-split-item">
              <span class="delay-dot delay-dot-red"></span>
              <span class="delay-split-label">Refusés</span>
              <span class="delay-split-value">{{ processingTime.rejected ?? '—' }} j</span>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- CHARTS ROW 4 : Score moyen par poste -->
    <div class="charts-row charts-row--full mt-4">
      <div class="chart-card">
        <div class="chart-title">Score moyen de matching par poste</div>
        <div class="chart-body">
          <div v-if="loadingMatching" class="chart-loading">Chargement...</div>
          <div v-else-if="!matchingStats.length" class="chart-empty">Aucune donnée de matching</div>
          <canvas v-else ref="scoreCanvas" height="160"></canvas>
        </div>
      </div>
    </div>

    <!-- CHARTS ROW 5 : Niveau d'éducation requis -->
    <div class="charts-row charts-row--full mt-4">

      <!-- Pie : Niveau d'éducation requis (offres) -->
      <div class="chart-card">
        <div class="chart-title">Niveau d'éducation requis (offres)</div>
        <div class="chart-body chart-body--doughnut">
          <div v-if="loading" class="chart-loading">Chargement...</div>
          <div v-else-if="!educationChart.values.some(v => v > 0)" class="chart-empty">Aucune donnée</div>
          <canvas v-else ref="educationCanvas" height="220"></canvas>
        </div>
      </div>

    </div>

    <!-- CHARTS ROW 6 : Candidatures par localisation -->
    <div class="charts-row charts-row--full mt-4">
      <div class="chart-card">
        <div class="chart-title">Candidatures par ville</div>
        <div class="chart-body">
          <div v-if="loading" class="chart-loading">Chargement...</div>
          <div v-else-if="locationChart.length === 0" class="chart-empty">Aucune donnée de localisation</div>
          <canvas v-else ref="locationCanvas" height="160"></canvas>
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
            <td class="muted">{{ formatDate(c.applied_date) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script>
import {
  Chart,
  ArcElement,
  Tooltip,
  Legend,
  DoughnutController,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Filler,
} from 'chart.js'

// Enregistrer uniquement les composants utilisés (tree-shaking)
Chart.register(
  ArcElement,
  Tooltip,
  Legend,
  DoughnutController,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Filler
)

export default {
  name: 'Dashboard',
  emits: ['counts'],

  data() {
    return {
      loading: false,
      loadingMatching: false,
      candidates: [],
      jobs: [],
      admis: [],
      refuses: [],
      matchingStats: [],
      // Instances Chart.js — stockées pour pouvoir les détruire avant re-rendu
      _charts: { doughnut: null, bar: null, line: null, score: null, education: null, location: null },
    }
  },

  computed: {
    today() {
      return new Date().toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      })
    },

    stats() {
      const all = this.candidates.length + this.admis.length + this.refuses.length
      const now = new Date()
      const y   = now.getFullYear()
      const m   = now.getMonth()

      // "Reçus ce mois" = toute candidature dont applied_date tombe dans le mois
      // courant, peu importe son statut actuel (en cours, admis ou refusé).
      const allWithDate = [
        ...this.candidates,
        ...this.admis,
        ...this.refuses,
      ]
      const receivedThisMonth = allWithDate.filter(c => {
        if (!c.applied_date) return false
        const d = new Date(c.applied_date)
        return d.getFullYear() === y && d.getMonth() === m
      }).length

      return {
        total:      all,
        inProgress: this.candidates.filter(c =>
          ['IN_PROGRESS','INTERVIEW','TEST','FINAL'].includes(c.status)
        ).length,
        received:   receivedThisMonth,
        accepted:   this.admis.length,
        rejected:   this.refuses.length,
        jobs:       this.jobs.length,
      }
    },

    // Données pour le Doughnut (statuts)
    doughnutData() {
      const all = [
        ...this.candidates,
        ...this.admis.map(a   => ({ ...a, status: 'ACCEPTED' })),
        ...this.refuses.map(r => ({ ...r, status: 'REJECTED' })),
      ]
      const map = { RECEIVED: 0, IN_PROGRESS: 0, ACCEPTED: 0, REJECTED: 0 }
      all.forEach(c => { if (map[c.status] !== undefined) map[c.status]++ })
      return {
        labels: ['Reçu', 'En cours', 'Admis', 'Refusé'],
        values: [map.RECEIVED, map.IN_PROGRESS, map.ACCEPTED, map.REJECTED],
        colors: ['#64748b', '#d97706', '#16a34a', '#dc2626'],
      }
    },

    // Données pour le Bar horizontal (top postes)
    jobChart() {
      const map = {}
      this.candidates.forEach(c => {
        const t = c.job_title || c.subject || 'Non défini'
        map[t] = (map[t] || 0) + 1
      })
      return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, value]) => ({ label, value }))
    },

    // Données pour le Line (candidatures par mois sur 12 mois)
    lineData() {
      const now   = new Date()
      const months = []
      const counts = []

      // On utilise applied_date pour les 3 sources — c'est la date réelle
      // de candidature, contrairement à accepted_at/refused_at qui reflète
      // la date de décision RH et décale artificiellement les pics du graphe.
      const all = [
        ...this.candidates,
        ...this.admis,
        ...this.refuses,
      ]

      for (let i = 3; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push(d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }))
        const y = d.getFullYear()
        const m = d.getMonth()
        counts.push(all.filter(c => {
          if (!c.applied_date) return false
          const cd = new Date(c.applied_date)
          return cd.getFullYear() === y && cd.getMonth() === m
        }).length)
      }
      return { months, counts }
    },

    recentCandidates() {
      return [...this.candidates].slice(0, 8)
    },

    // ─── Funnel de conversion : Reçu → En cours → Admis ────
    funnelData() {
      const received   = this.stats.total
      const inProgress = this.stats.inProgress + this.stats.accepted + this.stats.rejected
      const accepted    = this.stats.accepted

      const steps = [
        { label: 'Reçu',    value: received },
        { label: 'En cours', value: inProgress },
        { label: 'Admis',   value: accepted },
      ]

      const max = steps[0].value || 1
      return steps.map((step, i) => ({
        ...step,
        pct: Math.round((step.value / max) * 100),
        conversionFromPrev: i === 0
          ? null
          : steps[i - 1].value > 0
            ? Math.round((step.value / steps[i - 1].value) * 100)
            : 0,
      }))
    },

    // ─── Délai moyen de traitement (en jours) ──────────────
    // Différence entre applied_date et accepted_at / refused_at.
    processingTime() {
      const diffDays = (start, end) => {
        const d1 = new Date(start)
        const d2 = new Date(end)
        if (isNaN(d1) || isNaN(d2)) return null
        return Math.round((d2 - d1) / (1000 * 60 * 60 * 24))
      }

      const acceptedDelays = this.admis
        .map(a => diffDays(a.applied_date, a.accepted_at))
        .filter(d => d !== null && d >= 0)

      const rejectedDelays = this.refuses
        .map(r => diffDays(r.applied_date, r.refused_at))
        .filter(d => d !== null && d >= 0)

      const avg = arr => arr.length
        ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length)
        : null

      const allDelays = [...acceptedDelays, ...rejectedDelays]

      return {
        hasData:  allDelays.length > 0,
        overall:  avg(allDelays),
        accepted: avg(acceptedDelays),
        rejected: avg(rejectedDelays),
      }
    },

    // ─── Niveau d'éducation requis (toutes offres) ─────────
    educationChart() {
      const labels = ['Bac', 'Bac+2', 'Bac+3 / Licence', 'Bac+5 / Master', 'Doctorat', 'Non précisé']
      const map = { 'bac': 0, 'bac+2': 0, 'bac+3': 0, 'bac+5': 0, 'doctorat': 0, 'autre': 0 }

      const classify = (raw) => {
        const s = (raw || '').toLowerCase()
        if (!s.trim())                                        return 'autre'
        if (s.includes('doctorat') || s.includes('phd'))       return 'doctorat'
        if (s.includes('bac+5') || s.includes('master') || s.includes('ingénieur') || s.includes('mba')) return 'bac+5'
        if (s.includes('bac+3') || s.includes('licence') || s.includes('bachelor'))                       return 'bac+3'
        if (s.includes('bac+2') || s.includes('bts') || s.includes('dut'))                                return 'bac+2'
        if (s.includes('bac'))                                return 'bac'
        return 'autre'
      }

      this.jobs.forEach(j => { map[classify(j.education_level)]++ })

      return {
        labels,
        values: [map['bac'], map['bac+2'], map['bac+3'], map['bac+5'], map['doctorat'], map['autre']],
        colors: ['#64748b', '#0ea5e9', '#2563eb', '#7c3aed', '#a21caf', '#cbd5e1'],
      }
    },

    // ─── Candidatures par ville (extrait de candidate.address) ─
    locationChart() {
      const map = {}
      this.candidates.forEach(c => {
        const city = this.extractCity(c.address)
        if (!city) return
        map[city] = (map[city] || 0) + 1
      })
      return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, value]) => ({ label, value }))
    },
  },

  mounted() {
    this.fetchAll()
  },

  beforeUnmount() {
    // Détruire les instances Chart.js pour éviter les memory leaks
    Object.values(this._charts).forEach(c => c && c.destroy())
  },

  methods: {
    async fetchAll() {
      this.loading = true
      try {
        const [cRes, jRes, aRes, rRes] = await Promise.all([
          fetch('http://localhost:3000/api/candidates').then(r => r.json()),
          fetch('http://localhost:3000/api/jobs').then(r => r.json()),
          fetch('http://localhost:3000/api/candidates/admis').then(r => r.json()),
          fetch('http://localhost:3000/api/candidates/refuses').then(r => r.json()),
        ])
        this.candidates = Array.isArray(cRes) ? cRes : []
        this.jobs       = Array.isArray(jRes) ? jRes : []
        this.admis      = Array.isArray(aRes) ? aRes : []
        this.refuses    = Array.isArray(rRes) ? rRes : []

        this.$emit('counts', {
          candidates: this.candidates.length,
          admis:      this.admis.length,
          refuses:    this.refuses.length,
        })
      } catch (e) {
        console.error(e)
      } finally {
        this.loading = false
        // Attendre que Vue ait rendu les <canvas> avant de dessiner
        await this.$nextTick()
        this.renderCharts()
      }

      // Requête séparée — un échec ici ne doit pas bloquer le reste du dashboard
      this.fetchMatchingStats()
    },

    async fetchMatchingStats() {
      this.loadingMatching = true
      try {
        const res  = await fetch('http://localhost:3000/api/matching/stats')
        const data = await res.json()
        this.matchingStats = Array.isArray(data.stats) ? data.stats : []
      } catch (e) {
        console.error(e)
        this.matchingStats = []
      } finally {
        this.loadingMatching = false
        await this.$nextTick()
        this.renderScore()
      }
    },

    // ─── Rendu Chart.js ────────────────────────────────────
    renderCharts() {
      this.renderDoughnut()
      this.renderBar()
      this.renderLine()
      this.renderEducation()
      this.renderLocation()
    },

    renderDoughnut() {
      const canvas = this.$refs.doughnutCanvas
      if (!canvas) return
      // Détruire l'instance précédente si elle existe (re-fetch)
      if (this._charts.doughnut) { this._charts.doughnut.destroy() }

      const { labels, values, colors } = this.doughnutData

      this._charts.doughnut = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data:            values,
            backgroundColor: colors,
            borderColor:     '#ffffff',
            borderWidth:     3,
            hoverOffset:     6,
          }],
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          cutout:              '65%',   // épaisseur de l'anneau
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                font:       { size: 12 },
                padding:    16,
                usePointStyle: true,
                pointStyleWidth: 10,
              },
            },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label} : ${ctx.parsed} candidat(s)`,
              },
            },
          },
        },
      })
    },

    renderBar() {
      const canvas = this.$refs.barCanvas
      if (!canvas || !this.jobChart.length) return
      if (this._charts.bar) { this._charts.bar.destroy() }

      const labels = this.jobChart.map(i => i.label)
      const values = this.jobChart.map(i => i.value)

      // Palette de bleus dégradés
      const bgColors = [
        '#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe'
      ].slice(0, labels.length)

      this._charts.bar = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label:           'Candidats',
            data:            values,
            backgroundColor: bgColors,
            borderRadius:    6,
            borderSkipped:   false,
          }],
        },
        options: {
          indexAxis:           'y',   // barres horizontales
          responsive:          true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.parsed.x} candidat(s)`,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                stepSize:     1,
                font:         { size: 11 },
                color:        '#94a3b8',
              },
              grid: { color: '#f1f5f9' },
            },
            y: {
              ticks: {
                font:  { size: 11 },
                color: '#475569',
                // Tronquer les labels trop longs
                callback: val => {
                  const label = labels[val]
                  return label && label.length > 22 ? label.slice(0, 22) + '…' : label
                },
              },
              grid: { display: false },
            },
          },
        },
      })
    },

    renderLine() {
      const canvas = this.$refs.lineCanvas
      if (!canvas) return
      if (this._charts.line) { this._charts.line.destroy() }

      const { months, counts } = this.lineData

      this._charts.line = new Chart(canvas, {
        type: 'line',
        data: {
          labels: months,
          datasets: [{
            label:           'Candidatures',
            data:            counts,
            borderColor:     '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.08)',
            borderWidth:     2.5,
            pointRadius:     4,
            pointBackgroundColor: '#2563eb',
            pointBorderColor:    '#ffffff',
            pointBorderWidth:    2,
            tension:         0.4,   // courbe lissée
            fill:            true,
          }],
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.parsed.y} candidature(s)`,
              },
            },
          },
          scales: {
            x: {
              ticks:  { font: { size: 11 }, color: '#94a3b8' },
              grid:   { color: '#f1f5f9' },
            },
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
                font:     { size: 11 },
                color:    '#94a3b8',
              },
              grid: { color: '#f1f5f9' },
            },
          },
        },
      })
    },

    renderScore() {
      const canvas = this.$refs.scoreCanvas
      if (!canvas || !this.matchingStats.length) return
      if (this._charts.score) { this._charts.score.destroy() }

      const labels = this.matchingStats.map(s => s.job_title)
      const values = this.matchingStats.map(s => s.avg_score)

      // Couleur conditionnelle selon le score moyen
      const bgColors = values.map(v =>
        v >= 75 ? '#16a34a' : v >= 50 ? '#d97706' : '#dc2626'
      )

      this._charts.score = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label:           'Score moyen',
            data:            values,
            backgroundColor: bgColors,
            borderRadius:    6,
            borderSkipped:   false,
          }],
        },
        options: {
          indexAxis:           'y',
          responsive:          true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const stat = this.matchingStats[ctx.dataIndex]
                  return ` ${ctx.parsed.x}% (${stat.candidate_count} candidat(s), min ${stat.min_score}% / max ${stat.max_score}%)`
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: val => val + '%',
                font:     { size: 11 },
                color:    '#94a3b8',
              },
              grid: { color: '#f1f5f9' },
            },
            y: {
              ticks: {
                font:  { size: 11 },
                color: '#475569',
                callback: val => {
                  const label = labels[val]
                  return label && label.length > 28 ? label.slice(0, 28) + '…' : label
                },
              },
              grid: { display: false },
            },
          },
        },
      })
    },

    renderEducation() {
      const canvas = this.$refs.educationCanvas
      if (!canvas) return
      if (this._charts.education) { this._charts.education.destroy() }

      const { labels, values, colors } = this.educationChart

      this._charts.education = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data:            values,
            backgroundColor: colors,
            borderColor:     '#ffffff',
            borderWidth:     3,
            hoverOffset:     6,
          }],
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          cutout:              '65%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                font:       { size: 11 },
                padding:    14,
                usePointStyle: true,
                pointStyleWidth: 9,
                // On masque dans la légende les niveaux sans aucune offre
                filter: (item, data) => data.datasets[0].data[item.index] > 0,
              },
            },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label} : ${ctx.parsed} offre(s)`,
              },
            },
          },
        },
      })
    },

    renderLocation() {
      const canvas = this.$refs.locationCanvas
      if (!canvas || !this.locationChart.length) return
      if (this._charts.location) { this._charts.location.destroy() }

      const labels = this.locationChart.map(i => i.label)
      const values = this.locationChart.map(i => i.value)

      this._charts.location = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label:           'Candidats',
            data:            values,
            backgroundColor: '#0ea5e9',
            borderRadius:    6,
            borderSkipped:   false,
            maxBarThickness: 48,
          }],
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.parsed.y} candidat(s)`,
              },
            },
          },
          scales: {
            x: {
              ticks: { font: { size: 11 }, color: '#475569' },
              grid:  { display: false },
            },
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1, font: { size: 11 }, color: '#94a3b8' },
              grid:  { color: '#f1f5f9' },
            },
          },
        },
      })
    },

    // ─── Utilitaires ───────────────────────────────────────
    // Extrait une ville plausible d'une adresse en texte libre.
    // Stratégie : on prend le dernier segment significatif séparé par
    // une virgule (souvent la ville), en ignorant les codes postaux purs
    // et les segments trop courts ou trop longs pour être une ville.
    extractCity(address) {
      if (!address || typeof address !== 'string') return null
      const parts = address.split(',').map(p => p.trim()).filter(Boolean)
      if (!parts.length) return null

      // Liste de pays courants à exclure si présents en dernière position
      const countryLike = /^(maroc|morocco|france|tunisie|algérie)$/i

      // On parcourt depuis la fin, on saute le pays s'il est présent
      for (let i = parts.length - 1; i >= 0; i--) {
        const candidate = parts[i]
        if (countryLike.test(candidate)) continue
        if (/^\d+$/.test(candidate)) continue          // code postal pur
        if (candidate.length < 2 || candidate.length > 30) continue
        return candidate
      }
      return null
    },

    initials(n) {
      if (!n) return '?'
      return n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    },
    statusClass(s) {
      return {
        'dot-received': s === 'RECEIVED',
        'dot-progress': ['IN_PROGRESS','INTERVIEW','TEST','FINAL'].includes(s),
        'dot-accepted': s === 'ACCEPTED',
        'dot-rejected': s === 'REJECTED',
      }
    },
    statusLabel(s) {
      const m = {
        RECEIVED:'Reçu', IN_PROGRESS:'En cours', INTERVIEW:'Entretien',
        TEST:'Test', FINAL:'Final', ACCEPTED:'Admis', REJECTED:'Refusé',
      }
      return m[s] || s || '—'
    },
    formatDate(d) {
      if (!d) return '—'
      return new Date(d).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    },
  },
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
.kpi-blue .kpi-icon   { background:#dbeafe; color:#1d4ed8; }
.kpi-amber .kpi-icon  { background:#fef3c7; color:#d97706; }
.kpi-green .kpi-icon  { background:#dcfce7; color:#16a34a; }
.kpi-red .kpi-icon    { background:#fee2e2; color:#dc2626; }
.kpi-indigo .kpi-icon { background:#e0e7ff; color:#4338ca; }
.kpi-slate .kpi-icon  { background:#f1f5f9; color:#475569; }

/* Charts */
.charts-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.charts-row--full { grid-template-columns:1fr; }
.chart-card { background:white; border:1px solid #e2e8f0; border-radius:10px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
.chart-title { font-size:13px; font-weight:700; color:#0f172a; margin-bottom:16px; letter-spacing:0.02em; }
.chart-body { position:relative; height:220px; }
.chart-body--doughnut { height:260px; }
.chart-loading,.chart-empty { font-size:13px; color:#94a3b8; text-align:center; padding:20px 0; }

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
.dot-received { background:#f1f5f9; color:#475569; }
.dot-progress { background:#fef3c7; color:#92400e; }
.dot-accepted { background:#dcfce7; color:#15803d; }
.dot-rejected { background:#fee2e2; color:#b91c1c; }
.mt-4 { margin-top:20px; }

/* Funnel */
.funnel-wrap { display:flex; flex-direction:column; gap:18px; padding:6px 2px 2px; }
.funnel-step { display:flex; flex-direction:column; gap:6px; }
.funnel-row { display:flex; justify-content:space-between; align-items:baseline; }
.funnel-label { font-size:13px; font-weight:600; color:#0f172a; }
.funnel-value { font-size:16px; font-weight:800; color:#0f172a; }
.funnel-bar-bg { height:14px; background:#f1f5f9; border-radius:7px; overflow:hidden; }
.funnel-bar-fill { height:100%; border-radius:7px; transition:width 0.5s ease; }
.funnel-fill-0 { background:#64748b; }
.funnel-fill-1 { background:#d97706; }
.funnel-fill-2 { background:#16a34a; }
.funnel-rate { font-size:11px; color:#94a3b8; align-self:flex-end; }

/* Délai de traitement */
.delay-wrap { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; padding:14px 0 4px; }
.delay-main { text-align:center; }
.delay-number { font-size:42px; font-weight:800; color:#0f172a; line-height:1; }
.delay-unit { font-size:12px; color:#94a3b8; margin-top:6px; font-weight:500; }
.delay-split { display:flex; gap:24px; }
.delay-split-item { display:flex; align-items:center; gap:7px; font-size:12px; }
.delay-dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
.delay-dot-green { background:#16a34a; }
.delay-dot-red { background:#dc2626; }
.delay-split-label { color:#64748b; }
.delay-split-value { font-weight:700; color:#0f172a; }
</style>