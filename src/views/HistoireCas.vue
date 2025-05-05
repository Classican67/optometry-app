<template>
  <v-container>
    <!-- Zone de dessin - Apple Pencil via touch events -->
    <h2 class="mt-6">Signature ou dessin</h2>
    <div
      class="drawing-area"
      @touchstart.prevent="onTouchStart"
      @touchmove.prevent="onTouchMove"
      @touchend.prevent="onTouchEnd"
    >
      <canvas ref="pencilCanvas"></canvas>
    </div>
    <v-btn class="mt-2" @click="clearCanvas" color="error">Effacer</v-btn>
    <v-btn class="mt-2 ml-2" color="success" @click="validerExamen">
  Valider l'examen
</v-btn>
<v-btn
  class="mt-2 ml-2"
  color="primary"
  @click="exporterPDF"
  :disabled="!examenValide"
>
  Exporter en PDF
</v-btn>

    <v-row class="mb-2" align="center">
      <v-col cols="auto">
        <v-btn @click="undo" :disabled="undoStack.length === 0" icon>
          <v-icon>mdi-undo</v-icon>
        </v-btn>
      </v-col>
      <v-col cols="auto">
        <v-btn @click="redo" :disabled="redoStack.length === 0" icon>
          <v-icon>mdi-redo</v-icon>
        </v-btn>
      </v-col>
      <v-col cols="auto">
        <v-select
          v-model="penSize"
          :items="penSizes"
          label="Taille du crayon"
          dense
          hide-details
          style="max-width: 120px"
        ></v-select>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { dbService } from '../services/db';
import { pdfService } from '../services/pdfService';
import ExamenVue from "../views/ExamenVue.vue";
import { jsPDF } from "jspdf";
import { authService } from "../services/auth";

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const formRef = ref(null);
const pencilCanvas = ref(null);

const form = ref({
  motifConsultation: '',
  antecedents: '',
  antecedentsFamiliaux: '',
  traitements: '',
  allergies: '',
  habitudesVisuelles: '',
});

// Context 2D et état
let ctx = null;
let drawing = false;
let backgroundImg = null;

const penSizes = [2, 4, 8, 12, 16];
const penSize = ref(2);

let undoStack = ref([]);
let redoStack = ref([]);
let currentPath = [];
let paths = [];

function setCanvasToImageSize() {
  if (backgroundImg && pencilCanvas.value) {
    pencilCanvas.value.width = backgroundImg.naturalWidth;
    pencilCanvas.value.height = backgroundImg.naturalHeight;
    pencilCanvas.value.style.width = backgroundImg.naturalWidth + 'px';
    pencilCanvas.value.style.height = backgroundImg.naturalHeight + 'px';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = penSize.value;
  }
}

function drawBackgroundAndPaths() {
  ctx.clearRect(0, 0, pencilCanvas.value.width, pencilCanvas.value.height);
  ctx.drawImage(backgroundImg, 0, 0, pencilCanvas.value.width, pencilCanvas.value.height);
  for (const path of paths) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = path.size;
    ctx.beginPath();
    for (let i = 0; i < path.points.length; i++) {
      const pt = path.points[i];
      if (i === 0) {
        ctx.moveTo(pt.x, pt.y);
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    }
    ctx.stroke();
    ctx.closePath();
  }
}

function getStylusTouch(touches) {
  for (let i = 0; i < touches.length; i++) {
    const t = touches[i];
    if (t.touchType === 'stylus') {
      return t;
    }
  }
  return null;
}

function onTouchStart(event) {
  const touch = getStylusTouch(event.touches);
  if (!touch) return;
  drawing = true;
  currentPath = [];
  const { clientX: x, clientY: y } = touch;
  const rect = pencilCanvas.value.getBoundingClientRect();
  const px = x - rect.left;
  const py = y - rect.top;
  currentPath.push({ x: px, y: py });
  ctx.beginPath();
  ctx.moveTo(px, py);
}

function onTouchMove(event) {
  if (!drawing) return;
  const touch = getStylusTouch(event.touches);
  if (!touch) return;
  const { clientX: x, clientY: y } = touch;
  const rect = pencilCanvas.value.getBoundingClientRect();
  const px = x - rect.left;
  const py = y - rect.top;
  currentPath.push({ x: px, y: py });
  ctx.lineTo(px, py);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = penSize.value;
  ctx.stroke();
}

function onTouchEnd(event) {
  const stillStylus = getStylusTouch(event.touches);
  if (!stillStylus && drawing) {
    drawing = false;
    ctx.closePath();
    if (currentPath.length > 1) {
      paths.push({ points: [...currentPath], size: penSize.value });
      undoStack.value.push(JSON.stringify(paths));
      redoStack.value = [];
      saveCanvasData();
      saveCanvasImage();
    }
    currentPath = [];
  }
}

function undo() {
  if (undoStack.value.length > 0) {
    redoStack.value.push(JSON.stringify(paths));
    undoStack.value.pop();
    paths = undoStack.value.length > 0 ? JSON.parse(undoStack.value[undoStack.value.length - 1]) : [];
    drawBackgroundAndPaths();
    saveCanvasData();
    saveCanvasImage();
  }
}

function redo() {
  if (redoStack.value.length > 0) {
    undoStack.value.push(redoStack.value[redoStack.value.length - 1]);
    paths = JSON.parse(redoStack.value.pop());
    drawBackgroundAndPaths();
    saveCanvasData();
    saveCanvasImage();
  }
}

function clearCanvas() {
  paths = [];
  undoStack.value = [];
  redoStack.value = [];
  drawBackgroundAndPaths();
  saveCanvasData();
  saveCanvasImage();
}

async function loadHistoryData(examId) {
  if (!examId) return;
  loading.value = true;
  try {
    const saved = await dbService.getSection(examId, 'histoire');
    if (saved?.data) form.value = { ...saved.data };
  } catch (e) {
    console.error(e);
    alert('Impossible de charger les données');
  } finally {
    loading.value = false;
  }
}

async function submitForm() {
  loading.value = true;
  try {
    const examId = route.params.examId;
    if (!examId) throw new Error('ID manquant');
    const { valid } = await formRef.value.validate();
    if (!valid) throw new Error('Formulaire invalide');
    await dbService.saveSection(examId, 'histoire', form.value);
    await pdfService.generateSectionPDF(examId, 'histoire', form.value);
    router.push(`/refraction-objective/${examId}`);
  } catch (e) {
    console.error(e);
    alert(e.message);
  } finally {
    loading.value = false;
  }
}

// Sauvegarder les paths dans la base
async function saveCanvasData() {
  const examId = route.params.examId;
  if (!examId) return;
  // On sauvegarde le tableau paths sous forme de JSON
  await dbService.saveSection(examId, "histoire-canvas", JSON.stringify(paths));
  await saveCanvasImage();
}

// Charger les paths depuis la base
async function loadCanvasData() {
  const examId = route.params.examId;
  if (!examId) return;
  const saved = await dbService.getSection(examId, "histoire-canvas");
  if (saved && saved.data) {
    try {
      paths = JSON.parse(saved.data);
      // On reconstruit l'historique pour permettre undo/redo sur l'état chargé
      undoStack.value = [JSON.stringify(paths)];
      redoStack.value = [];
    } catch (e) {
      paths = [];
      undoStack.value = [];
      redoStack.value = [];
    }
  } else {
    paths = [];
    undoStack.value = [];
    redoStack.value = [];
  }
  drawBackgroundAndPaths();
}

async function saveCanvasImage() {
  const examId = route.params.examId;
  if (!examId) return;
  const canvas = pencilCanvas.value;
  const dataUrl = canvas.toDataURL("image/png");
  await dbService.saveSection(examId, "histoire-canvas-image", dataUrl);
}

watch(penSize, (newSize) => {
  if (ctx) ctx.lineWidth = newSize;
});

onMounted(async () => {
  loadHistoryData(route.params.examId);
  const canvas = pencilCanvas.value;
  ctx = canvas.getContext('2d');
  backgroundImg = new window.Image();
  backgroundImg.src = '/examen_annie.svg';
  backgroundImg.onload = async () => {
    setCanvasToImageSize();
    await loadCanvasData();
  };
});

watch(() => route.params.examId, id => loadHistoryData(id));

async function validerExamen() {
  const examId = route.params.examId;
  if (!examId) return;
  try {
    // Charger l'examen existant
    const exam = await dbService.getExam(examId);
    if (!exam) {
      alert("Examen introuvable");
      return;
    }
    // Mettre à jour le statut
    exam.status = "Terminé";
    exam.updatedAt = new Date().toISOString();
    await dbService.saveExam(exam);
    alert("Examen validé ! Vous pouvez maintenant exporter le PDF.");
    // Optionnel : rediriger ou rafraîchir la page d'accueil
  } catch (e) {
    console.error(e);
    alert("Erreur lors de la validation de l'examen");
  }
}

async function exporterPDF() {
  if (!examenValide.value) {
    alert("Vous devez d'abord valider l'examen avant de pouvoir l'exporter en PDF.");
    return;
  }
  const examId = route.params.examId;
  const exam = await dbService.getExam(examId);
  const patient = exam?.patient || {};
  const praticien = authService.getCurrentUser()?.id || "Inconnu";

  // Récupérer l'image du canvas annoté
  const canvasSection = await dbService.getSection(examId, "histoire-canvas-image");
  if (!canvasSection || !canvasSection.data || !canvasSection.data.startsWith("data:image")) {
    alert("Aucune annotation trouvée pour ce dossier.");
    return;
  }

  // Création du PDF paysage
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  // Titre personnalisé
  doc.setFontSize(18);
  doc.setTextColor(33, 150, 243);
  doc.text(
    `Examen - ${patient.prenom || ""} ${patient.nom || ""} - par Dr(e) - ${praticien}`,
    10,
    20
  );

  // Ajout de l'image annotée
  doc.addImage(canvasSection.data, "PNG", 10, 30, 277, 190);

  // Pied de page
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("© 2024 Cabinet d'Optométrie - Tous droits réservés", 10, 200);

  // Téléchargement
  doc.save(
    `examen-${patient.prenom || ""}-${patient.nom || ""}-${examId}.pdf`
  );
}
</script>

<style scoped>
.drawing-area {
  position: relative;
  border: 1px solid #000;
  touch-action: none;
}
.drawing-area canvas {
  display: block;
}
</style>