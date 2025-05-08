import { jsPDF } from "jspdf";

class ReferenceService {
  constructor() {
    this.currentPDF = null;
    this.fields = new Map();
  }

  // Charger la liste des PDFs disponibles
  async getPDFList() {
    // Liste des PDFs présents dans public/pdfs (mise à jour manuelle)
    return [
      {
        name: "Groupe IOL",
        path: "/optometryDB/pdfs/Groupe IOL.pdf",
      },
      {
        name: "Clinique Belle Vue",
        path: "/optometryDB/pdfs/Clinique Belle Vue.pdf",
      },
      {
        name: "Université de Montréal",
        path: "/optometryDB/pdfs/Université de Montréal.pdf",
      },
      {
        name: "Clinique de la Rétine de l'Est de Montréal",
        path: "/optometryDB/pdfs/Clinique de la Rétine de l'Est de Montréal.pdf",
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
  async exportPDF() {
    try {
      const pdf = await this.updatePDF();
      pdf.save("document_modifie.pdf");
    } catch (error) {
      console.error("Erreur lors de l'export du PDF:", error);
      throw error;
    }
  }
}

export const referenceService = new ReferenceService();
