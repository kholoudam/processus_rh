<template>
  <div class="rh-chat-page">

    <!-- ─── Panneau sessions ─── -->
    <aside class="sessions-panel">
      <div class="panel-header">
        <span class="panel-icon">🕘</span>
        <span>Historique</span>
        <button class="new-chat-btn" @click="startNewSession" title="Nouvelle conversation">✏️</button>
      </div>
      <div class="sessions-list">
        <div
          v-for="s in sessions"
          :key="s.session_id"
          class="session-item"
          :class="{ active: s.session_id === sessionId }"
          @click="loadSession(s.session_id)"
        >
          <div class="session-date">{{ formatDate(s.last_message_at) }}</div>
          <div class="session-count">{{ s.message_count }} message{{ s.message_count > 1 ? 's' : '' }}</div>
        </div>
        <div v-if="sessions.length === 0" class="sessions-empty">Aucun historique</div>
      </div>
    </aside>

    <!-- ─── Zone chat ─── -->
    <main class="chat-main">

      <header class="chat-header">
        <div class="chat-header-left">
          <div class="avatar-icon">🤖</div>
          <div>
            <div class="chat-title">Assistant RH</div>
            <div class="chat-subtitle">Analyse candidats · Matching · Recommandations</div>
          </div>
        </div>
        <div class="header-right">
          <span v-if="ctx.jobTitle" class="context-pill">📌 {{ ctx.jobTitle }}</span>
          <span v-if="ctx.candidateName" class="context-pill context-pill--candidate">👤 {{ ctx.candidateName }}</span>
          <span class="session-badge">Session {{ shortSession }}</span>
        </div>
      </header>

      <!-- Suggestions rapides -->
      <div v-if="messages.length <= 1 && !loadingHistory" class="suggestions">
        <div class="suggestions-label">Suggestions :</div>
        <button
          v-for="s in suggestions"
          :key="s"
          class="suggestion-chip"
          @click="sendSuggestion(s)"
        >{{ s }}</button>
      </div>

      <!-- Messages -->
      <div class="messages-area" ref="messagesArea">
        <div v-if="loadingHistory" class="loading-history">Chargement…</div>
        <template v-else>
          <div
            v-for="(msg, index) in messages"
            :key="index"
            class="msg-row"
            :class="msg.sender === 'user' ? 'msg-row--user' : 'msg-row--bot'"
          >
            <div v-if="msg.sender === 'bot'" class="msg-avatar">🤖</div>
            <div class="bubble" :class="msg.sender === 'user' ? 'bubble--user' : 'bubble--bot'">
              <div class="bubble-text" v-html="formatText(msg.text)"></div>
              <div v-if="msg.time" class="bubble-time">{{ msg.time }}</div>
            </div>
            <div v-if="msg.sender === 'user'" class="msg-avatar msg-avatar--user">👤</div>
          </div>

          <!-- Indicateur frappe -->
          <div v-if="typing" class="msg-row msg-row--bot">
            <div class="msg-avatar">🤖</div>
            <div class="bubble bubble--bot bubble--typing">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            </div>
          </div>
        </template>
      </div>

      <!-- Barre saisie -->
      <div class="input-bar">
        <input
          v-model="question"
          class="chat-input"
          placeholder="Posez votre question RH…"
          @keyup.enter="send"
          :disabled="typing"
        />
        <button class="send-btn" @click="send" :disabled="!question.trim() || typing">
          <span v-if="!typing">Envoyer ↩</span>
          <span v-else>…</span>
        </button>
      </div>

    </main>
  </div>
</template>


<script>
import axios from "axios";
const API = "http://localhost:3000/api/chatbot";

export default {
  name: "RecommendationChatbot",

  data() {
    return {
      question:  "",
      sessionId: Date.now().toString(),
      typing:    false,
      loadingHistory: false,
      sessions:  [],
      // Contexte affiché dans le header
      ctx: { jobTitle: null, candidateName: null },
      messages: [
        {
          sender: "bot",
          text:   "Bonjour ! Je suis votre assistant RH.\n\nJe peux vous aider à :\n- 🎯 Recommander des candidats pour un poste\n- 📊 Comparer les niveaux d'expérience\n- 💡 Expliquer pourquoi un candidat est recommandé",
          time:   this.now()
        }
      ],
      suggestions: [
        "Recommande des candidats pour Ingénieur Production",
        "Qui a le plus d'expérience ?",
        "Pourquoi ce candidat ?"
      ]
    };
  },

  computed: {
    shortSession() { return "#" + this.sessionId.slice(-6); }
  },

  async mounted() {
    await this.fetchSessions();
  },

  methods: {

    now() {
      return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    },

    formatDate(iso) {
      const d     = new Date(iso);
      const today = new Date();
      if (d.toDateString() === today.toDateString())
        return "Aujourd'hui " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
           + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    },

    formatText(text) {
      if (!text) return "";
      return text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        // gras entre **...**
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        // retours à la ligne
        .replace(/\n/g, "<br>")
        // barre de score : rendre en teal
        .replace(/(█+)(░+)/g, '<span class="bar-fill">$1</span><span class="bar-empty">$2</span>');
    },

    scrollBottom() {
      this.$nextTick(() => {
        const el = this.$refs.messagesArea;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },

    // ── Extraire le contexte de la réponse bot (poste, candidat) ──
    updateCtxFromAnswer(answer) {
      // Détecte le poste dans les réponses recommandation
      const jobMatch = answer.match(/pour le poste \*\*(.+?)\*\*/);
      if (jobMatch) this.ctx.jobTitle = jobMatch[1];

      // Détecte le nom du candidat en tête de classement ou dans l'explication
      const candidateMatch = answer.match(/🥇 (.+?) —/) || answer.match(/\*\*(.+?)\*\* est recommandé/);
      if (candidateMatch) this.ctx.candidateName = candidateMatch[1];
    },

    // ── Suggestions rapides ──
    sendSuggestion(text) {
      this.question = text;
      this.send();
    },

    // ── Nouvelle session ──
    startNewSession() {
      this.sessionId = Date.now().toString();
      this.ctx       = { jobTitle: null, candidateName: null };
      this.messages  = [{
        sender: "bot",
        text:   "Nouvelle conversation démarrée. Comment puis-je vous aider ?",
        time:   this.now()
      }];
      this.question = "";
    },

    // ── Charger une session depuis l'historique BDD ──
    async loadSession(sessionId) {
      this.sessionId = sessionId;
      this.loadingHistory = true;
      this.messages  = [];
      this.ctx       = { jobTitle: null, candidateName: null };

      try {
        const { data } = await axios.get(`${API}/history/${sessionId}`);
        this.messages = data.flatMap(row => [
          { sender: "user", text: row.user_message,  time: this.formatDate(row.created_at) },
          { sender: "bot",  text: row.bot_response,   time: this.formatDate(row.created_at) }
        ]);
        if (!this.messages.length)
          this.messages = [{ sender: "bot", text: "Session vide.", time: this.now() }];
      } catch {
        this.messages = [{ sender: "bot", text: "Erreur de chargement.", time: this.now() }];
      } finally {
        this.loadingHistory = false;
        this.scrollBottom();
      }
    },

    // ── Liste des sessions ──
    async fetchSessions() {
      try {
        const { data } = await axios.get(`${API}/sessions`);
        this.sessions  = data;
      } catch { /* silencieux */ }
    },

    // ── Envoyer un message ──
    async send() {
      const text = this.question.trim();
      if (!text || this.typing) return;

      this.messages.push({ sender: "user", text, time: this.now() });
      this.question = "";
      this.typing   = true;
      this.scrollBottom();

      try {
        const { data } = await axios.post(`${API}/message`, {
          message:   text,
          sessionId: this.sessionId
          // On ne passe plus candidateId/jobId depuis le front :
          // le backend les résout lui-même via le contexte de session.
        });

        this.messages.push({ sender: "bot", text: data.answer, time: this.now() });
        this.updateCtxFromAnswer(data.answer);
        await this.fetchSessions();

      } catch {
        this.messages.push({
          sender: "bot",
          text:   "❌ Erreur de connexion. Vérifiez que le backend est démarré.",
          time:   this.now()
        });
      } finally {
        this.typing = false;
        this.scrollBottom();
      }
    }
  }
};
</script>


<style scoped>
:root {
  --navy:    #003366;
  --teal:    #00838F;
  --teal-lt: #E0F4F5;
  --white:   #FFFFFF;
  --grey-bg: #F5F7FA;
  --grey-bd: #DDE3EA;
  --grey-txt:#6B7A90;
  --radius-lg: 18px;
  --radius-sm: 6px;
}

.rh-chat-page {
  display: flex;
  height: 100vh;
  font-family: 'Segoe UI', Arial, sans-serif;
  background: var(--grey-bg);
  color: #1a2534;
  overflow: hidden;
}

/* ── Panneau sessions ── */
.sessions-panel {
  width: 240px;
  min-width: 200px;
  background: #003366;
  color: #c8d8e8;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255,255,255,.08);
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 14px 14px;
  font-weight: 600;
  font-size: 14px;
  color: #fff;
  border-bottom: 1px solid rgba(255,255,255,.10);
}
.panel-icon { font-size: 16px; }
.new-chat-btn {
  margin-left: auto;
  background: rgba(255,255,255,.12);
  border: none; border-radius: 6px;
  color: #fff; cursor: pointer;
  padding: 4px 8px; font-size: 14px;
  transition: background .2s;
}
.new-chat-btn:hover { background: rgba(255,255,255,.22); }
.sessions-list { flex: 1; overflow-y: auto; padding: 8px 0; }
.session-item {
  padding: 10px 16px; cursor: pointer;
  border-left: 3px solid transparent;
  transition: background .15s, border-color .15s;
}
.session-item:hover { background: rgba(255,255,255,.07); }
.session-item.active { background: rgba(0,131,143,.25); border-left-color: #00838F; }
.session-date  { font-size: 12px; color: #a8c0d0; }
.session-count { font-size: 11px; color: #6a8fa8; margin-top: 2px; }
.sessions-empty { text-align: center; color: #6a8fa8; font-size: 12px; padding: 20px; }

/* ── Chat principal ── */
.chat-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

.chat-header {
  background: #fff;
  border-bottom: 1px solid var(--grey-bd);
  padding: 14px 22px;
  display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0,51,102,.08);
}
.chat-header-left { display: flex; align-items: center; gap: 12px; }
.avatar-icon {
  width: 40px; height: 40px;
  background: linear-gradient(135deg, #003366, #00838F);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
}
.chat-title    { font-weight: 700; font-size: 15px; color: #003366; }
.chat-subtitle { font-size: 11px; color: var(--grey-txt); margin-top: 1px; }

.header-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.context-pill {
  font-size: 11px;
  background: #fff3cd;
  color: #7a5c00;
  border: 1px solid #ffc107;
  border-radius: 20px;
  padding: 3px 10px;
  font-weight: 600;
}
.context-pill--candidate {
  background: var(--teal-lt);
  color: #005f68;
  border-color: #00838F;
}
.session-badge {
  font-size: 11px;
  background: var(--teal-lt);
  color: #00838F;
  border-radius: 20px;
  padding: 3px 10px;
  font-weight: 600;
}

/* ── Suggestions ── */
.suggestions {
  padding: 10px 22px 0;
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.suggestions-label { font-size: 12px; color: var(--grey-txt); }
.suggestion-chip {
  background: #fff;
  border: 1.5px solid var(--grey-bd);
  border-radius: 20px;
  padding: 5px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: border-color .2s, background .2s;
  color: #003366;
}
.suggestion-chip:hover { border-color: #00838F; background: var(--teal-lt); }

/* ── Messages ── */
.messages-area {
  flex: 1; overflow-y: auto;
  padding: 22px 24px;
  display: flex; flex-direction: column; gap: 14px;
  background: var(--grey-bg);
}
.loading-history { text-align: center; color: var(--grey-txt); font-size: 13px; padding: 40px; }

.msg-row { display: flex; align-items: flex-end; gap: 10px; }
.msg-row--user { flex-direction: row-reverse; }

.msg-avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #003366, #00838F);
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; flex-shrink: 0;
}
.msg-avatar--user { background: #e8edf5; }

.bubble {
  max-width: 68%;
  padding: 12px 16px;
  border-radius: var(--radius-lg);
  font-size: 14px; line-height: 1.6;
  box-shadow: 0 1px 4px rgba(0,0,0,.07);
}
.bubble--user {
  background: #003366; color: #fff;
  border-bottom-right-radius: var(--radius-sm);
}
.bubble--bot {
  background: #fff; color: #1a2534;
  border-bottom-left-radius: var(--radius-sm);
  border: 1px solid var(--grey-bd);
}
.bubble-time { font-size: 10px; color: rgba(255,255,255,.55); margin-top: 5px; text-align: right; }
.bubble--bot .bubble-time { color: var(--grey-txt); }

/* Barre de score */
.bar-fill  { color: #00838F; letter-spacing: 1px; }
.bar-empty { color: #ccc;    letter-spacing: 1px; }

/* Frappe */
.bubble--typing { padding: 14px 20px; display: flex; align-items: center; gap: 5px; }
.dot { width: 7px; height: 7px; background: #00838F; border-radius: 50%; animation: bounce 1.2s infinite ease-in-out; }
.dot:nth-child(2) { animation-delay: .2s; }
.dot:nth-child(3) { animation-delay: .4s; }
@keyframes bounce {
  0%,80%,100% { transform: scale(.7); opacity: .5; }
  40%         { transform: scale(1);  opacity: 1; }
}

/* ── Barre saisie ── */
.input-bar {
  display: flex; gap: 10px;
  padding: 16px 22px;
  background: #fff;
  border-top: 1px solid var(--grey-bd);
}
.chat-input {
  flex: 1; padding: 11px 16px;
  border: 1.5px solid var(--grey-bd);
  border-radius: 24px; font-size: 14px; outline: none;
  background: var(--grey-bg); color: #1a2534;
  transition: border-color .2s, box-shadow .2s;
}
.chat-input:focus {
  border-color: #00838F;
  box-shadow: 0 0 0 3px rgba(0,131,143,.12);
  background: #fff;
}
.chat-input:disabled { opacity: .5; cursor: not-allowed; }
.send-btn {
  padding: 11px 22px;
  background: linear-gradient(135deg, #003366, #00838F);
  color: #fff; border: none; border-radius: 24px;
  font-size: 14px; font-weight: 600; cursor: pointer;
  transition: opacity .2s, transform .15s;
  white-space: nowrap;
}
.send-btn:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
.send-btn:disabled { opacity: .4; cursor: not-allowed; }

/* Scrollbar */
.messages-area::-webkit-scrollbar, .sessions-list::-webkit-scrollbar { width: 5px; }
.messages-area::-webkit-scrollbar-thumb { background: #c5cfe0; border-radius: 4px; }
.sessions-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 4px; }
</style>