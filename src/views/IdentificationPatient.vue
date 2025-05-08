<template>
  <v-container>
    <v-card class="mx-auto" max-width="800">
      <v-card-title>Identification du patient</v-card-title>
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
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.dateNaissance"
                label="Date de naissance"
                type="date"
                required
                :rules="[(v) => !!v || 'La date de naissance est requise']"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.telephone"
                label="Téléphone"
                type="tel"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="form.adresse"
                label="Adresse"
                required
                :rules="[(v) => !!v || 'L\'adresse est requise']"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.ville"
                label="Ville"
                required
                :rules="[(v) => !!v || 'La ville est requise']"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.codePostal"
                label="Code postal"
                required
                :rules="[(v) => !!v || 'Le code postal est requis']"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="form.email"
                label="Courriel"
                type="email"
                :rules="[
                  (v) =>
                    !v ||
                    /.+@.+\..+/.test(v) ||
                    'L\'adresse email doit être valide',
                ]"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-btn color="primary" type="submit" :loading="loading" block>
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

const router = useRouter();
const route = useRoute();
const loading = ref(false);

const form = ref({
  nom: "",
  prenom: "",
  dateNaissance: "",
  telephone: "",
  adresse: "",
  ville: "",
  codePostal: "",
  email: "",
});

const formRef = ref(null);

const loadPatientData = async (examId) => {
  if (!examId) return;

  try {
    loading.value = true;
    const exam = await dbService.getExam(examId);
    if (exam && exam.patient) {
      // Formater la date de naissance pour l'input date
      const dateNaissance = exam.patient.dateNaissance
        ? new Date(exam.patient.dateNaissance).toISOString().split("T")[0]
        : "";

      // Mettre à jour le formulaire avec les données existantes
      form.value = {
        nom: exam.patient.nom || "",
        prenom: exam.patient.prenom || "",
        dateNaissance: dateNaissance,
        telephone: exam.patient.telephone || "",
        adresse: exam.patient.adresse || "",
        ville: exam.patient.ville || "",
        codePostal: exam.patient.codePostal || "",
        email: exam.patient.email || "",
      };
    }
  } catch (error) {
    console.error("Erreur lors du chargement des données:", error);
    alert("Impossible de charger les données du patient");
  } finally {
    loading.value = false;
  }
};

// Charger les données au montage du composant
onMounted(() => {
  loadPatientData(route.params.examId);
});

// Observer les changements de route pour recharger les données
watch(
  () => route.params.examId,
  (newExamId) => {
    loadPatientData(newExamId);
  }
);

const submitForm = async () => {
  try {
    loading.value = true;

    // Vérifier la validation du formulaire
    const { valid } = await formRef.value.validate();
    if (!valid) {
      throw new Error("Veuillez corriger les erreurs dans le formulaire");
    }

    const examId = route.params.examId;
    if (!examId) {
      throw new Error("ID d'examen manquant");
    }

    const now = new Date().toISOString();

    // Créer une copie sérialisable du formulaire
    const formData = JSON.parse(JSON.stringify(form.value));

    // Sauvegarder la section d'identification
    await dbService.saveSection({
      examId: examId,
      name: "identification",
      data: formData,
      updatedAt: now,
    });

    // Générer le PDF de la section
    await pdfService.generateSectionPDF(examId, "identification", formData);

    // Mettre à jour l'examen avec les informations du patient
    const exam = await dbService.getExam(examId);
    if (exam) {
      const updatedExam = {
        ...exam,
        patient: formData,
        updatedAt: now,
      };
      await dbService.saveExam(updatedExam);
    }

    // Rediriger vers l'examen
    router.replace(`/examen/${examId}`);
  } catch (error) {
    console.error("Erreur lors de la sauvegarde:", error);
    alert(error.message || "Une erreur est survenue lors de la sauvegarde");
  } finally {
    loading.value = false;
  }
};
</script>
