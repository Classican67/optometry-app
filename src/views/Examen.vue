<template>
  <v-container fluid class="fill-height pa-0">
    <v-row no-gutters class="fill-height">
      <!-- Marge gauche avec les boutons -->
      <v-col cols="2" class="d-flex flex-column">
        <v-card class="h-auto d-flex flex-column" flat>
          <v-card-text class="d-flex flex-column">
            <!-- Chip pour afficher la fiche chargée -->
            <v-chip
              v-if="loadedExamFile"
              color="primary"
              class="mb-4"
              closable
              @click:close="clearLoadedExam"
            >
              {{
                pdfList.find((pdf) => pdf.path === loadedExamFile)?.name ||
                "Fiche chargée"
              }}
            </v-chip>

            <v-select
              v-model="selectedPDF"
              :items="pdfList"
              label="Sélectionner une fiche d'examen"
              item-title="name"
              item-value="path"
              @update:model-value="loadPDF"
              class="mb-4"
            ></v-select>

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
            <v-divider class="my-4"></v-divider>
            <v-btn
              block
              class="mb-2"
              :color="isEraser ? 'error' : 'primary'"
              @click="toggleEraser"
              size="large"
            >
              <v-icon start>{{
                isEraser ? "mdi-pencil" : "mdi-eraser"
              }}</v-icon>
              {{ isEraser ? "Crayon" : "Gomme" }}
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Zone de dessin -->
      <v-col cols="10" class="d-flex flex-column">
        <v-card flat class="flex-grow-1 d-flex flex-column">
          <v-card-text class="flex-grow-1 pa-0 d-flex justify-center">
            <div class="canvas-wrapper">
              <div class="canvas-container">
                <div
                  class="drawing-area"
                  @touchstart.prevent="handleTouchStart"
                  @touchmove.prevent="handleTouchMove"
                  @touchend.prevent="handleTouchEnd"
                  @mousedown.prevent="onMouseDown"
                  @mousemove.prevent="onMouseMove"
                  @mouseup.prevent="onMouseUp"
                  @mouseleave.prevent="onMouseUp"
                >
                  <canvas ref="pencilCanvas"></canvas>
                </div>
              </div>
              <div class="scrollbar-container">
                <div class="scrollbar-track">
                  <div
                    class="scrollbar-thumb"
                    :style="{
                      height: thumbHeight + 'px',
                      top: thumbTop + 'px',
                    }"
                    @mousedown="startScrollDrag"
                    @touchstart.prevent="startScrollDrag"
                  ></div>
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialogue de confirmation -->
    <v-dialog v-model="showConfirmDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h5"> Confirmer le chargement </v-card-title>
        <v-card-text>
          Une fiche d'examen est déjà chargée. Voulez-vous la remplacer ? Les
          annotations non sauvegardées seront perdues.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey-darken-1" variant="text" @click="cancelLoadPDF">
            Annuler
          </v-btn>
          <v-btn color="primary" variant="text" @click="confirmLoadPDF">
            Confirmer
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { authService } from "../services/auth";
import { dbService } from "../services/db";
import { examService } from "../services/examService";
import { pdfService } from "../services/pdfService";
import { referenceService } from "../services/referenceService";
import { nativePlatformService } from "../services/nativePlatformService";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from '@capacitor/filesystem';

// Configuration du worker PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const formRef = ref(null);
const pencilCanvas = ref(null);
const examenValide = ref(false);
const isEraser = ref(false);
const selectedPDF = ref(null);
const pdfList = ref([]);
const currentPage = ref(1);
const totalPages = ref(1);
const loadedExamFile = ref(null);
const showConfirmDialog = ref(false);
const pendingPDFPath = ref(null);

const form = ref({
  motifConsultation: "",
  antecedents: "",
  antecedentsFamiliaux: "",
  traitements: "",
  allergies: "",
  habitudesVisuelles: "",
});

// Variables pour le canvas
let ctx = null;
let drawing = false;
let backgroundImg = null;
let currentPDF = null;
let pdfImages = new Map(); // Pour stocker les images des pages du PDF
let totalHeight = 0; // Pour suivre la hauteur totale du canvas

const penSizes = [2, 4, 8, 12, 16];
const penSize = ref(2);

let undoStack = ref([]);
let redoStack = ref([]);
let currentPath = [];
let paths = [];

let isDrawing = false;
let isScrolling = false;
let touchStartY = 0;
let touchStartTime = 0;
let lastTouchDistance = 0;

// Variables pour la barre de défilement
const thumbHeight = ref(0);
const thumbTop = ref(0);
const isDragging = ref(false);
const startDragY = ref(0);
const startScrollTop = ref(0);

// Ajouter une variable pour stocker l'image du background
let backgroundImage = null;

// Ajouter des variables pour stocker les dimensions originales du PDF
let originalPdfWidth = 0;
let originalPdfHeight = 0;
let currentScale = 1;

// Ajouter une variable pour le debounce
let saveTimeout = null;
const SAVE_DELAY = 1000; // 1 seconde de délai

function setCanvasToImageSize() {
  if (backgroundImg && pencilCanvas.value) {
    // Définir les dimensions exactes du canvas
    pencilCanvas.value.width = 816; // Largeur fixe du SVG
    pencilCanvas.value.height = 2112; // Hauteur fixe du SVG

    // Définir les dimensions CSS du canvas
    pencilCanvas.value.style.width = "816px";
    pencilCanvas.value.style.height = "2112px";

    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = penSize.value;
  }
}

function drawBackgroundAndPaths() {
  if (!pencilCanvas.value || !ctx) return;

  // Utiliser requestAnimationFrame pour optimiser le rendu
  requestAnimationFrame(() => {
    // Sauvegarder l'état actuel du contexte
    ctx.save();

    // Effacer le canvas
    ctx.clearRect(0, 0, pencilCanvas.value.width, pencilCanvas.value.height);

    // Redessiner le background s'il existe
    if (backgroundImage) {
      ctx.drawImage(backgroundImage, 0, 0);
    }

    // Optimiser le rendu des chemins
    const batchSize = 50; // Nombre de chemins à dessiner par frame
    let currentIndex = 0;

    function drawNextBatch() {
      const endIndex = Math.min(currentIndex + batchSize, paths.length);

      for (let i = currentIndex; i < endIndex; i++) {
        const path = paths[i];
        ctx.globalCompositeOperation = path.isEraser
          ? "destination-out"
          : "source-over";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = path.size;
        ctx.beginPath();

        // Optimiser le dessin des points
        const points = path.points;
        if (points.length > 0) {
          ctx.moveTo(points[0].x, points[0].y);
          for (let j = 1; j < points.length; j++) {
            ctx.lineTo(points[j].x, points[j].y);
          }
        }

        ctx.stroke();
        ctx.closePath();
      }

      currentIndex = endIndex;
      if (currentIndex < paths.length) {
        requestAnimationFrame(drawNextBatch);
      } else {
        // Restaurer l'état du contexte une fois tous les chemins dessinés
        ctx.restore();
        // Réinitialiser le mode de dessin
        ctx.globalCompositeOperation = isEraser.value
          ? "destination-out"
          : "source-over";
      }
    }

    drawNextBatch();
  });
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

function isApplePencil(event) {
  // Vérifier si c'est un Apple Pencil
  return (
    event.touches.length === 1 &&
    event.touches[0].force > 0 &&
    event.touches[0].radiusX < 5
  );
}

function handleTouchStart(event) {
  if (isApplePencil(event)) {
    isDrawing = true;
    drawing = true;
    currentPath = [];
    const touch = event.touches[0];
    const rect = pencilCanvas.value.getBoundingClientRect();
    const px =
      (touch.clientX - rect.left) * (pencilCanvas.value.width / rect.width);
    const py =
      (touch.clientY - rect.top) * (pencilCanvas.value.height / rect.height);
    if (
      currentPath.length === 0 ||
      Math.hypot(
        px - currentPath[currentPath.length - 1].x,
        py - currentPath[currentPath.length - 1].y
      ) > 2
    ) {
      currentPath.push({ x: px, y: py });
      ctx.beginPath();
      ctx.moveTo(px, py);
      if (isEraser.value) {
        ctx.globalCompositeOperation = "destination-out";
      } else {
        ctx.globalCompositeOperation = "source-over";
      }
    }
  }
}

function handleTouchMove(event) {
  if (isDrawing && isApplePencil(event)) {
    const touch = event.touches[0];
    const rect = pencilCanvas.value.getBoundingClientRect();
    const px =
      (touch.clientX - rect.left) * (pencilCanvas.value.width / rect.width);
    const py =
      (touch.clientY - rect.top) * (pencilCanvas.value.height / rect.height);

    // Optimiser l'ajout des points
    if (
      currentPath.length === 0 ||
      Math.hypot(
        px - currentPath[currentPath.length - 1].x,
        py - currentPath[currentPath.length - 1].y
      ) > 2
    ) {
      currentPath.push({ x: px, y: py });
      ctx.lineTo(px, py);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = penSize.value;
      ctx.stroke();
    }
  }
}

function handleTouchEnd(event) {
  if (isDrawing) {
    isDrawing = false;
    drawing = false;
    ctx.closePath();
    if (currentPath.length > 1) {
      const simplifiedPaths = paths.map((path) => ({
        points: path.points.filter((_, i) => i % 2 === 0), // Réduire le nombre de points
        size: path.size,
        isEraser: path.isEraser,
      }));
      paths.push({
        points: [...currentPath],
        size: penSize.value,
        isEraser: isEraser.value,
      });
      undoStack.value.push(JSON.stringify(simplifiedPaths));
      redoStack.value = [];

      // Utiliser le debounce pour la sauvegarde
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      saveTimeout = setTimeout(async () => {
        await saveCanvasData();
        await saveCanvasImage();
        await saveBackgroundImage();
      }, SAVE_DELAY);
    }
    currentPath = [];
  }
  isScrolling = false;
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

// Optimiser saveCanvasData
async function saveCanvasData() {
  const examId = route.params.examId;
  if (!examId) return;
  try {
    // Limiter la taille des données sauvegardées
    const simplifiedPaths = paths.map((path) => ({
      points: path.points.filter((_, i) => i % 2 === 0), // Réduire le nombre de points
      size: path.size,
      isEraser: path.isEraser,
    }));

    await dbService.saveSection({
      examId: examId,
      name: `histoire-canvas-page-${currentPage.value}`,
      data: JSON.stringify(simplifiedPaths),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des annotations:", error);
  }
}

// Charger les paths depuis la base
async function loadCanvasData() {
  const examId = route.params.examId;
  if (!examId) return;
  try {
    // Charger le background
    const savedBackground = await dbService.getSection(
      examId,
      "histoire-canvas-background"
    );
    if (savedBackground && savedBackground.data) {
      backgroundImage = new Image();
      backgroundImage.onload = () => {
        // Redessiner le canvas avec le background et les annotations
        drawBackgroundAndPaths();
        // Charger les annotations
        loadAnnotations();
      };
      backgroundImage.src = savedBackground.data;
    } else {
      // Si pas de background sauvegardé, charger uniquement les annotations
      loadAnnotations();
    }
  } catch (error) {
    console.error("Erreur lors du chargement du background:", error);
    loadAnnotations();
  }
}

// Optimiser saveCanvasImage
async function saveCanvasImage() {
  const examId = route.params.examId;
  if (!examId || !pencilCanvas.value) return;
  try {
    // Réduire la qualité de l'image pour optimiser la performance
    const dataUrl = pencilCanvas.value.toDataURL("image/jpeg", 0.8);
    await dbService.saveSection({
      examId: examId,
      name: "histoire-canvas-image",
      data: dataUrl,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erreur lors de la sauvegarde de l'image:", error);
  }
}

watch(penSize, (newSize) => {
  if (ctx) ctx.lineWidth = newSize;
});

// Fonction pour calculer le scale optimal
const calculateOptimalScale = (viewport, containerWidth) => {
  const containerPadding = 40; // Marge de sécurité
  const availableWidth = containerWidth - containerPadding;
  return availableWidth / viewport.width;
};

// Charger la liste des PDFs disponibles
const loadPDFList = async () => {
  try {
    pdfList.value = await examService.getExamList();
    // Charger automatiquement le premier PDF de la liste
    if (pdfList.value.length > 0) {
      await loadPDF(pdfList.value[0].path);
    }
  } catch (error) {
    console.error("Erreur lors du chargement de la liste des PDFs:", error);
  }
};

// Charger le PDF sélectionné
const loadPDF = async (pdfPath) => {
  try {
    console.log("Chargement du PDF:", pdfPath);
    const pdfBlob = await examService.loadExamPDF(pdfPath);
    console.log("PDF chargé avec succès");

    const pdfUrl = URL.createObjectURL(pdfBlob);
    console.log("URL du PDF créée:", pdfUrl);

    // Convertir le PDF en image pour le canvas
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    console.log("Tâche de chargement PDF.js créée");

    const pdf = await loadingTask.promise;
    console.log("PDF.js a chargé le document");

    // Obtenir la taille du conteneur
    const container = document.querySelector(".canvas-container");
    const containerWidth = container.clientWidth;

    // Calculer la taille du canvas pour maintenir le ratio
    const firstPage = await pdf.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1.0 });

    // Stocker les dimensions originales du PDF
    originalPdfWidth = viewport.width;
    originalPdfHeight = viewport.height * pdf.numPages;
    currentScale = calculateOptimalScale(viewport, containerWidth);
    const scaledViewport = firstPage.getViewport({ scale: currentScale });

    // Calculer la hauteur totale pour toutes les pages
    const totalHeight = scaledViewport.height * pdf.numPages;

    // Mettre à jour le canvas principal
    if (pencilCanvas.value) {
      // Créer un canvas temporaire pour le rendu complet
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      tempCanvas.width = scaledViewport.width;
      tempCanvas.height = totalHeight;

      // Rendre chaque page sur le canvas temporaire
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const pageViewport = page.getViewport({ scale: currentScale });

        // Créer un canvas temporaire pour chaque page
        const pageCanvas = document.createElement("canvas");
        const pageCtx = pageCanvas.getContext("2d");
        pageCanvas.width = pageViewport.width;
        pageCanvas.height = pageViewport.height;

        // Rendre la page sur le canvas temporaire
        await page.render({
          canvasContext: pageCtx,
          viewport: pageViewport,
        }).promise;

        // Calculer la position Y pour cette page
        const yOffset = (pageNum - 1) * pageViewport.height;

        // Dessiner la page sur le canvas temporaire principal
        tempCtx.drawImage(pageCanvas, 0, yOffset);
      }

      // Mettre à jour le canvas principal avec les dimensions correctes
      pencilCanvas.value.width = scaledViewport.width;
      pencilCanvas.value.height = totalHeight;
      pencilCanvas.value.style.width = `${scaledViewport.width}px`;
      pencilCanvas.value.style.height = `${totalHeight}px`;

      // Effacer le canvas principal
      ctx.clearRect(0, 0, pencilCanvas.value.width, pencilCanvas.value.height);

      // Copier le contenu du canvas temporaire sur le canvas principal
      ctx.drawImage(tempCanvas, 0, 0);

      // Sauvegarder le background
      await saveBackgroundImage();

      // Réinitialiser les paramètres de dessin
      ctx.lineCap = "round";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = penSize.value;
      ctx.globalCompositeOperation = isEraser.value
        ? "destination-out"
        : "source-over";

      // Sauvegarder la référence de la fiche chargée
      loadedExamFile.value = pdfPath;
      selectedPDF.value = pdfPath;
      await saveLoadedExamFile();

      // Charger les annotations sauvegardées
      await loadCanvasData();

      // Nettoyer les canvas temporaires
      tempCanvas.remove();
    }

    // Nettoyer l'URL de l'objet
    URL.revokeObjectURL(pdfUrl);
    console.log("Chargement du PDF terminé avec succès");
  } catch (error) {
    console.error("Erreur détaillée lors du chargement du PDF:", error);
    alert("Erreur lors du chargement du PDF. Veuillez réessayer.");
  }
};

// Fonction pour annuler le chargement d'une nouvelle fiche
const cancelLoadPDF = () => {
  showConfirmDialog.value = false;
  pendingPDFPath.value = null;
};

// Fonction pour confirmer le chargement d'une nouvelle fiche
const confirmLoadPDF = async () => {
  if (pendingPDFPath.value) {
    await loadPDF(pendingPDFPath.value);
    showConfirmDialog.value = false;
    pendingPDFPath.value = null;
  }
};

onMounted(async () => {
  loadHistoryData(route.params.examId);
  const canvas = pencilCanvas.value;
  ctx = canvas.getContext("2d");
  await loadPDFList();

  // Charger la dernière fiche utilisée si elle existe
  const examId = route.params.examId;
  if (examId) {
    const savedExamFile = await dbService.getSection(
      examId,
      "loaded-exam-file"
    );
    if (savedExamFile && savedExamFile.data) {
      loadedExamFile.value = savedExamFile.data;
      selectedPDF.value = savedExamFile.data;
      await loadPDF(savedExamFile.data);
    }
  }

  const container = document.querySelector(".canvas-container");
  container.addEventListener("scroll", updateScrollbar);
  updateScrollbar();
});

watch(
  () => route.params.examId,
  async (newExamId) => {
    if (newExamId) {
      await loadHistoryData(newExamId);
      await loadCanvasData();
    }
  }
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

  try {
    const examId = route.params.examId;
    const exam = await dbService.getExam(examId);
    const patient = exam?.patient || {};
    const praticien = authService.getCurrentUser();
    const dateExamen = new Date(exam.createdAt).toLocaleDateString("fr-FR");

    // Charger le PDF original
    const pdfBlob = await examService.loadExamPDF(selectedPDF.value);
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const pdf = await pdfjsLib.getDocument(pdfUrl).promise;

    // Création du PDF portrait
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Pour chaque page du PDF
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      // Ajouter une nouvelle page si ce n'est pas la première
      if (pageNum > 1) {
        doc.addPage();
      }

      // Récupérer la page du PDF original
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });

      // Créer un canvas temporaire pour le PDF
      const pdfCanvas = document.createElement("canvas");
      const pdfCtx = pdfCanvas.getContext("2d");
      pdfCanvas.width = viewport.width;
      pdfCanvas.height = viewport.height;

      // Rendre la page sur le canvas temporaire
      await page.render({
        canvasContext: pdfCtx,
        viewport: viewport,
      }).promise;

      // Récupérer les annotations pour cette page
      const saved = await dbService.getSection(
        examId,
        `histoire-canvas-page-${pageNum}`
      );
      let pagePaths = [];
      if (saved && saved.data) {
        try {
          pagePaths = JSON.parse(saved.data);
        } catch (e) {
          console.error("Erreur lors du parsing des annotations:", e);
        }
      }

      // Créer un canvas pour les annotations
      const annotationCanvas = document.createElement("canvas");
      const annotationCtx = annotationCanvas.getContext("2d");
      annotationCanvas.width = viewport.width;
      annotationCanvas.height = viewport.height;

      // Dessiner les annotations avec les coordonnées originales
      for (const path of pagePaths) {
        annotationCtx.globalCompositeOperation = path.isEraser
          ? "destination-out"
          : "source-over";
        annotationCtx.strokeStyle = "#000";
        annotationCtx.lineWidth = path.size / currentScale; // Ajuster la taille du trait
        annotationCtx.beginPath();
        for (let i = 0; i < path.points.length; i++) {
          const pt = path.points[i];
          // Convertir les coordonnées du canvas d'affichage vers les coordonnées originales
          const originalX = pt.x / currentScale;
          const originalY = pt.y / currentScale;
          if (i === 0) {
            annotationCtx.moveTo(originalX, originalY);
          } else {
            annotationCtx.lineTo(originalX, originalY);
          }
        }
        annotationCtx.stroke();
        annotationCtx.closePath();
      }

      // Combiner le PDF et les annotations
      const combinedCanvas = document.createElement("canvas");
      const combinedCtx = combinedCanvas.getContext("2d");
      combinedCanvas.width = viewport.width;
      combinedCanvas.height = viewport.height;

      // Dessiner d'abord le PDF
      combinedCtx.drawImage(pdfCanvas, 0, 0);
      // Puis les annotations
      combinedCtx.drawImage(annotationCanvas, 0, 0);

      // Ajouter l'image combinée au PDF
      const imgData = combinedCanvas.toDataURL("image/png");
      const imgWidth = 190; // Largeur en mm
      const imgHeight = (viewport.height * imgWidth) / viewport.width;

      // Ajouter le titre et les informations uniquement sur la première page
      if (pageNum === 1) {
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
        doc.addImage(imgData, "PNG", 10, 35, imgWidth, imgHeight);
      } else {
        doc.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
      }
    }

    // Pied de page sur la dernière page
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("© 2024 Cabinet d'Optométrie - Tous droits réservés", 10, 290);

    // Convertir le PDF en Blob
    const finalPdfBlob = doc.output('blob');
    const fileName = `examen-${patient.prenom || ""}-${patient.nom || ""}-${examId}.pdf`;

    // Utiliser le service d'export
    const result = await nativePlatformService.handleFileExport(finalPdfBlob, fileName);
    
    if (nativePlatformService.isNativePlatform()) {
      // Le menu de partage s'affiche automatiquement, pas besoin de message
    }

    // Nettoyer
    URL.revokeObjectURL(pdfUrl);
  } catch (error) {
    console.error("Erreur lors de l'export du PDF:", error);
    alert("Erreur lors de l'export du PDF");
  }
}

// Ajout des gestionnaires d'événements souris
function onMouseDown(event) {
  const touch = {
    clientX: event.clientX,
    clientY: event.clientY,
    touchType: "stylus",
  };
  handleTouchStart({ touches: [touch] });
}

function onMouseMove(event) {
  if (!drawing) return;
  const touch = {
    clientX: event.clientX,
    clientY: event.clientY,
    touchType: "stylus",
  };
  handleTouchMove({ touches: [touch] });
}

function onMouseUp() {
  if (drawing) {
    handleTouchEnd({ touches: [] });
  }
}

function toggleEraser() {
  isEraser.value = !isEraser.value;
  if (ctx) {
    if (isEraser.value) {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
    }
  }
}

function updateScrollbar() {
  const container = document.querySelector(".canvas-container");
  const contentHeight = container.scrollHeight;
  const viewportHeight = container.clientHeight;
  const scrollTop = container.scrollTop;

  // Calculer la hauteur du thumb
  thumbHeight.value = (viewportHeight / contentHeight) * viewportHeight;

  // Calculer la position du thumb
  thumbTop.value = (scrollTop / contentHeight) * viewportHeight;
}

function startScrollDrag(event) {
  isDragging.value = true;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  startDragY.value = clientY;
  startScrollTop.value = document.querySelector(".canvas-container").scrollTop;

  if (event.touches) {
    document.addEventListener("touchmove", handleScrollDrag, {
      passive: false,
    });
    document.addEventListener("touchend", stopScrollDrag);
  } else {
    document.addEventListener("mousemove", handleScrollDrag);
    document.addEventListener("mouseup", stopScrollDrag);
  }
}

function handleScrollDrag(event) {
  if (!isDragging.value) return;

  event.preventDefault();
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  const container = document.querySelector(".canvas-container");
  const trackHeight = container.clientHeight;
  const deltaY = clientY - startDragY.value;
  const scrollRatio = deltaY / trackHeight;

  container.scrollTop =
    startScrollTop.value + scrollRatio * container.scrollHeight;
  updateScrollbar();
}

function stopScrollDrag() {
  isDragging.value = false;
  document.removeEventListener("mousemove", handleScrollDrag);
  document.removeEventListener("mouseup", stopScrollDrag);
  document.removeEventListener("touchmove", handleScrollDrag);
  document.removeEventListener("touchend", stopScrollDrag);
}

// Sauvegarder la référence de la fiche chargée
const saveLoadedExamFile = async () => {
  if (loadedExamFile.value) {
    const examId = route.params.examId;
    await dbService.saveSection({
      examId: examId,
      name: "loaded-exam-file",
      data: loadedExamFile.value,
      updatedAt: new Date().toISOString(),
    });
  }
};

// Fonction pour effacer la fiche chargée
const clearLoadedExam = async () => {
  if (
    confirm(
      "Voulez-vous vraiment effacer la fiche d'examen chargée ? Les annotations seront perdues."
    )
  ) {
    loadedExamFile.value = null;
    selectedPDF.value = null;
    currentPDF = null;
    pdfImages.clear();
    paths = [];
    undoStack.value = [];
    redoStack.value = [];
    currentPage.value = 1;
    totalPages.value = 1;
    backgroundImage = null;
    if (ctx) {
      ctx.clearRect(0, 0, pencilCanvas.value.width, pencilCanvas.value.height);
    }
    // Supprimer le background sauvegardé
    const examId = route.params.examId;
    if (examId) {
      await dbService.deleteSection(examId, "histoire-canvas-background");
    }
    await saveLoadedExamFile();
  }
};

// Ajouter une nouvelle fonction pour sauvegarder le background
async function saveBackgroundImage() {
  const examId = route.params.examId;
  if (!examId || !pencilCanvas.value) return;
  try {
    // Créer un canvas temporaire pour le background uniquement
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = pencilCanvas.value.width;
    tempCanvas.height = pencilCanvas.value.height;

    // Copier le contenu du canvas principal
    tempCtx.drawImage(pencilCanvas.value, 0, 0);

    // Sauvegarder l'image du background
    const dataUrl = tempCanvas.toDataURL("image/png");
    await dbService.saveSection({
      examId: examId,
      name: "histoire-canvas-background",
      data: dataUrl,
      updatedAt: new Date().toISOString(),
    });

    // Stocker l'image en mémoire
    backgroundImage = new Image();
    backgroundImage.src = dataUrl;
  } catch (error) {
    console.error("Erreur lors de la sauvegarde du background:", error);
  }
}

// Nouvelle fonction pour charger les annotations
async function loadAnnotations() {
  const examId = route.params.examId;
  if (!examId) return;
  try {
    const saved = await dbService.getSection(
      examId,
      `histoire-canvas-page-${currentPage.value}`
    );
    if (saved && saved.data) {
      try {
        paths = JSON.parse(saved.data);
        // On reconstruit l'historique pour permettre undo/redo sur l'état chargé
        undoStack.value = [JSON.stringify(paths)];
        redoStack.value = [];
        // Redessiner les chemins
        requestAnimationFrame(() => {
          drawBackgroundAndPaths();
        });
      } catch (e) {
        console.error("Erreur lors du parsing des données:", e);
        paths = [];
        undoStack.value = [];
        redoStack.value = [];
      }
    } else {
      paths = [];
      undoStack.value = [];
      redoStack.value = [];
    }
  } catch (error) {
    console.error("Erreur lors du chargement des annotations:", error);
    alert("Erreur lors du chargement des annotations");
    paths = [];
    undoStack.value = [];
    redoStack.value = [];
  }
}
</script>

<style scoped>
.canvas-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  height: 100%;
  max-height: calc(100vh - 64px); /* Hauteur de la barre d'application */
  overflow: hidden;
}

.canvas-container {
  width: 816px;
  height: 100%;
  max-height: calc(100vh - 64px);
  overflow-y: hidden;
  background-color: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-outline));
  position: relative;
  touch-action: none;
}

.scrollbar-container {
  width: 32px;
  height: 100%;
  max-height: calc(100vh - 64px);
  position: relative;
  display: flex;
  align-items: center;
}

.scrollbar-track {
  width: 100%;
  height: 90%;
  background-color: rgba(var(--v-theme-surface), 0.5);
  border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 16px;
  position: relative;
  margin: auto;
}

.scrollbar-thumb {
  width: 100%;
  background-color: rgb(var(--v-theme-primary));
  border-radius: 16px;
  position: absolute;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.8;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}

.scrollbar-thumb:hover {
  opacity: 1;
  background-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 8px rgba(var(--v-theme-primary), 0.5);
}

.drawing-area {
  position: relative;
  touch-action: pan-y;
  background-color: rgb(var(--v-theme-surface));
  width: 816px;
  -webkit-user-select: none;
  user-select: none;
}

.drawing-area canvas {
  display: block;
  touch-action: pan-y;
  -webkit-user-select: none;
  user-select: none;
}

/* Styles pour la barre de défilement */
.canvas-container::-webkit-scrollbar {
  width: 20px;
}

.canvas-container::-webkit-scrollbar-track {
  background: rgb(var(--v-theme-surface));
  border-left: 1px solid rgb(var(--v-theme-outline));
}

.canvas-container::-webkit-scrollbar-thumb {
  background: rgb(var(--v-theme-outline));
  border-radius: 10px;
  border: 4px solid rgb(var(--v-theme-surface));
}

.canvas-container::-webkit-scrollbar-thumb:hover {
  background: rgb(var(--v-theme-outline));
  opacity: 0.8;
}

/* Styles spécifiques pour iPad */
@media only screen and (min-device-width: 768px) and (max-device-width: 1024px) {
  .canvas-wrapper {
    max-height: calc(
      100vh - 120px
    ); /* Ajustement pour les barres du navigateur iPad */
  }

  .canvas-container {
    max-height: calc(100vh - 120px);
  }

  .scrollbar-container {
    max-height: calc(100vh - 120px);
  }
}

/* Ajustements pour le mode paysage */
@media (orientation: landscape) {
  .canvas-wrapper {
    max-height: calc(100vh - 80px);
  }

  .canvas-container {
    max-height: calc(100vh - 80px);
  }

  .scrollbar-container {
    max-height: calc(100vh - 80px);
  }
}

/* Ajustements pour le mode portrait */
@media (orientation: portrait) {
  .canvas-wrapper {
    max-height: calc(100vh - 120px);
  }

  .canvas-container {
    max-height: calc(100vh - 120px);
  }

  .scrollbar-container {
    max-height: calc(100vh - 120px);
  }
}

/* Ajustements pour le conteneur principal */
:deep(.v-container) {
  height: calc(100vh - 64px);
  overflow: hidden;
}

:deep(.v-main) {
  overflow: hidden;
}

:deep(.v-card) {
  max-height: fit-content;
}

:deep(.v-card-text) {
  padding: 16px;
}
</style>
