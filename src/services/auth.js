import { dbService } from "./db";

class AuthService {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  async init() {
    try {
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        this.currentUser = JSON.parse(savedUser);
      }
    } catch (error) {
      console.error(
        "Erreur lors de l'initialisation du service d'authentification:",
        error
      );
      this.currentUser = null;
      localStorage.removeItem("user");
    }
  }

  async register(username, password, nom, prenom, numeroOrdre) {
    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await dbService.getUserByUsername(username);
      if (existingUser) {
        throw new Error("Cet identifiant est déjà utilisé");
      }

      // Créer un nouvel utilisateur
      const newUser = {
        id: Date.now().toString(),
        username,
        password, // Note: En production, il faudrait hasher le mot de passe
        nom,
        prenom,
        numeroOrdre,
        createdAt: new Date().toISOString(),
      };

      // Sauvegarder l'utilisateur
      await dbService.saveUser(newUser);

      // Mettre à jour l'utilisateur courant
      this.currentUser = newUser;
      localStorage.setItem("user", JSON.stringify(this.currentUser));

      return this.currentUser;
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);
      throw new Error(
        error.message || "Une erreur est survenue lors de l'inscription"
      );
    }
  }

  async login(username, password) {
    try {
      const user = await dbService.getUserByUsername(username);
      if (!user || user.password !== password) {
        throw new Error("Identifiant ou mot de passe incorrect");
      }

      this.currentUser = user;
      localStorage.setItem("user", JSON.stringify(this.currentUser));
      return this.currentUser;
    } catch (error) {
      console.error("Erreur lors de la connexion:", error);
      throw new Error(
        error.message || "Une erreur est survenue lors de la connexion"
      );
    }
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem("user");
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  getCurrentUser() {
    return this.currentUser;
  }
}

export const authService = new AuthService();
