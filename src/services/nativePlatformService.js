import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

class NativePlatformService {
  /**
   * Vérifie si l'application tourne sur une plateforme native
   * @returns {boolean}
   */
  isNativePlatform() {
    return Capacitor.isNativePlatform();
  }

  /**
   * Gère l'export de fichiers en fonction de la plateforme
   * @param {Blob} fileBlob - Le blob du fichier à exporter
   * @param {string} fileName - Le nom du fichier
   * @returns {Promise<string>} - L'URI du fichier sur iOS ou undefined sur web
   */
  async handleFileExport(fileBlob, fileName) {
    try {
      if (this.isNativePlatform()) {
        return await this.shareFile(fileBlob, fileName);
      } else {
        return await this.saveToWeb(fileBlob, fileName);
      }
    } catch (error) {
      console.error("Erreur lors de l'export du fichier:", error);
      throw error;
    }
  }

  /**
   * Partage un fichier via le menu de partage natif (iOS)
   * @param {Blob} fileBlob - Le blob du fichier
   * @param {string} fileName - Le nom du fichier
   * @returns {Promise<string>} - L'URI du fichier temporaire
   */
  async shareFile(fileBlob, fileName) {
    try {
      // Convertir le Blob en base64
      const reader = new FileReader();
      const base64Data = await new Promise((resolve) => {
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(fileBlob);
      });

      // Sauvegarder temporairement le fichier
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });

      // Partager le fichier
      await Share.share({
        title: 'Partager le document',
        text: 'Voici le document PDF',
        url: result.uri,
        dialogTitle: 'Partager le document'
      });

      // Nettoyer le fichier temporaire après le partage
      await Filesystem.deleteFile({
        path: fileName,
        directory: Directory.Cache
      });

      return result.uri;
    } catch (error) {
      console.error("Erreur lors du partage du fichier:", error);
      throw error;
    }
  }

  /**
   * Sauvegarde un fichier sur le web
   * @param {Blob} fileBlob - Le blob du fichier
   * @param {string} fileName - Le nom du fichier
   */
  async saveToWeb(fileBlob, fileName) {
    const url = URL.createObjectURL(fileBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
}

export const nativePlatformService = new NativePlatformService(); 