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
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @mouseleave="stopDrawing"
            @touchstart="startDrawing"
            @touchmove="draw"
            @touchend="stopDrawing"
          ></canvas>
        </div>
        <div class="controls">
          <v-btn-toggle v-model="selectedTool" mandatory>
            <v-btn value="pen" icon="mdi-pencil"></v-btn>
            <v-btn value="eraser" icon="mdi-eraser"></v-btn>
          </v-btn-toggle>
          <v-color-picker
            v-model="selectedColor"
            mode="hexa"
            hide-mode-switch
          ></v-color-picker>
          <v-btn @click="clearCanvas" color="error">Effacer</v-btn>
          <v-btn @click="saveDrawing" color="primary">Sauvegarder</v-btn>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
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
const canvasWidth = ref(800);
const canvasHeight = ref(600);

onMounted(() => {
  ctx.value = canvas.value.getContext("2d");
  loadBackgroundImage();
  loadSavedDrawing();
});

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
  const pos = getMousePos(e);
  ctx.value.beginPath();
  ctx.value.moveTo(pos.x, pos.y);
};

const draw = (e) => {
  if (!isDrawing.value) return;

  const pos = getMousePos(e);
  ctx.value.lineTo(pos.x, pos.y);
  ctx.value.strokeStyle =
    selectedTool.value === "eraser" ? "#FFFFFF" : selectedColor.value;
  ctx.value.lineWidth = selectedTool.value === "eraser" ? 20 : 5;
  ctx.value.lineCap = "round";
  ctx.value.lineJoin = "round";
  ctx.value.stroke();
};

const stopDrawing = () => {
  isDrawing.value = false;
};

const getMousePos = (e) => {
  const rect = canvas.value.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  return { x, y };
};

const clearCanvas = () => {
  ctx.value.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
  loadBackgroundImage();
};

const saveDrawing = async () => {
  const dataUrl = canvas.value.toDataURL("image/png");
  await dbService.saveSection(props.examId, "lesions", dataUrl);
};
</script>

<style scoped>
.lesion-canvas {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.canvas-container {
  border: 1px solid #ccc;
  margin-bottom: 1rem;
}

canvas {
  display: block;
  background-color: white;
}

.controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: center;
}
</style>
