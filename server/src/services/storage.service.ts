import getSupabaseClient from '../config/supabase';
import config from '../config';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const BUCKET_NAME = 'call-recordings';

class StorageService {
  private supabase = getSupabaseClient();
  private bucketInitialized = false;
  private supabaseAvailable = true;

  async ensureBucketExists(): Promise<void> {
    if (this.bucketInitialized) return;

    try {
      logger.info('Checking Supabase storage bucket...');

      // Check if bucket exists
      const { data: buckets, error: listError } = await this.supabase
        .storage
        .listBuckets();

      if (listError) {
        logger.error('Failed to list buckets:', listError);
        // If we can't list buckets, Supabase storage might not be properly configured
        this.supabaseAvailable = false;
      }

      const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
      logger.info(`Bucket '${BUCKET_NAME}' exists: ${bucketExists}`);

      if (!bucketExists && this.supabaseAvailable) {
        // Create bucket with public access for Twilio to fetch audio
        logger.info(`Creating bucket '${BUCKET_NAME}'...`);
        const { error: createError } = await this.supabase
          .storage
          .createBucket(BUCKET_NAME, {
            public: true,
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'],
          });

        if (createError) {
          if (createError.message.includes('already exists')) {
            logger.info(`Bucket '${BUCKET_NAME}' already exists`);
          } else {
            logger.error('Failed to create bucket:', createError);
            this.supabaseAvailable = false;
          }
        } else {
          logger.info(`Storage bucket '${BUCKET_NAME}' created successfully`);
        }
      }

      this.bucketInitialized = true;
      logger.info(`Storage bucket '${BUCKET_NAME}' ready, supabaseAvailable: ${this.supabaseAvailable}`);
    } catch (error) {
      logger.error('Failed to ensure bucket exists:', error);
      this.supabaseAvailable = false;
      this.bucketInitialized = true;
    }
  }

  async uploadAudio(
    audioBuffer: Buffer,
    callSessionId: string,
    type: string
  ): Promise<string> {
    await this.ensureBucketExists();

    const uniqueId = uuidv4().slice(0, 8);
    const filename = `${callSessionId}/${type}_${Date.now()}_${uniqueId}.mp3`;

    // Always save locally first for serving
    const localDir = path.join(__dirname, '../../public/audio', callSessionId);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const localFilename = `${type}_${Date.now()}_${uniqueId}.mp3`;
    const localPath = path.join(localDir, localFilename);
    fs.writeFileSync(localPath, audioBuffer);

    // Local URL that can be served by Express
    const localUrl = `${config.server.apiBaseUrl}/audio/${callSessionId}/${localFilename}`;
    logger.info('Audio saved locally', { localPath, localUrl });

    // Try Supabase upload if available
    if (this.supabaseAvailable) {
      try {
        const { data, error } = await this.supabase
          .storage
          .from(BUCKET_NAME)
          .upload(filename, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        if (error) {
          logger.error('Failed to upload audio to Supabase:', error);
          // Fall back to local URL
          return localUrl;
        }

        // Get public URL
        const { data: urlData } = this.supabase
          .storage
          .from(BUCKET_NAME)
          .getPublicUrl(filename);

        const publicUrl = urlData.publicUrl;

        logger.info('Audio uploaded to Supabase Storage', {
          filename,
          callSessionId,
          type,
          url: publicUrl,
        });

        return publicUrl;
      } catch (error) {
        logger.error('Failed to upload audio to Supabase:', error);
        // Fall back to local URL
        return localUrl;
      }
    }

    // Return local URL if Supabase not available
    logger.info('Using local audio URL (Supabase not available)', { url: localUrl });
    return localUrl;
  }

  async deleteCallRecordings(callSessionId: string): Promise<void> {
    try {
      const { data: files, error: listError } = await this.supabase
        .storage
        .from(BUCKET_NAME)
        .list(callSessionId);

      if (listError) {
        logger.error('Failed to list recordings:', listError);
        return;
      }

      if (files && files.length > 0) {
        const filePaths = files.map(f => `${callSessionId}/${f.name}`);
        const { error: deleteError } = await this.supabase
          .storage
          .from(BUCKET_NAME)
          .remove(filePaths);

        if (deleteError) {
          logger.error('Failed to delete recordings:', deleteError);
        } else {
          logger.info(`Deleted ${files.length} recordings for call ${callSessionId}`);
        }
      }
    } catch (error) {
      logger.error('Failed to delete call recordings:', error);
    }
  }

  getPublicUrl(filename: string): string {
    const { data } = this.supabase
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

    return data.publicUrl;
  }
}

export const storageService = new StorageService();
export default storageService;
