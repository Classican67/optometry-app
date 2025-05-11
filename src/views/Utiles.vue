<template>
  <v-container v-if="isNativePlatform" fluid class="fill-height pa-0">
    <v-row no-gutters class="fill-height">
      <!-- En-tête avec le toggle de vue -->
      <v-col cols="12" class="pa-4">
        <div class="d-flex justify-space-between align-center">
          <h2 class="text-h5">Documents utiles</h2>
          <v-btn-group>
            <v-btn
              :color="viewMode === 'grid' ? 'primary' : undefined"
              icon="mdi-grid"
              @click="viewMode = 'grid'"
            ></v-btn>
            <v-btn
              :color="viewMode === 'list' ? 'primary' : undefined"
              icon="mdi-format-list-bulleted"
              @click="viewMode = 'list'"
            ></v-btn>
          </v-btn-group>
        </div>
      </v-col>

      <!-- Liste des fichiers -->
      <v-col cols="12" class="px-4">
        <v-row v-if="viewMode === 'grid'" dense>
          <v-col
            v-for="file in files"
            :key="file.id"
            cols="6"
            sm="4"
            md="3"
            lg="2"
          >
            <v-card
              class="file-card"
              @click="openFile(file)"
            >
              <v-img
                :src="`data:image/${file.format};base64,${file.base64String}`"
                height="150"
                cover
                class="bg-grey-lighten-2"
              >
                <template v-slot:placeholder>
                  <v-row class="fill-height ma-0" align="center" justify="center">
                    <v-progress-circular
                      indeterminate
                      color="primary"
                    ></v-progress-circular>
                  </v-row>
                </template>
              </v-img>
              <v-card-text class="pa-2">
                <div class="text-truncate">{{ file.name }}</div>
                <div class="text-caption text-grey">
                  {{ formatDate(file.createdAt) }}
                </div>
              </v-card-text>
              <v-card-actions class="pa-2">
                <v-spacer></v-spacer>
                <v-btn
                  icon="mdi-delete"
                  color="error"
                  size="small"
                  @click.stop="confirmDelete(file)"
                ></v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>

        <v-list v-else>
          <v-list-item
            v-for="file in files"
            :key="file.id"
            :title="file.name"
            :subtitle="formatDate(file.createdAt)"
            @click="openFile(file)"
          >
            <template v-slot:prepend>
              <v-avatar size="40" class="mr-2">
                <v-img 
                  :src="`data:image/${file.format};base64,${file.base64String}`"
                  cover
                ></v-img>
              </v-avatar>
            </template>
            <template v-slot:append>
              <v-btn
                icon="mdi-delete"
                color="error"
                size="small"
                @click.stop="confirmDelete(file)"
              ></v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-col>
    </v-row>

    <!-- Bouton FAB pour ajouter un document -->
    <v-btn
      color="primary"
      icon="mdi-plus"
      size="large"
      class="fab-button"
      @click="showAddFileDialog"
    ></v-btn>

    <!-- Dialog pour ajouter un nouveau fichier -->
    <v-dialog v-model="showDialog" max-width="500px">
      <v-card>
        <v-card-title>Ajouter un document</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newFileName"
            label="Nom du document"
            :rules="[v => !!v || 'Le nom est requis']"
            required
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey-darken-1" variant="text" @click="showDialog = false">
            Annuler
          </v-btn>
          <v-btn 
            color="primary" 
            variant="text" 
            @click="takePhoto"
            :loading="isLoading"
          >
            Prendre une photo
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog de prévisualisation -->
    <v-dialog v-model="previewDialog" max-width="90vw">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center">
          <span>{{ selectedFile?.name }}</span>
          <v-btn icon @click="previewDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text class="text-center">
          <v-img
            v-if="selectedFile"
            :src="`data:image/${selectedFile.format};base64,${selectedFile.base64String}`"
            max-height="80vh"
            contain
          ></v-img>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Dialog de confirmation de suppression -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title>Confirmer la suppression</v-card-title>
        <v-card-text>
          Êtes-vous sûr de vouloir supprimer ce document ?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="deleteDialog = false">Annuler</v-btn>
          <v-btn color="error" @click="deleteFile">Supprimer</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import { utilesService } from '../services/utilesService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';

const route = useRoute();
const viewMode = ref('grid');
const files = ref([]);
const showDialog = ref(false);
const newFileName = ref('');
const isNativePlatform = computed(() => Capacitor.isNativePlatform());
const isLoading = ref(false);
const previewDialog = ref(false);
const deleteDialog = ref(false);
const selectedFile = ref(null);
const fileToDelete = ref(null);

// Charger les fichiers du patient
const loadFiles = async () => {
  try {
    const examId = route.params.examId;
    if (!examId) return;
    files.value = await utilesService.getFiles(examId);
  } catch (error) {
    console.error('Erreur lors du chargement des fichiers:', error);
  }
};

// Formater la date
const formatDate = (date) => {
  return format(new Date(date), 'dd MMMM yyyy HH:mm', { locale: fr });
};

// Afficher le dialog d'ajout de fichier
const showAddFileDialog = () => {
  newFileName.value = '';
  showDialog.value = true;
};

// Prendre une photo
const takePhoto = async () => {
  if (!newFileName.value) {
    alert('Veuillez entrer un nom pour le document');
    return;
  }

  try {
    isLoading.value = true;
    const photo = await utilesService.takePhoto();
    
    const newFile = {
      id: uuidv4(),
      name: newFileName.value,
      base64String: photo.base64String,
      format: photo.format,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const examId = route.params.examId;
    await utilesService.saveFile(examId, newFile);
    files.value = [...files.value, newFile];
    showDialog.value = false;
  } catch (error) {
    console.error('Erreur lors de la prise de photo:', error);
    alert('Erreur lors de la prise de photo');
  } finally {
    isLoading.value = false;
  }
};

// Ouvrir un fichier
const openFile = (file) => {
  selectedFile.value = file;
  previewDialog.value = true;
};

function openPreview(file) {
  selectedFile.value = file;
  previewDialog.value = true;
}

function confirmDelete(file) {
  fileToDelete.value = file;
  deleteDialog.value = true;
}

async function deleteFile() {
  if (!fileToDelete.value) return;

  try {
    const examId = route.params.examId;
    await utilesService.deleteFile(examId, fileToDelete.value.id);
    await loadFiles();
  } catch (error) {
    console.error('Erreur lors de la suppression du fichier:', error);
  } finally {
    deleteDialog.value = false;
    fileToDelete.value = null;
  }
}

onMounted(() => {
  if (isNativePlatform.value) {
    loadFiles();
  }
});
</script>

<style scoped>
.fab-button {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
}

.file-card {
  cursor: pointer;
  transition: transform 0.2s;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.file-card:hover {
  transform: scale(1.02);
}

/* Styles spécifiques pour iPad */
@media only screen and (min-device-width: 768px) and (max-device-width: 1024px) {
  .fab-button {
    bottom: 32px;
    right: 32px;
  }
}
</style> 