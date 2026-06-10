<template>

<nav class="navbar navbar-light bg-white shadow-sm">

  <div class="container-fluid">

    <span class="navbar-brand">
      Airbus RH
    </span>

    <div class="dropdown">

      <button
        class="btn btn-light dropdown-toggle"
        data-bs-toggle="dropdown"
      >
        {{ user.fullname }}
      </button>

      <ul class="dropdown-menu dropdown-menu-end">

        <li>
          <router-link
            class="dropdown-item"
            to="/profile"
          >
            Mon profil
          </router-link>
        </li>

        <li>
          <button
            class="dropdown-item text-danger"
            @click="logout"
          >
            Déconnexion
          </button>
        </li>

      </ul>

    </div>

  </div>

</nav>

</template>

<script setup>
import { useRouter } from "vue-router";

const router = useRouter();

const user = JSON.parse(
  localStorage.getItem("user")
);

const logout = () => {

  localStorage.removeItem("token");

  localStorage.removeItem("user");

  router.push("/login");
};
</script>