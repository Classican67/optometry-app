import { dbService } from "./db";

class AuthService {
  constructor() {
    this.currentUser = null;
  }

  async init() {
    // S'assurer que la base de données est initialisée
    await dbService.init();
  }

  async register(username, password) {
    try {
      await this.init();

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
        name: username,
        createdAt: new Date().toISOString(),
      };

      // Sauvegarder l'utilisateur
      await dbService.saveUser(newUser);
      this.currentUser = newUser;
      localStorage.setItem("user", JSON.stringify(this.currentUser));
      return this.currentUser;
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);
      throw error;
    }
  }

  async login(username, password) {
    try {
      await this.init();

      const user = await dbService.getUserByUsername(username);
      if (!user || user.password !== password) {
        throw new Error("Identifiant ou mot de passe incorrect");
      }

      this.currentUser = user;
      localStorage.setItem("user", JSON.stringify(this.currentUser));
      return this.currentUser;
    } catch (error) {
      console.error("Erreur lors de la connexion:", error);
      throw error;
    }
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem("user");
  }

  getCurrentUser() {
    if (!this.currentUser) {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
      }
    }
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.getCurrentUser();
  }
}

export const authService = new AuthService();
