<template>
  <v-container>
    <LesionCanvas
      :exam-id="route.params.examId"
      background-image="/retina-background.png"
    />
  </v-container>
</template>

<script setup>
import { useRoute } from "vue-router";
import LesionCanvas from "../components/LesionCanvas.vue";

const route = useRoute();
</script>
