<template>
  <div class="rec-empty">
    <div class="rec-empty-icon">
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </div>
    <div class="rec-empty-title">Recommandations</div>
    <div class="rec-empty-sub">Cette section est en cours de construction. Revenez bientôt.</div>
  </div>
</template>

<script>
export default {
  name: "Recommendations",
};
</script>

<style scoped>
.rec-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 60vh;
  padding: 40px 20px;
  color: #8a9ab0;
}
.rec-empty-icon {
  color: #c4d4e0;
  margin-bottom: 14px;
}
.rec-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: #003366;
  margin-bottom: 6px;
}
.rec-empty-sub {
  font-size: 13px;
  color: #8a9ab0;
}
</style>