<template>
  <div class="matching-page">

    <div class="page-header">
      <h2>Matching Intelligent</h2>
      <button class="refresh-btn" @click="fetchMatching">
        Actualiser
      </button>
    </div>

    <div v-if="loading" class="loading">
      Chargement...
    </div>

    <div v-else>

      <div
        v-for="(group, jobTitle) in groupedMatching"
        :key="jobTitle"
        class="job-section"
      >
        <div class="job-header">
          <h3>{{ jobTitle }}</h3>
          <span>{{ group.length }} candidat(s)</span>
        </div>

        <table class="matching-table">
          <thead>
            <tr>
              <th>Candidat</th>
              <th>Email</th>
              <th>Score</th>
              <th>Compétences</th>
              <th>Décision</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="candidate in group" :key="candidate.id">
              <td>{{ candidate.name }}</td>
              <td>{{ candidate.email }}</td>

              <td>
                <div class="score-wrapper">
                  <div
                    class="score-bar"
                    :style="{ width: candidate.score + '%' }"
                  ></div>
                  <span>{{ candidate.score }}%</span>
                </div>
              </td>

              <td>
                <div class="skills">
                  <span
                    v-for="(skill, i) in candidate.skills"
                    :key="i"
                    class="skill"
                  >
                    {{ skill }}
                  </span>
                </div>
              </td>

              <td>
                <span
                  class="decision"
                  :class="candidate.score >= 70 ? 'good' : 'bad'"
                >
                  {{ candidate.score >= 70 ? 'Compatible' : 'Faible match' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="Object.keys(groupedMatching).length === 0"
        class="empty"
      >
        Aucun matching disponible
      </div>

    </div>

  </div>
</template>

<script>
export default {
  name: "Matching",

  data() {
    return {
      loading: false,
      matching: []
    }
  },

  computed: {
    groupedMatching() {
      const groups = {}

      this.matching.forEach(item => {
        const title = item.job_title || "Poste non défini"

        if (!groups[title]) groups[title] = []

        groups[title].push(item)
      })

      return groups
    }
  },

  mounted() {
    this.fetchMatching()
  },

  methods: {
    async fetchMatching() {
      this.loading = true

      try {
        const res = await fetch("http://localhost:3000/api/matching")
        const data = await res.json()

        this.matching = Array.isArray(data) ? data : []

      } catch (err) {
        console.error(err)
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.matching-page {
  padding: 30px;
  background: #f8fafc;
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}

.page-header h2 {
  font-size: 24px;
  color: #1e293b;
}

.refresh-btn {
  background: #2563eb;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
}

.job-section {
  background: white;
  border-radius: 14px;
  margin-bottom: 30px;
  overflow: hidden;
  box-shadow: 0 4px 18px rgba(0,0,0,0.05);
}

.job-header {
  background: #eff6ff;
  padding: 18px 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.job-header h3 {
  color: #1d4ed8;
  font-size: 18px;
}

.matching-table {
  width: 100%;
  border-collapse: collapse;
}

.matching-table th,
.matching-table td {
  padding: 15px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
}

.matching-table th {
  background: #f8fafc;
}

.score-wrapper {
  position: relative;
  width: 120px;
  height: 22px;
  background: #e2e8f0;
  border-radius: 20px;
  overflow: hidden;
}

.score-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: #22c55e;
}

.score-wrapper span {
  position: absolute;
  width: 100%;
  text-align: center;
  font-size: 12px;
  line-height: 22px;
  font-weight: bold;
}

.skills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.skill {
  background: #dbeafe;
  color: #1e40af;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
}

.decision {
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
}

.good {
  background: #dcfce7;
  color: #166534;
}

.bad {
  background: #fee2e2;
  color: #991b1b;
}

.loading,
.empty {
  text-align: center;
  padding: 50px;
  color: #64748b;
}

@media (max-width: 900px) {
  .matching-table {
    display: block;
    overflow-x: auto;
  }

  .page-header {
    flex-direction: column;
    gap: 15px;
  }
}
</style>