import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';

export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors: Record<string, string[]> = {};
    errors.array().forEach(err => {
      if (err.type === 'field') {
        if (!extractedErrors[err.path]) {
          extractedErrors[err.path] = [];
        }
        extractedErrors[err.path].push(err.msg);
      }
    });

    return res.status(400).json(
      ApiResponse.validation('Erreurs de validation', extractedErrors)
    );
  };
};
