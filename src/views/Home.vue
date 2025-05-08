<template>
  <v-container>
    <v-row>
      <v-col cols="12" class="d-flex justify-space-between align-center">
        <h1>Mes examens</h1>
        <v-btn color="primary" @click="createNewExam" class="mr-2">
          Nouvel examen
        </v-btn>

        <v-btn color="error" @click="logout"> Déconnexion </v-btn>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>Liste des examens</v-card-title>
          <v-card-text>
            <v-data-table
              :headers="headers"
              :items="exams"
              :loading="loading"
              @click:row="openExam"
              class="cursor-pointer"
            >
              <template v-slot:item.patient.nom="{ item }">
                {{ item.patient?.nom || "Non renseigné" }}
              </template>
              <template v-slot:item.patient.prenom="{ item }">
                {{ item.patient?.prenom || "Non renseigné" }}
              </template>
              <template v-slot:item.date="{ item }">
                {{ formatDate(item.createdAt) }}
              </template>
              <template v-slot:item.lastUpdate="{ item }">
                {{ formatDate(item.updatedAt) }}
              </template>
              <template v-slot:item.status="{ item }">
                <v-chip
                  :color="getStatusColor(item.status)"
                  :text="item.status"
                  class="text-uppercase"
                  size="small"
                  label
                ></v-chip>
              </template>
              <template v-slot:item.actions="{ item }">
                <v-btn
                  icon
                  color="error"
                  size="small"
                  @click.stop="deleteExam(item)"
                >
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { authService } from "../services/auth";
import { dbService } from "../services/db";

const router = useRouter();
const route = useRoute();
const loading = ref(false);
const exams = ref([]);

const headers = [
  { title: "Nom", key: "patient.nom" },
  { title: "Prénom", key: "patient.prenom" },
  { title: "Date de création", key: "date" },
  { title: "Dernière modification", key: "lastUpdate" },
  { title: "Statut", key: "status" },
  { title: "Actions", key: "actions", sortable: false },
];

const loadExams = async () => {
  try {
    loading.value = true;
    const userId = authService.getCurrentUser()?.id;
    console.log("Chargement des examens pour l'utilisateur:", userId);

    if (!userId) {
      console.error("Aucun utilisateur connecté");
      router.replace("/login");
      return;
    }

    const userExams = await dbService.getUserExams(userId);
    console.log("Examens chargés:", userExams);

    if (!userExams || userExams.length === 0) {
      console.log("Aucun examen trouvé pour l'utilisateur");
      exams.value = [];
      return;
    }

    exams.value = userExams;
  } catch (error) {
    console.error("Erreur lors du chargement des examens:", error);
    alert("Impossible de charger la liste des examens");
    exams.value = [];
  } finally {
    loading.value = false;
  }
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusColor = (status) => {
  switch (status) {
    case "Terminé":
      return "success";
    case "En cours":
      return "warning";
    default:
      return "grey";
  }
};

const createNewExam = async () => {
  try {
    loading.value = true;
    const userId = authService.getCurrentUser()?.id;
    console.log("Création d'un nouvel examen pour l'utilisateur:", userId);

    if (!userId) {
      console.error("Aucun utilisateur connecté");
      router.push("/login");
      return;
    }

    const examId = `exam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const exam = {
      id: examId,
      userId,
      createdAt: now,
      updatedAt: now,
      patient: {
        nom: "",
        prenom: "",
      },
      status: "En cours",
    };

    console.log("Sauvegarde du nouvel examen:", exam);
    await dbService.saveExam(exam);

    // Recharger la liste des examens après la création
    await loadExams();

    router.push(`/identification/${examId}`);
  } catch (error) {
    console.error("Erreur lors de la création de l'examen:", error);
    alert("Une erreur est survenue lors de la création de l'examen");
  } finally {
    loading.value = false;
  }
};

const openExam = (event, { item }) => {
  router.push(`/identification/${item.id}`);
};

const deleteExam = async (exam) => {
  if (
    !confirm(
      `Voulez-vous vraiment supprimer l'examen de ${exam.patient?.nom || "Non renseigné"} ${exam.patient?.prenom || ""} ?`
    )
  ) {
    return;
  }

  try {
    loading.value = true;
    const userId = authService.getCurrentUser()?.id;
    if (!userId) {
      console.error("Aucun utilisateur connecté");
      return;
    }

    await dbService.deleteExam(userId, exam.id);
    console.log("Examen supprimé avec succès");
    await loadExams();
  } catch (error) {
    console.error("Erreur lors de la suppression de l'examen:", error);
    // Ne pas afficher d'alerte si l'erreur est due à l'examen n'existant pas ou si c'est juste une erreur de sections/PDFs
    if (
      error.message?.includes("n'existe pas") ||
      error.message?.includes("Aucune section") ||
      error.message?.includes("Aucun PDF")
    ) {
      console.log("Suppression partielle réussie:", error.message);
      await loadExams();
    } else {
      alert("Une erreur est survenue lors de la suppression de l'examen");
    }
  } finally {
    loading.value = false;
  }
};

const logout = () => {
  authService.logout();
  router.push("/login");
};

onMounted(async () => {
  console.log("Composant Home monté");
  if (!authService.isAuthenticated()) {
    console.log("Utilisateur non authentifié, redirection vers login");
    router.push("/login");
  } else {
    console.log("Utilisateur authentifié, chargement des examens");
    await loadExams();
  }
});

// Watcher pour la route
watch(
  () => route.path,
  async (newPath) => {
    if (newPath === "/" && authService.isAuthenticated()) {
      console.log(
        "Changement de route vers la page d'accueil, rechargement des examens"
      );
      await loadExams();
    }
  },
  { immediate: true }
);

// Watcher pour les changements dans la base de données
watch(
  () => authService.getCurrentUser()?.id,
  async (newUserId) => {
    if (newUserId && route.path === "/") {
      console.log(
        "Changement d'utilisateur ou mise à jour des données, rechargement des examens"
      );
      await loadExams();
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
