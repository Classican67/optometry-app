<template>
  <v-container fluid>
    <v-row>
      <!-- Menu latéral -->
      <v-col cols="3">
        <v-card>
          <v-card-title>Documents de référence</v-card-title>
          <v-card-text>
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
              label="Sélectionner un document"
              item-title="name"
              item-value="path"
              @update:model-value="confirmLoadPDF"
            ></v-select>

            <v-divider class="my-4"></v-divider>

            <v-btn
              color="error"
              block
              class="mb-2"
              @click="clearCanvas"
              size="large"
            >
              Effacer
            </v-btn>

            <v-btn
              color="primary"
              block
              class="mb-2"
              @click="exportPDF"
              size="large"
            >
              Exporter le PDF
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

            <v-btn
              block
              class="mb-2"
              color="secondary"
              @click="addPatientLabel"
              size="large"
            >
              <v-icon start>mdi-label</v-icon>
              Étiquette Patient
            </v-btn>

            <v-btn
              block
              class="mb-2"
              color="secondary"
              @click="addOptoLabel"
              size="large"
            >
              <v-icon start>mdi-account-tie</v-icon>
              Étiquette Opto
            </v-btn>

            <v-btn
              block
              class="mb-2"
              color="info"
              @click="showTextDialog = true"
              size="large"
            >
              <v-icon start>mdi-text-box</v-icon>
              Ajouter Texte
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Zone de dessin -->
      <v-col cols="9">
        <v-card>
          <v-card-text>
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

    <!-- Dialog pour les champs de texte -->
    <v-dialog v-model="showTextFieldDialog" max-width="500">
      <v-card>
        <v-card-title>Modifier le champ</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="currentFieldValue"
            :label="currentFieldLabel"
            @input="updatePDFField"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="showTextFieldDialog = false">
            Fermer
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog pour ajouter du texte -->
    <v-dialog v-model="showTextDialog" max-width="500">
      <v-card>
        <v-card-title>Ajouter du texte</v-card-title>
        <v-card-text>
          <v-textarea
            v-model="newText"
            label="Votre texte"
            rows="4"
            auto-grow
          ></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" @click="showTextDialog = false"> Annuler </v-btn>
          <v-btn color="primary" @click="addTextLabel"> Valider </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { authService } from "../services/auth";
import { dbService } from "../services/db";
import { referenceService } from "../services/referenceService";
import { Capacitor } from '@capacitor/core';

// Configuration du worker PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

const route = useRoute();
const router = useRouter();
const selectedPDF = ref(null);
const loadedExamFile = ref(null);
const pdfList = ref([]);
const pencilCanvas = ref(null);
const isEraser = ref(false);
const penSize = ref(2);
const showTextFieldDialog = ref(false);
const currentFieldValue = ref("");
const currentFieldLabel = ref("");
const currentFieldId = ref(null);
const showTextDialog = ref(false);
const newText = ref("");

// Variables pour le canvas
let ctx = null;
let drawing = false;
let undoStack = ref([]);
let redoStack = ref([]);
let currentPath = [];
let paths = [];

// Variables pour la barre de défilement
const thumbHeight = ref(0);
const thumbTop = ref(0);
const isDragging = ref(false);
const startDragY = ref(0);
const startScrollTop = ref(0);

// Variables pour les étiquettes
const labels = ref([]);

// Modifier les variables pour l'étiquette patient
const patientLabel = ref({
  x: 50,
  y: 50,
  width: 250,
  height: 140,
  isDragging: false,
  isResizing: false,
  dragOffset: { x: 0, y: 0 },
  resizeStart: { x: 0, y: 0, width: 0, height: 0 },
});

// Ajouter une référence pour l'élément DOM de l'étiquette
const labelElement = ref(null);

const patientInfo = ref({
  nom: "Nom",
  prenom: "Prénom",
  dateNaissance: "Date de naissance",
  telephone: "Téléphone",
  courriel: "Courriel",
  adresse: "Adresse",
});

// Ajouter les variables pour l'étiquette opto
const optoLabel = ref({
  x: 50,
  y: 200,
  width: 250,
  height: 140,
  isDragging: false,
  isResizing: false,
  dragOffset: { x: 0, y: 0 },
  resizeStart: { x: 0, y: 0, width: 0, height: 0 },
});

const optoElement = ref(null);

const optoInfo = ref({
  nom: "",
  prenom: "",
  adresse: "",
  telephone: "",
  fax: "",
  email: "",
});

// Ajouter les variables pour l'étiquette de texte
const textLabel = ref({
  x: 50,
  y: 50,
  width: 250,
  height: 140,
  isDragging: false,
  isResizing: false,
  dragOffset: { x: 0, y: 0 },
  resizeStart: { x: 0, y: 0, width: 0, height: 0 },
});

// Ajouter une référence pour l'élément DOM de l'étiquette de texte
const textElement = ref(null);

// Fonction pour calculer le scale optimal
const calculateOptimalScale = (viewport, containerWidth) => {
  const containerPadding = 40; // Marge de sécurité
  const availableWidth = containerWidth - containerPadding;
  return availableWidth / viewport.width;
};

// Charger la liste des PDFs disponibles
const loadPDFList = async () => {
  try {
    pdfList.value = await referenceService.getPDFList();
  } catch (error) {
    console.error("Erreur lors du chargement de la liste des PDFs:", error);
  }
};

// Méthode pour confirmer le chargement du PDF
const confirmLoadPDF = (pdfPath) => {
  if (pdfPath) {
    const pdfName = pdfList.value.find((pdf) => pdf.path === pdfPath)?.name;
    if (confirm(`Voulez-vous charger le document "${pdfName}" ?`)) {
      loadPDF(pdfPath);
    } else {
      selectedPDF.value = null;
    }
  }
};

// Fonction pour obtenir les étiquettes
const getLabels = () => {
  return labels.value;
};

// Fonction pour ajouter une étiquette
const addLabel = (type, position) => {
  labels.value.push({
    type,
    position,
    id: Date.now(), // Identifiant unique
  });
};

// Fonction pour supprimer une étiquette
const removeLabel = (id) => {
  labels.value = labels.value.filter((label) => label.id !== id);
};

// Méthode pour charger le PDF
const loadPDF = async (pdfPath) => {
  loadedExamFile.value = pdfPath;
  try {
    console.log("Chargement du PDF:", pdfPath);
    const pdfBlob = await referenceService.loadPDF(pdfPath);
    console.log("PDF chargé avec succès");

    const pdfUrl = URL.createObjectURL(pdfBlob);
    console.log("URL du PDF créée:", pdfUrl);

    // Convertir le PDF en image pour le canvas
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    console.log("Tâche de chargement PDF.js créée");

    const pdf = await loadingTask.promise;
    console.log("PDF.js a chargé le document");

    const page = await pdf.getPage(1);
    console.log("Première page récupérée");

    // Obtenir la taille du conteneur
    const container = document.querySelector(".canvas-container");
    const containerWidth = container.clientWidth;

    // Calculer la taille du canvas pour maintenir le ratio
    const viewport = page.getViewport({ scale: 1.0 });
    const optimalScale = calculateOptimalScale(viewport, containerWidth);
    const scaledViewport = page.getViewport({ scale: optimalScale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    console.log("Rendu de la page sur le canvas");
    // Rendre la page sur le canvas
    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
    }).promise;

    console.log("Mise à jour du canvas principal");
    // Mettre à jour le canvas principal
    if (pencilCanvas.value) {
      pencilCanvas.value.width = scaledViewport.width;
      pencilCanvas.value.height = scaledViewport.height;
      pencilCanvas.value.style.width = `${scaledViewport.width}px`;
      pencilCanvas.value.style.height = `${scaledViewport.height}px`;

      // Copier l'image du PDF sur le canvas principal
      ctx.drawImage(canvas, 0, 0);

      // Réinitialiser les paramètres de dessin
      ctx.lineCap = "round";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = penSize.value;
      ctx.globalCompositeOperation = isEraser.value
        ? "destination-out"
        : "source-over";
    }

    // Restaurer les annotations et étiquettes sauvegardées
    const savedData = localStorage.getItem(`reference_${pdfPath}`);
    if (savedData) {
      const { annotations, labels: savedLabels } = JSON.parse(savedData);
      if (annotations && pencilCanvas.value) {
        // Restaurer les annotations
        pencilCanvas.value.loadAnnotations?.(annotations);
      }
      if (savedLabels) {
        // Restaurer les étiquettes
        labels.value = savedLabels;
      }
    }

    // Nettoyer l'URL de l'objet
    URL.revokeObjectURL(pdfUrl);
    console.log("Chargement du PDF terminé avec succès");

    return true; // Indiquer que le chargement est terminé
  } catch (error) {
    console.error("Erreur détaillée lors du chargement du PDF:", error);
    alert("Erreur lors du chargement du PDF. Veuillez réessayer.");
    return false;
  }
};

function drawBackgroundAndPaths() {
  if (!pencilCanvas.value || !ctx) return;

  // Ne pas effacer le canvas, seulement redessiner les chemins
  for (const path of paths) {
    ctx.globalCompositeOperation = path.isEraser
      ? "destination-out"
      : "source-over";
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

  // Réinitialiser le mode de dessin
  ctx.globalCompositeOperation = isEraser.value
    ? "destination-out"
    : "source-over";
}

function isApplePencil(event) {
  return (
    event.touches.length === 1 &&
    event.touches[0].force > 0 &&
    event.touches[0].radiusX < 5
  );
}

function handleTouchStart(event) {
  if (isApplePencil(event)) {
    drawing = true;
    currentPath = [];
    const touch = event.touches[0];
    const rect = pencilCanvas.value.getBoundingClientRect();
    const px = touch.clientX - rect.left;
    const py = touch.clientY - rect.top;
    currentPath.push({ x: px, y: py });
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.globalCompositeOperation = isEraser.value
      ? "destination-out"
      : "source-over";
  }
}

function handleTouchMove(event) {
  if (drawing && isApplePencil(event)) {
    const touch = event.touches[0];
    const rect = pencilCanvas.value.getBoundingClientRect();
    const px = touch.clientX - rect.left;
    const py = touch.clientY - rect.top;
    currentPath.push({ x: px, y: py });
    ctx.lineTo(px, py);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = penSize.value;
    ctx.stroke();
  }
}

function handleTouchEnd(event) {
  if (drawing) {
    drawing = false;
    ctx.closePath();
    if (currentPath.length > 1) {
      paths.push({
        points: [...currentPath],
        size: penSize.value,
        isEraser: isEraser.value,
      });
      undoStack.value.push(JSON.stringify(paths));
      redoStack.value = [];
    }
    currentPath = [];
  }
}

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

function undo() {
  if (undoStack.value.length > 0) {
    redoStack.value.push(JSON.stringify(paths));
    undoStack.value.pop();
    paths =
      undoStack.value.length > 0
        ? JSON.parse(undoStack.value[undoStack.value.length - 1])
        : [];
    drawBackgroundAndPaths();
  }
}

function redo() {
  if (redoStack.value.length > 0) {
    undoStack.value.push(redoStack.value[redoStack.value.length - 1]);
    paths = JSON.parse(redoStack.value.pop());
    drawBackgroundAndPaths();
  }
}

function clearCanvas() {
  paths = [];
  undoStack.value = [];
  redoStack.value = [];
  drawBackgroundAndPaths();
}

function toggleEraser() {
  isEraser.value = !isEraser.value;
  if (ctx) {
    ctx.globalCompositeOperation = isEraser.value
      ? "destination-out"
      : "source-over";
  }
}

function updateScrollbar() {
  const container = document.querySelector(".canvas-container");
  const contentHeight = container.scrollHeight;
  const viewportHeight = container.clientHeight;
  const scrollTop = container.scrollTop;

  thumbHeight.value = (viewportHeight / contentHeight) * viewportHeight;
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

async function exportPDF() {
  try {
    const canvas = pencilCanvas.value;
    const imgData = canvas.toDataURL("image/png");

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    tempCtx.drawImage(canvas, 0, 0);

    // Dessiner l'étiquette patient si elle existe
    if (labelElement.value) {
      const labelCanvas = await html2canvas(labelElement.value, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: patientLabel.value.width,
        height: patientLabel.value.height,
      });

      tempCtx.drawImage(
        labelCanvas,
        patientLabel.value.x,
        patientLabel.value.y,
        patientLabel.value.width,
        patientLabel.value.height
      );
    }

    // Dessiner l'étiquette opto si elle existe
    if (optoElement.value) {
      const optoCanvas = await html2canvas(optoElement.value, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: optoLabel.value.width,
        height: optoLabel.value.height,
      });

      tempCtx.drawImage(
        optoCanvas,
        optoLabel.value.x,
        optoLabel.value.y,
        optoLabel.value.width,
        optoLabel.value.height
      );
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(
      tempCanvas.toDataURL("image/png"),
      "PNG",
      0,
      0,
      imgWidth,
      imgHeight
    );

    // Convertir le PDF en Blob
    const pdfBlob = pdf.output('blob');
    const fileName = `document_annote_${new Date().getTime()}.pdf`;

    // Utiliser le service d'export
    const result = await referenceService.exportPDF(pdfBlob, fileName);
    
    if (Capacitor.isNativePlatform()) {
      alert(`Le document a été sauvegardé dans vos documents : ${result}`);
    }
  } catch (error) {
    console.error("Erreur lors de l'export du PDF:", error);
    alert("Erreur lors de l'export du PDF");
  }
}

// Mettre à jour un champ du PDF
const updatePDFField = (value) => {
  if (currentFieldId.value) {
    referenceService.updateField(currentFieldId.value, value);
  }
};

// Ouvrir le dialog pour modifier un champ
const openTextFieldDialog = (fieldId, label, value) => {
  currentFieldId.value = fieldId;
  currentFieldLabel.value = label;
  currentFieldValue.value = value;
  showTextFieldDialog.value = true;
};

watch(penSize, (newSize) => {
  if (ctx) ctx.lineWidth = newSize;
});

// Modifier la fonction addPatientLabel
async function addPatientLabel() {
  try {
    // Récupérer l'ID de l'examen depuis la route
    const examId = route.params.examId;
    if (!examId) {
      console.error("Aucun ID d'examen trouvé");
      return;
    }

    // Récupérer les informations du patient depuis la base de données
    const exam = await dbService.getExam(examId);
    if (exam && exam.patient) {
      patientInfo.value = {
        nom: exam.patient.nom || "Non renseigné",
        prenom: exam.patient.prenom || "Non renseigné",
        dateNaissance: exam.patient.dateNaissance || "Non renseignée",
        telephone: exam.patient.telephone || "Non renseigné",
        courriel: exam.patient.courriel || "Non renseigné",
        adresse: exam.patient.adresse || "Non renseignée",
      };
    }

    // Supprimer l'ancienne étiquette si elle existe
    if (labelElement.value) {
      labelElement.value.remove();
    }

    // Créer l'élément DOM de l'étiquette
    const element = document.createElement("div");
    element.className = "patient-label";
    element.style.position = "absolute";
    element.style.left = patientLabel.value.x + "px";
    element.style.top = patientLabel.value.y + "px";
    element.style.width = patientLabel.value.width + "px";
    element.style.height = patientLabel.value.height + "px";
    element.style.cursor = "move";
    element.style.zIndex = "1000";
    element.style.userSelect = "none";
    element.style.touchAction = "none";

    // Ajouter le contenu de l'étiquette
    element.innerHTML = `
      <div class="label-content" style="
        width: 100%;
        height: 100%;
        background: white;
        border: 2px solid #1976D2;
        border-radius: 4px;
        padding: 8px;
        box-sizing: border-box;
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: calc(12px * (${patientLabel.value.width} / 250));
      ">
        <div style="
          font-weight: bold;
          font-size: calc(16px * (${patientLabel.value.width} / 250));
          color: #1976D2;
          border-bottom: 1px solid #1976D2;
          padding-bottom: 2px;
        ">
          ${patientInfo.value.nom} ${patientInfo.value.prenom}
        </div>
        <div style="
          display: flex;
          flex-direction: column;
          gap: 2px;
        ">
          <div style="display: flex; align-items: center; gap: 6px;">
            <svg width="calc(14px * (${patientLabel.value.width} / 250))" height="calc(14px * (${patientLabel.value.width} / 250))" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: #1976D2;">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="currentColor"/>
            </svg>
            ${patientInfo.value.dateNaissance}
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <svg width="calc(14px * (${patientLabel.value.width} / 250))" height="calc(14px * (${patientLabel.value.width} / 250))" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: #1976D2;">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="currentColor"/>
            </svg>
            ${patientInfo.value.telephone}
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <svg width="calc(14px * (${patientLabel.value.width} / 250))" height="calc(14px * (${patientLabel.value.width} / 250))" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: #1976D2;">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="currentColor"/>
            </svg>
            ${patientInfo.value.courriel}
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <svg width="calc(14px * (${patientLabel.value.width} / 250))" height="calc(14px * (${patientLabel.value.width} / 250))" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: #1976D2;">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
            </svg>
            ${patientInfo.value.adresse}
          </div>
        </div>
        <div class="resize-handle" style="
          position: absolute;
          right: 0;
          bottom: 0;
          width: calc(20px * (${patientLabel.value.width} / 250));
          height: calc(20px * (${patientLabel.value.width} / 250));
          background: #1976D2;
          border-radius: 0 0 4px 0;
          cursor: nwse-resize;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        ">
          <svg width="calc(14px * (${patientLabel.value.width} / 250))" height="calc(14px * (${patientLabel.value.width} / 250))" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM18 18H16V16H18V18ZM14 22H12V20H14V22ZM22 14H20V12H22V14Z" fill="currentColor"/>
          </svg>
        </div>
        <div class="delete-handle" style="
          position: absolute;
          right: 0;
          top: 0;
          width: calc(20px * (${patientLabel.value.width} / 250));
          height: calc(20px * (${patientLabel.value.width} / 250));
          background: #ff5252;
          border-radius: 0 4px 0 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        ">
          <svg width="calc(14px * (${patientLabel.value.width} / 250))" height="calc(14px * (${patientLabel.value.width} / 250))" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
          </svg>
        </div>
      </div>
    `;

    // Ajouter les gestionnaires d'événements
    element.addEventListener("mousedown", startDragLabel);
    element.addEventListener("touchstart", startDragLabel, {
      passive: false,
    });

    const resizeHandle = element.querySelector(".resize-handle");
    resizeHandle.addEventListener("mousedown", startResizeLabel);
    resizeHandle.addEventListener("touchstart", startResizeLabel, {
      passive: false,
    });

    // Ajouter le gestionnaire de suppression
    const deleteHandle = element.querySelector(".delete-handle");

    // Gestionnaire pour les événements tactiles
    deleteHandle.addEventListener(
      "touchstart",
      (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (confirm("Voulez-vous supprimer l'étiquette ?")) {
          removePatientLabel();
        }
      },
      { passive: false }
    );

    // Gestionnaire pour les événements souris
    deleteHandle.addEventListener("click", (event) => {
      event.stopPropagation();
      if (confirm("Voulez-vous supprimer l'étiquette ?")) {
        removePatientLabel();
      }
    });

    document.querySelector(".drawing-area").appendChild(element);
    labelElement.value = element;
  } catch (error) {
    console.error("Erreur lors de l'ajout de l'étiquette:", error);
    alert("Erreur lors de l'ajout de l'étiquette");
  }
}

// Modifier les fonctions de drag & drop
function startDragLabel(event) {
  if (event.target.classList.contains("resize-handle")) return;

  const touch = event.touches ? event.touches[0] : event;
  patientLabel.value.isDragging = true;
  patientLabel.value.dragOffset = {
    x: touch.clientX - patientLabel.value.x,
    y: touch.clientY - patientLabel.value.y,
  };

  if (event.touches) {
    document.addEventListener("touchmove", onDragLabel, { passive: false });
    document.addEventListener("touchend", stopDragLabel);
  } else {
    document.addEventListener("mousemove", onDragLabel);
    document.addEventListener("mouseup", stopDragLabel);
  }
}

function onDragLabel(event) {
  if (!patientLabel.value.isDragging) return;

  const touch = event.touches ? event.touches[0] : event;
  const newX = touch.clientX - patientLabel.value.dragOffset.x;
  const newY = touch.clientY - patientLabel.value.dragOffset.y;

  // Mettre à jour la position de l'élément DOM
  if (labelElement.value) {
    labelElement.value.style.left = newX + "px";
    labelElement.value.style.top = newY + "px";
  }

  // Mettre à jour la position dans l'état
  patientLabel.value.x = newX;
  patientLabel.value.y = newY;

  if (event.touches) {
    event.preventDefault();
  }
}

function startResizeLabel(event) {
  event.stopPropagation();

  const touch = event.touches ? event.touches[0] : event;
  patientLabel.value.isResizing = true;
  patientLabel.value.resizeStart = {
    x: touch.clientX,
    y: touch.clientY,
    width: patientLabel.value.width,
    height: patientLabel.value.height,
  };

  if (event.touches) {
    document.addEventListener("touchmove", onResizeLabel, { passive: false });
    document.addEventListener("touchend", stopResizeLabel);
  } else {
    document.addEventListener("mousemove", onResizeLabel);
    document.addEventListener("mouseup", stopResizeLabel);
  }
}

function onResizeLabel(event) {
  if (!patientLabel.value.isResizing) return;

  const touch = event.touches ? event.touches[0] : event;
  const dx = touch.clientX - patientLabel.value.resizeStart.x;
  const dy = touch.clientY - patientLabel.value.resizeStart.y;

  const newWidth = Math.max(250, patientLabel.value.resizeStart.width + dx);
  const newHeight = Math.max(100, patientLabel.value.resizeStart.height + dy);

  // Mettre à jour la taille de l'élément DOM
  if (labelElement.value) {
    labelElement.value.style.width = newWidth + "px";
    labelElement.value.style.height = newHeight + "px";
  }

  // Mettre à jour la taille dans l'état
  patientLabel.value.width = newWidth;
  patientLabel.value.height = newHeight;

  if (event.touches) {
    event.preventDefault();
  }
}

function stopDragLabel() {
  patientLabel.value.isDragging = false;
  document.removeEventListener("mousemove", onDragLabel);
  document.removeEventListener("mouseup", stopDragLabel);
  document.removeEventListener("touchmove", onDragLabel);
  document.removeEventListener("touchend", stopDragLabel);
}

function stopResizeLabel() {
  patientLabel.value.isResizing = false;
  document.removeEventListener("mousemove", onResizeLabel);
  document.removeEventListener("mouseup", stopResizeLabel);
  document.removeEventListener("touchmove", onResizeLabel);
  document.removeEventListener("touchend", stopResizeLabel);
}

// Ajouter une fonction pour supprimer l'étiquette
function removePatientLabel() {
  if (labelElement.value) {
    // Supprimer tous les écouteurs d'événements
    const deleteHandle = labelElement.value.querySelector(".delete-handle");
    if (deleteHandle) {
      deleteHandle.removeEventListener("touchstart", () => {});
      deleteHandle.removeEventListener("click", () => {});
    }

    const resizeHandle = labelElement.value.querySelector(".resize-handle");
    if (resizeHandle) {
      resizeHandle.removeEventListener("touchstart", () => {});
      resizeHandle.removeEventListener("mousedown", () => {});
    }

    // Supprimer l'élément du DOM
    labelElement.value.remove();
    labelElement.value = null;

    // Réinitialiser l'état
    patientLabel.value = {
      x: 50,
      y: 50,
      width: 250,
      height: 140,
      isDragging: false,
      isResizing: false,
      dragOffset: { x: 0, y: 0 },
      resizeStart: { x: 0, y: 0, width: 0, height: 0 },
    };
  }
}

// Ajouter la fonction pour créer l'étiquette opto
async function addOptoLabel() {
  try {
    // Récupérer les informations de l'utilisateur connecté
    const user = await dbService.getUserByUsername(
      authService.getCurrentUser()?.username
    );
    if (!user) {
      console.error("Utilisateur non trouvé");
      return;
    }

    // Mettre à jour les informations de l'optométriste
    optoInfo.value = {
      nom: user.nom || "",
      prenom: user.prenom || "",
      adresse: user.adresse || "",
      telephone: user.telephone || "",
      fax: user.fax || "",
      email: user.email || "",
    };

    // Supprimer l'ancienne étiquette si elle existe
    if (optoElement.value) {
      optoElement.value.remove();
    }

    // Créer l'élément DOM de l'étiquette
    const element = document.createElement("div");
    element.className = "opto-label";
    element.style.position = "absolute";
    element.style.left = optoLabel.value.x + "px";
    element.style.top = optoLabel.value.y + "px";
    element.style.width = optoLabel.value.width + "px";
    element.style.height = optoLabel.value.height + "px";
    element.style.cursor = "move";
    element.style.zIndex = "1000";
    element.style.userSelect = "none";
    element.style.touchAction = "none";

    // Ajouter le contenu de l'étiquette
    element.innerHTML = `
      <div class="label-content" style="
        width: 100%;
        height: 100%;
        background: white;
        border: 2px solid #4CAF50;
        border-radius: 4px;
        padding: 8px;
        box-sizing: border-box;
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: calc(12px * (${optoLabel.value.width} / 250));
      ">
        <div style="
          font-weight: bold;
          font-size: calc(16px * (${optoLabel.value.width} / 250));
          color: #4CAF50;
          border-bottom: 1px solid #4CAF50;
          padding-bottom: 2px;
        ">
          ${optoInfo.value.nom} ${optoInfo.value.prenom}
        </div>
        <div style="
          display: flex;
          flex-direction: column;
          gap: 2px;
        ">
          ${
            optoInfo.value.adresse
              ? `
            <div style="display: flex; align-items: center; gap: 6px;">
              <svg width="calc(14px * (${optoLabel.value.width} / 250))" height="calc(14px * (${optoLabel.value.width} / 250))" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: #4CAF50;">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
              </svg>
              ${optoInfo.value.adresse}
            </div>
          `
              : ""
          }
          ${
            optoInfo.value.telephone
              ? `
            <div style="display: flex; align-items: center; gap: 6px;">
              <svg width="calc(14px * (${optoLabel.value.width} / 250))" height="calc(14px * (${optoLabel.value.width} / 250))" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: #4CAF50;">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="currentColor"/>
              </svg>
              ${optoInfo.value.telephone}
            </div>
          `
              : ""
          }
          ${
            optoInfo.value.fax
              ? `
            <div style="display: flex; align-items: center; gap: 6px;">
              <svg width="calc(14px * (${optoLabel.value.width} / 250))" height="calc(14px * (${optoLabel.value.width} / 250))" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: #4CAF50;">
                <path d="M22 3H2C.9 3 0 3.9 0 5v14c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H2V5h20v14zM19 9h-4c-.55 0-1-.45-1-1s.45-1 1-1h4c.55 0 1 .45 1 1s-.45 1-1 1zm0 4h-4c-.55 0-1-.45-1-1s.45-1 1-1h4c.55 0 1 .45 1 1s-.45 1-1 1zm0 4h-4c-.55 0-1-.45-1-1s.45-1 1-1h4c.55 0 1 .45 1 1s-.45 1-1 1zM9 9H5c-.55 0-1-.45-1-1s.45-1 1-1h4c.55 0 1 .45 1 1s-.45 1-1 1zm0 4H5c-.55 0-1-.45-1-1s.45-1 1-1h4c.55 0 1 .45 1 1s-.45 1-1 1zm0 4H5c-.55 0-1-.45-1-1s.45-1 1-1h4c.55 0 1 .45 1 1s-.45 1-1 1z" fill="currentColor"/>
              </svg>
              ${optoInfo.value.fax}
            </div>
          `
              : ""
          }
          ${
            optoInfo.value.email
              ? `
            <div style="display: flex; align-items: center; gap: 6px;">
              <svg width="calc(14px * (${optoLabel.value.width} / 250))" height="calc(14px * (${optoLabel.value.width} / 250))" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: #4CAF50;">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="currentColor"/>
              </svg>
              ${optoInfo.value.email}
            </div>
          `
              : ""
          }
        </div>
        <div class="resize-handle" style="
          position: absolute;
          right: 0;
          bottom: 0;
          width: calc(20px * (${optoLabel.value.width} / 250));
          height: calc(20px * (${optoLabel.value.width} / 250));
          background: #4CAF50;
          border-radius: 0 0 4px 0;
          cursor: nwse-resize;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        ">
          <svg width="calc(14px * (${optoLabel.value.width} / 250))" height="calc(14px * (${optoLabel.value.width} / 250))" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM18 18H16V16H18V18ZM14 22H12V20H14V22ZM22 14H20V12H22V14Z" fill="currentColor"/>
          </svg>
        </div>
        <div class="delete-handle" style="
          position: absolute;
          right: 0;
          top: 0;
          width: calc(20px * (${optoLabel.value.width} / 250));
          height: calc(20px * (${optoLabel.value.width} / 250));
          background: #ff5252;
          border-radius: 0 4px 0 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        ">
          <svg width="calc(14px * (${optoLabel.value.width} / 250))" height="calc(14px * (${optoLabel.value.width} / 250))" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
          </svg>
        </div>
      </div>
    `;

    // Ajouter les gestionnaires d'événements
    element.addEventListener("mousedown", startDragOptoLabel);
    element.addEventListener("touchstart", startDragOptoLabel, {
      passive: false,
    });

    const resizeHandle = element.querySelector(".resize-handle");
    resizeHandle.addEventListener("mousedown", startResizeOptoLabel);
    resizeHandle.addEventListener("touchstart", startResizeOptoLabel, {
      passive: false,
    });

    const deleteHandle = element.querySelector(".delete-handle");
    deleteHandle.addEventListener(
      "touchstart",
      (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (confirm("Voulez-vous supprimer l'étiquette ?")) {
          removeOptoLabel();
        }
      },
      { passive: false }
    );

    deleteHandle.addEventListener("click", (event) => {
      event.stopPropagation();
      if (confirm("Voulez-vous supprimer l'étiquette ?")) {
        removeOptoLabel();
      }
    });

    document.querySelector(".drawing-area").appendChild(element);
    optoElement.value = element;
  } catch (error) {
    console.error("Erreur lors de l'ajout de l'étiquette opto:", error);
    alert("Erreur lors de l'ajout de l'étiquette opto");
  }
}

// Ajouter les fonctions pour gérer le drag & drop de l'étiquette opto
function startDragOptoLabel(event) {
  if (event.target.classList.contains("resize-handle")) return;

  const touch = event.touches ? event.touches[0] : event;
  optoLabel.value.isDragging = true;
  optoLabel.value.dragOffset = {
    x: touch.clientX - optoLabel.value.x,
    y: touch.clientY - optoLabel.value.y,
  };

  if (event.touches) {
    document.addEventListener("touchmove", onDragOptoLabel, { passive: false });
    document.addEventListener("touchend", stopDragOptoLabel);
  } else {
    document.addEventListener("mousemove", onDragOptoLabel);
    document.addEventListener("mouseup", stopDragOptoLabel);
  }
}

function onDragOptoLabel(event) {
  if (!optoLabel.value.isDragging) return;

  const touch = event.touches ? event.touches[0] : event;
  const newX = touch.clientX - optoLabel.value.dragOffset.x;
  const newY = touch.clientY - optoLabel.value.dragOffset.y;

  if (optoElement.value) {
    optoElement.value.style.left = newX + "px";
    optoElement.value.style.top = newY + "px";
  }

  optoLabel.value.x = newX;
  optoLabel.value.y = newY;

  if (event.touches) {
    event.preventDefault();
  }
}

function startResizeOptoLabel(event) {
  event.stopPropagation();

  const touch = event.touches ? event.touches[0] : event;
  optoLabel.value.isResizing = true;
  optoLabel.value.resizeStart = {
    x: touch.clientX,
    y: touch.clientY,
    width: optoLabel.value.width,
    height: optoLabel.value.height,
  };

  if (event.touches) {
    document.addEventListener("touchmove", onResizeOptoLabel, {
      passive: false,
    });
    document.addEventListener("touchend", stopResizeOptoLabel);
  } else {
    document.addEventListener("mousemove", onResizeOptoLabel);
    document.addEventListener("mouseup", stopResizeOptoLabel);
  }
}

function onResizeOptoLabel(event) {
  if (!optoLabel.value.isResizing) return;

  const touch = event.touches ? event.touches[0] : event;
  const dx = touch.clientX - optoLabel.value.resizeStart.x;
  const dy = touch.clientY - optoLabel.value.resizeStart.y;

  const newWidth = Math.max(250, optoLabel.value.resizeStart.width + dx);
  const newHeight = Math.max(100, optoLabel.value.resizeStart.height + dy);

  if (optoElement.value) {
    optoElement.value.style.width = newWidth + "px";
    optoElement.value.style.height = newHeight + "px";
  }

  optoLabel.value.width = newWidth;
  optoLabel.value.height = newHeight;

  if (event.touches) {
    event.preventDefault();
  }
}

function stopDragOptoLabel() {
  optoLabel.value.isDragging = false;
  document.removeEventListener("mousemove", onDragOptoLabel);
  document.removeEventListener("mouseup", stopDragOptoLabel);
  document.removeEventListener("touchmove", onDragOptoLabel);
  document.removeEventListener("touchend", stopDragOptoLabel);
}

function stopResizeOptoLabel() {
  optoLabel.value.isResizing = false;
  document.removeEventListener("mousemove", onResizeOptoLabel);
  document.removeEventListener("mouseup", stopResizeOptoLabel);
  document.removeEventListener("touchmove", onResizeOptoLabel);
  document.removeEventListener("touchend", stopResizeOptoLabel);
}

function removeOptoLabel() {
  if (optoElement.value) {
    const deleteHandle = optoElement.value.querySelector(".delete-handle");
    if (deleteHandle) {
      deleteHandle.removeEventListener("touchstart", () => {});
      deleteHandle.removeEventListener("click", () => {});
    }

    const resizeHandle = optoElement.value.querySelector(".resize-handle");
    if (resizeHandle) {
      resizeHandle.removeEventListener("touchstart", () => {});
      resizeHandle.removeEventListener("mousedown", () => {});
    }

    optoElement.value.remove();
    optoElement.value = null;

    optoLabel.value = {
      x: 50,
      y: 200,
      width: 250,
      height: 140,
      isDragging: false,
      isResizing: false,
      dragOffset: { x: 0, y: 0 },
      resizeStart: { x: 0, y: 0, width: 0, height: 0 },
    };
  }
}

// Méthode pour effacer le PDF chargé
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
    if (ctx) {
      ctx.clearRect(0, 0, pencilCanvas.value.width, pencilCanvas.value.height);
    }
    // Supprimer l'état sauvegardé
    localStorage.removeItem(`reference_state_${route.params.examId}`);
  }
};

// Sauvegarder les annotations et étiquettes
const saveAnnotationsAndLabels = () => {
  if (loadedExamFile.value) {
    const annotations = pencilCanvas.value?.getAnnotations?.() || [];
    const currentLabels = getLabels();
    localStorage.setItem(
      `reference_${loadedExamFile.value}`,
      JSON.stringify({ annotations, labels: currentLabels })
    );
  }
};

// Ajouter un watcher pour sauvegarder automatiquement
watch(
  [() => pencilCanvas.value?.getAnnotations?.() || [], labels],
  () => {
    saveAnnotationsAndLabels();
  },
  { deep: true }
);

// Modifier la fonction resetForm pour ne pas effacer les données sauvegardées
const resetForm = () => {
  // Ne pas réinitialiser selectedPDF et loadedExamFile ici
  isEraser.value = false;
  penSize.value = 2;
  showTextFieldDialog.value = false;
  currentFieldValue.value = "";
  currentFieldLabel.value = "";
  currentFieldId.value = null;
};

// Modifier la fonction saveState pour inclure l'image du PDF
const saveState = () => {
  if (loadedExamFile.value) {
    // Sauvegarder l'image du PDF de fond
    const backgroundImage = pencilCanvas.value.toDataURL("image/png");

    const state = {
      pdfPath: loadedExamFile.value,
      backgroundImage: backgroundImage,
      annotations: paths,
      undoStack: undoStack.value,
      redoStack: redoStack.value,
      labels: labels.value,
      patientLabel: patientLabel.value,
      optoLabel: optoLabel.value,
    };
    localStorage.setItem(
      `reference_state_${route.params.examId}`,
      JSON.stringify(state)
    );
  }
};

// Modifier la fonction restoreState pour restaurer l'image du PDF
const restoreState = async () => {
  const savedState = localStorage.getItem(
    `reference_state_${route.params.examId}`
  );
  if (savedState) {
    const state = JSON.parse(savedState);
    loadedExamFile.value = state.pdfPath;
    selectedPDF.value = state.pdfPath;

    // Restaurer les annotations
    paths = state.annotations || [];
    undoStack.value = state.undoStack || [];
    redoStack.value = state.redoStack || [];

    // Restaurer les étiquettes
    labels.value = state.labels || [];

    // Restaurer l'image du PDF de fond
    if (state.backgroundImage && pencilCanvas.value) {
      const img = new Image();
      img.onload = () => {
        // Définir les dimensions du canvas
        pencilCanvas.value.width = img.width;
        pencilCanvas.value.height = img.height;
        pencilCanvas.value.style.width = `${img.width}px`;
        pencilCanvas.value.style.height = `${img.height}px`;

        // Dessiner l'image de fond
        ctx.drawImage(img, 0, 0);

        // Redessiner les annotations
        drawBackgroundAndPaths();

        // Restaurer les étiquettes
        if (state.patientLabel) {
          patientLabel.value = state.patientLabel;
          addPatientLabel();
        }
        if (state.optoLabel) {
          optoLabel.value = state.optoLabel;
          addOptoLabel();
        }
      };
      img.src = state.backgroundImage;
    } else {
      // Si pas d'image sauvegardée, charger le PDF normalement
      await loadPDF(state.pdfPath);
      drawBackgroundAndPaths();

      if (state.patientLabel) {
        patientLabel.value = state.patientLabel;
        await addPatientLabel();
      }
      if (state.optoLabel) {
        optoLabel.value = state.optoLabel;
        await addOptoLabel();
      }
    }
  }
};

// Modifier le watcher de la route
watch(
  () => route.path,
  async (newPath) => {
    if (newPath.includes("/reference/")) {
      await restoreState();
    }
  }
);

// Modifier le watcher de l'ID de l'examen
watch(
  () => route.params.examId,
  async (newExamId) => {
    if (newExamId) {
      await restoreState();
    }
  }
);

// Ajouter un watcher pour sauvegarder l'état quand il change
watch(
  [
    () => paths,
    () => labels.value,
    () => patientLabel.value,
    () => optoLabel.value,
  ],
  () => {
    saveState();
  },
  { deep: true }
);

// Modifier la fonction addTextLabel
async function addTextLabel() {
  if (!newText.value.trim()) {
    alert("Veuillez entrer du texte");
    return;
  }

  try {
    const element = document.createElement("div");
    element.className = "text-label";
    element.style.position = "absolute";
    element.style.left = textLabel.value.x + "px";
    element.style.top = textLabel.value.y + "px";
    element.style.width = textLabel.value.width + "px";
    element.style.height = textLabel.value.height + "px";
    element.style.cursor = "move";
    element.style.zIndex = "1000";
    element.style.userSelect = "none";
    element.style.touchAction = "none";

    // Ajouter le contenu de l'étiquette
    element.innerHTML = `
      <div class="label-content" style="
        width: 100%;
        height: 100%;
        background: white;
        border: 2px solid #2196F3;
        border-radius: 4px;
        padding: 8px;
        box-sizing: border-box;
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: calc(12px * (${textLabel.value.width} / 250));
      ">
        <div style="
          word-wrap: break-word;
          white-space: pre-wrap;
        ">
          ${newText.value.replace(/\n/g, "<br>")}
        </div>
        <div class="resize-handle" style="
          position: absolute;
          right: 0;
          bottom: 0;
          width: calc(20px * (${textLabel.value.width} / 250));
          height: calc(20px * (${textLabel.value.width} / 250));
          background: #2196F3;
          border-radius: 0 0 4px 0;
          cursor: nwse-resize;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        ">
          <svg width="calc(14px * (${textLabel.value.width} / 250))" height="calc(14px * (${textLabel.value.width} / 250))" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM18 18H16V16H18V18ZM14 22H12V20H14V22ZM22 14H20V12H22V14Z" fill="currentColor"/>
          </svg>
        </div>
        <div class="delete-handle" style="
          position: absolute;
          right: 0;
          top: 0;
          width: calc(20px * (${textLabel.value.width} / 250));
          height: calc(20px * (${textLabel.value.width} / 250));
          background: #ff5252;
          border-radius: 0 4px 0 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        ">
          <svg width="calc(14px * (${textLabel.value.width} / 250))" height="calc(14px * (${textLabel.value.width} / 250))" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
          </svg>
        </div>
      </div>
    `;

    // Ajouter les gestionnaires d'événements
    element.addEventListener("mousedown", startDragTextLabel);
    element.addEventListener("touchstart", startDragTextLabel, {
      passive: false,
    });

    const resizeHandle = element.querySelector(".resize-handle");
    resizeHandle.addEventListener("mousedown", startResizeTextLabel);
    resizeHandle.addEventListener("touchstart", startResizeTextLabel, {
      passive: false,
    });

    const deleteHandle = element.querySelector(".delete-handle");
    deleteHandle.addEventListener(
      "touchstart",
      (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (confirm("Voulez-vous supprimer l'étiquette ?")) {
          removeTextLabel();
        }
      },
      { passive: false }
    );

    deleteHandle.addEventListener("click", (event) => {
      event.stopPropagation();
      if (confirm("Voulez-vous supprimer l'étiquette ?")) {
        removeTextLabel();
      }
    });

    document.querySelector(".drawing-area").appendChild(element);
    textElement.value = element;

    // Réinitialiser le formulaire
    newText.value = "";
    showTextDialog.value = false;
  } catch (error) {
    console.error("Erreur lors de l'ajout de l'étiquette de texte:", error);
    alert("Erreur lors de l'ajout de l'étiquette de texte");
  }
}

// Ajouter les fonctions pour gérer le drag & drop de l'étiquette de texte
function startDragTextLabel(event) {
  if (event.target.classList.contains("resize-handle")) return;

  const touch = event.touches ? event.touches[0] : event;
  textLabel.value.isDragging = true;
  textLabel.value.dragOffset = {
    x: touch.clientX - textLabel.value.x,
    y: touch.clientY - textLabel.value.y,
  };

  if (event.touches) {
    document.addEventListener("touchmove", onDragTextLabel, { passive: false });
    document.addEventListener("touchend", stopDragTextLabel);
  } else {
    document.addEventListener("mousemove", onDragTextLabel);
    document.addEventListener("mouseup", stopDragTextLabel);
  }
}

function onDragTextLabel(event) {
  if (!textLabel.value.isDragging) return;

  const touch = event.touches ? event.touches[0] : event;
  const newX = touch.clientX - textLabel.value.dragOffset.x;
  const newY = touch.clientY - textLabel.value.dragOffset.y;

  if (textElement.value) {
    textElement.value.style.left = newX + "px";
    textElement.value.style.top = newY + "px";
  }

  textLabel.value.x = newX;
  textLabel.value.y = newY;

  if (event.touches) {
    event.preventDefault();
  }
}

function startResizeTextLabel(event) {
  event.stopPropagation();

  const touch = event.touches ? event.touches[0] : event;
  textLabel.value.isResizing = true;
  textLabel.value.resizeStart = {
    x: touch.clientX,
    y: touch.clientY,
    width: textLabel.value.width,
    height: textLabel.value.height,
  };

  if (event.touches) {
    document.addEventListener("touchmove", onResizeTextLabel, {
      passive: false,
    });
    document.addEventListener("touchend", stopResizeTextLabel);
  } else {
    document.addEventListener("mousemove", onResizeTextLabel);
    document.addEventListener("mouseup", stopResizeTextLabel);
  }
}

function onResizeTextLabel(event) {
  if (!textLabel.value.isResizing) return;

  const touch = event.touches ? event.touches[0] : event;
  const dx = touch.clientX - textLabel.value.resizeStart.x;
  const dy = touch.clientY - textLabel.value.resizeStart.y;

  const newWidth = Math.max(250, textLabel.value.resizeStart.width + dx);
  const newHeight = Math.max(100, textLabel.value.resizeStart.height + dy);

  if (textElement.value) {
    textElement.value.style.width = newWidth + "px";
    textElement.value.style.height = newHeight + "px";
  }

  textLabel.value.width = newWidth;
  textLabel.value.height = newHeight;

  if (event.touches) {
    event.preventDefault();
  }
}

function stopDragTextLabel() {
  textLabel.value.isDragging = false;
  document.removeEventListener("mousemove", onDragTextLabel);
  document.removeEventListener("mouseup", stopDragTextLabel);
  document.removeEventListener("touchmove", onDragTextLabel);
  document.removeEventListener("touchend", stopDragTextLabel);
}

function stopResizeTextLabel() {
  textLabel.value.isResizing = false;
  document.removeEventListener("mousemove", onResizeTextLabel);
  document.removeEventListener("mouseup", stopResizeTextLabel);
  document.removeEventListener("touchmove", onResizeTextLabel);
  document.removeEventListener("touchend", stopResizeTextLabel);
}

function removeTextLabel() {
  if (textElement.value) {
    const deleteHandle = textElement.value.querySelector(".delete-handle");
    if (deleteHandle) {
      deleteHandle.removeEventListener("touchstart", () => {});
      deleteHandle.removeEventListener("click", () => {});
    }

    const resizeHandle = textElement.value.querySelector(".resize-handle");
    if (resizeHandle) {
      resizeHandle.removeEventListener("touchstart", () => {});
      resizeHandle.removeEventListener("mousedown", () => {});
    }

    textElement.value.remove();
    textElement.value = null;

    textLabel.value = {
      x: 50,
      y: 50,
      width: 250,
      height: 140,
      isDragging: false,
      isResizing: false,
      dragOffset: { x: 0, y: 0 },
      resizeStart: { x: 0, y: 0, width: 0, height: 0 },
    };
  }
}

// Modifier onMounted
onMounted(async () => {
  loadPDFList();
  const canvas = pencilCanvas.value;
  if (canvas) {
    ctx = canvas.getContext("2d");
  }

  const container = document.querySelector(".canvas-container");
  if (container) {
    container.addEventListener("scroll", updateScrollbar);
    updateScrollbar();
  }

  // Restaurer l'état au montage
  await restoreState();
});
</script>

<style scoped>
.canvas-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  height: 100%;
  max-height: calc(100vh - 64px);
  overflow: hidden;
}

.canvas-container {
  width: 100%;
  height: 100%;
  max-height: calc(100vh - 64px);
  overflow-y: auto;
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
    max-height: calc(100vh - 120px);
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
</style>
