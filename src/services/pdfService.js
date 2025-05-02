import { jsPDF } from "jspdf";
import { dbService } from "./db";

// Couleurs pour les différentes sections
const COLORS = {
  identification: "#E3F2FD", // Bleu clair
  histoire: "#F3E5F5", // Violet clair
  "refraction-objective": "#E8F5E9", // Vert clair
  "refraction-subjective": "#FFF3E0", // Orange clair
  lesions: "#FFEBEE", // Rouge clair
};

// Styles pour les titres de section
const SECTION_STYLES = {
  fontSize: 14,
  fontStyle: "bold",
  textColor: "#1976D2", // Bleu
};

// Styles pour les labels
const LABEL_STYLES = {
  fontSize: 10,
  fontStyle: "bold",
  textColor: "#424242", // Gris foncé
};

// Styles pour les valeurs
const VALUE_STYLES = {
  fontSize: 10,
  textColor: "#000000", // Noir
};

export const pdfService = {
  async generateSectionPDF(examId, sectionName, data) {
    try {
      console.log("Début de la génération du PDF de section:", {
        examId,
        sectionName,
        data,
      });

      if (!examId || !sectionName) {
        throw new Error("ID d'examen et nom de section requis");
      }

      const doc = new jsPDF();

      // En-tête avec logo
      doc.setFontSize(20);
      doc.setTextColor(33, 150, 243); // Bleu
      doc.text("Examen Optométrique", 20, 20);
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text("Rapport de consultation", 20, 30);

      // Section avec boîte colorée
      const sectionColor = COLORS[sectionName] || "#FFFFFF";
      doc.setFillColor(sectionColor);
      doc.rect(15, 40, 180, 20, "F");

      // Titre de section
      doc.setFontSize(SECTION_STYLES.fontSize);
      doc.setTextColor(SECTION_STYLES.textColor);
      doc.text(`Section: ${this.formatSectionName(sectionName)}`, 20, 55);

      // Contenu
      let y = 70;
      if (data && typeof data === "object") {
        Object.entries(data).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            // Label
            doc.setFontSize(LABEL_STYLES.fontSize);
            doc.setTextColor(LABEL_STYLES.textColor);
            doc.text(`${this.formatLabel(key)}:`, 20, y);

            // Valeur
            doc.setFontSize(VALUE_STYLES.fontSize);
            doc.setTextColor(VALUE_STYLES.textColor);
            doc.text(this.formatValue(value), 60, y);

            y += 10;
          }
        });
      } else if (
        data &&
        typeof data === "string" &&
        data.startsWith("data:image")
      ) {
        const img = new Image();
        img.src = data;
        doc.addImage(img, "PNG", 20, y, 170, 170);
      }

      // Pied de page
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("© 2024 Cabinet d'Optométrie - Tous droits réservés", 20, 280);

      // Sauvegarde dans IndexedDB
      const pdfBlob = doc.output("blob");
      await dbService.saveSection(examId, `${sectionName}_pdf`, pdfBlob);

      return pdfBlob;
    } catch (error) {
      console.error("Erreur lors de la génération du PDF de section:", error);
      throw new Error(
        `Impossible de générer le PDF pour la section ${sectionName}: ${error.message}`
      );
    }
  },

  async generateFinalPDF(examId) {
    try {
      console.log("Début de la génération du PDF final pour l'examen:", examId);

      if (!examId) {
        throw new Error("ID d'examen requis");
      }

      const doc = new jsPDF();
      const sections = await dbService.getAllSections(examId);

      if (!sections || sections.length === 0) {
        throw new Error("Aucune section trouvée pour cet examen");
      }

      // En-tête avec logo
      doc.setFontSize(20);
      doc.setTextColor(33, 150, 243); // Bleu
      doc.text("Examen Optométrique", 20, 20);
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text("Rapport complet de consultation", 20, 30);

      let y = 50;
      for (const section of sections) {
        if (section.sectionName.endsWith("_pdf")) continue;

        // Section avec boîte colorée
        const sectionColor = COLORS[section.sectionName] || "#FFFFFF";
        doc.setFillColor(sectionColor);
        doc.rect(15, y - 10, 180, 20, "F");

        // Titre de section
        doc.setFontSize(SECTION_STYLES.fontSize);
        doc.setTextColor(SECTION_STYLES.textColor);
        doc.text(
          `Section: ${this.formatSectionName(section.sectionName)}`,
          20,
          y + 5
        );

        y += 20;

        if (section.data && typeof section.data === "object") {
          Object.entries(section.data).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              // Label
              doc.setFontSize(LABEL_STYLES.fontSize);
              doc.setTextColor(LABEL_STYLES.textColor);
              doc.text(`${this.formatLabel(key)}:`, 20, y);

              // Valeur
              doc.setFontSize(VALUE_STYLES.fontSize);
              doc.setTextColor(VALUE_STYLES.textColor);
              doc.text(this.formatValue(value), 60, y);

              y += 10;
            }
          });
        } else if (
          section.data &&
          typeof section.data === "string" &&
          section.data.startsWith("data:image")
        ) {
          const img = new Image();
          img.src = section.data;
          doc.addImage(img, "PNG", 20, y, 170, 170);
          y += 180;
        }

        // Nouvelle page si nécessaire
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
      }

      // Pied de page
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("© 2024 Cabinet d'Optométrie - Tous droits réservés", 20, 280);

      return doc.output("blob");
    } catch (error) {
      console.error("Erreur lors de la génération du PDF final:", error);
      throw new Error(`Impossible de générer le PDF final: ${error.message}`);
    }
  },

  formatSectionName(name) {
    const names = {
      identification: "Identification du patient",
      histoire: "Histoire de cas",
      "refraction-objective": "Réfraction objective",
      "refraction-subjective": "Réfraction subjective",
      lesions: "Dessin des lésions",
    };
    return names[name] || name;
  },

  formatLabel(key) {
    const labels = {
      nom: "Nom",
      prenom: "Prénom",
      dateNaissance: "Date de naissance",
      telephone: "Téléphone",
      email: "Email",
      adresse: "Adresse",
      numeroSecu: "Numéro de sécurité sociale",
      mutuelle: "Mutuelle",
      motifConsultation: "Motif de consultation",
      antecedents: "Antécédents médicaux",
      antecedentsFamiliaux: "Antécédents familiaux",
      traitements: "Traitements en cours",
      allergies: "Allergies",
      habitudesVisuelles: "Habitudes visuelles",
      od: "Œil droit",
      og: "Œil gauche",
      sphere: "Sphère",
      cylindre: "Cylindre",
      axe: "Axe",
      vision: "Vision",
      add: "Addition",
      notes: "Notes",
    };
    return labels[key] || key;
  },

  formatValue(value) {
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return value;
  },
};
