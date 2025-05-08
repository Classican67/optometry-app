class ExamService {
  constructor() {
    this.currentPDF = null;
  }

  // Charger la liste des fiches d'examen disponibles
  async getExamList() {
    // Liste des fiches d'examen présentes dans public/fiche_examen
    return [
      {
        name: "Fiche Annie",
        path: "/optometryDB/fiche_examen/examen-annie.pdf",
      },
    ];
  }

  // Charger une fiche d'examen spécifique
  async loadExamPDF(pdfPath) {
    try {
      console.log("Tentative de chargement de la fiche d'examen:", pdfPath);
      const response = await fetch(pdfPath);
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      const pdfBlob = await response.blob();
      this.currentPDF = pdfBlob;
      return pdfBlob;
    } catch (error) {
      console.error("Erreur lors du chargement de la fiche d'examen:", error);
      throw error;
    }
  }
}

export const examService = new ExamService();
