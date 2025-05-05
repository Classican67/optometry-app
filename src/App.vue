<template>
  <v-app>
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
      <v-btn icon @click="goToHome" v-if="!isHomePage">
        <v-icon>mdi-home</v-icon>
      </v-btn>
      <v-btn icon @click="exportPDF">
        <v-icon>mdi-file-pdf-box</v-icon>
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
  </v-app>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { authService } from "./services/auth";
import { pdfService } from "./services/pdfService";

const router = useRouter();
const route = useRoute();
const drawer = ref(true);

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
      title: "Histoire de cas",
      icon: "mdi-clipboard-text",
      to: `/histoire/${examId}`,
      step: 2,
    },
    {
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
  ];
});

const currentStep = computed(() => {
  const examId = route.params.examId;
  if (!examId) return 0;

  const step =
    menuItems.value.find((item) => item.to === route.path)?.step || 0;
  return step;
});

const isStepAccessible = (step) => {
  return step <= currentStep.value + 1;
};

const goToHome = () => {
  router.push("/");
};

const exportPDF = async () => {
  try {
    const examId = route.params.examId;
    if (!examId) {
      alert("Veuillez commencer un examen avant d'exporter");
      return;
    }

    const pdfBlob = await pdfService.generateFinalPDF(examId);
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `examen-optometrique-${examId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Erreur lors de l'export du PDF:", error);
    alert("Une erreur est survenue lors de l'export du PDF");
  }
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
</style>
