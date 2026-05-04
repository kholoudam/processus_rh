<template>
  <footer class="app-footer">
    <span>&copy; 2026 Airbus Atlantic Maroc &mdash; Recruitment System</span>
    <span class="footer-sep">|</span>
    <span class="footer-right">Tous droits réservés</span>
  </footer>
</template>

<style scoped>
.app-footer {
  position: fixed;
  bottom: 0;
  left: 260px;
  width: calc(100% - 260px);
  height: 44px;
  background: #0f172a;
  border-top: 1px solid #1e293b;
  color: #475569;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 12px;
  letter-spacing: 0.02em;
  z-index: 99;
}

.footer-sep { color: #1e293b; }
.footer-right { color: #334155; }
</style>