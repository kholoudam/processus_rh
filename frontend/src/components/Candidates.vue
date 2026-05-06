<template>
  <div class="page-wrapper">

    <!-- HEADER -->
    <div class="page-header">
      <div>
        <h4 class="page-title">Candidats en cours</h4>
        <p class="page-sub">Gestion du pipeline de recrutement</p>
      </div>
      <span class="count-badge">{{ filtered.length }}</span>
    </div>

    <!-- FILTERS -->
    <div class="card-surface mb-3">
      <div class="filter-row">
        <input
          v-model="searchText"
          class="f-input"
          placeholder="Rechercher..."
        />

        <select v-model="selectedStatus" class="f-select">
          <option value="">Tous les statuts</option>
          <option value="RECEIVED">Reçu</option>
          <option value="IN_PROGRESS">En cours</option>
          <option value="INTERVIEW">Entretien</option>
          <option value="TEST">Test</option>
          <option value="FINAL">Final</option>
        </select>

        <select v-model="perPage" class="f-select">
          <option :value="5">5</option>
          <option :value="10">10</option>
          <option :value="15">15</option>
          <option :value="20">20</option>
        </select>
      </div>
    </div>

    <!-- TABLE -->
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Candidat</th>
            <th>Email</th>
            <th>Poste</th>
            <th>Statut</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="c in paginatedCandidates" :key="c.id">
            <td>{{ c.name }}</td>
            <td>{{ c.email }}</td>
            <td>{{ c.subject || 'N/D' }}</td>
            <td>
              <span :class="'status '+c.status">
                {{ c.status }}
              </span>
            </td>
            <td>
              <button class="btn-view" @click="openModal(c)">
                Consulter
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- PAGINATION -->
    <div class="pagination">
      <button @click="prevPage" :disabled="page===1">◀</button>
      <span>Page {{ page }} / {{ totalPages }}</span>
      <button @click="nextPage" :disabled="page===totalPages">▶</button>
    </div>

    <!-- MODAL -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">

      <div class="modal-panel">

        <div class="modal-head">
          <h3>{{ sel.name }}</h3>
          <button @click="closeModal">✕</button>
        </div>

        <div class="modal-body">

          <div class="info-grid">
            <div><strong>Email:</strong> {{ sel.email }}</div>
            <div><strong>Téléphone:</strong> {{ sel.phone || '—' }}</div>
            <div><strong>Adresse:</strong> {{ sel.address || '—' }}</div>
            <div><strong>Poste:</strong> {{ sel.subject }}</div>
          </div>

          <!-- SELECT STATUT -->
          <div class="status-box">
            <label>Changer statut :</label>
            <select
              v-model="sel.status"
              class="status-select"
              @change="updateStatus(sel, sel.status)"
            >
              <option value="RECEIVED">Reçu</option>
              <option value="IN_PROGRESS">En cours</option>
              <option value="INTERVIEW">Entretien</option>
              <option value="TEST">Test</option>
              <option value="FINAL">Final</option>
            </select>
          </div>

          <!-- CV -->
          <div class="section">
            <h4>CV</h4>
            <iframe
              v-if="sel.cv_link"
              :src="cvUrl(sel.cv_link)"
              class="cv-frame"
            ></iframe>
          </div>

          <!-- MAIL -->
          <div class="section">
            <h4>Contenu du mail</h4>
            <p>{{ sel.body }}</p>
          </div>

          <!-- SKILLS -->
          <div class="section">
            <h4>Compétences</h4>
            <span
              v-for="(s,i) in sel.skills"
              :key="i"
              class="skill-tag"
            >
              {{ s }}
            </span>
          </div>

          <!-- EXPERIENCE -->
          <div class="section">
            <h4>Expériences</h4>
            <div
              v-for="e in sel.experience"
              :key="e.id"
              class="timeline"
            >
              {{ e.position }} - {{ e.company }} ({{ e.duration }})
            </div>
          </div>

          <!-- EDUCATION -->
          <div class="section">
            <h4>Formation</h4>
            <div
              v-for="ed in sel.education"
              :key="ed.id"
              class="timeline"
            >
              {{ ed.degree }} - {{ ed.institution }} ({{ ed.year }})
            </div>
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
      showModal: false,
      sel: {
        skills: [],
        experience: [],
        education: []
      },
      searchText: '',
      selectedStatus: '',
      page: 1,
      perPage: 10
    }
  },

  computed: {
    filtered() {
      return this.candidates.filter(c => {
        const search = c.name?.toLowerCase().includes(this.searchText.toLowerCase())
        const status = this.selectedStatus
          ? c.status === this.selectedStatus
          : true
        return search && status
      })
    },

    totalPages() {
      return Math.ceil(this.filtered.length / this.perPage)
    },

    paginatedCandidates() {
      const start = (this.page - 1) * this.perPage
      return this.filtered.slice(start, start + this.perPage)
    }
  },

  mounted() {
    this.fetchCandidates()
  },

  methods: {
    async fetchCandidates() {
      const r = await fetch('http://localhost:3000/api/candidates')
      this.candidates = await r.json()
    },

    async openModal(c) {
      const r = await fetch(`http://localhost:3000/api/candidates/${c.id}/details`)
      const d = await r.json()

      this.sel = {
        ...d.candidate,
        skills: d.skills || [],
        experience: d.experience || [],
        education: d.education || []
      }

      this.showModal = true
    },

    closeModal() {
      this.showModal = false
    },

    async updateStatus(c, status) {
      await fetch(`http://localhost:3000/api/candidates/${c.id}/status`, {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ status })
      })

      this.fetchCandidates()
    },

    prevPage() {
      if(this.page>1) this.page--
    },

    nextPage() {
      if(this.page<this.totalPages) this.page++
    },

    cvUrl(link){
      return `http://localhost:3000/${link}`
    }
  }
}
</script>

<style scoped>
.page-wrapper{
  padding:25px;
  background:#f8fafc;
}

.page-header{
  display:flex;
  justify-content:space-between;
  margin-bottom:20px;
}

.page-title{
  font-size:22px;
  font-weight:700;
}

.count-badge{
  background:#2563eb;
  color:white;
  padding:8px 14px;
  border-radius:30px;
}

.card-surface{
  background:white;
  padding:15px;
  border-radius:12px;
}

.filter-row{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
}

.f-input,.f-select{
  padding:10px;
  border:1px solid #ddd;
  border-radius:8px;
}

.table-wrapper{
  overflow-x:auto;
}

.data-table{
  width:100%;
  background:white;
  border-radius:12px;
}

.data-table th,.data-table td{
  padding:14px;
}

.btn-view{
  background:#2563eb;
  color:white;
  border:none;
  padding:8px 14px;
  border-radius:8px;
}

.pagination{
  margin-top:15px;
  display:flex;
  justify-content:center;
  gap:15px;
}

.modal-overlay{
  position:fixed;
  inset:0;
  background:rgba(0,0,0,.5);
  display:flex;
  justify-content:center;
  align-items:center;
  z-index:999;
}

.modal-panel{
  width:90%;
  max-width:900px;
  max-height:90vh;
  background:white;
  border-radius:16px;
  overflow:hidden;
  display:flex;
  flex-direction:column;
}

.modal-head{
  padding:18px;
  display:flex;
  justify-content:space-between;
  border-bottom:1px solid #eee;
}

.modal-body{
  padding:20px;
  overflow-y:auto;
}

.info-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
  gap:12px;
}

.status-box{
  margin:20px 0;
}

.cv-frame{
  width:100%;
  height:450px;
}

.section{
  margin-top:20px;
}

.skill-tag{
  display:inline-block;
  margin:5px;
  padding:6px 12px;
  background:#dbeafe;
  border-radius:20px;
}

.timeline{
  background:#f8fafc;
  padding:10px;
  border-radius:8px;
  margin-bottom:8px;
}

@media(max-width:768px){
  .page-wrapper{
    padding:12px;
  }

  .modal-panel{
    width:98%;
    max-height:95vh;
  }

  .cv-frame{
    height:300px;
  }

  .data-table{
    min-width:700px;
  }
}
</style>