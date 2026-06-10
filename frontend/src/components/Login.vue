<template>
  <div class="login-container">

    <div class="card p-4">

      <h3 class="text-center mb-4">
        Connexion RH
      </h3>

      <form @submit.prevent="submit">

        <input
          v-model="email"
          class="form-control mb-3"
          placeholder="Email"
        />

        <input
          type="password"
          v-model="password"
          class="form-control mb-3"
          placeholder="Mot de passe"
        />

        <button
          class="btn btn-primary w-100"
        >
          Se connecter
        </button>

      </form>

    </div>

  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { login } from "@/services/authService";

const router = useRouter();

const email = ref("");
const password = ref("");

const submit = async () => {

  try {

    const response = await login({
      email: email.value,
      password: password.value
    });

    localStorage.setItem(
      "token",
      response.data.token
    );

    localStorage.setItem(
      "user",
      JSON.stringify(response.data.user)
    );

    router.push("/dashboard");

  } catch {

    alert("Email ou mot de passe incorrect");

  }
};
</script>