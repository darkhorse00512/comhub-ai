import getSupabaseClient from '../config/supabase';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const BUCKET_NAME = 'call-recordings';
const PLAY_AUDIO_BUCKET = 'Play Audio';
const VOICE_MODELS_BUCKET = 'Voice models';

class StorageService {
  private supabase = getSupabaseClient();
  private bucketInitialized = false;
  private playAudioBucketInitialized = false;
  private voiceModelsBucketInitialized = false;

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
        throw new Error(`Supabase storage error: ${listError.message}`);
      }

      const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
      logger.info(`Bucket '${BUCKET_NAME}' exists: ${bucketExists}`);

      if (!bucketExists) {
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
            throw new Error(`Failed to create bucket: ${createError.message}`);
          }
        } else {
          logger.info(`Storage bucket '${BUCKET_NAME}' created successfully`);
        }
      }

      this.bucketInitialized = true;
      logger.info(`Storage bucket '${BUCKET_NAME}' ready`);
    } catch (error) {
      logger.error('Failed to ensure bucket exists:', error);
      throw error;
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

    logger.info('Uploading audio to Supabase Storage...', {
      filename,
      callSessionId,
      type,
      bufferSize: audioBuffer.length,
    });

    const { error } = await this.supabase
      .storage
      .from(BUCKET_NAME)
      .upload(filename, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (error) {
      logger.error('Failed to upload audio to Supabase:', error);
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = this.supabase
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

    const publicUrl = urlData.publicUrl;

    logger.info('Audio uploaded to Supabase Storage successfully', {
      filename,
      callSessionId,
      type,
      url: publicUrl,
    });

    return publicUrl;
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

  async ensurePlayAudioBucketExists(): Promise<void> {
    if (this.playAudioBucketInitialized) return;

    try {
      const { data: buckets, error: listError } = await this.supabase
        .storage
        .listBuckets();

      if (listError) {
        throw new Error(`Supabase storage error: ${listError.message}`);
      }

      const bucketExists = buckets?.some(b => b.name === PLAY_AUDIO_BUCKET);

      if (!bucketExists) {
        const { error: createError } = await this.supabase
          .storage
          .createBucket(PLAY_AUDIO_BUCKET, {
            public: true,
            fileSizeLimit: 15728640, // 15MB
            allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/mp4', 'audio/x-m4a'],
          });

        if (createError && !createError.message.includes('already exists')) {
          throw new Error(`Failed to create bucket: ${createError.message}`);
        }
      }

      this.playAudioBucketInitialized = true;
    } catch (error) {
      logger.error('Failed to ensure Play Audio bucket exists:', error);
      throw error;
    }
  }

  async uploadPlayAudio(
    audioBuffer: Buffer,
    agentId: string,
    originalName: string
  ): Promise<string> {
    await this.ensurePlayAudioBucketExists();

    const uniqueId = uuidv4().slice(0, 8);
    const ext = originalName.split('.').pop()?.toLowerCase() || 'mp3';
    const filename = `${agentId}/${Date.now()}_${uniqueId}.${ext}`;

    const contentTypeMap: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
    };

    const { error } = await this.supabase
      .storage
      .from(PLAY_AUDIO_BUCKET)
      .upload(filename, audioBuffer, {
        contentType: contentTypeMap[ext] || 'audio/mpeg',
        upsert: true,
      });

    if (error) {
      logger.error('Failed to upload play audio:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: urlData } = this.supabase
      .storage
      .from(PLAY_AUDIO_BUCKET)
      .getPublicUrl(filename);

    logger.info('Play audio uploaded successfully', { filename, agentId });
    return urlData.publicUrl;
  }

  async deletePlayAudio(fileUrl: string): Promise<void> {
    try {
      const bucketPath = `/storage/v1/object/public/${PLAY_AUDIO_BUCKET}/`;
      const idx = fileUrl.indexOf(bucketPath);
      if (idx === -1) return;

      const filePath = decodeURIComponent(fileUrl.substring(idx + bucketPath.length));

      const { error } = await this.supabase
        .storage
        .from(PLAY_AUDIO_BUCKET)
        .remove([filePath]);

      if (error) {
        logger.error('Failed to delete play audio:', error);
      }
    } catch (error) {
      logger.error('Failed to delete play audio file:', error);
    }
  }

  // ===== Voice Models Bucket =====

  async ensureVoiceModelsBucketExists(): Promise<void> {
    if (this.voiceModelsBucketInitialized) return;

    try {
      const { data: buckets, error: listError } = await this.supabase
        .storage
        .listBuckets();

      if (listError) {
        throw new Error(`Supabase storage error: ${listError.message}`);
      }

      const bucketExists = buckets?.some(b => b.name === VOICE_MODELS_BUCKET);

      if (!bucketExists) {
        const { error: createError } = await this.supabase
          .storage
          .createBucket(VOICE_MODELS_BUCKET, {
            public: true,
            fileSizeLimit: 5242880, // 5MB
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          });

        if (createError && !createError.message.includes('already exists')) {
          throw new Error(`Failed to create bucket: ${createError.message}`);
        }
      }

      this.voiceModelsBucketInitialized = true;
    } catch (error) {
      logger.error('Failed to ensure Voice models bucket exists:', error);
      throw error;
    }
  }

  async uploadVoiceModelImage(
    imageBuffer: Buffer,
    originalName: string
  ): Promise<string> {
    await this.ensureVoiceModelsBucketExists();

    const uniqueId = uuidv4().slice(0, 8);
    const ext = originalName.split('.').pop()?.toLowerCase() || 'png';
    const filename = `${Date.now()}_${uniqueId}.${ext}`;

    const contentTypeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };

    const { error } = await this.supabase
      .storage
      .from(VOICE_MODELS_BUCKET)
      .upload(filename, imageBuffer, {
        contentType: contentTypeMap[ext] || 'image/png',
        upsert: true,
      });

    if (error) {
      logger.error('Failed to upload voice model image:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: urlData } = this.supabase
      .storage
      .from(VOICE_MODELS_BUCKET)
      .getPublicUrl(filename);

    logger.info('Voice model image uploaded successfully', { filename });
    return urlData.publicUrl;
  }

  async deleteVoiceModelImage(fileUrl: string): Promise<void> {
    try {
      const bucketPath = `/storage/v1/object/public/${VOICE_MODELS_BUCKET}/`;
      const idx = fileUrl.indexOf(bucketPath);
      if (idx === -1) return;

      const filePath = decodeURIComponent(fileUrl.substring(idx + bucketPath.length));

      const { error } = await this.supabase
        .storage
        .from(VOICE_MODELS_BUCKET)
        .remove([filePath]);

      if (error) {
        logger.error('Failed to delete voice model image:', error);
      }
    } catch (error) {
      logger.error('Failed to delete voice model image:', error);
    }
  }
}

export const storageService = new StorageService();
export default storageService;
