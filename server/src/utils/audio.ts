import fs from 'fs';
import path from 'path';
import logger from './logger';

export class AudioUtils {
  static ensureRecordingsDirectory(subDir?: string): string {
    const baseDir = path.join(__dirname, '../../recordings');
    const targetDir = subDir ? path.join(baseDir, subDir) : baseDir;

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      logger.info('Recordings directory created', { path: targetDir });
    }

    return targetDir;
  }

  static generateAudioFileName(
    callId: string,
    type: 'stt' | 'tts' | 'recording',
    extension: string = 'wav'
  ): string {
    const timestamp = Date.now();
    return `${type}_${callId}_${timestamp}.${extension}`;
  }

  static saveAudioBuffer(
    buffer: Buffer,
    fileName: string,
    subDir?: string
  ): string {
    try {
      const dir = this.ensureRecordingsDirectory(subDir);
      const filePath = path.join(dir, fileName);

      fs.writeFileSync(filePath, buffer);

      logger.info('Audio buffer saved', {
        fileName,
        size: buffer.length,
        path: filePath,
      });

      return filePath;
    } catch (error) {
      logger.error('Failed to save audio buffer:', error);
      throw new Error(`Failed to save audio: ${error}`);
    }
  }

  static deleteAudioFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info('Audio file deleted', { filePath });
      }
    } catch (error) {
      logger.error('Failed to delete audio file:', error);
    }
  }

  static getAudioFileDuration(filePath: string): number | null {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      logger.error('Failed to get audio file duration:', error);
      return null;
    }
  }

  static convertBufferToBase64(buffer: Buffer): string {
    return buffer.toString('base64');
  }

  static convertBase64ToBuffer(base64: string): Buffer {
    return Buffer.from(base64, 'base64');
  }

  static async cleanupOldRecordings(maxAgeInDays: number = 30): Promise<void> {
    try {
      const recordingsDir = this.ensureRecordingsDirectory();
      const files = fs.readdirSync(recordingsDir);
      const now = Date.now();
      const maxAge = maxAgeInDays * 24 * 60 * 60 * 1000;

      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(recordingsDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      logger.info('Old recordings cleaned up', {
        maxAgeInDays,
        deletedCount,
      });
    } catch (error) {
      logger.error('Failed to cleanup old recordings:', error);
    }
  }
}

export default AudioUtils;
