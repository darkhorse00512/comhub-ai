import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import logger from '../utils/logger';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');

      logger.warn('Validation failed', {
        path: req.path,
        errors: errorMessage,
      });

      res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
      return;
    }

    next();
  };
};

export const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
  }),

  initiateCall: Joi.object({
    phoneNumber: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .required()
      .messages({
        'string.pattern.base': 'Phone number must be in E.164 format',
      }),
  }),

  sendMessage: Joi.object({
    message: Joi.string().min(1).max(1000).required(),
  }),

  twilioOutboundCall: Joi.object({
    to: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .required(),
    from: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .optional(),
  }),
};

export default validate;
