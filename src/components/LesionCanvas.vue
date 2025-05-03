<template>
  <div class="lesion-canvas">
    <v-card>
      <v-card-title>Dessin des lésions</v-card-title>
      <v-card-text>
        <div class="canvas-container">
          <canvas
            ref="canvas"
            :width="canvasWidth"
            :height="canvasHeight"
            @pointerdown="startDrawing"
            @pointermove="draw"
            @pointerup="stopDrawing"
            @pointerleave="stopDrawing"
            @touchstart.prevent="handleTouchStart"
            @touchmove.prevent="handleTouchMove"
            @touchend.prevent="handleTouchEnd"
            style="touch-action: none"
          ></canvas>
        </div>
        <div class="controls">
          <v-btn-toggle v-model="selectedTool" mandatory>
            <v-btn value="pen" icon="mdi-pencil" title="Stylo"></v-btn>
            <v-btn value="eraser" icon="mdi-eraser" title="Gomme"></v-btn>
            <v-btn
              value="highlight"
              icon="mdi-marker"
              title="Surligneur"
            ></v-btn>
          </v-btn-toggle>
          <v-slider
            v-model="brushSize"
            min="1"
            max="20"
            step="1"
            label="Taille du pinceau"
            class="brush-size-slider"
          ></v-slider>
          <v-color-picker
            v-model="selectedColor"
            mode="hexa"
            hide-mode-switch
            class="color-picker"
          ></v-color-picker>
          <v-btn
            @click="clearCanvas"
            color="error"
            icon="mdi-delete"
            title="Effacer"
          ></v-btn>
          <v-btn
            @click="saveDrawing"
            color="primary"
            icon="mdi-content-save"
            title="Sauvegarder"
          ></v-btn>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from "vue";
import { dbService } from "../services/db";

const props = defineProps({
  examId: {
    type: String,
    required: true,
  },
  backgroundImage: {
    type: String,
    default: "/retina-background.png",
  },
});

const canvas = ref(null);
const ctx = ref(null);
const isDrawing = ref(false);
const selectedTool = ref("pen");
const selectedColor = ref("#000000");
const brushSize = ref(5);
const canvasWidth = ref(800);
const canvasHeight = ref(600);
const lastPoint = ref(null);

onMounted(() => {
  ctx.value = canvas.value.getContext("2d");
  loadBackgroundImage();
  loadSavedDrawing();
  setupCanvas();
});

const setupCanvas = () => {
  // Améliorer la qualité du rendu
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.value.getBoundingClientRect();
  canvas.value.width = rect.width * dpr;
  canvas.value.height = rect.height * dpr;
  ctx.value.scale(dpr, dpr);
  canvas.value.style.width = `${rect.width}px`;
  canvas.value.style.height = `${rect.height}px`;
};

const loadBackgroundImage = () => {
  const img = new Image();
  img.src = props.backgroundImage;
  img.onload = () => {
    ctx.value.drawImage(img, 0, 0, canvasWidth.value, canvasHeight.value);
  };
};

const loadSavedDrawing = async () => {
  const savedData = await dbService.getSection(props.examId, "lesions");
  if (savedData && savedData.data) {
    const img = new Image();
    img.src = savedData.data;
    img.onload = () => {
      ctx.value.drawImage(img, 0, 0);
    };
  }
};

const startDrawing = (e) => {
  isDrawing.value = true;
  const pos = getPosition(e);
  lastPoint.value = pos;
  ctx.value.beginPath();
  ctx.value.moveTo(pos.x, pos.y);

  // Configurer le style en fonction de l'outil
  updateDrawingStyle();
};

const draw = (e) => {
  if (!isDrawing.value) return;

  const pos = getPosition(e);

  // Dessiner une ligne lisse
  if (lastPoint.value) {
    ctx.value.beginPath();
    ctx.value.moveTo(lastPoint.value.x, lastPoint.value.y);
    ctx.value.lineTo(pos.x, pos.y);
    ctx.value.stroke();
  }

  lastPoint.value = pos;
};

const stopDrawing = () => {
  isDrawing.value = false;
  lastPoint.value = null;
};

const getPosition = (e) => {
  const rect = canvas.value.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.value.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.value.height / rect.height);
  return { x, y };
};

const updateDrawingStyle = () => {
  switch (selectedTool.value) {
    case "pen":
      ctx.value.strokeStyle = selectedColor.value;
      ctx.value.lineWidth = brushSize.value;
      ctx.value.globalAlpha = 1;
      break;
    case "eraser":
      ctx.value.strokeStyle = "#FFFFFF";
      ctx.value.lineWidth = brushSize.value * 2;
      ctx.value.globalAlpha = 1;
      break;
    case "highlight":
      ctx.value.strokeStyle = selectedColor.value;
      ctx.value.lineWidth = brushSize.value * 2;
      ctx.value.globalAlpha = 0.3;
      break;
  }
  ctx.value.lineCap = "round";
  ctx.value.lineJoin = "round";
};

const handleTouchStart = (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent("pointerdown", {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });
  canvas.value.dispatchEvent(mouseEvent);
};

const handleTouchMove = (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent("pointermove", {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });
  canvas.value.dispatchEvent(mouseEvent);
};

const handleTouchEnd = (e) => {
  e.preventDefault();
  const mouseEvent = new MouseEvent("pointerup", {});
  canvas.value.dispatchEvent(mouseEvent);
};

const clearCanvas = () => {
  ctx.value.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
  loadBackgroundImage();
};

const saveDrawing = async () => {
  const dataUrl = canvas.value.toDataURL("image/png");
  await dbService.saveSection(props.examId, "lesions", dataUrl);
};

// Surveiller les changements d'outil et de taille
watch([selectedTool, brushSize], () => {
  updateDrawingStyle();
});
</script>

<style scoped>
.lesion-canvas {
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
}

.canvas-container {
  border: 1px solid #ccc;
  margin-bottom: 1rem;
  position: relative;
  overflow: hidden;
}

canvas {
  display: block;
  background-color: white;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}

.controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
}

.brush-size-slider {
  min-width: 150px;
  max-width: 200px;
}

.color-picker {
  max-width: 200px;
}

@media (max-width: 600px) {
  .controls {
    flex-direction: column;
    align-items: stretch;
  }

  .brush-size-slider,
  .color-picker {
    width: 100%;
    max-width: none;
  }
}
</style>
