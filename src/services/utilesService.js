import { dbService } from './db';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

class UtilesService {
  /**
   * Charge les fichiers utiles d'un examen
   * @param {string} examId - L'ID de l'examen
   * @returns {Promise<Array>} - La liste des fichiers
   */
  async getFiles(examId) {
    try {
      const savedFiles = await dbService.getSection(examId, 'utiles-files');
      return savedFiles?.data ? JSON.parse(savedFiles.data) : [];
    } catch (error) {
      console.error('Erreur lors du chargement des fichiers:', error);
      throw error;
    }
  }

  /**
   * Sauvegarde un nouveau fichier
   * @param {string} examId - L'ID de l'examen
   * @param {Object} file - Le fichier à sauvegarder
   * @returns {Promise<void>}
   */
  async saveFile(examId, file) {
    try {
      const files = await this.getFiles(examId);
      files.push(file);
      await dbService.saveSection({
        examId,
        name: 'utiles-files',
        data: JSON.stringify(files),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du fichier:', error);
      throw error;
    }
  }

  /**
   * Vérifie et demande les permissions de la caméra
   * @returns {Promise<boolean>} - True si les permissions sont accordées
   */
  async checkCameraPermissions() {
    try {
      const permissionStatus = await Camera.checkPermissions();
      if (permissionStatus.camera === 'granted') {
        return true;
      }

      const requestResult = await Camera.requestPermissions();
      return requestResult.camera === 'granted';
    } catch (error) {
      console.error('Erreur lors de la vérification des permissions:', error);
      return false;
    }
  }

  /**
   * Prend une photo avec l'appareil photo
   * @returns {Promise<Object>} - Les données de l'image
   */
  async takePhoto() {
    try {
      // Vérifier les permissions d'abord
      const hasPermission = await this.checkCameraPermissions();
      if (!hasPermission) {
        throw new Error('Permission de la caméra refusée');
      }

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        correctOrientation: true,
        saveToGallery: true
      });

      if (!image || !image.base64String) {
        throw new Error('Aucune image n\'a été capturée');
      }

      return {
        base64String: image.base64String,
        format: image.format || 'jpeg',
        saved: image.saved || false
      };
    } catch (error) {
      console.error('Erreur lors de la prise de photo:', error);
      throw new Error(`Erreur lors de la prise de photo: ${error.message}`);
    }
  }

  /**
   * Supprime un fichier
   * @param {string} examId - L'ID de l'examen
   * @param {string} fileId - L'ID du fichier à supprimer
   * @returns {Promise<void>}
   */
  async deleteFile(examId, fileId) {
    try {
      const files = await this.getFiles(examId);
      const updatedFiles = files.filter(file => file.id !== fileId);
      await dbService.saveSection({
        examId,
        name: 'utiles-files',
        data: JSON.stringify(updatedFiles),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Erreur lors de la suppression du fichier:', error);
      throw error;
    }
  }

  /**
   * Renomme un fichier
   * @param {string} examId - L'ID de l'examen
   * @param {string} fileId - L'ID du fichier à renommer
   * @param {string} newName - Le nouveau nom du fichier
   * @returns {Promise<void>}
   */
  async renameFile(examId, fileId, newName) {
    try {
      const files = await this.getFiles(examId);
      const fileIndex = files.findIndex(file => file.id === fileId);
      
      if (fileIndex === -1) {
        throw new Error('Fichier non trouvé');
      }

      files[fileIndex] = {
        ...files[fileIndex],
        name: newName,
        updatedAt: new Date().toISOString()
      };

      await dbService.saveSection({
        examId,
        name: 'utiles-files',
        data: JSON.stringify(files),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Erreur lors du renommage du fichier:', error);
      throw error;
    }
  }
}

export const utilesService = new UtilesService(); 