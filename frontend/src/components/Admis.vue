<template>
  <div class="admis-page">

    <h3 class="page-title">Candidats Admis</h3>

    <div class="filters">
      <input v-model="searchText" placeholder="Rechercher un nom ou email..." />
    </div>

    <div v-if="loading" class="loading">Chargement...</div>

    <div v-else-if="filtered.length === 0" class="empty-state">
      <p>🎓 Aucun candidat admis pour l'instant.</p>
    </div>

    <div v-else class="table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Email</th>
            <th>Poste</th>
            <th>Téléphone</th>
            <th>Date d'admission</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in filtered" :key="a.id">
            <td><span class="name-badge">{{ a.name || '---' }}</span></td>
            <td>{{ a.email || '---' }}</td>
            <td>{{ a.subject || 'Non défini' }}</td>
            <td>{{ a.phone || '-' }}</td>
            <td>{{ formatDate(a.accepted_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="stats-bar" v-if="admis.length">
      Total admis : <strong>{{ admis.length }}</strong>
    </div>

  </div>
</template>

<script>
export default {
  name: 'Admis',
  data() {
    return {
      admis: [],
      searchText: '',
      loading: true,
    }
  },
  computed: {
    filtered() {
      const q = this.searchText.toLowerCase()
      return this.admis.filter(a =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q)
      )
    }
  },
  mounted() { this.fetchAdmis() },
  methods: {
    async fetchAdmis() {
      this.loading = true
      try {
        // ✅ JOIN avec candidate pour récupérer name/email/phone/subject
        const res = await fetch('http://localhost:3000/api/candidates/admis')
        const data = await res.json()
        this.admis = Array.isArray(data) ? data : []
      } catch (err) {
        console.error('ADMIS ERROR:', err)
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
.admis-page { padding: 24px; background: #f0fdf4; min-height: 100vh; }
.page-title { font-size: 22px; font-weight: 700; color: #15803d; margin-bottom: 18px; }

.filters input {
  padding: 8px 14px; border: 1px solid #86efac; border-radius: 8px;
  width: 280px; font-size: 14px; outline: none; margin-bottom: 16px;
}
.filters input:focus { border-color: #16a34a; box-shadow: 0 0 0 2px #bbf7d0; }

.table { width: 100%; border-collapse: collapse; background: white;
  border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.07); }
thead { background: #15803d; color: white; }
th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #dcfce7; }
tbody tr:hover { background: #f0fdf4; }

.name-badge { font-weight: 600; color: #15803d; }
.loading { text-align: center; padding: 40px; color: #6b7280; }
.empty-state {
  text-align: center; padding: 60px 20px; color: #6b7280; font-size: 16px;
  background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.stats-bar {
  margin-top: 16px; padding: 10px 16px; background: #dcfce7;
  border-radius: 8px; font-size: 14px; color: #15803d;
}
</style>