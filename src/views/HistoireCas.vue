<template>
  <v-container fluid class="fill-height pa-0">
    <v-row no-gutters class="fill-height">
      <!-- Marge gauche avec les boutons -->
      <v-col cols="2" class="d-flex flex-column">
        <v-card class="h-100 d-flex flex-column" flat>
          <v-card-text class="flex-grow-1 d-flex flex-column">
            <v-btn
              block
              class="mb-2"
              color="error"
              @click="clearCanvas"
              size="large"
            >
              Effacer
            </v-btn>
            <v-btn
              block
              class="mb-2"
              color="success"
              @click="validerExamen"
              size="large"
            >
              Valider
            </v-btn>
            <v-btn
              block
              class="mb-2"
              color="primary"
              @click="exporterPDF"
              :disabled="!examenValide"
              size="large"
            >
              EXPORTER
            </v-btn>
            <v-divider class="my-4"></v-divider>
            <div class="d-flex justify-space-between mb-2">
              <v-btn
                @click="undo"
                :disabled="undoStack.length === 0"
                icon="mdi-undo"
                size="large"
              ></v-btn>
              <v-btn
                @click="redo"
                :disabled="redoStack.length === 0"
                icon="mdi-redo"
                size="large"
              ></v-btn>
            </div>
            <div class="px-2 mt-4">
              <div class="text-caption mb-2">Taille du crayon</div>
              <v-slider
                v-model="penSize"
                :min="1"
                :max="20"
                :step="1"
                thumb-label
                hide-details
                color="primary"
              ></v-slider>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Zone de dessin -->
      <v-col cols="10" class="d-flex flex-column">
        <v-card flat class="flex-grow-1 d-flex flex-column">
          <v-card-text class="flex-grow-1 pa-0">
            <div
              class="drawing-area"
              @touchstart.prevent="onTouchStart"
              @touchmove.prevent="onTouchMove"
              @touchend.prevent="onTouchEnd"
              @mousedown.prevent="onMouseDown"
              @mousemove.prevent="onMouseMove"
              @mouseup.prevent="onMouseUp"
              @mouseleave.prevent="onMouseUp"
            >
              <canvas ref="pencilCanvas"></canvas>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { jsPDF } from "jspdf";
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { authService } from "../services/auth";
import { dbService } from "../services/db";
import { pdfService } from "../services/pdfService";

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const formRef = ref(null);
const pencilCanvas = ref(null);
const examenValide = ref(false);

const form = ref({
  motifConsultation: "",
  antecedents: "",
  antecedentsFamiliaux: "",
  traitements: "",
  allergies: "",
  habitudesVisuelles: "",
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
    pencilCanvas.value.style.width = backgroundImg.naturalWidth + "px";
    pencilCanvas.value.style.height = backgroundImg.naturalHeight + "px";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = penSize.value;
  }
}

function drawBackgroundAndPaths() {
  ctx.clearRect(0, 0, pencilCanvas.value.width, pencilCanvas.value.height);
  ctx.drawImage(
    backgroundImg,
    0,
    0,
    pencilCanvas.value.width,
    pencilCanvas.value.height
  );
  for (const path of paths) {
    ctx.strokeStyle = "#000";
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
    if (t.touchType === "stylus") {
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
  ctx.strokeStyle = "#000";
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
    paths =
      undoStack.value.length > 0
        ? JSON.parse(undoStack.value[undoStack.value.length - 1])
        : [];
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
    const saved = await dbService.getSection(examId, "histoire");
    if (saved?.data) form.value = { ...saved.data };
  } catch (e) {
    console.error(e);
    alert("Impossible de charger les données");
  } finally {
    loading.value = false;
  }
}

async function submitForm() {
  loading.value = true;
  try {
    const examId = route.params.examId;
    if (!examId) throw new Error("ID manquant");
    const { valid } = await formRef.value.validate();
    if (!valid) throw new Error("Formulaire invalide");
    await dbService.saveSection(examId, "histoire", form.value);
    await pdfService.generateSectionPDF(examId, "histoire", form.value);
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
  ctx = canvas.getContext("2d");
  backgroundImg = new window.Image();
  backgroundImg.src = "/examen_annie.svg";
  backgroundImg.onload = async () => {
    setCanvasToImageSize();
    await loadCanvasData();
  };
});

watch(
  () => route.params.examId,
  (id) => loadHistoryData(id)
);

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
    examenValide.value = true;
    alert("Examen validé ! Vous pouvez maintenant exporter le PDF.");
  } catch (e) {
    console.error(e);
    alert("Erreur lors de la validation de l'examen");
  }
}

async function exporterPDF() {
  if (!examenValide.value) {
    alert(
      "Vous devez d'abord valider l'examen avant de pouvoir l'exporter en PDF."
    );
    return;
  }
  const examId = route.params.examId;
  const exam = await dbService.getExam(examId);
  const patient = exam?.patient || {};
  const praticien = authService.getCurrentUser();
  const dateExamen = new Date(exam.createdAt).toLocaleDateString("fr-FR");

  // Récupérer l'image du canvas annoté
  const canvasSection = await dbService.getSection(
    examId,
    "histoire-canvas-image"
  );
  if (
    !canvasSection ||
    !canvasSection.data ||
    !canvasSection.data.startsWith("data:image")
  ) {
    alert("Aucune annotation trouvée pour ce dossier.");
    return;
  }

  // Création du PDF paysage
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Titre personnalisé
  doc.setFontSize(18);
  doc.setTextColor(33, 150, 243);
  doc.text(
    `Examen - ${dateExamen} - ${patient.prenom || ""} ${patient.nom || ""} (${patient.dateNaissance || ""})`,
    10,
    15
  );
  doc.setFontSize(14);
  doc.text(
    `Réalisé par Dr(e) ${praticien.prenom} ${praticien.nom} - N°Ordre: ${praticien.numeroOrdre}`,
    10,
    25
  );

  // Ajout de l'image annotée
  doc.addImage(canvasSection.data, "PNG", 10, 35, 277, 190);

  // Pied de page
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("© 2024 Cabinet d'Optométrie - Tous droits réservés", 10, 200);

  // Téléchargement
  doc.save(`examen-${patient.prenom || ""}-${patient.nom || ""}-${examId}.pdf`);
}

// Ajout des gestionnaires d'événements souris
function onMouseDown(event) {
  const touch = {
    clientX: event.clientX,
    clientY: event.clientY,
    touchType: "stylus",
  };
  onTouchStart({ touches: [touch] });
}

function onMouseMove(event) {
  if (!drawing) return;
  const touch = {
    clientX: event.clientX,
    clientY: event.clientY,
    touchType: "stylus",
  };
  onTouchMove({ touches: [touch] });
}

function onMouseUp() {
  if (drawing) {
    onTouchEnd({ touches: [] });
  }
}
</script>

<style scoped>
.drawing-area {
  position: relative;
  border: 1px solid #000;
  touch-action: none;
  width: 100%;
  height: 100%;
  background-color: white;
}

.drawing-area canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}

/* Styles spécifiques pour iPad */
@media (hover: none) and (pointer: coarse) {
  .drawing-area {
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    user-select: none;
  }

  .v-btn {
    min-height: 48px;
    font-size: 16px;
  }

  .v-slider {
    min-height: 48px;
  }

  .v-slider-thumb {
    width: 24px !important;
    height: 24px !important;
  }
}

/* Ajustements pour le mode paysage */
@media (orientation: landscape) {
  .drawing-area {
    height: calc(100vh - 32px);
  }
}

/* Ajustements pour le mode portrait */
@media (orientation: portrait) {
  .drawing-area {
    height: calc(100vh - 32px);
  }
}
</style>
