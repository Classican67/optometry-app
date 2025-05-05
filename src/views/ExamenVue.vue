<template>
  <v-container>
    <v-card class="mx-auto" max-width="800">
      <v-card-title>Examen de Vue</v-card-title>
      <v-card-text>
        <p>Utilisez le stylet pour dessiner ou signer ci-dessous.</p>
      </v-card-text>
    </v-card>
    <h2 class="mt-6">Zone de dessin</h2>
    <div
      class="drawing-area"
      @touchstart.prevent="onTouchStart"
      @touchmove.prevent="onTouchMove"
      @touchend.prevent="onTouchEnd"
    >
      <canvas ref="pencilCanvas"></canvas>
    </div>
    <v-btn class="mt-2" @click="clearCanvas" color="error">Effacer</v-btn>
  </v-container>
</template>

<script setup>
import { onMounted, ref } from 'vue';

const pencilCanvas = ref(null);
let ctx = null;
let drawing = false;
let backgroundImage = null;

function resizeCanvas() {
  const canvas = pencilCanvas.value;
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;

  // Redessiner le fond après redimensionnement
  if (backgroundImage) {
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
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
  const { clientX: x, clientY: y } = touch;
  const rect = pencilCanvas.value.getBoundingClientRect();
  ctx.beginPath();
  ctx.moveTo(x - rect.left, y - rect.top);
}

function onTouchMove(event) {
  if (!drawing) return;
  const touch = getStylusTouch(event.touches);
  if (!touch) return;
  const { clientX: x, clientY: y } = touch;
  const rect = pencilCanvas.value.getBoundingClientRect();
  ctx.lineTo(x - rect.left, y - rect.top);
  ctx.stroke();
}

function onTouchEnd(event) {
  const stillStylus = getStylusTouch(event.touches);
  if (!stillStylus && drawing) {
    drawing = false;
    ctx.closePath();
  }
}

function clearCanvas() {
  const canvas = pencilCanvas.value;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Redessiner le fond après effacement
  if (backgroundImage) {
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
  }
}

onMounted(() => {
  const canvas = pencilCanvas.value;
  ctx = canvas.getContext('2d');

  // Charger l'image SVG
  backgroundImage = new Image();
  backgroundImage.src = '/examen_annie.svg';
  backgroundImage.onload = () => {
    resizeCanvas();
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
  };

  window.addEventListener('resize', resizeCanvas);
});
</script>

<style scoped>
.drawing-area {
  position: relative;
  border: 1px solid #000;
  width: 100%;
  height: 200px;
  touch-action: none;
}
.drawing-area canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: crosshair;
}
</style>
