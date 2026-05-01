<template>
  <div class="main">

    <!-- ================= DASHBOARD ================= -->
    <div v-if="!currentPage || currentPage === 'dashboard'">

      <h3 class="mb-3">📋 Liste des Candidats</h3>

      <div class="filters">
        <input v-model="searchText" placeholder="Nom..." class="form-control" />
        <select v-model="selectedJob" class="form-select">
          <option value="">Tous les postes</option>
          <option v-for="job in jobs" :key="job">{{ job }}</option>
        </select>
      </div>

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
              <td>{{ c.name || '---' }}</td>
              <td>{{ c.email || '---' }}</td>
              <td>{{ c.subject || 'Non défini' }}</td>
              <td>
                <span class="badge"
                  :class="{
                    'bg-secondary': c.status === 'RECEIVED',
                    'bg-warning':   c.status === 'IN_PROGRESS',
                    'bg-success':   c.status === 'ACCEPTED',
                    'bg-danger':    c.status === 'REJECTED'
                  }">
                  {{ c.status || '---' }}
                </span>
              </td>
              <td>
                <button class="btn btn-primary btn-sm" @click="openModal(c)">Voir</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ================= JOBS ================= -->
    <div v-if="currentPage === 'jobs'">
      <Jobs />
    </div>

    <!-- ================= ADMIS ================= -->
    <div v-if="currentPage === 'admis'">
      <Admis />
    </div>

    <!-- ================= REFUSES ================= -->
    <div v-if="currentPage === 'refuses'">
      <Refuses />
    </div>

    <!-- ================= MATCHING ================= -->
    <div v-if="currentPage === 'matching'">
      <Matching />
    </div>

    <!-- ================= MODAL DETAILS ================= -->
    <div v-if="showModal" class="custom-modal" @click.self="closeModal">
      <div class="modal-content-custom">

        <div class="modal-header">
          <h5>{{ selectedCandidate.name }}</h5>
          <button @click="closeModal">✖</button>
        </div>

        <div class="modal-body">
          <p><strong>Email :</strong> {{ selectedCandidate.email }}</p>
          <p><strong>Poste :</strong> {{ selectedCandidate.subject || 'Non défini' }}</p>
          <p><strong>Téléphone :</strong> {{ selectedCandidate.phone || '-' }}</p>
          <p><strong>Adresse :</strong> {{ selectedCandidate.address || '-' }}</p>

          <!-- CV -->
          <div class="mb-3">
            <h6>📄 CV</h6>
            <iframe
              v-if="selectedCandidate.cv_link"
              :src="getCVUrl(selectedCandidate.cv_link)"
              width="100%" height="400"
              style="border:1px solid #ccc;border-radius:6px;">
            </iframe>
            <p v-else>Aucun CV disponible</p>
          </div>

          <!-- EMAIL BODY -->
          <h6>✉️ Contenu Email</h6>
          <div class="email-body">
            <p style="white-space:pre-line;">{{ selectedCandidate.body || 'Aucun contenu email' }}</p>
          </div>

          <!-- SKILLS -->
          <h6 class="mt-3">🛠️ Compétences</h6>
          <div v-if="selectedCandidate.skills && selectedCandidate.skills.length">
            <span v-for="(s, i) in selectedCandidate.skills" :key="i"
              class="badge bg-secondary me-1 mb-1">{{ s }}</span>
          </div>
          <p v-else>Aucune compétence</p>

          <!-- EXPERIENCE -->
          <h6 class="mt-3">💼 Expérience</h6>
          <ul v-if="selectedCandidate.experience && selectedCandidate.experience.length">
            <li v-for="e in selectedCandidate.experience" :key="e.id">
              {{ e.position }} - {{ e.company }}
              <span v-if="e.duration">({{ e.duration }})</span>
            </li>
          </ul>
          <p v-else>Aucune expérience</p>

          <!-- EDUCATION -->
          <h6 class="mt-3">🎓 Formation</h6>
          <ul v-if="selectedCandidate.education && selectedCandidate.education.length">
            <li v-for="ed in selectedCandidate.education" :key="ed.id">
              {{ ed.degree }} - {{ ed.institution }}
              <span v-if="ed.year">({{ ed.year }})</span>
            </li>
          </ul>
          <p v-else>Aucune formation</p>
        </div>

        <div class="modal-footer">
          <button class="btn btn-success" :disabled="actionLoading" @click="acceptCandidate(selectedCandidate.id)">
            <span v-if="actionLoading">⏳</span>
            <span v-else>✅ Accepter</span>
          </button>
          <button class="btn btn-danger" :disabled="actionLoading" @click="openRejectModal(selectedCandidate)">
            ❌ Refuser
          </button>
        </div>

      </div>
    </div>

    <!-- ================= MODAL REFUS (motif) ================= -->
    <div v-if="showRejectModal" class="custom-modal" @click.self="closeRejectModal">
      <div class="modal-content-custom" style="max-width:480px;">

        <div class="modal-header">
          <h5>❌ Refuser {{ rejectTarget?.name }}</h5>
          <button @click="closeRejectModal">✖</button>
        </div>

        <div class="modal-body">
          <label class="form-label"><strong>Motif du refus (optionnel)</strong></label>
          <textarea
            v-model="rejectReason"
            class="form-control"
            rows="4"
            placeholder="Ex : Profil ne correspondant pas aux critères requis...">
          </textarea>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeRejectModal">Annuler</button>
          <button class="btn btn-danger" :disabled="actionLoading" @click="confirmReject">
            <span v-if="actionLoading">⏳ Envoi...</span>
            <span v-else>Confirmer le refus</span>
          </button>
        </div>

      </div>
    </div>

    <!-- ================= TOAST ================= -->
    <div v-if="toast.show" class="toast-notif" :class="toast.type">
      {{ toast.message }}
    </div>

  </div>
</template>

<script>
import Jobs from "./Jobs.vue"
import Admis from "./Admis.vue"
import Refuses from "./Refuses.vue"
import Matching from "./Matching.vue"

export default {
  components: { Jobs, Admis, Refuses, Matching },

  // ✅ FIX : currentPage est maintenant une DATA locale, plus une prop.
  // C'est App.vue (via le sidebar) qui la contrôle via :currentPage (prop).
  // Dashboard reçoit la valeur et l'affiche — il ne la modifie pas lui-même.
  props: {
    currentPage: { type: String, default: 'dashboard' }
  },

  data() {
    return {
      candidates: [],
      selectedCandidate: { skills: [], experience: [], education: [], cv_link: null, body: "" },
      showModal: false,

      // Refus
      showRejectModal: false,
      rejectTarget: null,
      rejectReason: "",

      actionLoading: false,

      searchText: "",
      selectedJob: "",
      jobs: [],

      toast: { show: false, message: "", type: "success" }
    }
  },

  mounted() {
    this.fetchCandidates()
  },

  computed: {
    filteredCandidates() {
      return (this.candidates || []).filter(c => {
        const name = (c.name || "").toLowerCase()
        return (
          name.includes(this.searchText.toLowerCase()) &&
          (this.selectedJob ? c.subject === this.selectedJob : true)
        )
      })
    }
  },

  methods: {

    // ── Fetch liste ──
    async fetchCandidates() {
      try {
        const res = await fetch("http://localhost:3000/api/candidates")
        const data = await res.json()
        this.candidates = Array.isArray(data) ? data : []
        this.jobs = [...new Set(this.candidates.map(c => c.subject).filter(Boolean))]
      } catch (err) {
        console.error("FETCH ERROR:", err)
      }
    },

    // ── Ouvrir modal détails ──
    async openModal(c) {
      try {
        const res = await fetch(`http://localhost:3000/api/candidates/${c.id}/details`)
        const data = await res.json()
        this.selectedCandidate = {
          ...data.candidate,
          skills: (data.skills || []).map(s => s.skill_name),
          experience: data.experience || [],
          education: data.education || [],
          cv_link: data.candidate.cv_link || null,
          body: data.candidate.body || ""
        }
        this.showModal = true
      } catch (err) {
        console.error("MODAL ERROR:", err)
      }
    },

    closeModal() {
      this.showModal = false
      this.selectedCandidate = { skills: [], experience: [], education: [], cv_link: null, body: "" }
    },

    // ── Accepter ──
    async acceptCandidate(id) {
      if (!confirm("Confirmer l'acceptation de ce candidat ?")) return
      this.actionLoading = true
      try {
        const res = await fetch(`http://localhost:3000/api/candidates/${id}/accept`, {
          method: "POST"
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message)
        this.showToast("✅ Candidat accepté et email envoyé !", "success")
        this.closeModal()
        this.fetchCandidates()
      } catch (err) {
        console.error("ACCEPT ERROR:", err)
        this.showToast("Erreur lors de l'acceptation", "error")
      } finally {
        this.actionLoading = false
      }
    },

    // ── Ouvrir modal refus ──
    openRejectModal(candidate) {
      this.rejectTarget = candidate
      this.rejectReason = ""
      this.showRejectModal = true
    },

    closeRejectModal() {
      this.showRejectModal = false
      this.rejectTarget = null
      this.rejectReason = ""
    },

    // ── Confirmer refus ──
    async confirmReject() {
      if (!this.rejectTarget) return
      this.actionLoading = true
      try {
        const res = await fetch(`http://localhost:3000/api/candidates/${this.rejectTarget.id}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: this.rejectReason })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message)
        this.showToast("❌ Candidat refusé et email envoyé.", "error")
        this.closeRejectModal()
        this.closeModal()
        this.fetchCandidates()
      } catch (err) {
        console.error("REJECT ERROR:", err)
        this.showToast("Erreur lors du refus", "error")
      } finally {
        this.actionLoading = false
      }
    },

    // ── URL CV ──
    getCVUrl(link) {
      if (!link) return ""
      const clean = link.replace(/\\/g, "/")
      const index = clean.indexOf("uploads/")
      if (index === -1) return ""
      return "http://localhost:3000/" + clean.substring(index)
    },

    // ── Toast ──
    showToast(message, type = "success") {
      this.toast = { show: true, message, type }
      setTimeout(() => { this.toast.show = false }, 3500)
    }
  }
}
</script>

<style scoped>
.main { padding: 20px; background: #f3f4f6; min-height: 100vh; }

.filters { display: flex; gap: 10px; margin-bottom: 15px; }
.filters input, .filters select {
  padding: 8px; border: 1px solid #ccc; border-radius: 6px; width: 200px;
}

table { width: 100%; border-collapse: collapse; background: white; }
thead { background: #1f2937; color: white; }
th, td { padding: 10px; border: 1px solid #ddd; }
tbody tr:hover { background: #f9fafb; }

.badge { padding: 5px 10px; border-radius: 6px; color: white; font-size: 12px; }
.bg-secondary { background: gray; }
.bg-warning    { background: orange; }
.bg-success    { background: green; }
.bg-danger     { background: red; }

.email-body {
  background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;
  padding: 12px; max-height: 200px; overflow-y: auto; font-size: 14px; color: #374151;
}

.custom-modal {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.5); display: flex; justify-content: center;
  align-items: center; z-index: 9999;
}

.modal-content-custom {
  background: white; width: 700px; max-width: 95%; max-height: 90vh;
  border-radius: 12px; display: flex; flex-direction: column;
}

.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 15px; border-bottom: 1px solid #e5e7eb;
}
.modal-header button { background: none; border: none; font-size: 18px; cursor: pointer; color: #6b7280; }
.modal-header button:hover { color: #111; }

.modal-body { overflow-y: auto; max-height: 65vh; padding: 15px; }

.modal-footer {
  display: flex; gap: 10px; padding: 15px;
  border-top: 1px solid #e5e7eb; justify-content: flex-end;
}

/* Toast */
.toast-notif {
  position: fixed; bottom: 28px; right: 28px;
  padding: 14px 22px; border-radius: 8px; color: white;
  font-size: 15px; font-weight: 500; z-index: 99999;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  animation: fadeInUp 0.3s ease;
}
.toast-notif.success { background: #16a34a; }
.toast-notif.error   { background: #dc2626; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>