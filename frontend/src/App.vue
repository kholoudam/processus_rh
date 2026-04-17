<template>
  <div class="app-container">

    <!-- SIDEBAR -->
    <Sidebar :page="currentPage" @changePage="changePage"/>

    <!-- MAIN CONTENT -->
    <div class="content">
      <Dashboard :currentPage="currentPage"/>
    </div>

    <!-- FOOTER -->
    <Footer />

  </div>
</template>

<script>
import Sidebar from "./components/Sidebar.vue"
import Dashboard from "./components/Dashboard.vue"
import Footer from "./components/Footer.vue"

export default {
  components: { Sidebar, Dashboard, Footer },

  data() {
    return {
      currentPage: localStorage.getItem("page") || "dashboard"
    }
  },

  methods: {
    changePage(page) {
      this.currentPage = page
      localStorage.setItem("page", page)
    }
  }
}
</script>
<style>
  .content {
    position: absolute;
    left: 250px;
    top: 0;

    width: calc(100% - 250px);
    height: calc(100vh - 60px);

    overflow-y: auto;

    padding: 20px;
    padding-bottom: 80px;
    padding-right: 260px;

    background: #f3f4f6;
  }
</style>