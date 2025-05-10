import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

class ExamService {
  constructor() {
    this.currentPDF = null;
  }

  // Charger la liste des fiches d'examen disponibles
  async getExamList() {
    // Liste des fiches d'examen présentes dans src/assets/fiche_examen
    return [
      {
        name: "Fiche Annie",
        path: new URL(
          "../assets/fiche_examen/examen-annie.pdf",
          import.meta.url
        ).href,
      },
    ];
  }

  // Charger une fiche d'examen spécifique
  async loadExamPDF(pdfPath) {
    try {
      console.log("Tentative de chargement de la fiche d'examen:", pdfPath);
      const response = await fetch(pdfPath);
      if (!response.ok) {
        console.error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      const pdfBlob = await response.blob();
      console.log("PDF chargé avec succès, taille:", pdfBlob.size, "bytes");
      this.currentPDF = pdfBlob;
      return pdfBlob;
    } catch (error) {
      console.error("Erreur lors du chargement de la fiche d'examen:", error);
      throw error;
    }
  }

  // Sauvegarder le PDF sur l'appareil
  async savePDFToDevice(pdfBlob, fileName) {
    // Vérifier si nous sommes sur iOS
    const isIOS = Capacitor.getPlatform() === 'ios';

    if (isIOS) {
      try {
        // Convertir le Blob en base64
        const reader = new FileReader();
        const base64Data = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(pdfBlob);
        });

        // Sauvegarder le fichier sur iOS
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });

        console.log('PDF sauvegardé avec succès sur iOS:', result.uri);
        return result.uri;
      } catch (error) {
        console.error('Erreur lors de la sauvegarde du PDF sur iOS:', error);
        throw error;
      }
    } else {
      // Méthode web standard
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return url;
    }
  }
}

export const examService = new ExamService();
