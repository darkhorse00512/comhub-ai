import getSupabaseClient from '../config/supabase';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const BUCKET_NAME = 'call-recordings';

class StorageService {
  private supabase = getSupabaseClient();
  private bucketInitialized = false;

  async ensureBucketExists(): Promise<void> {
    if (this.bucketInitialized) return;

    try {
      // Check if bucket exists
      const { data: buckets, error: listError } = await this.supabase
        .storage
        .listBuckets();

      if (listError) {
        logger.error('Failed to list buckets:', listError);
        throw listError;
      }

      const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

      if (!bucketExists) {
        // Create bucket with public access for Twilio to fetch audio
        const { error: createError } = await this.supabase
          .storage
          .createBucket(BUCKET_NAME, {
            public: true,
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'],
          });

        if (createError && !createError.message.includes('already exists')) {
          logger.error('Failed to create bucket:', createError);
          throw createError;
        }

        logger.info(`Storage bucket '${BUCKET_NAME}' created`);
      }

      this.bucketInitialized = true;
      logger.info(`Storage bucket '${BUCKET_NAME}' ready`);
    } catch (error) {
      logger.error('Failed to ensure bucket exists:', error);
      // Continue anyway - bucket might already exist
      this.bucketInitialized = true;
    }
  }

  async uploadAudio(
    audioBuffer: Buffer,
    callSessionId: string,
    type: string
  ): Promise<string> {
    await this.ensureBucketExists();

    const filename = `${callSessionId}/${type}_${Date.now()}_${uuidv4().slice(0, 8)}.mp3`;

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
        throw error;
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
      logger.error('Failed to upload audio:', error);
      throw error;
    }
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
