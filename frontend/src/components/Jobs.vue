<template>
  <div class="page-wrapper">

    <div class="page-header">
      <div>
        <h4 class="page-title">Offres d'emploi</h4>
        <p class="page-sub">Postes extraits depuis LinkedIn</p>
      </div>

      <div class="header-actions">
        <button
          class="sync-btn"
          @click="syncLinkedin"
          :disabled="syncing"
        >
          {{ syncing ? 'Synchronisation...' : 'Synchroniser LinkedIn' }}
        </button>

        <span class="count-badge">
          {{ filteredJobs.length }} offre(s)
        </span>
      </div>
    </div>

    <div class="card-surface mb-3">
      <input
        v-model="search"
        class="f-input"
        placeholder="Rechercher un poste..."
      />
    </div>

    <div v-if="loading" class="state-box">
      Chargement des offres...
    </div>

    <div v-else-if="paginatedJobs.length === 0" class="state-box">
      Aucune offre trouvée.
    </div>

    <div v-else>

      <div
        v-for="job in paginatedJobs"
        :key="job.id"
        class="job-card"
      >
        <div class="job-card-left"></div>

        <div class="job-card-body">
          <div class="job-title">{{ job.title }}</div>

          <div class="job-desc">
            {{ shortDesc(job.description) }}
          </div>

          <div class="job-footer">
            <span
              v-if="extractEmail(job.description)"
              class="job-contact"
            >
              Contact : {{ extractEmail(job.description) }}
            </span>

            <a
              v-if="job.source && job.source.includes('linkedin')"
              :href="job.source"
              target="_blank"
              class="job-link"
            >
              Voir sur LinkedIn
            </a>
          </div>
        </div>
      </div>

      <div class="pagination">
        <button
          class="btn-page"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
          Précédent
        </button>

        <span class="page-info">
          Page {{ currentPage }} / {{ totalPages }}
        </span>

        <button
          class="btn-page"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >
          Suivant
        </button>
      </div>

    </div>
  </div>
</template>

<script>
export default {
  name: "Jobs",

  data() {
    return {
      jobs: [],
      search: "",
      loading: false,
      syncing: false,
      currentPage: 1,
      perPage: 6
    }
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
      return Math.max(
        1,
        Math.ceil(this.filteredJobs.length / this.perPage)
      )
    },

    paginatedJobs() {
      const start = (this.currentPage - 1) * this.perPage
      return this.filteredJobs.slice(start, start + this.perPage)
    }
  },

  watch: {
    search() {
      this.currentPage = 1
    }
  },

  mounted() {
    this.fetchJobs()
  },

  methods: {
    async fetchJobs() {
      this.loading = true

      try {
        const res = await fetch("http://localhost:3000/api/jobs")
        const data = await res.json()

        this.jobs = Array.isArray(data) ? data : []
      } catch (error) {
        console.error(error)
      } finally {
        this.loading = false
      }
    },

    async syncLinkedin() {
      this.syncing = true

      try {
        const res = await fetch(
          "http://localhost:3000/api/linkedin/sync",
          {
            method: "POST"
          }
        )

        const data = await res.json()

        if (data.success) {
          alert("Synchronisation terminée")
          await this.fetchJobs()
        } else {
          alert("Erreur : " + data.error)
        }

      } catch (error) {
        console.error(error)
        alert("Erreur synchronisation")
      } finally {
        this.syncing = false
      }
    },

    shortDesc(text) {
      if (!text) return "Aucune description."

      const clean = text.replace(/\n/g, " ").trim()

      return clean.length > 240
        ? clean.slice(0, 240) + "…"
        : clean
    },

    extractEmail(text) {
      if (!text) return null

      const match = text.match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
      )

      return match ? match[0] : null
    }
  }
}
</script>

<style scoped>
.page-wrapper {
  padding: 32px 28px 80px;
  background: #f8fafc;
  min-height: 100vh;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sync-btn {
  background: #2563eb;
  color: white;
  border: none;
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
}

.sync-btn:hover:not(:disabled) {
  background: #1d4ed8;
}

.sync-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.page-sub {
  font-size: 13px;
  color: #94a3b8;
  margin: 2px 0 0;
}

.count-badge {
  background: #e0eaff;
  color: #1e40af;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
}

.card-surface {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.mb-3 {
  margin-bottom: 14px;
}

.f-input {
  padding: 7px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  font-size: 13px;
  outline: none;
  width: 300px;
}

.f-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
}

.state-box {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  color: #94a3b8;
  font-size: 13px;
}

.job-card {
  display: flex;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.job-card-left {
  width: 4px;
  background: #2563eb;
}

.job-card-body {
  padding: 16px 18px;
  flex: 1;
}

.job-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 6px;
}

.job-desc {
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
  margin-bottom: 10px;
}

.job-footer {
  display: flex;
  align-items: center;
  gap: 16px;
}

.job-contact {
  font-size: 12px;
  color: #64748b;
}

.job-link {
  font-size: 12px;
  font-weight: 600;
  color: #2563eb;
  text-decoration: none;
  padding: 4px 12px;
  border: 1px solid #bfdbfe;
  border-radius: 5px;
  background: #eff6ff;
}

.pagination {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
}

.btn-page {
  padding: 7px 18px;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  background: white;
  cursor: pointer;
}

.page-info {
  font-size: 13px;
  color: #64748b;
}
</style>