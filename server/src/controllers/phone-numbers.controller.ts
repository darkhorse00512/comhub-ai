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

  // Search for available phone numbers without purchasing
  searchAvailableNumbers = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { countryCode, areaCode, capabilities, limit = 10 } = req.query;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (!countryCode) {
        res.status(400).json({ success: false, error: 'Country code is required' });
        return;
      }

      // Use platform's Twilio account to search
      const twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      // Build search criteria
      const searchOptions: any = { limit: Math.min(Number(limit), 20) }; // Max 20 results

      if (areaCode && areaCode !== '') {
        searchOptions.areaCode = String(areaCode);
      }

      if (capabilities) {
        const caps = JSON.parse(String(capabilities));
        if (caps.voice) searchOptions.voiceEnabled = true;
        if (caps.sms) searchOptions.smsEnabled = true;
      }

      logger.info('Searching for available phone numbers', {
        countryCode,
        searchOptions,
        userId
      });

      // Search for available phone numbers
      const availableNumbers = await twilioClient
        .availablePhoneNumbers(String(countryCode))
        .local
        .list(searchOptions);

      logger.info('Available numbers found', { count: availableNumbers?.length });

      if (!availableNumbers || availableNumbers.length === 0) {
        res.status(404).json({
          success: false,
          error: `No available phone numbers found for country code ${countryCode}${areaCode ? ` and area code ${areaCode}` : ''}. Try a different country or remove the area code filter.`,
          data: []
        });
        return;
      }

      // Format the response with useful information
      const allNumbers = availableNumbers.map(number => ({
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        locality: number.locality,
        region: number.region,
        isoCountry: number.isoCountry,
        capabilities: {
          voice: number.capabilities?.voice || false,
          sms: number.capabilities?.sms || false,
          mms: number.capabilities?.mms || false,
        },
        addressRequirements: number.addressRequirements || 'none',
      }));

      // Filter out numbers that require addresses (regulatory compliance not yet implemented)
      const formattedNumbers = allNumbers.filter(num => num.addressRequirements === 'none');

      logger.info('Filtered numbers by address requirements', {
        total: allNumbers.length,
        available: formattedNumbers.length,
        filtered: allNumbers.length - formattedNumbers.length
      });

      if (formattedNumbers.length === 0 && allNumbers.length > 0) {
        res.status(404).json({
          success: false,
          error: `All available numbers in ${countryCode} require address verification for regulatory compliance. This feature is not yet implemented. Try a different country like US, CA, or GB.`,
          data: []
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: formattedNumbers,
        count: formattedNumbers.length,
        message: formattedNumbers.length < allNumbers.length
          ? `Showing ${formattedNumbers.length} of ${allNumbers.length} numbers (${allNumbers.length - formattedNumbers.length} require address verification)`
          : undefined
      });
    } catch (error) {
      logger.error('Error in searchAvailableNumbers:', error);

      if (error instanceof Error) {
        if (error.message.includes('21452') || error.message.includes('geo permissions')) {
          res.status(403).json({
            success: false,
            error: 'Your Twilio account does not have permission to search numbers in this country. Enable it in Twilio Console → Phone Numbers → Regulatory Compliance.',
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: 'Failed to search available phone numbers',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Purchase a new Twilio phone number
  purchasePhoneNumber = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { phoneNumber, countryCode } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (!phoneNumber) {
        res.status(400).json({ success: false, error: 'Phone number is required' });
        return;
      }

      // Use platform's Twilio account to purchase
      const twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      logger.info('Purchasing phone number', { phoneNumber, userId });

      // Purchase the phone number
      const purchasedNumber = await twilioClient.incomingPhoneNumbers.create({
        phoneNumber: phoneNumber,
        voiceUrl: `${process.env.API_BASE_URL}/api/twilio/voice`,
        voiceMethod: 'POST',
        statusCallback: `${process.env.API_BASE_URL}/api/twilio/status`,
        statusCallbackMethod: 'POST',
      });

      // Store in database
      const { data: newPhoneNumber, error } = await this.supabase
        .from('phone_numbers')
        .insert({
          user_id: userId,
          phone_number: purchasedNumber.phoneNumber,
          friendly_name: purchasedNumber.friendlyName,
          country_code: countryCode || purchasedNumber.isoCountry,
          country: purchasedNumber.isoCountry,
          type: 'purchased',
          status: 'active',
          twilio_account_sid: process.env.TWILIO_ACCOUNT_SID,
          twilio_phone_number_sid: purchasedNumber.sid,
          twilio_capabilities: {
            voice: purchasedNumber.capabilities?.voice || false,
            sms: purchasedNumber.capabilities?.sms || false,
          },
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to save purchased phone number to database:', error);
        // Note: Phone number was purchased but failed to save - admin should handle this
        res.status(500).json({
          success: false,
          error: 'Phone number purchased but failed to save. Please contact support.',
          details: error.message,
        });
        return;
      }

      logger.info('Phone number purchased successfully', {
        userId,
        phoneNumber: purchasedNumber.phoneNumber,
        sid: purchasedNumber.sid,
      });

      res.status(201).json({
        success: true,
        data: newPhoneNumber,
        message: 'Phone number purchased successfully',
      });
    } catch (error) {
      logger.error('Error in purchasePhoneNumber:', error);

      if (error instanceof Error) {
        // Check for Twilio-specific errors
        if (error.message.includes('balance')) {
          res.status(402).json({
            success: false,
            error: 'Insufficient Twilio account balance to purchase number',
          });
          return;
        }

        if (error.message.includes('not available') || error.message.includes('unavailable')) {
          res.status(404).json({
            success: false,
            error: 'Phone numbers are not available for this country/region. Try a different country.',
          });
          return;
        }

        if (error.message.includes('21452') || error.message.includes('geo permissions')) {
          res.status(403).json({
            success: false,
            error: 'Your Twilio account does not have permission to purchase numbers in this country. Enable it in Twilio Console → Phone Numbers → Regulatory Compliance.',
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: 'Failed to purchase phone number',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
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
