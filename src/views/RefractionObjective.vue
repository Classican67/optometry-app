<template>
  <v-container>
    <v-card class="mx-auto" max-width="800">
      <v-card-title>Réfraction objective</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="submitForm" ref="formRef">
          <v-row>
            <v-col cols="12" md="6">
              <v-card class="mb-4">
                <v-card-title class="text-subtitle-1"
                  >Œil droit (OD)</v-card-title
                >
                <v-card-text>
                  <v-row>
                    <v-col cols="6">
                      <v-text-field
                        v-model="form.od.sphere"
                        label="Sphère"
                        type="number"
                        step="0.25"
                        suffix="D"
                        data-test="od-sphere"
                        :rules="[validateNumber]"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="6">
                      <v-text-field
                        v-model="form.od.cylindre"
                        label="Cylindre"
                        type="number"
                        step="0.25"
                        suffix="D"
                        data-test="od-cylindre"
                        :rules="[validateNumber]"
                      ></v-text-field>
                    </v-col>
                  </v-row>
                  <v-row>
                    <v-col cols="6">
                      <v-text-field
                        v-model="form.od.axe"
                        label="Axe"
                        type="number"
                        step="1"
                        suffix="°"
                        data-test="od-axe"
                        :rules="[validateAxe]"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="6">
                      <v-text-field
                        v-model="form.od.vision"
                        label="Vision"
                        type="number"
                        step="0.1"
                        data-test="od-vision"
                        :rules="[validateVision]"
                      ></v-text-field>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>

            <v-col cols="12" md="6">
              <v-card class="mb-4">
                <v-card-title class="text-subtitle-1"
                  >Œil gauche (OG)</v-card-title
                >
                <v-card-text>
                  <v-row>
                    <v-col cols="6">
                      <v-text-field
                        v-model="form.og.sphere"
                        label="Sphère"
                        type="number"
                        step="0.25"
                        suffix="D"
                        data-test="og-sphere"
                        :rules="[validateNumber]"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="6">
                      <v-text-field
                        v-model="form.og.cylindre"
                        label="Cylindre"
                        type="number"
                        step="0.25"
                        suffix="D"
                        data-test="og-cylindre"
                        :rules="[validateNumber]"
                      ></v-text-field>
                    </v-col>
                  </v-row>
                  <v-row>
                    <v-col cols="6">
                      <v-text-field
                        v-model="form.og.axe"
                        label="Axe"
                        type="number"
                        step="1"
                        suffix="°"
                        data-test="og-axe"
                        :rules="[validateAxe]"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="6">
                      <v-text-field
                        v-model="form.og.vision"
                        label="Vision"
                        type="number"
                        step="0.1"
                        data-test="og-vision"
                        :rules="[validateVision]"
                      ></v-text-field>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-textarea
                v-model="form.notes"
                label="Notes complémentaires"
                rows="2"
                data-test="notes"
              ></v-textarea>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-btn
                color="primary"
                type="submit"
                :loading="loading"
                block
                data-test="submit-button"
              >
                Valider et continuer
              </v-btn>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { dbService } from "../services/db";
import { pdfService } from "../services/pdfService";

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const formRef = ref(null);

const form = ref({
  od: {
    sphere: "",
    cylindre: "",
    axe: "",
    vision: "",
  },
  og: {
    sphere: "",
    cylindre: "",
    axe: "",
    vision: "",
  },
  notes: "",
});

// Fonctions de validation
const validateNumber = (v) => {
  if (!v) return true; // Champ optionnel
  const num = parseFloat(v);
  return !isNaN(num) || "Veuillez entrer un nombre valide";
};

const validateAxe = (v) => {
  if (!v) return true; // Champ optionnel
  const num = parseFloat(v);
  return (
    (!isNaN(num) && num >= 0 && num <= 180) || "L'axe doit être entre 0 et 180°"
  );
};

const validateVision = (v) => {
  if (!v) return true; // Champ optionnel
  const num = parseFloat(v);
  return (
    (!isNaN(num) && num >= 0 && num <= 1) || "La vision doit être entre 0 et 1"
  );
};

const loadRefractionData = async (examId) => {
  if (!examId) return;

  try {
    loading.value = true;
    const savedData = await dbService.getSection(
      examId,
      "refraction-objective"
    );
    if (savedData && savedData.data) {
      form.value = { ...savedData.data };
    }
  } catch (error) {
    console.error("Erreur lors du chargement des données:", error);
    alert("Impossible de charger les données de la réfraction objective");
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadRefractionData(route.params.examId);
});

// Observer les changements de route pour recharger les données
watch(
  () => route.params.examId,
  (newExamId) => {
    loadRefractionData(newExamId);
  }
);

const submitForm = async () => {
  try {
    loading.value = true;
    const examId = route.params.examId;

    if (!examId) {
      throw new Error("ID d'examen manquant");
    }

    // Vérifier la validation du formulaire
    const { valid } = await formRef.value.validate();
    if (!valid) {
      throw new Error("Veuillez corriger les erreurs dans le formulaire");
    }

    // Créer une copie sérialisable des données du formulaire
    const formData = JSON.parse(JSON.stringify(form.value));

    // Sauvegarder la section
    await dbService.saveSection(examId, "refraction-objective", formData);

    // Générer le PDF de la section
    await pdfService.generateSectionPDF(
      examId,
      "refraction-objective",
      formData
    );

    // Rediriger vers la prochaine étape avec l'ID de l'examen
    router.push(`/refraction-subjective/${examId}`);
  } catch (error) {
    console.error("Erreur lors de la sauvegarde:", error);
    alert(error.message || "Une erreur est survenue lors de la sauvegarde");
  } finally {
    loading.value = false;
  }
};
</script>
