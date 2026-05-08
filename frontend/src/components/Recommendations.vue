<template>
  <div class="page-wrapper">

    <div class="page-header">
      <div>
        <h4 class="page-title">Recommandations</h4>
        <p class="page-sub">Historique des recommandations envoyées</p>
      </div>

      <span class="count-badge count-blue">
        {{ recommendations.length }} recommandation(s)
      </span>
    </div>

    <div v-if="loading" class="state-box">
      Chargement...
    </div>

    <div v-else-if="recommendations.length === 0" class="state-box">
      Aucune recommandation envoyée
    </div>

    <div v-else class="card-surface p-0">
      <table class="data-table">
        <thead>
          <tr>
            <th>Candidat</th>
            <th>Email</th>
            <th>Poste refusé</th>
            <th>Poste recommandé</th>
            <th>Date</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="r in recommendations" :key="r.id">
            <td>
              <div class="cand-cell">
                <div class="avatar av-blue">
                  {{ initials(r.name) }}
                </div>
                <span class="cand-name">{{ r.name }}</span>
              </div>
            </td>

            <td class="muted">{{ r.email }}</td>

            <td>
              <span class="job-tag-red">
                {{ r.original_job }}
              </span>
            </td>

            <td>
              <span class="job-tag-blue">
                {{ r.recommended_job }}
              </span>
            </td>

            <td class="muted">
              {{ formatDate(r.created_at) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script>
export default {
  name: 'Recommendations',

  data() {
    return {
      recommendations: [],
      loading: true
    }
  },

  mounted() {
    this.fetchRecommendations()
  },

  methods: {
    async fetchRecommendations() {
      try {
        const res = await fetch(
          'http://localhost:3000/api/candidates/recommendations'
        )

        this.recommendations = await res.json()

      } catch (err) {
        console.error(err)
      } finally {
        this.loading = false
      }
    },

    formatDate(d) {
      return new Date(d).toLocaleDateString('fr-FR',{
        day:'2-digit',
        month:'long',
        year:'numeric'
      })
    },

    initials(n) {
      if(!n) return '?'
      return n.split(' ')
        .map(w=>w[0])
        .slice(0,2)
        .join('')
        .toUpperCase()
    }
  }
}
</script>

<style scoped>
.page-wrapper { padding:32px 28px; background:#f8fafc; min-height:100vh; }
.page-header { display:flex; justify-content:space-between; margin-bottom:20px; }
.page-title { font-size:20px; font-weight:700; }
.page-sub { font-size:13px; color:#94a3b8; }

.count-blue {
  background:#dbeafe;
  color:#1d4ed8;
  padding:6px 14px;
  border-radius:20px;
}

.card-surface {
  background:white;
  border-radius:10px;
  border:1px solid #e2e8f0;
}

.data-table {
  width:100%;
  border-collapse:collapse;
}

.data-table th {
  background:#eff6ff;
  color:#1d4ed8;
  padding:14px;
}

.data-table td {
  padding:14px;
}

.cand-cell {
  display:flex;
  align-items:center;
  gap:10px;
}

.avatar {
  width:34px;
  height:34px;
  border-radius:8px;
  display:flex;
  align-items:center;
  justify-content:center;
}

.av-blue {
  background:#dbeafe;
  color:#1d4ed8;
}

.job-tag-red {
  background:#fee2e2;
  color:#b91c1c;
  padding:4px 8px;
  border-radius:5px;
}

.job-tag-blue {
  background:#dbeafe;
  color:#1d4ed8;
  padding:4px 8px;
  border-radius:5px;
}

.state-box {
  padding:60px;
  text-align:center;
  background:white;
  border-radius:10px;
}
</style>