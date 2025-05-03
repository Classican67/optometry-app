<template>
  <v-container>
    <LesionCanvas
      :exam-id="route.params.examId"
      background-image="/segment_anterieur.svg"
    />
  </v-container>
</template>

<script setup>
import { useRoute } from "vue-router";
import LesionCanvas from "../components/LesionCanvas.vue";

const route = useRoute();
</script>
