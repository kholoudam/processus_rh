<template>
  <div class="main">

    <!-- ================= DASHBOARD ================= -->
    <div v-if="currentPage==='dashboard'">

      <h3 class="mb-3">📋 Liste des Candidats</h3>

      <!-- FILTERS -->
      <div class="filters">
        <input v-model="searchText" placeholder="Nom..." class="form-control"/>
        <input v-model="searchSkill" placeholder="Compétence..." class="form-control"/>

        <select v-model="selectedJob" class="form-select">
          <option value="">Tous les postes</option>
          <option v-for="job in jobs" :key="job">{{ job }}</option>
        </select>
      </div>

      <!-- TABLE -->
      <div class="table-responsive mt-3">
        <table class="table table-bordered bg-white">
          <thead class="table-dark">
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Poste</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="c in filteredCandidates" :key="c.id">
              <td>{{ c.first_name }} {{ c.last_name }}</td>
              <td>{{ c.email }}</td>
              <td>{{ c.subject }}</td>

              <td>
                <span class="badge"
                  :class="{
                    'bg-secondary': c.status==='à traiter',
                    'bg-warning': c.status==='appel',
                    'bg-primary': c.status==='entretien',
                    'bg-success': c.status==='accepté',
                    'bg-danger': c.status==='refusé'
                  }">
                  {{ c.status }}
                </span>
              </td>

              <td>
                <button class="btn btn-primary btn-sm" @click="openModal(c)">
                  Voir
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>

    <!-- ================= JOBS ================= -->
    <div v-if="currentPage==='jobs'">
      <Jobs />
    </div>

    <!-- ================= MODAL ================= -->
    <div v-if="showModal" class="custom-modal" @click.self="closeModal">

      <div class="modal-content-custom">

        <!-- HEADER -->
        <div class="modal-header">
          <h5>{{ selectedCandidate.first_name }} {{ selectedCandidate.last_name }}</h5>
          <button @click="closeModal">✖</button>
        </div>

        <!-- BODY -->
        <div class="modal-body">

          <p><strong>Email:</strong> {{ selectedCandidate.email }}</p>
          <p><strong>Téléphone:</strong> {{ selectedCandidate.phone }}</p>
          <p><strong>Adresse:</strong> {{ selectedCandidate.address || 'Casablanca' }}</p>

          <!-- CV -->
          <div class="mb-3">
            <h6>CV</h6>

            <iframe
              v-if="selectedCandidate.cv_link"
              :src="getCVUrl(selectedCandidate.cv_link)"
              width="100%" height="400"
              style="border-radius:10px;">
            </iframe>

            <p v-else>Aucun CV</p>

            <a
              v-if="selectedCandidate.cv_link"
              :href="getCVUrl(selectedCandidate.cv_link)"
              target="_blank"
              class="btn btn-outline-primary mt-2">
              📄 Ouvrir CV
            </a>
          </div>

          <!-- SKILLS -->
          <h6>Compétences</h6>
          <div v-if="selectedCandidate.skills?.length">
            <span
              v-for="(skill, i) in selectedCandidate.skills"
              :key="i"
              class="badge bg-secondary me-1 mb-1">
              {{ skill }}
            </span>
          </div>
          <p v-else>Aucune compétence</p>

          <!-- EXPERIENCE -->
          <h6 class="mt-3">Expérience</h6>
          <ul v-if="selectedCandidate.experience?.length">
            <li v-for="(exp, i) in selectedCandidate.experience" :key="i">
              {{ exp }}
            </li>
          </ul>
          <p v-else>Aucune expérience</p>

          <!-- EDUCATION -->
          <h6 class="mt-3">Éducation</h6>
          <ul v-if="selectedCandidate.education?.length">
            <li v-for="(edu, i) in selectedCandidate.education" :key="i">
              {{ edu }}
            </li>
          </ul>
          <p v-else>Aucune éducation</p>

          <!-- STATUS -->
          <div class="mt-4">
            <label>Status</label>

            <select
              class="form-select"
              v-model="selectedCandidate.status"
              @change="updateStatus(selectedCandidate.id, selectedCandidate.status)">
              <option value="à traiter">📥 À traiter</option>
              <option value="appel">📞 Appel</option>
              <option value="entretien">🧑‍💼 Entretien</option>
              <option value="accepté">✅ Accepté</option>
              <option value="refusé">❌ Refusé</option>
            </select>
          </div>

        </div>

        <!-- FOOTER -->
        <div class="modal-footer">
          <button class="btn btn-success"
            @click="updateStatus(selectedCandidate.id,'accepté')">
            Accepter
          </button>

          <button class="btn btn-danger"
            @click="updateStatus(selectedCandidate.id,'refusé')">
            Refuser
          </button>
        </div>

      </div>

    </div>

  </div>
</template>

<script>
import Jobs from "./Jobs.vue"

export default {
  components: { Jobs },

  props: ["currentPage"],

  data() {
    return {
      candidates: [],
      selectedCandidate: {},
      showModal: false,

      searchText: "",
      searchSkill: "",
      selectedJob: "",
      jobs: []
    }
  },

  mounted() {
    this.fetchCandidates()
  },

  computed: {
    filteredCandidates() {
      return this.candidates.filter(c => {
        const name = (c.first_name + " " + c.last_name).toLowerCase()

        return (
          name.includes(this.searchText.toLowerCase()) &&
          (this.searchSkill
            ? c.skills?.some(s =>
                s.toLowerCase().includes(this.searchSkill.toLowerCase()))
            : true) &&
          (this.selectedJob ? c.subject === this.selectedJob : true)
        )
      })
    }
  },

  methods: {
    async fetchCandidates() {
      const res = await fetch("http://localhost:3000/api/candidates")
      const data = await res.json()

      this.candidates = data
      this.jobs = [...new Set(data.map(c => c.subject))]
    },

    openModal(c) {
      this.selectedCandidate = c
      this.showModal = true
    },

    closeModal() {
      this.showModal = false
    },

    getCVUrl(link) {
      if (!link) return ""

      if (link.startsWith("http")) return link

      return "http://localhost:3000" + link
    },

    async updateStatus(id, status) {
      await fetch(`http://localhost:3000/api/candidates/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      })

      this.fetchCandidates()
    }
  }
}
</script>

<style scoped>
.main {
  padding: 20px;
  background: #f3f4f6;
  min-height: 100vh;
}

.filters {
  display: flex;
  gap: 10px;
}

/* MODAL */
.custom-modal {
  position: fixed;
  top:0;
  left:0;
  width:100%;
  height:100%;
  background: rgba(0,0,0,0.5);

  display:flex;
  justify-content:center;
  align-items:center;
}

.modal-content-custom {
  background:white;
  width:700px;
  max-height:90vh;
  overflow-y:auto;
  padding:20px;
  border-radius:10px;
}
</style>