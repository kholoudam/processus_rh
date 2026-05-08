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

    <!-- ===================== MODAL CANDIDAT ===================== -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">

      <div class="modal-panel">

        <!-- Head -->
        <div class="modal-head">
          <h3>{{ sel.name }}</h3>
          <button class="btn-close" @click="closeModal">✕</button>
        </div>

        <!-- Body -->
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
            <p v-else class="no-data">Aucun CV disponible</p>
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
            <p v-if="!sel.skills.length" class="no-data">—</p>
          </div>

          <!-- EXPERIENCE -->
          <div class="section">
            <h4>Expériences</h4>
            <div
              v-for="e in sel.experience"
              :key="e.id"
              class="timeline"
            >
              {{ e.position }} — {{ e.company }} ({{ e.duration }})
            </div>
            <p v-if="!sel.experience.length" class="no-data">—</p>
          </div>

          <!-- EDUCATION -->
          <div class="section">
            <h4>Formation</h4>
            <div
              v-for="ed in sel.education"
              :key="ed.id"
              class="timeline"
            >
              {{ ed.degree }} — {{ ed.institution }} ({{ ed.year }})
            </div>
            <p v-if="!sel.education.length" class="no-data">—</p>
          </div>

        </div>

        <!-- ── Footer : boutons Accepter / Refuser ── -->
        <div class="modal-footer">
          <button
            class="btn-accept"
            :disabled="actionLoading"
            @click="confirmAccept"
          >
            ✅ Accepter
          </button>
          <button
            class="btn-reject"
            :disabled="actionLoading"
            @click="openRejectModal"
          >
            ❌ Refuser
          </button>
        </div>

      </div>
    </div>

    <!-- ===================== MODAL REFUS ===================== -->
    <div v-if="showRejectModal" class="modal-overlay" @click.self="showRejectModal=false">
      <div class="modal-confirm">
        <h3>Motif de refus</h3>
        <p>Candidat : <strong>{{ sel.name }}</strong></p>
        <textarea
          v-model="rejectReason"
          class="reason-input"
          placeholder="Indiquez un motif (facultatif)..."
          rows="4"
        ></textarea>
        <div class="confirm-actions">
          <button class="btn-cancel" @click="showRejectModal=false">Annuler</button>
          <button class="btn-reject" :disabled="actionLoading" @click="confirmReject">
            Confirmer le refus
          </button>
        </div>
      </div>
    </div>

    <!-- ===================== TOAST ===================== -->
    <transition name="toast">
      <div v-if="toast.show" :class="['toast', toast.type]">
        {{ toast.message }}
      </div>
    </transition>

  </div>
</template>

<script>
export default {
  data() {
    return {
      candidates:      [],
      showModal:       false,
      showRejectModal: false,
      actionLoading:   false,
      rejectReason:    '',
      sel: { skills: [], experience: [], education: [] },

      searchText:     '',
      selectedStatus: '',
      page:           1,
      perPage:        10,

      toast: { show: false, message: '', type: 'success' }
    }
  },

  computed: {
    filtered() {
      return this.candidates.filter(c => {
        const search = c.name?.toLowerCase().includes(this.searchText.toLowerCase())
        const status = this.selectedStatus ? c.status === this.selectedStatus : true
        return search && status
      })
    },

    totalPages() {
      return Math.max(1, Math.ceil(this.filtered.length / this.perPage))
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
    /* ── Fetch ── */
    async fetchCandidates() {
      const r = await fetch('http://localhost:3000/api/candidates')
      this.candidates = await r.json()
    },

    /* ── Modal candidat ── */
    async openModal(c) {
      const r = await fetch(`http://localhost:3000/api/candidates/${c.id}/details`)
      const d = await r.json()
      this.sel = {
        ...d.candidate,
        skills:     d.skills?.map(s => s.skill_name) || [],
        experience: d.experience || [],
        education:  d.education  || []
      }
      this.rejectReason = ''
      this.showModal    = true
    },

    closeModal() {
      this.showModal = false
    },

    /* ── Statut intermédiaire ── */
    async updateStatus(c, status) {
      await fetch(`http://localhost:3000/api/candidates/${c.id}/status`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status })
      })
      this.fetchCandidates()
    },

    /* ── Accepter ── */
    async confirmAccept() {
      if (!confirm(`Accepter la candidature de ${this.sel.name} ?`)) return
      this.actionLoading = true
      try {
        const r = await fetch(`http://localhost:3000/api/candidates/${this.sel.id}/accept`, {
          method: 'POST'
        })
        if (r.ok) {
          this.showToast(`✅ ${this.sel.name} accepté(e) — un email a été envoyé.`, 'success')
          this.closeModal()
          this.fetchCandidates()
        } else {
          const err = await r.json()
          this.showToast(err.message || 'Erreur lors de l\'acceptation', 'error')
        }
      } catch (e) {
        this.showToast('Erreur réseau', 'error')
      } finally {
        this.actionLoading = false
      }
    },

    /* ── Refuser ── */
    openRejectModal() {
      this.rejectReason    = ''
      this.showRejectModal = true
    },

    async confirmReject() {
      this.actionLoading = true
      try {
        const r = await fetch(`http://localhost:3000/api/candidates/${this.sel.id}/reject`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ reason: this.rejectReason })
        })
        if (r.ok) {
          this.showToast(`❌ ${this.sel.name} refusé(e) — un email a été envoyé.`, 'success')
          this.showRejectModal = false
          this.closeModal()
          this.fetchCandidates()
        } else {
          const err = await r.json()
          this.showToast(err.message || 'Erreur lors du refus', 'error')
        }
      } catch (e) {
        this.showToast('Erreur réseau', 'error')
      } finally {
        this.actionLoading = false
      }
    },

    /* ── Toast ── */
    showToast(message, type = 'success') {
      this.toast = { show: true, message, type }
      setTimeout(() => { this.toast.show = false }, 4000)
    },

    /* ── Pagination ── */
    prevPage() { if (this.page > 1) this.page-- },
    nextPage()  { if (this.page < this.totalPages) this.page++ },

    /* ── CV URL ── */
    cvUrl(link) { return `http://localhost:3000/${link}` }
  }
}
</script>

<style scoped>
.page-wrapper {
  padding: 25px;
  background: #f8fafc;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title { font-size: 22px; font-weight: 700; }
.page-sub   { color: #64748b; font-size: 14px; margin-top: 4px; }

.count-badge {
  background: #2563eb;
  color: white;
  padding: 8px 14px;
  border-radius: 30px;
  font-weight: 600;
}

.card-surface {
  background: white;
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
}

.mb-3 { margin-bottom: 16px; }

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.f-input, .f-select {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.f-input { flex: 1; min-width: 180px; }

/* ── Table ── */
.table-wrapper { overflow-x: auto; }

.data-table {
  width: 100%;
  background: white;
  border-radius: 12px;
  border-collapse: collapse;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
}

.data-table th {
  background: #f1f5f9;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: #475569;
  padding: 14px 16px;
  text-align: left;
}

.data-table td { padding: 14px 16px; border-top: 1px solid #f1f5f9; }

.data-table tr:hover td { background: #f8fafc; }

/* Status badges */
.status {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}
.status.RECEIVED    { background: #dbeafe; color: #1d4ed8; }
.status.IN_PROGRESS { background: #fef9c3; color: #854d0e; }
.status.INTERVIEW   { background: #d1fae5; color: #065f46; }
.status.TEST        { background: #ede9fe; color: #4c1d95; }
.status.FINAL       { background: #fce7f3; color: #9d174d; }

/* ── Buttons ── */
.btn-view {
  background: #2563eb;
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.btn-view:hover { background: #1d4ed8; }

.btn-accept {
  background: #16a34a;
  color: white;
  border: none;
  padding: 11px 24px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background .2s;
}
.btn-accept:hover:not(:disabled) { background: #15803d; }

.btn-reject {
  background: #dc2626;
  color: white;
  border: none;
  padding: 11px 24px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background .2s;
}
.btn-reject:hover:not(:disabled) { background: #b91c1c; }

.btn-accept:disabled, .btn-reject:disabled { opacity: .5; cursor: not-allowed; }

.btn-cancel {
  background: #e2e8f0;
  color: #334155;
  border: none;
  padding: 11px 24px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.btn-cancel:hover { background: #cbd5e1; }

.btn-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #64748b;
}

/* ── Pagination ── */
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
}

.pagination button {
  background: #2563eb;
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
}

.pagination button:disabled { background: #cbd5e1; cursor: default; }

/* ── Modal candidat ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.modal-panel {
  width: 90%;
  max-width: 900px;
  max-height: 90vh;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-head {
  padding: 18px 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  background: #f8fafc;
}

.modal-head h3 { font-size: 18px; font-weight: 700; }

.modal-body {
  padding: 22px;
  overflow-y: auto;
  flex: 1;
}

/* ── Footer ── */
.modal-footer {
  padding: 16px 22px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

/* ── Info grid ── */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  background: #f1f5f9;
  padding: 16px;
  border-radius: 10px;
}

/* ── Status select ── */
.status-box { margin: 20px 0; display: flex; align-items: center; gap: 12px; }

.status-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

/* ── CV ── */
.cv-frame { width: 100%; height: 450px; border: 1px solid #e2e8f0; border-radius: 8px; }

/* ── Section ── */
.section { margin-top: 22px; }
.section h4 { font-size: 15px; font-weight: 600; margin-bottom: 10px; color: #1e293b; }

.skill-tag {
  display: inline-block;
  margin: 4px;
  padding: 5px 12px;
  background: #dbeafe;
  color: #1d4ed8;
  border-radius: 20px;
  font-size: 13px;
}

.timeline {
  background: #f8fafc;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 14px;
  border-left: 3px solid #2563eb;
}

.no-data { color: #94a3b8; font-size: 14px; }

/* ── Modal refus ── */
.modal-confirm {
  background: white;
  border-radius: 16px;
  padding: 28px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0,0,0,.2);
}

.modal-confirm h3 { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
.modal-confirm p  { color: #475569; margin-bottom: 14px; }

.reason-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  box-sizing: border-box;
}

.confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 18px;
}

/* ── Toast ── */
.toast {
  position: fixed;
  bottom: 28px;
  right: 28px;
  padding: 14px 22px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  z-index: 9999;
  box-shadow: 0 4px 20px rgba(0,0,0,.15);
}

.toast.success { background: #16a34a; color: white; }
.toast.error   { background: #dc2626; color: white; }

.toast-enter-active, .toast-leave-active { transition: all .3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(20px); }

/* ── Responsive ── */
@media (max-width: 768px) {
  .page-wrapper  { padding: 12px; }
  .modal-panel   { width: 98%; max-height: 95vh; }
  .cv-frame      { height: 300px; }
  .data-table    { min-width: 700px; }
  .modal-footer  { flex-direction: column; }
  .btn-accept, .btn-reject { width: 100%; text-align: center; }
}
</style>