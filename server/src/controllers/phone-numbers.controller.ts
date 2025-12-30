import { Request, Response } from 'express';
import getSupabaseClient from '../config/supabase';
import logger from '../utils/logger';
import twilio from 'twilio';
import config from '../config';

class PhoneNumbersController {
  private supabase = getSupabaseClient();
  private twilioClient: twilio.Twilio | null = null;

  constructor() {
    if (config.twilio.accountSid && config.twilio.authToken) {
      this.twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
    }
  }

  // Get all phone numbers for the authenticated user
  getPhoneNumbers = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { data: phoneNumbers, error } = await this.supabase
        .from('phone_numbers')
        .select(`
          *,
          groups:group_id (
            id,
            name
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch phone numbers:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch phone numbers' });
        return;
      }

      res.status(200).json({ success: true, data: phoneNumbers });
    } catch (error) {
      logger.error('Error in getPhoneNumbers:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  // Get a single phone number
  getPhoneNumber = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { data: phoneNumber, error } = await this.supabase
        .from('phone_numbers')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error || !phoneNumber) {
        res.status(404).json({ success: false, error: 'Phone number not found' });
        return;
      }

      res.status(200).json({ success: true, data: phoneNumber });
    } catch (error) {
      logger.error('Error in getPhoneNumber:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  // Import an existing Twilio phone number
  importPhoneNumber = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { accountSid, authToken, phoneNumberSid } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (!accountSid || !authToken || !phoneNumberSid) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: accountSid, authToken, phoneNumberSid',
        });
        return;
      }

      // Create Twilio client with user's credentials
      const userTwilioClient = twilio(accountSid, authToken);

      // Fetch phone number details from Twilio
      let twilioPhoneNumber;
      try {
        twilioPhoneNumber = await userTwilioClient
          .incomingPhoneNumbers(phoneNumberSid)
          .fetch();
      } catch (twilioError: any) {
        logger.error('Failed to fetch Twilio phone number:', twilioError);
        res.status(400).json({
          success: false,
          error: 'Failed to fetch phone number from Twilio. Please check your credentials and SID.',
        });
        return;
      }

      // Extract country code from phone number (+49... -> DE, +1... -> US, etc.)
      const phoneNumber = twilioPhoneNumber.phoneNumber;
      let countryCode = '';
      let country = '';

      if (phoneNumber.startsWith('+49')) {
        countryCode = 'DE';
        country = 'Germany';
      } else if (phoneNumber.startsWith('+1')) {
        countryCode = 'US';
        country = 'United States';
      } else if (phoneNumber.startsWith('+44')) {
        countryCode = 'GB';
        country = 'United Kingdom';
      } else if (phoneNumber.startsWith('+353')) {
        countryCode = 'IE';
        country = 'Ireland';
      } else {
        countryCode = twilioPhoneNumber.isoCountry || 'Unknown';
        country = countryCode;
      }

      // Check if phone number already exists
      const { data: existing } = await this.supabase
        .from('phone_numbers')
        .select('id')
        .eq('phone_number', phoneNumber)
        .single();

      if (existing) {
        res.status(400).json({
          success: false,
          error: 'This phone number is already imported',
        });
        return;
      }

      // Insert phone number into database
      const { data: newPhoneNumber, error: insertError } = await this.supabase
        .from('phone_numbers')
        .insert({
          user_id: userId,
          phone_number: phoneNumber,
          friendly_name: twilioPhoneNumber.friendlyName,
          country_code: countryCode,
          country: country,
          type: 'imported',
          status: 'active',
          twilio_account_sid: accountSid,
          twilio_phone_number_sid: phoneNumberSid,
          twilio_capabilities: {
            voice: twilioPhoneNumber.capabilities?.voice || false,
            sms: twilioPhoneNumber.capabilities?.sms || false,
            mms: twilioPhoneNumber.capabilities?.mms || false,
          },
        })
        .select()
        .single();

      if (insertError) {
        logger.error('Failed to insert phone number:', insertError);
        res.status(500).json({
          success: false,
          error: 'Failed to save phone number to database',
        });
        return;
      }

      logger.info('Phone number imported successfully', {
        phoneNumber,
        userId,
      });

      res.status(201).json({
        success: true,
        data: newPhoneNumber,
        message: 'Phone number imported successfully',
      });
    } catch (error) {
      logger.error('Error in importPhoneNumber:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  // Purchase a new Twilio phone number (future feature)
  purchasePhoneNumber = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(501).json({
        success: false,
        error: 'Phone number purchasing is not yet available. Please use the import feature.',
      });
    } catch (error) {
      logger.error('Error in purchasePhoneNumber:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  // Update phone number settings
  updatePhoneNumber = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      const { friendly_name, group_id, status } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      // Verify ownership
      const { data: phoneNumber } = await this.supabase
        .from('phone_numbers')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (!phoneNumber) {
        res.status(404).json({ success: false, error: 'Phone number not found' });
        return;
      }

      // Update phone number
      const updateData: any = {};
      if (friendly_name !== undefined) updateData.friendly_name = friendly_name;
      if (group_id !== undefined) updateData.group_id = group_id;
      if (status !== undefined) updateData.status = status;

      const { data: updated, error } = await this.supabase
        .from('phone_numbers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update phone number:', error);
        res.status(500).json({ success: false, error: 'Failed to update phone number' });
        return;
      }

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Phone number updated successfully',
      });
    } catch (error) {
      logger.error('Error in updatePhoneNumber:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  // Delete a phone number
  deletePhoneNumber = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      // Verify ownership
      const { data: phoneNumber } = await this.supabase
        .from('phone_numbers')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (!phoneNumber) {
        res.status(404).json({ success: false, error: 'Phone number not found' });
        return;
      }

      // Delete phone number
      const { error } = await this.supabase
        .from('phone_numbers')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error('Failed to delete phone number:', error);
        res.status(500).json({ success: false, error: 'Failed to delete phone number' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Phone number deleted successfully',
      });
    } catch (error) {
      logger.error('Error in deletePhoneNumber:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };
}

export default new PhoneNumbersController();
