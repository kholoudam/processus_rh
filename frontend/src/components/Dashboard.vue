<template>
  <div class="dashboard">

    <!-- SIDEBAR -->
    <div class="sidebar">
      <h2 class="logo">AIRBUS</h2>
      <ul>
        <li class="active">Dashboard</li>
        <li>CVthèque</li>
        <li>Admis</li>
        <li>Refusés</li>
      </ul>
    </div>

    <!-- MAIN -->
    <div class="main">

      <h3 class="mb-3">📋 Liste des Candidats</h3>

      <!-- 🔍 FILTERS -->
      <div class="filters">

        <!-- NOM -->
        <input
          type="text"
          v-model="searchText"
          placeholder="🔍 Nom ou prénom"
          class="form-control"
        />

        <!-- SKILLS -->
        <input
          type="text"
          v-model="searchSkill"
          placeholder="🧠 Compétence (React, Python...)"
          class="form-control"
        />

        <!-- POSTE -->
        <select v-model="selectedJob" class="form-select">
          <option value="">💼 Tous les postes</option>
          <option v-for="job in jobs" :key="job">
            {{ job }}
          </option>
        </select>

      </div>

      <!-- TABLE -->
      <div class="table-responsive mt-3">
        <table class="table table-hover table-bordered bg-white">
          <thead class="table-dark">
            <tr>
              <th>Nom</th>
              <th>Prénom</th>
              <th>Téléphone</th>
              <th>Email</th>
              <th>Poste</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="c in filteredCandidates" :key="c.id">
              <td>{{ c.last_name }}</td>
              <td>{{ c.first_name }}</td>
              <td>{{ c.phone }}</td>
              <td>{{ c.email }}</td>
              <td>{{ c.subject }}</td>

              <td>
                <span class="badge bg-info">{{ c.status }}</span>
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

    <!-- MODAL -->
    <div v-if="showModal" class="custom-modal"> 
      <div class="modal-content-custom"> 
        <div class="modal-header"> 
          <h5> {{ selectedCandidate.first_name }} {{ selectedCandidate.last_name }} </h5> 
          <button @click="closeModal">✖</button> 
        </div> 
        <div class="modal-body"> 
          <p><strong>Email:</strong> {{ selectedCandidate.email }}</p> 
          <p><strong>Téléphone:</strong> {{ selectedCandidate.phone }}</p> 
          <p><strong>Adresse:</strong> {{ selectedCandidate.address || 'Casablanca' }}</p> 
          <!-- CV --> 
          <div class="mb-3"> 
            <h6>CV</h6> 
            <iframe v-if="selectedCandidate.cv_link" :src="getCVUrl(selectedCandidate.cv_link)" width="100%" height="500px" style="border:1px solid #ccc; border-radius:10px;"> </iframe> 
            <p v-else>Aucun CV disponible</p> 
            <a v-if="selectedCandidate.cv_link" :href="getCVUrl(selectedCandidate.cv_link)" target="_blank" class="btn btn-outline-primary mt-2" > 📄 Ouvrir CV </a> 
          </div> 
          <!-- Skills --> 
          <h6>Compétences</h6> 
          <div v-if="selectedCandidate.skills?.length"> 
            <span v-for="(skill, i) in selectedCandidate.skills" :key="i" class="badge bg-secondary me-1 mb-1" > {{ skill }} </span> 
          </div> 
          <p v-else>Aucune compétence</p> 
          <!-- Experience --> 
          <h6 class="mt-3">Expérience</h6> 
          <ul v-if="selectedCandidate.experience?.length"> 
            <li v-for="(exp, i) in selectedCandidate.experience" :key="i"> {{ exp }} </li>
          </ul> 
          <p v-else>Aucune expérience</p> 
          <!-- Education --> 
          <h6 class="mt-3">Éducation</h6> 
          <ul v-if="selectedCandidate.education?.length"> 
            <li v-for="(edu, i) in selectedCandidate.education" :key="i"> {{ edu }} </li> 
          </ul> 
          <p v-else>Aucune éducation</p> 
          <!-- STATUS SELECT --> 
          <div class="mt-4"> 
            <label><strong>Status</strong></label> 
            <select class="form-select mt-2" v-model="selectedCandidate.status" @change="updateStatus(selectedCandidate.id, selectedCandidate.status)" > 
              <option value="à traiter">📥 À traiter</option> 
              <option value="appel">📞 Appel</option> 
              <option value="entretien">🧑‍💼 Entretien</option> 
              <option value="accepté">✅ Accepté</option> 
              <option value="refusé">❌ Refusé</option> 
            </select> 
          </div> 
          <!-- FOOTER --> 
          <div class="modal-footer"> 
            <button class="btn btn-success" @click="updateStatus(selectedCandidate.id, 'accepté')"> Accepter </button> 
            <button class="btn btn-danger" @click="updateStatus(selectedCandidate.id, 'refusé')"> Refuser </button> 
          </div>
        </div> 
      </div> 
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      candidates: [],
      selectedCandidate: {},
      showModal: false,

      searchText: "",
      searchSkill: "",
      selectedJob: "",

      jobs: [] // ✅ liste postes
    }
  },

  mounted() {
    this.fetchCandidates()
  },

  computed: {
    filteredCandidates() {
      return this.candidates.filter(c => {

        // 🔍 NOM
        const fullName = (c.first_name + " " + c.last_name).toLowerCase()
        const matchName = fullName.includes(this.searchText.toLowerCase())

        // 🧠 SKILLS
        const matchSkill = this.searchSkill
          ? c.skills?.some(s =>
              s.toLowerCase().includes(this.searchSkill.toLowerCase())
            )
          : true

        // 💼 POSTE
        const matchJob = this.selectedJob
          ? c.subject === this.selectedJob
          : true

        return matchName && matchSkill && matchJob
      })
    }
  },

  methods: {
    async fetchCandidates() {
      const res = await fetch("http://localhost:3000/api/candidates")
      const data = await res.json()

      this.candidates = data

      // ✅ EXTRAIRE LES POSTES UNIQUES
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
    }
  }
}
</script>

<style scoped>

.dashboard {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 250px;
  background: #1f2937;
  color: white;
  padding: 20px;
}

.main {
  flex: 1;
  padding: 20px;
  background: #f3f4f6;
}

/* FILTERS */
.filters {
  display: flex;
  gap: 10px;
}

.filters input,
.filters select {
  width: 100%;
}

/* MODAL */
.custom-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;

  background: rgba(0,0,0,0.5);

  display: flex;
  justify-content: center;
  align-items: center;

  overflow-y: auto; /* ✅ IMPORTANT */
  padding: 20px;
}

.modal-content-custom {
  background: white;
  width: 700px;
  max-height: 90vh;   /* ✅ limite hauteur */
  overflow-y: auto;   /* ✅ scroll interne */
  border-radius: 10px;
  padding: 20px;
}

</style>