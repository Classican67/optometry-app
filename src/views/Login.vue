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
              <!-- Champs de connexion -->
              <template v-if="isLogin">
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
              </template>

              <!-- Champs d'inscription -->
              <template v-else>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="nom"
                      label="Nom"
                      required
                      :rules="[(v) => !!v || 'Le nom est requis']"
                      @input="updateUsername"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="prenom"
                      label="Prénom"
                      required
                      :rules="[(v) => !!v || 'Le prénom est requis']"
                      @input="updateUsername"
                    ></v-text-field>
                  </v-col>
                </v-row>

                <v-text-field
                  v-model="numeroOrdre"
                  label="Numéro d'ordre"
                  required
                  :rules="[(v) => !!v || 'Le numéro d\'ordre est requis']"
                ></v-text-field>

                <v-text-field
                  v-model="username"
                  label="Identifiant (généré automatiquement)"
                  name="username"
                  prepend-icon="mdi-account"
                  type="text"
                  readonly
                  disabled
                ></v-text-field>

                <v-text-field
                  v-model="password"
                  label="Mot de passe"
                  name="password"
                  prepend-icon="mdi-lock"
                  type="password"
                  required
                  :rules="[(v) => !!v || 'Le mot de passe est requis']"
                ></v-text-field>

                <v-text-field
                  v-model="confirmPassword"
                  label="Confirmer le mot de passe"
                  name="confirmPassword"
                  prepend-icon="mdi-lock-check"
                  type="password"
                  required
                  :rules="[
                    (v) => !!v || 'La confirmation est requise',
                    (v) =>
                      v === password ||
                      'Les mots de passe ne correspondent pas',
                  ]"
                ></v-text-field>
              </template>
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

    <!-- Affichage des informations du praticien connecté -->
    <v-card v-if="currentUser" class="mx-auto mt-4" max-width="600">
      <v-card-title class="text-center">Informations du praticien</v-card-title>
      <v-card-text>
        <v-list>
          <v-list-item>
            <v-list-item-title>Nom</v-list-item-title>
            <v-list-item-subtitle>{{ currentUser.nom }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item>
            <v-list-item-title>Prénom</v-list-item-title>
            <v-list-item-subtitle>{{
              currentUser.prenom
            }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item>
            <v-list-item-title>Numéro d'ordre</v-list-item-title>
            <v-list-item-subtitle>{{
              currentUser.numeroOrdre
            }}</v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { authService } from "../services/auth";

const router = useRouter();
const formRef = ref(null);
const loading = ref(false);
const isLogin = ref(true);

// Champs de connexion
const username = ref("");
const password = ref("");

// Champs d'inscription
const nom = ref("");
const prenom = ref("");
const numeroOrdre = ref("");
const confirmPassword = ref("");

const currentUser = computed(() => authService.getCurrentUser());

// Fonction pour générer le nom d'utilisateur
const updateUsername = () => {
  if (prenom.value && nom.value) {
    username.value = `${prenom.value.toLowerCase()}.${nom.value.toLowerCase()}`;
  }
};

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
      await authService.register(
        username.value,
        password.value,
        nom.value,
        prenom.value,
        numeroOrdre.value
      );
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
