<template>
  <v-container>
    <v-card class="mx-auto" max-width="800">
      <v-card-title>Histoire de cas</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="submitForm" ref="formRef">
          <v-row>
            <v-col cols="12">
              <v-textarea
                v-model="form.motifConsultation"
                label="Motif de consultation"
                rows="3"
                required
                :rules="[(v) => !!v || 'Le motif de consultation est requis']"
                data-test="motif-consultation"
              ></v-textarea>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-textarea
                v-model="form.antecedents"
                label="Antécédents médicaux"
                rows="3"
                data-test="antecedents"
              ></v-textarea>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-textarea
                v-model="form.antecedentsFamiliaux"
                label="Antécédents familiaux"
                rows="2"
                data-test="antecedents-familiaux"
              ></v-textarea>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-textarea
                v-model="form.traitements"
                label="Traitements en cours"
                rows="2"
                data-test="traitements"
              ></v-textarea>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-textarea
                v-model="form.allergies"
                label="Allergies"
                rows="2"
                data-test="allergies"
              ></v-textarea>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-textarea
                v-model="form.habitudesVisuelles"
                label="Habitudes visuelles"
                rows="2"
                data-test="habitudes-visuelles"
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
  motifConsultation: "",
  antecedents: "",
  antecedentsFamiliaux: "",
  traitements: "",
  allergies: "",
  habitudesVisuelles: "",
});

const loadHistoryData = async (examId) => {
  if (!examId) return;

  try {
    loading.value = true;
    const savedData = await dbService.getSection(examId, "histoire");
    if (savedData && savedData.data) {
      form.value = { ...savedData.data };
    }
  } catch (error) {
    console.error("Erreur lors du chargement des données:", error);
    alert("Impossible de charger les données de l'histoire de cas");
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadHistoryData(route.params.examId);
});

// Observer les changements de route pour recharger les données
watch(
  () => route.params.examId,
  (newExamId) => {
    loadHistoryData(newExamId);
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
    await dbService.saveSection(examId, "histoire", formData);

    // Générer le PDF de la section
    await pdfService.generateSectionPDF(examId, "histoire", formData);

    // Rediriger vers la prochaine étape avec l'ID de l'examen
    router.push(`/refraction-objective/${examId}`);
  } catch (error) {
    console.error("Erreur lors de la sauvegarde:", error);
    alert(error.message || "Une erreur est survenue lors de la sauvegarde");
  } finally {
    loading.value = false;
  }
};
</script>
