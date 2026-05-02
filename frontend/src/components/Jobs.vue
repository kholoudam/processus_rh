<template>
  <div class="jobs-page">

    <h3 class="mb-3">💼 Offres RH (LinkedIn)</h3>

    <!-- SEARCH -->
    <input
      v-model="search"
      class="form-control mb-3"
      placeholder="🔍 Rechercher un poste..."
    />

    <!-- LOADING -->
    <div v-if="loading" class="text-center py-5 text-muted">
      <div class="spinner"></div>
      <p>Chargement des offres...</p>
    </div>

    <!-- JOBS -->
    <div v-else-if="paginatedJobs.length">

      <div
        v-for="job in paginatedJobs"
        :key="job.id"
        class="job-card"
      >
        <h5>{{ job.title }}</h5>

        <p class="desc">{{ shortDesc(job.description) }}</p>

        <p v-if="extractEmail(job.description)">
          <strong>📧 Contact :</strong> {{ extractEmail(job.description) }}
        </p>

        <a
          v-if="job.source && job.source.includes('linkedin')"
          :href="job.source"
          target="_blank"
          class="btn btn-outline-primary btn-sm"
        >
          🔗 Voir le post LinkedIn
        </a>
      </div>

      <!-- PAGINATION -->
      <div class="pagination">
        <button
          class="btn btn-secondary btn-sm"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
          ⬅️ Précédent
        </button>

        <span>Page {{ currentPage }} / {{ totalPages }}</span>

        <button
          class="btn btn-secondary btn-sm"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >
          Suivant ➡️
        </button>
      </div>

    </div>

    <p v-else class="text-muted">Aucune offre trouvée.</p>

  </div>
</template>

<script>
export default {
  data() {
    return {
      jobs:        [],
      search:      "",
      loading:     false,
      currentPage: 1,
      perPage:     5
    }
  },

  mounted() {
    this.fetchJobs()
  },

  computed: {
    filteredJobs() {
      const q = this.search.toLowerCase()
      return this.jobs.filter(j =>
        (j.title || "").toLowerCase().includes(q) ||
        (j.description || "").toLowerCase().includes(q)
      )
    },

    totalPages() {
      return Math.max(1, Math.ceil(this.filteredJobs.length / this.perPage))
    },

    paginatedJobs() {
      const start = (this.currentPage - 1) * this.perPage
      return this.filteredJobs.slice(start, start + this.perPage)
    }
  },

  watch: {
    search() { this.currentPage = 1 }
  },

  methods: {
    async fetchJobs() {
      this.loading = true
      try {
        const res  = await fetch("http://localhost:3000/api/jobs")
        const data = await res.json()
        // L'API retourne directement { id, title, description, source }
        this.jobs = Array.isArray(data) ? data : []
      } catch (err) {
        console.error("Erreur jobs:", err)
      } finally {
        this.loading = false
      }
    },

    // Tronque la description à 200 caractères
    shortDesc(text) {
      if (!text) return "Aucune description disponible."
      const clean = text.replace(/\n/g, " ").trim()
      return clean.length > 200 ? clean.substring(0, 200) + "..." : clean
    },

    // Extrait un email depuis la description
    extractEmail(text) {
      if (!text) return null
      const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
      return m ? m[0] : null
    }
  }
}
</script>

<style scoped>
.jobs-page { padding: 20px; }

.job-card {
  background: white;
  padding: 18px;
  border-radius: 10px;
  margin-bottom: 15px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  border-left: 4px solid #1d4ed8;
}

.job-card h5 {
  color: #1e3a8a;
  font-weight: 700;
  margin-bottom: 8px;
}

.desc { color: #555; font-size: 14px; margin-bottom: 10px; }

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
}

.spinner {
  width: 32px; height: 32px; margin: 0 auto 12px;
  border: 3px solid #e5e7eb; border-top-color: #3b82f6;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>