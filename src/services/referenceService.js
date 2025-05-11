import { jsPDF } from "jspdf";
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { nativePlatformService } from "./nativePlatformService";
import { dbService } from "./db";

class ReferenceService {
  constructor() {
    this.currentPDF = null;
    this.fields = new Map();
  }

  // Charger la liste des PDFs disponibles
  async getPDFList() {
    // Liste des PDFs présents dans src/assets/fiche_reference
    return [
      {
        name: "Groupe IOL",
        path: new URL(
          "../assets/fiche_reference/Groupe IOL.pdf",
          import.meta.url
        ).href,
      },
      {
        name: "Clinique Belle Vue",
        path: new URL(
          "../assets/fiche_reference/Clinique Belle Vue.pdf",
          import.meta.url
        ).href,
      },
      {
        name: "Université de Montréal",
        path: new URL(
          "../assets/fiche_reference/Université de Montréal.pdf",
          import.meta.url
        ).href,
      },
      {
        name: "Clinique de la Rétine de l'Est de Montréal",
        path: new URL(
          "../assets/fiche_reference/clinique_de_la_retine_de_lest_de_mtl.pdf",
          import.meta.url
        ).href,
      },
    ];
  }

  // Charger un PDF spécifique
  async loadPDF(pdfPath) {
    try {
      console.log("Tentative de chargement du PDF:", pdfPath);
      const response = await fetch(pdfPath);
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      const pdfBlob = await response.blob();
      this.currentPDF = pdfBlob;
      return pdfBlob;
    } catch (error) {
      console.error("Erreur lors du chargement du PDF:", error);
      throw error;
    }
  }

  // Sauvegarder le document chargé
  async saveLoadedFile(examId, filePath) {
    try {
      await dbService.saveSection({
        examId: examId,
        name: "loaded-reference-file",
        data: filePath,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du fichier chargé:", error);
      throw error;
    }
  }

  // Récupérer le document chargé
  async getLoadedFile(examId) {
    try {
      const saved = await dbService.getSection(examId, "loaded-reference-file");
      return saved?.data || null;
    } catch (error) {
      console.error("Erreur lors de la récupération du fichier chargé:", error);
      return null;
    }
  }

  // Sauvegarder les annotations d'une page
  async savePageAnnotations(examId, pageNum, annotations) {
    try {
      await dbService.saveSection({
        examId: examId,
        name: `reference-canvas-page-${pageNum}`,
        data: JSON.stringify(annotations),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des annotations:", error);
      throw error;
    }
  }

  // Récupérer les annotations d'une page
  async getPageAnnotations(examId, pageNum) {
    try {
      const saved = await dbService.getSection(examId, `reference-canvas-page-${pageNum}`);
      if (saved?.data) {
        return JSON.parse(saved.data);
      }
      return null;
    } catch (error) {
      console.error("Erreur lors de la récupération des annotations:", error);
      return null;
    }
  }

  // Sauvegarder le background
  async saveBackground(examId, backgroundData) {
    try {
      await dbService.saveSection({
        examId: examId,
        name: "reference-canvas-background",
        data: backgroundData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du background:", error);
      throw error;
    }
  }

  // Récupérer le background
  async getBackground(examId) {
    try {
      const saved = await dbService.getSection(examId, "reference-canvas-background");
      return saved?.data || null;
    } catch (error) {
      console.error("Erreur lors de la récupération du background:", error);
      return null;
    }
  }

  // Exporter le PDF modifié
  async exportPDF(pdfBlob, fileName) {
    try {
      const result = await nativePlatformService.handleFileExport(pdfBlob, fileName);
      return result;
    } catch (error) {
      console.error("Erreur lors de l'export du PDF:", error);
      throw error;
    }
  }
}

export const referenceService = new ReferenceService();
