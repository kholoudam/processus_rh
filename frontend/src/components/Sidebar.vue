<template>
  <div class="sidebar">
    <h2 class="logo">AIRBUS</h2>

    <ul>
      <li :class="{active: page==='dashboard'}"
          @click="$emit('changePage','dashboard')">
        📊 Dashboard
      </li>

      <li :class="{active: page==='jobs'}"
          @click="$emit('changePage','jobs')">
        💼 Jobs
      </li>

      <li>CVthèque</li>
      <li>Admis</li>
      <li>Refusés</li>
    </ul>
  </div>
</template>

<script>
export default {
  props: ["page"]
}
</script>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 250px;
  height: 100vh;

  background: #1f2937;
  color: white;
  padding: 20px;
}

/* ✅ FIX ICI */
ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar li {
  padding: 12px;
  cursor: pointer;
  border-radius: 6px;
  margin-bottom: 5px;
}

.sidebar li.active {
  background: #2563eb;
}
</style>