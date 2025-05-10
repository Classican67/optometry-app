import { jsPDF } from "jspdf";
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

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

  // Ajouter un champ de texte au PDF
  addTextField(fieldId, x, y, width, height, label) {
    this.fields.set(fieldId, {
      x,
      y,
      width,
      height,
      label,
      value: "",
    });
  }

  // Mettre à jour la valeur d'un champ
  updateField(fieldId, value) {
    const field = this.fields.get(fieldId);
    if (field) {
      field.value = value;
      this.updatePDF();
    }
  }

  // Mettre à jour le PDF avec les valeurs des champs
  async updatePDF() {
    if (!this.currentPDF) return;

    try {
      const pdf = new jsPDF();
      // Ici, vous devrez implémenter la logique pour mettre à jour
      // le PDF avec les valeurs des champs
      return pdf;
    } catch (error) {
      console.error("Erreur lors de la mise à jour du PDF:", error);
      throw error;
    }
  }

  // Exporter le PDF modifié
  async exportPDF(pdfBlob, fileName) {
    try {
      if (Capacitor.isNativePlatform()) {
        // Convertir le Blob en base64
        const reader = new FileReader();
        const base64Data = await new Promise((resolve) => {
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(pdfBlob);
        });

        // Sauvegarder le fichier sur iOS
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });

        return result.uri;
      } else {
        // Comportement web standard
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Erreur lors de l'export du PDF:", error);
      throw error;
    }
  }
}

export const referenceService = new ReferenceService();
