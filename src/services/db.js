import { deleteDB, openDB } from "idb";

const DB_NAME = "optometryDB";
const DB_VERSION = 4;

console.log("Début de l'initialisation de la base de données...");

// Fonction pour supprimer la base de données existante
const deleteExistingDB = async () => {
  try {
    await deleteDB(DB_NAME);
    console.log("Base de données supprimée avec succès");
  } catch (error) {
    console.error(
      "Erreur lors de la suppression de la base de données:",
      error
    );
  }
};

// Créer une promesse unique pour l'initialisation de la base de données
let dbPromise = null;

const getDBPromise = async () => {
  if (!dbPromise) {
    console.log("Début de l'initialisation du service DB...");
    try {
      console.log(
        "Tentative de connexion à la base de données:",
        DB_NAME,
        "version:",
        DB_VERSION
      );
      dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion) {
          console.log(
            "Mise à jour de la base de données de la version",
            oldVersion,
            "à",
            newVersion
          );
          console.log("Stores existants:", db.objectStoreNames);

          // Créer les object stores
          if (!db.objectStoreNames.contains("users")) {
            const userStore = db.createObjectStore("users", {
              keyPath: "id",
              autoIncrement: true,
            });
            userStore.createIndex("username", "username", { unique: true });
            console.log("Store 'users' créé");
          }

          if (!db.objectStoreNames.contains("exams")) {
            const examStore = db.createObjectStore("exams", {
              keyPath: "id",
              autoIncrement: true,
            });
            examStore.createIndex("userId", "userId");
            examStore.createIndex("date", "date");
            console.log("Store 'exams' créé avec les index userId et date");
          }

          if (!db.objectStoreNames.contains("sections")) {
            const sectionStore = db.createObjectStore("sections", {
              keyPath: ["examId", "name"],
            });
            sectionStore.createIndex("examId", "examId");
            console.log("Store 'sections' créé");
          }

          if (!db.objectStoreNames.contains("signatures")) {
            const signatureStore = db.createObjectStore("signatures", {
              keyPath: "id",
              autoIncrement: true,
            });
            signatureStore.createIndex("examId", "examId");
            console.log("Store 'signatures' créé");
          }
        },
        blocked() {
          console.warn("Base de données bloquée par une autre connexion");
        },
        blocking() {
          console.warn(
            "Une autre connexion tente de mettre à jour la base de données"
          );
        },
        terminated() {
          console.warn("Connexion à la base de données terminée");
          dbPromise = null;
        },
      });

      console.log("Base de données initialisée avec succès");
      return dbPromise;
    } catch (error) {
      console.error(
        "Erreur lors de l'initialisation de la base de données:",
        error
      );
      dbPromise = null;
      throw error;
    }
  }
  return dbPromise;
};

// Réinitialiser la promesse de la base de données
const resetDBPromise = () => {
  dbPromise = null;
};

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
        this.db = await getDBPromise();
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
      console.log("Début de la réinitialisation de la base de données...");
      await this.deleteDatabase();
      console.log(
        "Base de données supprimée, tentative de réinitialisation..."
      );
      this.db = await getDBPromise();
      console.log("Base de données réinitialisée avec succès");
      return this.db;
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

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await store.index("username").get(user.username);
      if (existingUser) {
        console.log("Mise à jour de l'utilisateur existant");
        user.id = existingUser.id;
        await store.put(user);
      } else {
        console.log("Création d'un nouvel utilisateur");
        await store.add(user);
      }

      await tx.done;
      console.log("Utilisateur sauvegardé avec succès:", user);
      return user;
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de l'utilisateur:", error);
      throw new Error(
        "Impossible de sauvegarder l'utilisateur: " + error.message
      );
    }
  }

  async getUserByUsername(username) {
    console.log("Recherche de l'utilisateur par nom d'utilisateur:", username);
    if (!this.db) await this.init();
    try {
      const tx = this.db.transaction("users", "readonly");
      const store = tx.objectStore("users");
      const user = await store.index("username").get(username);
      console.log("Résultat de la recherche:", user);
      await tx.done;
      return user;
    } catch (error) {
      console.error("Erreur lors de la recherche de l'utilisateur:", error);
      throw new Error("Impossible de trouver l'utilisateur: " + error.message);
    }
  }

  async getAllUsers() {
    console.log("Récupération de tous les utilisateurs");
    if (!this.db) await this.init();
    try {
      const tx = this.db.transaction("users", "readonly");
      const store = tx.objectStore("users");
      const users = await store.getAll();
      console.log("Utilisateurs trouvés:", users);
      await tx.done;
      return users;
    } catch (error) {
      console.error("Erreur lors de la récupération des utilisateurs:", error);
      throw new Error(
        "Impossible de récupérer les utilisateurs: " + error.message
      );
    }
  }

  // Gestion des examens
  async saveExam(exam) {
    console.log("Tentative de sauvegarde de l'examen:", exam);
    if (!this.db) await this.init();
    try {
      const tx = this.db.transaction("exams", "readwrite");
      const store = tx.objectStore("exams");

      // Vérifier si l'examen existe déjà
      const existingExam = await store.get(exam.id);

      if (existingExam) {
        // Mettre à jour l'examen existant
        await store.put(exam);
      } else {
        // Créer un nouvel examen
        const id = await store.add(exam);
        exam.id = id;
      }

      await tx.done;
      return exam;
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
      await tx.done;
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
      const exams = await store.getAll();
      // Filtrer les examens par userId
      const userExams = exams.filter((exam) => exam.userId === userId);
      console.log("Examens trouvés pour l'utilisateur", userId, ":", userExams);
      await tx.done;
      return userExams.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    } catch (error) {
      console.error("Erreur lors de la récupération des examens:", error);
      return [];
    }
  }

  // Gestion des sections
  async saveSection(section) {
    console.log("Tentative de sauvegarde de la section:", section);
    if (!this.db) await this.init();
    try {
      const tx = this.db.transaction("sections", "readwrite");
      const store = tx.objectStore("sections");

      // Vérifier si la section existe déjà
      const existingSection = await store.get([section.examId, section.name]);

      if (existingSection) {
        // Mettre à jour la section existante
        const updatedSection = {
          ...existingSection,
          data: section.data,
          updatedAt: section.updatedAt || new Date().toISOString(),
        };
        await store.put(updatedSection);
        return updatedSection;
      } else {
        // Créer une nouvelle section
        const newSection = {
          examId: section.examId,
          name: section.name,
          data: section.data,
          updatedAt: section.updatedAt || new Date().toISOString(),
        };
        await store.put(newSection);
        return newSection;
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la section:", error);
      throw new Error("Impossible de sauvegarder la section");
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
      await tx.done;
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
      await tx.done;
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
      await tx.done;
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

  // Méthodes pour la gestion des signatures
  async saveUserSignature(userId, signatureData) {
    const tx = this.db.transaction("signatures", "readwrite");
    const store = tx.objectStore("signatures");

    await store.put({
      userId,
      signatureData,
      createdAt: new Date().toISOString(),
    });
  }

  async getUserSignature(userId) {
    const tx = this.db.transaction("signatures", "readonly");
    const store = tx.objectStore("signatures");

    return await store.get(userId);
  }
}

export const dbService = new DBService();
