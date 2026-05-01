<template>
  <div class="refuses-page">

    <h3 class="page-title">Candidats Refusés</h3>

    <div class="filters">
      <input v-model="searchText" placeholder="Rechercher un nom ou email..." />
    </div>

    <div v-if="loading" class="loading">Chargement...</div>

    <div v-else-if="filtered.length === 0" class="empty-state">
      <p>📭 Aucun candidat refusé pour l'instant.</p>
    </div>

    <div v-else class="table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Email</th>
            <th>Poste</th>
            <th>Téléphone</th>
            <th>Motif</th>
            <th>Date de refus</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in filtered" :key="r.id">
            <td><span class="name-badge">{{ r.name || '---' }}</span></td>
            <td>{{ r.email || '---' }}</td>
            <td>{{ r.subject || 'Non défini' }}</td>
            <td>{{ r.phone || '-' }}</td>
            <td>
              <span v-if="r.reason" class="reason-text">{{ r.reason }}</span>
              <span v-else class="no-reason">—</span>
            </td>
            <td>{{ formatDate(r.refused_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="stats-bar" v-if="refuses.length">
      Total refusés : <strong>{{ refuses.length }}</strong>
    </div>

  </div>
</template>

<script>
export default {
  name: 'Refuses',
  data() {
    return {
      refuses: [],
      searchText: '',
      loading: true,
    }
  },
  computed: {
    filtered() {
      const q = this.searchText.toLowerCase()
      return this.refuses.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q)
      )
    }
  },
  mounted() { this.fetchRefuses() },
  methods: {
    async fetchRefuses() {
      this.loading = true
      try {
        // ✅ JOIN avec candidate pour récupérer name/email/phone/subject
        const res = await fetch('http://localhost:3000/api/candidates/refuses')
        const data = await res.json()
        this.refuses = Array.isArray(data) ? data : []
      } catch (err) {
        console.error('REFUSES ERROR:', err)
      } finally {
        this.loading = false
      }
    },
    formatDate(d) {
      if (!d) return '-'
      return new Date(d).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric'
      })
    }
  }
}
</script>

<style scoped>
.refuses-page { padding: 24px; background: #fff5f5; min-height: 100vh; }
.page-title { font-size: 22px; font-weight: 700; color: #dc2626; margin-bottom: 18px; }

.filters input {
  padding: 8px 14px; border: 1px solid #fca5a5; border-radius: 8px;
  width: 280px; font-size: 14px; outline: none; margin-bottom: 16px;
}
.filters input:focus { border-color: #dc2626; box-shadow: 0 0 0 2px #fecaca; }

.table { width: 100%; border-collapse: collapse; background: white;
  border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.07); }
thead { background: #dc2626; color: white; }
th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #fee2e2; }
tbody tr:hover { background: #fff5f5; }

.name-badge { font-weight: 600; color: #dc2626; }

.reason-text {
  font-size: 13px; color: #374151; background: #fef2f2;
  padding: 3px 8px; border-radius: 4px; display: inline-block; max-width: 220px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.no-reason { color: #9ca3af; font-style: italic; }

.loading { text-align: center; padding: 40px; color: #6b7280; }
.empty-state {
  text-align: center; padding: 60px 20px; color: #6b7280; font-size: 16px;
  background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.stats-bar {
  margin-top: 16px; padding: 10px 16px; background: #fee2e2;
  border-radius: 8px; font-size: 14px; color: #dc2626;
}
</style>