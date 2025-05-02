<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark flat>
            <v-toolbar-title>{{
              isLogin ? "Connexion" : "Inscription"
            }}</v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <v-form @submit.prevent="submitForm" ref="formRef">
              <v-text-field
                v-model="username"
                label="Identifiant"
                name="username"
                prepend-icon="mdi-account"
                type="text"
                required
                :rules="[(v) => !!v || 'L\'identifiant est requis']"
                data-test="username-input"
              ></v-text-field>
              <v-text-field
                v-model="password"
                label="Mot de passe"
                name="password"
                prepend-icon="mdi-lock"
                type="password"
                required
                :rules="[(v) => !!v || 'Le mot de passe est requis']"
                data-test="password-input"
              ></v-text-field>
              <v-text-field
                v-if="!isLogin"
                v-model="confirmPassword"
                label="Confirmer le mot de passe"
                name="confirmPassword"
                prepend-icon="mdi-lock-check"
                type="password"
                required
                :rules="[
                  (v) => !!v || 'La confirmation est requise',
                  (v) =>
                    v === password || 'Les mots de passe ne correspondent pas',
                ]"
                data-test="confirm-password-input"
              ></v-text-field>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-btn
              text
              @click="isLogin = !isLogin"
              data-test="toggle-form-button"
            >
              {{ isLogin ? "Créer un compte" : "Déjà un compte ?" }}
            </v-btn>
            <v-spacer></v-spacer>
            <v-btn
              color="primary"
              @click="submitForm"
              :loading="loading"
              data-test="submit-button"
            >
              {{ isLogin ? "Se connecter" : "S'inscrire" }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { authService } from "../services/auth";

const router = useRouter();
const formRef = ref(null);
const loading = ref(false);
const isLogin = ref(true);
const username = ref("");
const password = ref("");
const confirmPassword = ref("");

const submitForm = async () => {
  try {
    loading.value = true;
    const { valid } = await formRef.value.validate();
    if (!valid) return;

    if (isLogin.value) {
      await authService.login(username.value, password.value);
    } else {
      if (password.value !== confirmPassword.value) {
        throw new Error("Les mots de passe ne correspondent pas");
      }
      const user = await authService.register(username.value, password.value);
      if (!user) {
        throw new Error("L'inscription a échoué");
      }
    }

    // Vérifier que l'utilisateur est bien authentifié avant la redirection
    if (!authService.isAuthenticated()) {
      throw new Error("L'authentification a échoué");
    }

    router.replace("/");
  } catch (error) {
    console.error("Erreur:", error);
    alert(
      error.message || "Une erreur est survenue lors de l'authentification"
    );
  } finally {
    loading.value = false;
  }
};
</script>
