<template>

  <div class="container mt-4">

    <div class="card p-4">

      <h3>Mon profil</h3>

      <p>
        <strong>Nom :</strong>
        {{ user.fullname }}
      </p>

      <p>
        <strong>Email :</strong>
        {{ user.email }}
      </p>

      <p>
        <strong>Rôle :</strong>
        {{ user.role }}
      </p>

    </div>

  </div>

</template>

<script setup>
import { ref, onMounted } from "vue";
import { getProfile } from "@/services/authService";

const user = ref({});

onMounted(async () => {

  const response = await getProfile();

  user.value = response.data;

});
</script>