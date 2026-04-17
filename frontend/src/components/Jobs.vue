<template>
  <div class="jobs-page">

    <h3 class="mb-3">💼 Offres RH (LinkedIn Scraping)</h3>

    <!-- SEARCH -->
    <input
      v-model="search"
      class="form-control mb-3"
      placeholder="🔍 Rechercher un poste..."
    />

    <!-- JOBS -->
    <div v-if="paginatedJobs.length">

      <div
        v-for="(job, index) in paginatedJobs"
        :key="index"
        class="job-card"
      >
        <h5>{{ job.title }}</h5>

        <p class="desc">
          {{ job.shortDescription }}
        </p>

        <p><strong>📧 Email :</strong> {{ job.email || 'Non trouvé' }}</p>
        <p><strong>👤 RH :</strong> {{ job.author }}</p>
        <p><strong>📅 Date :</strong> {{ job.postDate }}</p>

        <a
          v-if="job.postUrl && job.postUrl.includes('linkedin')"
          :href="job.postUrl"
          target="_blank"
          class="btn btn-outline-primary btn-sm"
        >
          🔗 Voir le post
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

    <p v-else>Aucune offre trouvée</p>

  </div>
</template>

<script>
export default {
  data() {
    return {
      jobs: [],
      search: "",

      currentPage: 1,
      perPage: 5
    }
  },

  mounted() {
    this.fetchJobs()
  },

  computed: {
    // 🔍 FILTER
    filteredJobs() {
      return this.jobs.filter(j =>
        j.title.toLowerCase().includes(this.search.toLowerCase())
      )
    },

    // 📄 TOTAL PAGES
    totalPages() {
      return Math.ceil(this.filteredJobs.length / this.perPage)
    },

    // 📌 PAGINATION
    paginatedJobs() {
      const start = (this.currentPage - 1) * this.perPage
      const end = start + this.perPage
      return this.filteredJobs.slice(start, end)
    }
  },

  watch: {
    // 🔁 reset page quand tu recherches
    search() {
      this.currentPage = 1
    }
  },

  methods: {
    async fetchJobs() {
      try {
        const res = await fetch("http://localhost:3000/api/jobs")
        const data = await res.json()

        this.jobs = data
          .filter(p =>
            p.postContent &&
            p.postContent.length > 20 &&
            p.postUrl &&
            p.postUrl.includes("linkedin")
          )
          .map(p => {
            const content = p.postContent

            // 🎯 TITLE
            let titleMatch = content.match(/recrute.*?\"([^\"]+)\"/i)
            let title = titleMatch ? titleMatch[1] : "Poste non défini"

            // 📧 EMAIL
            let emailMatch = content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
            let email = emailMatch ? emailMatch[0] : ""

            return {
              title,
              email,
              shortDescription: content.substring(0, 180) + "...",
              author: p.author,
              postDate: p.postDate,
              postUrl: p.postUrl
            }
          })

      } catch (err) {
        console.error("Erreur jobs:", err)
      }
    }
  }
}
</script>

<style scoped>
.jobs-page {
  padding: 20px;
}

.job-card {
  background: white;
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 15px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

.desc {
  color: #555;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
}
</style>