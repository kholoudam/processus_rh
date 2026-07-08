<template>
  <div class="rh-chat">

    <!-- ══ PANNEAU SESSIONS (gauche) ══════════════════════════ -->
    <aside class="sessions-panel">
      <div class="sp-header">
        <span class="sp-title">💬 Historique</span>
        <button class="sp-new-btn" @click="newSession" title="Nouvelle conversation">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5"  y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      <div class="sp-list">
        <button
          v-for="s in sessions" :key="s.session_id"
          class="sp-item" :class="{ 'sp-item--active': s.session_id === sessionId }"
          @click="loadSession(s.session_id)"
        >
          <span class="sp-date">{{ fmtDate(s.last_message_at) }}</span>
          <span class="sp-count">{{ s.message_count }} message{{ s.message_count > 1 ? 's' : '' }}</span>
        </button>
        <div v-if="!sessions.length" class="sp-empty">Aucune conversation</div>
      </div>
    </aside>

    <!-- ══ ZONE CHAT (droite) ═════════════════════════════════ -->
    <div class="chat-pane">

      <!-- ── Header ── -->
      <div class="cp-header">
        <div class="cp-header-left">
          <div class="cp-avatar">🤖</div>
          <div>
            <div class="cp-name">Assistant RH</div>
            <div class="cp-sub">Posez n'importe quelle question sur vos candidats</div>
          </div>
        </div>
        <div class="cp-header-right">
          <span v-if="ctx.job_title"      class="ctx-tag ctx-tag--job">📌 {{ ctx.job_title }}</span>
          <span v-if="ctx.candidate_name" class="ctx-tag ctx-tag--cand">👤 {{ ctx.candidate_name }}</span>
          <button class="help-btn" @click="helpOpen = true" title="Comment utiliser le chatbot ?">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <circle cx="12" cy="17" r=".5" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- ── Messages (seule zone scrollable) ── -->
      <div class="cp-messages" ref="messagesEl">

        <div v-if="loading" class="cp-loading">
          <div class="dot-spinner"></div> Chargement…
        </div>

        <template v-else>
          <!-- Écran d'accueil -->
          <div v-if="!messages.length" class="welcome-screen">
            <div class="ws-icon">🤖</div>
            <div class="ws-title">Bonjour, je suis votre assistant RH !</div>
            <div class="ws-sub">Posez une question ou cliquez sur un exemple :</div>
            <div class="ws-chips">
              <button
                v-for="q in quickChips" :key="q"
                class="ws-chip" @click="quickAsk(q)"
              >{{ q }}</button>
            </div>
          </div>

          <!-- Bulles de messages -->
          <div
            v-for="(m, i) in messages" :key="i"
            class="msg-row" :class="m.from === 'user' ? 'msg-row--right' : 'msg-row--left'"
          >
            <div v-if="m.from === 'bot'" class="msg-avatar">🤖</div>
            <div class="bubble"
                 :class="m.from === 'user' ? 'bubble--user' : 'bubble--bot'">
              <div class="bubble-text" v-html="renderText(m.text)"></div>
              <div class="bubble-ts">{{ m.time }}</div>
            </div>
          </div>

          <!-- Indicateur de frappe -->
          <div v-if="typing" class="msg-row msg-row--left">
            <div class="msg-avatar">🤖</div>
            <div class="bubble bubble--bot bubble--typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        </template>
      </div>

      <!-- ── Barre de saisie ── -->
      <div class="cp-input">
        <input
          ref="inputEl"
          v-model="draft"
          class="cp-field"
          :placeholder="inputPlaceholder"
          :disabled="typing"
          @keydown.enter.prevent="sendMessage"
        />
        <button
          class="cp-send"
          :disabled="!draft.trim() || typing"
          @click="sendMessage"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- ══ MODAL AIDE ═════════════════════════════════════════ -->
    <transition name="modal-fade">
      <div v-if="helpOpen" class="modal-backdrop" @click.self="helpOpen = false">
        <div class="modal-box">

          <div class="modal-header">
            <span>❓ Comment utiliser l'assistant RH</span>
            <button class="modal-close" @click="helpOpen = false">✕</button>
          </div>

          <div class="modal-content">
            <div v-for="sec in helpSections" :key="sec.title" class="help-block">
              <div class="help-block-title">{{ sec.icon }} {{ sec.title }}</div>
              <ul class="help-examples">
                <li
                  v-for="ex in sec.examples" :key="ex"
                  @click="useExample(ex)"
                >
                  <span class="he-text">{{ ex }}</span>
                  <span class="he-action">Essayer →</span>
                </li>
              </ul>
            </div>

            <div class="help-tip">
              💡 L'assistant comprend le <strong>langage naturel</strong>.
              Pas besoin de formulation exacte — il retient le poste et le candidat
              discutés tout au long de la conversation.
            </div>
          </div>

        </div>
      </div>
    </transition>

  </div>
</template>


<script>
import axios from "axios";
const API = "http://localhost:3000/api/chatbot";

export default {
  name: "Chatbot",

  data() {
    return {
      sessionId: String(Date.now()),
      draft:     "",
      typing:    false,
      loading:   false,
      helpOpen:  false,
      messages:  [],
      sessions:  [],
      ctx: { job_title: null, candidate_name: null },

      quickChips: [
        "Recommande des candidats pour Technicien Méthodes",
        "Qui a le plus d'expérience en Ingénieur Production ?",
        "Qui a postulé à nos offres ?",
        "Statistiques globales de recrutement",
        "Détail Saad EL AMRANI",
      ],

      helpSections: [
        {
          icon: "🎯", title: "Recommandations",
          examples: [
            "Recommande des candidats pour Ingénieur Production",
            "Meilleurs profils pour Technicien Méthodes",
            "Montre les candidats pour Préparateur Méthodes",
          ]
        },
        {
          icon: "📊", title: "Expérience & Classement",
          examples: [
            "Qui a le plus d'expérience ?",
            "Qui a le plus d'expérience en Ingénieur Production ?",
            "Classe les candidats par expérience pour Technicien Moyens Généraux",
          ]
        },
        {
          icon: "🔍", title: "Détail d'un candidat",
          examples: [
            "Détail Omar BENHADDOU",
            "Profil complet de Tarik MANSOURI",
            "Analyse Saad EL AMRANI pour Ingénieur Production",
          ]
        },
        {
          icon: "📨", title: "Candidatures",
          examples: [
            "Qui a postulé à Ingénieur Production ?",
            "Montre les candidatures en attente",
          ]
        },
        {
          icon: "📈", title: "Statistiques",
          examples: [
            "Combien de candidats avons-nous ?",
            "Score moyen de matching pour Technicien Méthodes",
          ]
        },
        {
          icon: "📞", title: "Contact",
          examples: [
            "Quel est l'email de Omar BENHADDOU ?",
            "Contact de Hamid NACIRI",
          ]
        },
      ]
    };
  },

  computed: {
    inputPlaceholder() {
      if (this.ctx.job_title)      return `Question sur "${this.ctx.job_title}"…`;
      if (this.ctx.candidate_name) return `Question sur ${this.ctx.candidate_name}…`;
      return "Posez votre question RH en langage naturel…";
    }
  },

  async mounted() {
    await this.fetchSessions();
    this.$nextTick(() => this.$refs.inputEl?.focus());
  },

  methods: {
    hhmm() {
      return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    },

    fmtDate(iso) {
      const d  = new Date(iso);
      const hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      if (d.toDateString() === new Date().toDateString()) return `Aujourd'hui ${hm}`;
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + ` ${hm}`;
    },

    renderText(text) {
      if (!text) return "";
      return text
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>")
        .replace(/(█+)/g, '<span class="bar-full">$1</span>')
        .replace(/(░+)/g, '<span class="bar-empty">$1</span>');
    },

    goBottom() {
      this.$nextTick(() => {
        const el = this.$refs.messagesEl;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },

    quickAsk(text) { this.draft = text; this.sendMessage(); },

    useExample(text) {
      this.helpOpen = false;
      this.draft    = text;
      this.$nextTick(() => this.$refs.inputEl?.focus());
    },

    newSession() {
      this.sessionId = String(Date.now());
      this.messages  = [];
      this.ctx       = { job_title: null, candidate_name: null };
      this.draft     = "";
      this.$nextTick(() => this.$refs.inputEl?.focus());
    },

    async loadSession(sid) {
      if (sid === this.sessionId) return;
      this.sessionId = sid;
      this.loading   = true;
      this.messages  = [];
      this.ctx       = { job_title: null, candidate_name: null };
      try {
        const { data } = await axios.get(`${API}/history/${sid}`);
        this.messages = data.flatMap(r => [
          { from: "user", text: r.user_message, time: this.fmtDate(r.created_at) },
          { from: "bot",  text: r.bot_response, time: this.fmtDate(r.created_at) }
        ]);
      } catch { /* silencieux */ }
      finally { this.loading = false; this.goBottom(); }
    },

    async fetchSessions() {
      try {
        const { data } = await axios.get(`${API}/sessions`);
        this.sessions  = data;
      } catch { /* silencieux */ }
    },

    async sendMessage() {
      const text = this.draft.trim();
      if (!text || this.typing) return;

      this.messages.push({ from: "user", text, time: this.hhmm() });
      this.draft  = "";
      this.typing = true;
      this.goBottom();

      try {
        const { data } = await axios.post(`${API}/message`, {
          message: text, sessionId: this.sessionId
        });
        this.messages.push({ from: "bot", text: data.answer, time: this.hhmm() });
        this.pickCtx(data.answer);
        await this.fetchSessions();
      } catch {
        this.messages.push({
          from: "bot",
          text: "❌ Erreur de connexion. Vérifiez que le backend est démarré.",
          time: this.hhmm()
        });
      } finally {
        this.typing = false;
        this.goBottom();
        this.$nextTick(() => this.$refs.inputEl?.focus());
      }
    },

    pickCtx(answer) {
      const jm = answer.match(/pour le poste \*\*(.+?)\*\*/);
      if (jm) this.ctx.job_title = jm[1];
      const cm = answer.match(/🥇 \*\*(.+?)\*\*/) || answer.match(/\*\*(.+?)\*\* — Profil/);
      if (cm) this.ctx.candidate_name = cm[1];
    }
  }
};
</script>


<style scoped>
/*
  ┌─────────────────────────────────────────────────────────────────┐
  │  PRINCIPE DE LAYOUT                                             │
  │  .rh-chat remplit la zone de contenu de l'app (pas la fenêtre) │
  │  grâce à height:100% + overflow:hidden sur le parent.           │
  │  Pas de position:fixed, pas de reset global.                    │
  └─────────────────────────────────────────────────────────────────┘
*/

/* Racine : occupe tout l'espace disponible dans la zone de contenu */
.rh-chat {
  display: flex;
  width: 100%;
  height: 100%;          /* hérite de la zone de contenu du router-view */
  min-height: 0;
  overflow: hidden;
  background: #EEF2F7;
  font-family: 'Segoe UI', Arial, sans-serif;
  color: #1a2534;
}

/* ── Panneau sessions ── */
.sessions-panel {
  width: 200px;
  min-width: 160px;
  flex-shrink: 0;
  background: #002855;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid rgba(255,255,255,.06);
}

.sp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 12px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  flex-shrink: 0;
}

.sp-title {
  font-size: 12.5px;
  font-weight: 700;
  color: #fff;
  letter-spacing: .2px;
}

.sp-new-btn {
  width: 24px; height: 24px;
  background: rgba(255,255,255,.13);
  border: none; border-radius: 6px;
  color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .2s;
  flex-shrink: 0;
}
.sp-new-btn:hover { background: rgba(255,255,255,.24); }

.sp-list {
  flex: 1;
  overflow-y: auto;
  padding: 5px 0;
}
.sp-list::-webkit-scrollbar       { width: 3px; }
.sp-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 3px; }

.sp-item {
  width: 100%; display: flex; flex-direction: column; gap: 2px;
  background: none; border: none; border-left: 3px solid transparent;
  padding: 9px 12px; text-align: left; cursor: pointer;
  transition: background .15s, border-color .15s;
}
.sp-item:hover         { background: rgba(255,255,255,.06); }
.sp-item--active       { background: rgba(0,131,143,.26); border-left-color: #00838F; }

.sp-date  { font-size: 11px; color: #8ab0c8; }
.sp-count { font-size: 10px; color: #4a6a80; }

.sp-empty { padding: 16px 12px; font-size: 11px; color: #4a6a80; text-align: center; }

/* ── Zone chat ── */
.chat-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;   /* critique : empêche le scroll de remonter */
}

/* ── Header chat ── */
.cp-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #DDE3EA;
  box-shadow: 0 1px 4px rgba(0,51,102,.06);
  gap: 10px;
}

.cp-header-left { display: flex; align-items: center; gap: 10px; }

.cp-avatar {
  width: 34px; height: 34px;
  background: linear-gradient(135deg, #003366, #00838F);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0;
}

.cp-name { font-weight: 700; font-size: 13px; color: #003366; }
.cp-sub  { font-size: 10.5px; color: #8a9ab0; margin-top: 1px; }

.cp-header-right {
  display: flex; align-items: center;
  gap: 6px; flex-wrap: wrap;
}

.ctx-tag {
  font-size: 10.5px; border-radius: 20px;
  padding: 2px 8px; font-weight: 600; white-space: nowrap;
}
.ctx-tag--job  { background: #fff8e1; color: #7a5c00; border: 1px solid #ffc107; }
.ctx-tag--cand { background: #E0F4F5; color: #005060; border: 1px solid #00838F; }

/* Bouton aide ❓ */
.help-btn {
  width: 30px; height: 30px;
  background: #EEF2F7;
  border: 1.5px solid #DDE3EA;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #003366; flex-shrink: 0;
  transition: background .2s, border-color .2s, transform .15s, color .2s;
}
.help-btn:hover {
  background: #E0F4F5;
  border-color: #00838F;
  color: #00838F;
  transform: scale(1.1);
}

/* ── Zone messages — SEULE PARTIE QUI SCROLLE ── */
.cp-messages {
  flex: 1;           /* prend tout l'espace vertical restant */
  min-height: 0;     /* indispensable pour que overflow fonctionne dans un flex */
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.cp-messages::-webkit-scrollbar       { width: 5px; }
.cp-messages::-webkit-scrollbar-thumb { background: #c0cfde; border-radius: 4px; }

/* Loading */
.cp-loading {
  display: flex; align-items: center; gap: 10px;
  justify-content: center; color: #8a9ab0;
  font-size: 13px; margin: auto;
}

/* ── Écran d'accueil ── */
.welcome-screen {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center;
  padding: 30px 16px;
  margin: auto;
  max-width: 520px;
}

.ws-icon  { font-size: 48px; margin-bottom: 12px; }
.ws-title { font-size: 16px; font-weight: 700; color: #003366; margin-bottom: 5px; }
.ws-sub   { font-size: 12px; color: #8a9ab0; margin-bottom: 18px; }

.ws-chips {
  display: flex; flex-wrap: wrap; gap: 7px; justify-content: center;
}

.ws-chip {
  background: #fff;
  border: 1.5px solid #DDE3EA;
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 12px; color: #003366;
  cursor: pointer;
  transition: border-color .2s, background .2s, transform .12s;
}
.ws-chip:hover {
  border-color: #00838F;
  background: #E0F4F5;
  transform: translateY(-1px);
}

/* ── Rangées de messages ── */
.msg-row { display: flex; align-items: flex-end; gap: 8px; }
.msg-row--left  { flex-direction: row; }
.msg-row--right { flex-direction: row-reverse; }

.msg-avatar {
  width: 28px; height: 28px;
  background: linear-gradient(135deg, #003366, #00838F);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; flex-shrink: 0;
}

/* ── Bulles ── */
.bubble {
  max-width: 72%;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 13px; line-height: 1.65;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
  word-break: break-word;
}

.bubble--user {
  background: #003366; color: #fff;
  border-bottom-right-radius: 3px;
}
.bubble--bot {
  background: #fff; color: #1a2534;
  border: 1px solid #DDE3EA;
  border-bottom-left-radius: 3px;
}

.bubble-ts {
  font-size: 9.5px; margin-top: 5px; text-align: right;
  color: rgba(255,255,255,.38);
}
.bubble--bot .bubble-ts { color: #9aabbc; }

/* Barres de score */
.bar-full  { color: #00838F; letter-spacing: .4px; }
.bar-empty { color: #c4d4e0; letter-spacing: .4px; }

/* Typing */
.bubble--typing {
  padding: 12px 16px;
  display: flex; align-items: center; gap: 5px;
  width: fit-content;
}
.bubble--typing span {
  display: inline-block;
  width: 7px; height: 7px;
  background: #00838F; border-radius: 50%;
  animation: blink 1.2s ease-in-out infinite;
}
.bubble--typing span:nth-child(2) { animation-delay: .2s; }
.bubble--typing span:nth-child(3) { animation-delay: .4s; }
@keyframes blink {
  0%,80%,100% { transform: scale(.55); opacity: .3; }
  40%         { transform: scale(1);   opacity: 1;  }
}

/* ── Barre de saisie ── */
.cp-input {
  flex-shrink: 0;
  display: flex; align-items: center; gap: 8px;
  padding: 11px 16px;
  background: #fff;
  border-top: 1px solid #DDE3EA;
}

.cp-field {
  flex: 1; padding: 9px 14px;
  border: 1.5px solid #DDE3EA; border-radius: 22px;
  font-size: 13px; outline: none;
  background: #EEF2F7; color: #1a2534;
  transition: border-color .2s, box-shadow .2s, background .2s;
}
.cp-field:focus {
  border-color: #00838F;
  box-shadow: 0 0 0 3px rgba(0,131,143,.10);
  background: #fff;
}
.cp-field:disabled { opacity: .5; cursor: not-allowed; }
.cp-field::placeholder { color: #9aabbc; }

.cp-send {
  width: 36px; height: 36px;
  background: linear-gradient(135deg, #003366, #00838F);
  color: #fff; border: none; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0;
  transition: opacity .2s, transform .15s;
}
.cp-send:hover:not(:disabled) { opacity: .88; transform: scale(1.08); }
.cp-send:disabled { opacity: .32; cursor: not-allowed; }

/* ══ MODAL AIDE ══════════════════════════════════════════════ */
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,20,50,.42);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}

.modal-box {
  background: #fff;
  border-radius: 14px;
  width: 540px; max-width: 94vw;
  max-height: 80vh;
  display: flex; flex-direction: column;
  box-shadow: 0 14px 44px rgba(0,20,50,.22);
  overflow: hidden;
}

.modal-header {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  background: linear-gradient(135deg, #003366, #00838F);
  color: #fff; font-weight: 700; font-size: 13.5px;
}

.modal-close {
  background: rgba(255,255,255,.18); border: none; color: #fff;
  width: 26px; height: 26px; border-radius: 50%; font-size: 12px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background .2s;
}
.modal-close:hover { background: rgba(255,255,255,.30); }

.modal-content {
  overflow-y: auto; padding: 16px 18px;
  display: flex; flex-direction: column; gap: 14px;
}
.modal-content::-webkit-scrollbar       { width: 4px; }
.modal-content::-webkit-scrollbar-thumb { background: #c5d5e0; border-radius: 4px; }

.help-block-title {
  font-weight: 700; font-size: 12.5px; color: #003366; margin-bottom: 7px;
}

.help-examples {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 4px;
}

.help-examples li {
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 11px; background: #F0F4F8; border-radius: 7px;
  cursor: pointer; transition: background .18s, transform .12s;
}
.help-examples li:hover { background: #E0F4F5; transform: translateX(3px); }

.he-text   { font-size: 12px; color: #1a2534; font-style: italic; }
.he-action { font-size: 11px; color: #00838F; font-weight: 700;
             white-space: nowrap; margin-left: 10px; }

.help-tip {
  background: #fff8e1; border: 1px solid #ffc107;
  border-radius: 8px; padding: 9px 13px;
  font-size: 11.5px; color: #5a4000; line-height: 1.55;
}

/* Dot spinner */
.dot-spinner {
  width: 18px; height: 18px;
  border: 2.5px solid #DDE3EA;
  border-top-color: #00838F;
  border-radius: 50%;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Transition modale */
.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity .2s, transform .2s;
}
.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0; transform: scale(.95);
}
</style>