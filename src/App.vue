<template>
  <v-app :theme="theme">
    <v-navigation-drawer v-model="drawer" app v-if="showNavigation">
      <v-list>
        <v-list-item
          v-for="(item, i) in menuItems"
          :key="i"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          :disabled="!isStepAccessible(item.step)"
        ></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar app>
      <v-app-bar-nav-icon
        @click="drawer = !drawer"
        v-if="showNavigation"
      ></v-app-bar-nav-icon>
      <v-toolbar-title>Application d'Optométrie</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn icon @click="toggleTheme">
        <v-icon>{{
          theme === "dark" ? "mdi-weather-sunny" : "mdi-weather-night"
        }}</v-icon>
      </v-btn>
      <v-btn icon @click="goToHome" v-if="!isHomePage">
        <v-icon>mdi-home</v-icon>
      </v-btn>
      <v-btn icon @click="openSignatureDialog">
        <v-icon>mdi-signature</v-icon>
      </v-btn>
      <v-btn icon @click="goToProfile" v-if="authService.isAuthenticated()">
        <v-icon>mdi-account-circle</v-icon>
      </v-btn>
    </v-app-bar>

    <v-main>
      <v-container fluid>
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </v-container>
    </v-main>

    <!-- Dialog de signature -->
    <v-dialog v-model="signatureDialog" max-width="500">
      <v-card>
        <v-card-title>Signature</v-card-title>
        <v-card-text>
          <div class="signature-container">
            <canvas
              ref="signatureCanvas"
              @mousedown="startDrawing"
              @mousemove="draw"
              @mouseup="stopDrawing"
              @mouseleave="stopDrawing"
              @touchstart.prevent="startDrawing"
              @touchmove.prevent="draw"
              @touchend.prevent="stopDrawing"
              width="400"
              height="200"
              class="signature-canvas"
            ></canvas>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" @click="clearSignature">Effacer</v-btn>
          <v-btn color="primary" @click="saveSignature">Enregistrer</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { authService } from "./services/auth";
import { dbService } from "./services/db";

const router = useRouter();
const route = useRoute();
const drawer = ref(true);
const theme = ref(localStorage.getItem("theme") || "light");
const signatureDialog = ref(false);
const signatureCanvas = ref(null);
const isDrawing = ref(false);
const lastX = ref(0);
const lastY = ref(0);
const currentExam = ref(null);

// Variables pour le canvas de signature
let ctx = null;

const showNavigation = computed(() => {
  return route.params.examId && authService.isAuthenticated();
});

const isHomePage = computed(() => {
  return route.path === "/";
});

const menuItems = computed(() => {
  const examId = route.params.examId;
  if (!examId) return [];

  return [
    {
      title: "Identification",
      icon: "mdi-account",
      to: `/identification/${examId}`,
      step: 1,
    },
    {
      title: "Examen",
      icon: "mdi-clipboard-text",
      to: `/examen/${examId}`,
      step: 2,
    },
    {
      title: "Référence",
      icon: "mdi-file-document",
      to: `/reference/${examId}`,
      step: 3,
    },
    /** {
      title: "Réfraction objective",
      icon: "mdi-eye",
      to: `/refraction-objective/${examId}`,
      step: 3,
    },
    {
      title: "Réfraction subjective",
      icon: "mdi-eye-settings",
      to: `/refraction-subjective/${examId}`,
      step: 4,
    },
    {
      title: "Lesions",
      icon: "mdi-draw",
      to: `/lesions/${examId}`,
      step: 5,
    },
    {
      title: "Examen de Vue",
      icon: "mdi-eye-check",
      to: `/examen-vue/${examId}`,
      step: 6,
    },
    */
  ];
});

const currentStep = computed(() => {
  const examId = route.params.examId;
  if (!examId) return 0;

  const step =
    menuItems.value.find((item) => item.to === route.path)?.step || 0;
  return step;
});

// Ajouter un watcher pour charger l'examen quand l'ID change
watch(
  () => route.params.examId,
  async (newExamId) => {
    if (newExamId) {
      try {
        currentExam.value = await dbService.getExam(newExamId);
      } catch (error) {
        console.error("Erreur lors du chargement de l'examen:", error);
        currentExam.value = null;
      }
    } else {
      currentExam.value = null;
    }
  },
  { immediate: true }
);

const isStepAccessible = (step) => {
  if (step === 1) return true; // L'identification est toujours accessible

  // Si l'identification est complète (nom et prénom présents), toutes les étapes sont accessibles
  if (currentExam.value?.patient?.nom && currentExam.value?.patient?.prenom) {
    return true;
  }

  return false;
};

const goToHome = () => {
  router.push("/");
};

const openSignatureDialog = () => {
  signatureDialog.value = true;
  // Initialiser le canvas après que le dialog soit ouvert
  setTimeout(() => {
    const canvas = signatureCanvas.value;
    if (canvas) {
      ctx = canvas.getContext("2d");
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  }, 100);
};

function startDrawing(event) {
  isDrawing.value = true;
  const rect = signatureCanvas.value.getBoundingClientRect();
  const clientX = event.clientX || event.touches[0].clientX;
  const clientY = event.clientY || event.touches[0].clientY;
  lastX.value = clientX - rect.left;
  lastY.value = clientY - rect.top;
}

function draw(event) {
  if (!isDrawing.value) return;

  const rect = signatureCanvas.value.getBoundingClientRect();
  const clientX = event.clientX || event.touches[0].clientX;
  const clientY = event.clientY || event.touches[0].clientY;
  const currentX = clientX - rect.left;
  const currentY = clientY - rect.top;

  ctx.beginPath();
  ctx.moveTo(lastX.value, lastY.value);
  ctx.lineTo(currentX, currentY);
  ctx.stroke();

  lastX.value = currentX;
  lastY.value = currentY;
}

function stopDrawing() {
  isDrawing.value = false;
}

function clearSignature() {
  ctx.clearRect(
    0,
    0,
    signatureCanvas.value.width,
    signatureCanvas.value.height
  );
}

async function saveSignature() {
  try {
    const signatureData = signatureCanvas.value.toDataURL("image/png");
    const userId = authService.getCurrentUser()?.id;

    if (!userId) {
      throw new Error("Utilisateur non connecté");
    }

    // Sauvegarder la signature dans IndexedDB
    await dbService.saveUserSignature(userId, signatureData);

    signatureDialog.value = false;
    alert("Signature enregistrée avec succès");
  } catch (error) {
    console.error("Erreur lors de la sauvegarde de la signature:", error);
    alert("Erreur lors de la sauvegarde de la signature");
  }
}

const toggleTheme = () => {
  theme.value = theme.value === "light" ? "dark" : "light";
  localStorage.setItem("theme", theme.value);
};

// Ajouter cette fonction pour réinitialiser la base de données
async function resetDatabase() {
  try {
    await dbService.resetDatabase();
    alert(
      "Base de données réinitialisée avec succès. Veuillez recharger la page."
    );
    window.location.reload();
  } catch (error) {
    console.error(
      "Erreur lors de la réinitialisation de la base de données:",
      error
    );
    alert(
      "Erreur lors de la réinitialisation de la base de données. Veuillez réessayer."
    );
  }
}

// Ajouter cette fonction pour vérifier la connexion à la base de données
async function checkDatabaseConnection() {
  try {
    await dbService.init();
    console.log("Connexion à la base de données réussie");
  } catch (error) {
    console.error("Erreur de connexion à la base de données:", error);
    if (
      confirm(
        "Erreur de connexion à la base de données. Voulez-vous réinitialiser la base de données ?"
      )
    ) {
      await resetDatabase();
    }
  }
}

// Appeler checkDatabaseConnection au montage du composant
onMounted(async () => {
  await checkDatabaseConnection();
});

const goToProfile = () => {
  router.push("/profile");
};
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.signature-container {
  border: 1px solid #ccc;
  border-radius: 4px;
  margin: 10px 0;
}

.signature-canvas {
  width: 100%;
  height: 200px;
  background-color: white;
  touch-action: none;
}
</style>
