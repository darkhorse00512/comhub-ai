import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import getSupabaseClient from '../config/supabase';
import logger from '../utils/logger';
import config from '../config';

interface AudioSegment {
  filePath: string;
  role: 'user' | 'ai';
  timestamp: number;
}

class RecordingService {
  private supabase = getSupabaseClient();
  private callAudioSegments: Map<string, AudioSegment[]> = new Map();
  private recordingsDir: string;
  private finalRecordingsDir: string;

  constructor() {
    this.recordingsDir = path.join(__dirname, '../../recordings/tts');
    this.finalRecordingsDir = path.join(__dirname, '../../recordings/calls');
    
    // Ensure directories exist
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
    }
    if (!fs.existsSync(this.finalRecordingsDir)) {
      fs.mkdirSync(this.finalRecordingsDir, { recursive: true });
    }
  }

  /**
   * Register an audio segment for a call
   */
  addAudioSegment(callSessionId: string, filePath: string, role: 'user' | 'ai'): void {
    if (!this.callAudioSegments.has(callSessionId)) {
      this.callAudioSegments.set(callSessionId, []);
    }
    
    this.callAudioSegments.get(callSessionId)?.push({
      filePath,
      role,
      timestamp: Date.now()
    });
    
    logger.debug('Audio segment added', { callSessionId, filePath, role });
  }

  /**
   * Get all audio segments for a call
   */
  getAudioSegments(callSessionId: string): AudioSegment[] {
    return this.callAudioSegments.get(callSessionId) || [];
  }

  /**
   * Get the path to a call's final recording
   */
  getRecordingPath(callSessionId: string): string {
    return path.join(this.finalRecordingsDir, `${callSessionId}.mp3`);
  }

  /**
   * Get the URL for a recording
   */
  getRecordingUrl(callSessionId: string): string {
    const port = config.server.port || 3000;
    return `/api/recordings/${callSessionId}.mp3`;
  }

  /**
   * Check if a recording exists for a call
   */
  recordingExists(callSessionId: string): boolean {
    const recordingPath = this.getRecordingPath(callSessionId);
    return fs.existsSync(recordingPath);
  }

  /**
   * Finalize recording when call ends - combine all segments
   */
  async finalizeRecording(callSessionId: string): Promise<string | null> {
    try {
      const segments = this.callAudioSegments.get(callSessionId);
      
      if (!segments || segments.length === 0) {
        logger.info('No audio segments to finalize', { callSessionId });
        return null;
      }

      // Sort segments by timestamp
      segments.sort((a, b) => a.timestamp - b.timestamp);

      // Filter to only existing files
      const existingSegments = segments.filter(s => fs.existsSync(s.filePath));
      
      if (existingSegments.length === 0) {
        logger.warn('No audio segment files found', { callSessionId });
        return null;
      }

      const finalPath = this.getRecordingPath(callSessionId);

      // If only one segment, just copy it
      if (existingSegments.length === 1) {
        fs.copyFileSync(existingSegments[0].filePath, finalPath);
        logger.info('Single segment recording copied', { callSessionId, finalPath });
      } else {
        // Combine multiple segments using ffmpeg or simple concatenation
        await this.combineAudioSegments(existingSegments.map(s => s.filePath), finalPath);
        logger.info('Recording segments combined', { 
          callSessionId, 
          segmentCount: existingSegments.length, 
          finalPath 
        });
      }

      // Save recording to database
      const recordingUrl = this.getRecordingUrl(callSessionId);
      await this.saveRecordingToDatabase(callSessionId, recordingUrl, finalPath);

      // Cleanup individual segments
      for (const segment of existingSegments) {
        try {
          fs.unlinkSync(segment.filePath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Clear from memory
      this.callAudioSegments.delete(callSessionId);

      return recordingUrl;
    } catch (error) {
      logger.error('Failed to finalize recording:', error);
      return null;
    }
  }

  /**
   * Combine multiple audio files into one (simple concatenation for MP3s)
   */
  private async combineAudioSegments(inputPaths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Try using ffmpeg if available
      const ffmpegCheck = spawn('ffmpeg', ['-version'], { shell: true });
      
      ffmpegCheck.on('error', () => {
        // ffmpeg not available, use simple buffer concatenation
        this.simpleConcatenate(inputPaths, outputPath)
          .then(resolve)
          .catch(reject);
      });

      ffmpegCheck.on('close', (code) => {
        if (code === 0) {
          // ffmpeg available, use it for better quality
          this.ffmpegConcatenate(inputPaths, outputPath)
            .then(resolve)
            .catch(() => {
              // Fallback to simple concatenation
              this.simpleConcatenate(inputPaths, outputPath)
                .then(resolve)
                .catch(reject);
            });
        } else {
          this.simpleConcatenate(inputPaths, outputPath)
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }

  /**
   * Use ffmpeg to concatenate audio files
   */
  private ffmpegConcatenate(inputPaths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create a file list for ffmpeg
      const listPath = path.join(this.finalRecordingsDir, `temp_${Date.now()}.txt`);
      const listContent = inputPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
      fs.writeFileSync(listPath, listContent);

      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-c', 'copy',
        outputPath
      ], { shell: true });

      ffmpeg.on('close', (code) => {
        // Cleanup temp file
        try { fs.unlinkSync(listPath); } catch (e) {}
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });
  }

  /**
   * Simple buffer concatenation for MP3 files
   */
  private async simpleConcatenate(inputPaths: string[], outputPath: string): Promise<void> {
    const buffers: Buffer[] = [];
    
    for (const inputPath of inputPaths) {
      const buffer = fs.readFileSync(inputPath);
      buffers.push(buffer);
    }

    const combined = Buffer.concat(buffers);
    fs.writeFileSync(outputPath, combined);
  }

  /**
   * Save recording metadata to database
   */
  private async saveRecordingToDatabase(
    callSessionId: string, 
    fileUrl: string, 
    filePath: string
  ): Promise<void> {
    try {
      const stats = fs.statSync(filePath);
      
      const { error } = await this.supabase
        .from('call_recordings')
        .insert({
          call_session_id: callSessionId,
          file_url: fileUrl,
          file_size: stats.size
        });

      if (error) {
        logger.error('Failed to save recording to database:', error);
        throw error;
      }

      logger.info('Recording saved to database', { callSessionId, fileUrl });
    } catch (error) {
      logger.error('Failed to save recording to database:', error);
      throw error;
    }
  }

  /**
   * Get recording URL from database for a call
   */
  async getRecordingUrlFromDb(callSessionId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('call_recordings')
        .select('file_url')
        .eq('call_session_id', callSessionId)
        .single();

      if (error || !data) {
        return null;
      }

      return data.file_url;
    } catch (error) {
      logger.error('Failed to get recording from database:', error);
      return null;
    }
  }

  /**
   * Get all recordings for a user's calls
   */
  async getRecordingsForCalls(callSessionIds: string[]): Promise<Map<string, string>> {
    const recordings = new Map<string, string>();
    
    if (callSessionIds.length === 0) return recordings;

    try {
      const { data, error } = await this.supabase
        .from('call_recordings')
        .select('call_session_id, file_url')
        .in('call_session_id', callSessionIds);

      if (error) {
        logger.error('Failed to get recordings:', error);
        return recordings;
      }

      for (const record of data || []) {
        recordings.set(record.call_session_id, record.file_url);
      }
    } catch (error) {
      logger.error('Failed to get recordings:', error);
    }

    return recordings;
  }
}

export const recordingService = new RecordingService();
export default recordingService;

