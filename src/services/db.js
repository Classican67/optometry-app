import { openDB } from "idb";

const DB_NAME = "optometry-app";
const DB_VERSION = 2;

console.log("Début de l'initialisation de la base de données...");

const dbPromise = (async () => {
  try {
    console.log("Tentative d'ouverture de la base de données...");
    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        console.log(
          "Mise à jour de la base de données, version actuelle:",
          oldVersion
        );

        if (oldVersion < 1) {
          console.log("Création des stores initiaux...");
          // Créer le store pour les examens
          if (!db.objectStoreNames.contains("exams")) {
            console.log("Création du store 'exams'");
            const examStore = db.createObjectStore("exams", { keyPath: "id" });
            examStore.createIndex("userId", "userId", { unique: false });
          }

          // Créer le store pour les sections
          if (!db.objectStoreNames.contains("sections")) {
            console.log("Création du store 'sections'");
            const sectionStore = db.createObjectStore("sections", {
              keyPath: ["examId", "sectionName"],
            });
            sectionStore.createIndex("examId", "examId", { unique: false });
          }
        }

        if (oldVersion < 2) {
          console.log("Mise à jour vers la version 2...");
          // Créer le store pour les utilisateurs
          if (!db.objectStoreNames.contains("users")) {
            console.log("Création du store 'users'");
            const userStore = db.createObjectStore("users", { keyPath: "id" });
            userStore.createIndex("username", "username", { unique: true });
          }

          // Créer le store des PDFs partiels
          if (!db.objectStoreNames.contains("pdfs")) {
            console.log("Création du store 'pdfs'");
            const pdfStore = db.createObjectStore("pdfs", {
              keyPath: ["userId", "examId", "sectionId"],
            });
            pdfStore.createIndex("by-exam", ["userId", "examId"]);
          }
        }
      },
    });
    console.log("Base de données ouverte avec succès");
    return db;
  } catch (error) {
    console.error(
      "Erreur critique lors de l'initialisation de la base de données:",
      error
    );
    throw new Error(
      `Impossible d'accéder à la base de données: ${error.message}`
    );
  }
})();

class DBService {
  constructor() {
    console.log("Création d'une nouvelle instance de DBService");
    this.db = null;
  }

  async init() {
    console.log("Début de l'initialisation du service DB...");
    if (!this.db) {
      try {
        console.log("Tentative de connexion à la base de données...");
        this.db = await dbPromise;
        console.log("Connexion à la base de données réussie");
        console.log("Stores disponibles:", this.db.objectStoreNames);
        return this.db;
      } catch (error) {
        console.error(
          "Erreur lors de l'initialisation de la base de données:",
          error
        );
        throw new Error(
          `Échec de l'initialisation de la base de données: ${error.message}`
        );
      }
    }
    return this.db;
  }

  async deleteDatabase() {
    try {
      console.log("Tentative de suppression de la base de données...");
      await indexedDB.deleteDatabase(DB_NAME);
      console.log("Base de données supprimée avec succès");
      this.db = null;
    } catch (error) {
      console.error(
        "Erreur lors de la suppression de la base de données:",
        error
      );
      throw new Error(
        `Impossible de supprimer la base de données: ${error.message}`
      );
    }
  }

  async resetDatabase() {
    try {
      console.log("Tentative de suppression de la base de données...");
      await indexedDB.deleteDatabase(DB_NAME);
      console.log("Base de données supprimée avec succès");
      this.db = null;
      // Réinitialiser la base de données
      await this.init();
      console.log("Base de données réinitialisée avec succès");
    } catch (error) {
      console.error(
        "Erreur lors de la réinitialisation de la base de données:",
        error
      );
      throw new Error(
        `Impossible de réinitialiser la base de données: ${error.message}`
      );
    }
  }

  // Gestion des utilisateurs
  async saveUser(user) {
    console.log("Tentative de sauvegarde de l'utilisateur:", user);
    if (!this.db) await this.init();
    try {
      const tx = this.db.transaction("users", "readwrite");
      const store = tx.objectStore("users");
      await store.put(user);
      await tx.done;
      console.log("Utilisateur sauvegardé avec succès:", user);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de l'utilisateur:", error);
      throw new Error("Impossible de sauvegarder l'utilisateur");
    }
  }

  async getUserByUsername(username) {
    console.log("Recherche de l'utilisateur par nom d'utilisateur:", username);
    if (!this.db) await this.init();
    try {
      const tx = this.db.transaction("users", "readonly");
      const store = tx.objectStore("users");
      const index = store.index("username");
      const user = await index.get(username);
      console.log("Résultat de la recherche:", user);
      return user;
    } catch (error) {
      console.error("Erreur lors de la recherche de l'utilisateur:", error);
      throw error;
    }
  }

  // Gestion des examens
  async saveExam(exam) {
    console.log("Tentative de sauvegarde de l'examen:", exam);
    if (!this.db) await this.init();
    try {
      const tx = this.db.transaction("exams", "readwrite");
      const store = tx.objectStore("exams");
      await store.put({
        ...exam,
        updatedAt: new Date().toISOString(),
        status: exam.status || "En cours",
      });
      await tx.done;
      console.log("Examen sauvegardé avec succès");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de l'examen:", error);
      throw new Error("Impossible de sauvegarder l'examen");
    }
  }

  async getExam(examId) {
    console.log("Récupération de l'examen:", examId);
    if (!this.db) await this.init();
    try {
      const tx = this.db.transaction("exams", "readonly");
      const store = tx.objectStore("exams");
      const exam = await store.get(examId);
      console.log("Examen trouvé:", exam);
      return exam;
    } catch (error) {
      console.error("Erreur lors de la récupération de l'examen:", error);
      throw error;
    }
  }

  async getUserExams(userId) {
    console.log("Récupération des examens de l'utilisateur:", userId);
    if (!this.db) await this.init();
    try {
      const tx = this.db.transaction("exams", "readonly");
      const store = tx.objectStore("exams");
      const index = store.index("userId");
      const exams = await index.getAll(userId);
      console.log("Examens trouvés pour l'utilisateur", userId, ":", exams);
      return exams.sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      );
    } catch (error) {
      console.error("Erreur lors de la récupération des examens:", error);
      return [];
    }
  }

  // Gestion des sections
  async saveSection(examId, sectionName, data) {
    console.log("Tentative de sauvegarde de la section:", {
      examId,
      sectionName,
      data,
    });
    if (!this.db) await this.init();
    try {
      const tx = this.db.transaction("sections", "readwrite");
      const store = tx.objectStore("sections");
      await store.put({ examId, sectionName, data });
      await tx.done;

      // Mettre à jour les informations de l'examen si c'est la section d'identification
      if (sectionName === "identification") {
        console.log("Mise à jour des informations du patient dans l'examen");
        const examTx = this.db.transaction("exams", "readwrite");
        const examStore = examTx.objectStore("exams");
        const exam = await examStore.get(examId);

        if (exam) {
          exam.patient = {
            ...exam.patient,
            ...data,
          };
          exam.updatedAt = new Date().toISOString();
          await examStore.put(exam);
        }

        await examTx.done;
      }
      console.log("Section sauvegardée avec succès");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la section:", error);
      throw new Error("Impossible de sauvegarder les données de la section");
    }
  }

  async getSection(examId, sectionName) {
    console.log("Récupération de la section:", { examId, sectionName });
    if (!this.db) await this.init();
    try {
      const tx = this.db.transaction("sections", "readonly");
      const store = tx.objectStore("sections");
      const section = await store.get([examId, sectionName]);
      console.log("Section trouvée:", section);
      return section;
    } catch (error) {
      console.error("Erreur lors de la récupération de la section:", error);
      throw error;
    }
  }

  async getAllSections(examId) {
    console.log("Récupération de toutes les sections pour l'examen:", examId);
    if (!this.db) await this.init();
    try {
      const tx = this.db.transaction("sections", "readonly");
      const store = tx.objectStore("sections");
      const index = store.index("examId");
      const sections = await index.getAll(examId);
      console.log("Sections trouvées:", sections);
      return sections.map((section) => ({
        ...section,
        updatedAt: new Date(section.updatedAt),
      }));
    } catch (error) {
      console.error("Erreur lors de la récupération des sections:", error);
      throw new Error("Impossible de récupérer les sections");
    }
  }

  async savePDF(userId, examId, sectionId, pdfBlob) {
    console.log("Tentative de sauvegarde du PDF:", {
      userId,
      examId,
      sectionId,
    });
    if (!this.db) await this.init();
    try {
      const tx = this.db.transaction("pdfs", "readwrite");
      const store = tx.objectStore("pdfs");
      await store.put({
        userId,
        examId,
        sectionId,
        pdf: pdfBlob,
        updatedAt: new Date().toISOString(),
      });
      await tx.done;
      console.log("PDF sauvegardé avec succès");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du PDF:", error);
      throw new Error("Impossible de sauvegarder le PDF");
    }
  }

  async getPDF(userId, examId, sectionId) {
    console.log("Récupération du PDF:", { userId, examId, sectionId });
    if (!this.db) await this.init();
    try {
      const tx = this.db.transaction("pdfs", "readonly");
      const store = tx.objectStore("pdfs");
      const pdf = await store.get([userId, examId, sectionId]);
      console.log("PDF trouvé:", pdf);
      if (pdf) {
        pdf.updatedAt = new Date(pdf.updatedAt);
      }
      return pdf;
    } catch (error) {
      console.error("Erreur lors de la récupération du PDF:", error);
      throw new Error("Impossible de récupérer le PDF");
    }
  }

  async deleteExam(userId, examId) {
    console.log("Tentative de suppression de l'examen:", { userId, examId });
    if (!this.db) await this.init();

    try {
      // Vérifier si l'examen existe avant de le supprimer
      const examTx = this.db.transaction("exams", "readonly");
      const examStore = examTx.objectStore("exams");
      const exam = await examStore.get(examId);
      await examTx.done;

      if (!exam) {
        console.log("L'examen n'existe pas:", examId);
        return;
      }

      // Supprimer l'examen
      const deleteExamTx = this.db.transaction("exams", "readwrite");
      const deleteExamStore = deleteExamTx.objectStore("exams");
      await deleteExamStore.delete(examId);
      await deleteExamTx.done;

      try {
        // Supprimer les sections associées si elles existent
        const sectionTx = this.db.transaction("sections", "readwrite");
        const sectionStore = sectionTx.objectStore("sections");
        const sectionIndex = sectionStore.index("examId");
        const sections = await sectionIndex.getAllKeys(examId);
        if (sections && sections.length > 0) {
          await Promise.all(sections.map((key) => sectionStore.delete(key)));
        }
        await sectionTx.done;
      } catch (sectionError) {
        console.log("Aucune section à supprimer pour l'examen:", examId);
      }

      try {
        // Supprimer les PDFs associés s'ils existent
        const pdfTx = this.db.transaction("pdfs", "readwrite");
        const pdfStore = pdfTx.objectStore("pdfs");
        const pdfIndex = pdfStore.index("by-exam");
        const pdfs = await pdfIndex.getAllKeys([userId, examId]);
        if (pdfs && pdfs.length > 0) {
          await Promise.all(pdfs.map((key) => pdfStore.delete(key)));
        }
        await pdfTx.done;
      } catch (pdfError) {
        console.log("Aucun PDF à supprimer pour l'examen:", examId);
      }

      console.log("Examen supprimé avec succès:", examId);
    } catch (error) {
      console.error("Erreur lors de la suppression de l'examen:", error);
      throw error;
    }
  }
}

export const dbService = new DBService();
