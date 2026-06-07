<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h2 class="logo">RH Platform</h2>
    </div>

    <nav class="nav-menu">
      <router-link
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        active-class="active-link"
      >
        {{ item.name }}
      </router-link>
    </nav>
  </aside>
</template>

<script>
export default {
  name: "Sidebar",

  data() {
    return {
      menuItems: [
        {
          name: "Dashboard",
          path: "/"
        },
        {
          name: "Jobs",
          path: "/jobs"
        },
        {
          name: "Candidats",
          path: "/candidates"
        },
        {
          name: "Matching",
          path: "/matching"
        },
        {
          name: "Admis",
          path: "/admis"
        },
        {
          name: "Refusés",
          path: "/refuses"
        },
        {
          name: "Recommendation",
          path: "/recommendations"
        }
      ]
    };
  }
};
</script>

<style scoped>
.sidebar {
  width: 240px;
  min-height: 100vh;
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  padding: 24px 0;
  box-shadow: 2px 0 8px rgba(0,0,0,0.03);
}

.sidebar-header {
  padding: 0 24px 24px;
  border-bottom: 1px solid #f1f5f9;
}

.logo {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}

.nav-menu {
  display: flex;
  flex-direction: column;
  padding: 20px 14px;
  gap: 8px;
}

.nav-item {
  text-decoration: none;
  color: #475569;
  font-size: 15px;
  font-weight: 500;
  padding: 12px 16px;
  border-radius: 10px;
  transition: all .25s ease;
}

.nav-item:hover {
  background: #f8fafc;
  color: #2563eb;
}

.active-link {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 600;
}
</style>