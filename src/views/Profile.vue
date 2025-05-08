<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="8" offset-md="2">
        <v-card>
          <v-card-title class="text-h5"> Profil Utilisateur </v-card-title>
          <v-card-text>
            <v-form
              ref="form"
              v-model="isFormValid"
              @submit.prevent="saveProfile"
            >
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="profile.nom"
                    label="Nom"
                    :rules="[(v) => !!v || 'Le nom est requis']"
                    required
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="profile.prenom"
                    label="Prénom"
                    :rules="[(v) => !!v || 'Le prénom est requis']"
                    required
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="profile.numeroOrdre"
                    label="Numéro d'ordre"
                    :rules="[(v) => !!v || 'Le numéro d\'ordre est requis']"
                    required
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="profile.telephone"
                    label="Téléphone"
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="profile.fax"
                    label="Fax"
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="profile.email"
                    label="Email"
                    type="email"
                    :rules="[
                      (v) => !!v || 'L\'email est requis',
                      (v) => /.+@.+\..+/.test(v) || 'L\'email doit être valide',
                    ]"
                    required
                  ></v-text-field>
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="profile.adresse"
                    label="Adresse"
                  ></v-text-field>
                </v-col>
              </v-row>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              color="primary"
              @click="saveProfile"
              :disabled="!isFormValid"
              :loading="loading"
            >
              Enregistrer
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { authService } from "../services/auth";
import { dbService } from "../services/db";

const router = useRouter();
const form = ref(null);
const isFormValid = ref(false);
const loading = ref(false);

const profile = ref({
  nom: "",
  prenom: "",
  numeroOrdre: "",
  telephone: "",
  fax: "",
  email: "",
  adresse: "",
});

const loadProfile = async () => {
  try {
    const userId = authService.getCurrentUser()?.id;
    if (!userId) {
      router.push("/login");
      return;
    }

    const user = await dbService.getUserByUsername(
      authService.getCurrentUser()?.username
    );
    if (user) {
      profile.value = {
        nom: user.nom || "",
        prenom: user.prenom || "",
        numeroOrdre: user.numeroOrdre || "",
        telephone: user.telephone || "",
        fax: user.fax || "",
        email: user.email || "",
        adresse: user.adresse || "",
      };
    }
  } catch (error) {
    console.error("Erreur lors du chargement du profil:", error);
    alert("Erreur lors du chargement du profil");
  }
};

const saveProfile = async () => {
  if (!form.value.validate()) return;

  try {
    loading.value = true;
    const userId = authService.getCurrentUser()?.id;
    if (!userId) {
      router.push("/login");
      return;
    }

    const user = await dbService.getUserByUsername(
      authService.getCurrentUser()?.username
    );
    if (user) {
      const updatedUser = {
        ...user,
        ...profile.value,
        updatedAt: new Date().toISOString(),
      };

      await dbService.saveUser(updatedUser);
      alert("Profil mis à jour avec succès");
    }
  } catch (error) {
    console.error("Erreur lors de la sauvegarde du profil:", error);
    alert("Erreur lors de la sauvegarde du profil");
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadProfile();
});
</script>
