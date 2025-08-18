class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    stack: string = ''
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message: string = 'Requête invalide'): ApiError {
    return new ApiError(message, 400);
  }

  static unauthorized(message: string = 'Non autorisé'): ApiError {
    return new ApiError(message, 401);
  }

  static forbidden(message: string = 'Accès interdit'): ApiError {
    return new ApiError(message, 403);
  }

  static notFound(message: string = 'Ressource non trouvée'): ApiError {
    return new ApiError(message, 404);
  }

  static conflict(message: string = 'Conflit de données'): ApiError {
    return new ApiError(message, 409);
  }

  static unprocessableEntity(message: string = 'Entité non traitable'): ApiError {
    return new ApiError(message, 422);
  }

  static tooManyRequests(message: string = 'Trop de requêtes'): ApiError {
    return new ApiError(message, 429);
  }

  static internal(message: string = 'Erreur interne du serveur'): ApiError {
    return new ApiError(message, 500);
  }

  static notImplemented(message: string = 'Fonctionnalité non implémentée'): ApiError {
    return new ApiError(message, 501);
  }

  static serviceUnavailable(message: string = 'Service indisponible'): ApiError {
    return new ApiError(message, 503);
  }
}

export default ApiError;