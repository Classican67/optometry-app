<template>
  <v-container>
    <v-card class="mx-auto" max-width="600">
      <v-card-title class="text-center">Inscription</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="submitForm" ref="formRef">
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.nom"
                label="Nom"
                required
                :rules="[(v) => !!v || 'Le nom est requis']"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.prenom"
                label="Prénom"
                required
                :rules="[(v) => !!v || 'Le prénom est requis']"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="form.numeroOrdre"
                label="Numéro d'ordre"
                required
                :rules="[(v) => !!v || 'Le numéro d\'ordre est requis']"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="form.username"
                label="Nom d'utilisateur"
                required
                :rules="[(v) => !!v || 'Le nom d\'utilisateur est requis']"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="form.password"
                label="Mot de passe"
                type="password"
                required
                :rules="[(v) => !!v || 'Le mot de passe est requis']"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-btn color="primary" type="submit" :loading="loading" block>
                S'inscrire
              </v-btn>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" class="text-center">
              <router-link to="/login">
                Déjà inscrit ? Connectez-vous
              </router-link>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { authService } from "../services/auth";

const router = useRouter();
const loading = ref(false);
const formRef = ref(null);

const form = ref({
  nom: "",
  prenom: "",
  numeroOrdre: "",
  username: "",
  password: "",
});

const submitForm = async () => {
  try {
    loading.value = true;
    const { valid } = await formRef.value.validate();
    if (!valid) {
      throw new Error("Veuillez remplir tous les champs requis");
    }

    await authService.register(
      form.value.username,
      form.value.password,
      form.value.nom,
      form.value.prenom,
      form.value.numeroOrdre
    );

    router.push("/");
  } catch (error) {
    alert(error.message || "Une erreur est survenue lors de l'inscription");
  } finally {
    loading.value = false;
  }
};
</script>
