interface ApiResponseData {
  success: boolean;
  message: string;
  data?: any;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta?: Record<string, any>;
}

class ApiResponse {
  public success: boolean;
  public message: string;
  public data?: any;
  public pagination?: ApiResponseData['pagination'];
  public meta?: Record<string, any>;

  constructor(
    success: boolean,
    message: string,
    data?: any,
    pagination?: ApiResponseData['pagination'],
    meta?: Record<string, any>
  ) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.pagination = pagination;
    this.meta = meta;
  }

  static success(
    message: string = 'Opération réussie',
    data?: any,
    pagination?: ApiResponseData['pagination'],
    meta?: Record<string, any>
  ): ApiResponse {
    return new ApiResponse(true, message, data, pagination, meta);
  }

  static error(
    message: string = 'Une erreur est survenue',
    data?: any,
    meta?: Record<string, any>
  ): ApiResponse {
    return new ApiResponse(false, message, data, undefined, meta);
  }

  static created(
    message: string = 'Ressource créée avec succès',
    data?: any,
    meta?: Record<string, any>
  ): ApiResponse {
    return new ApiResponse(true, message, data, undefined, meta);
  }

  static updated(
    message: string = 'Ressource mise à jour avec succès',
    data?: any,
    meta?: Record<string, any>
  ): ApiResponse {
    return new ApiResponse(true, message, data, undefined, meta);
  }

  static deleted(
    message: string = 'Ressource supprimée avec succès',
    data?: any,
    meta?: Record<string, any>
  ): ApiResponse {
    return new ApiResponse(true, message, data, undefined, meta);
  }

  static paginated(
    message: string = 'Données récupérées avec succès',
    data: any[],
    currentPage: number,
    totalPages: number,
    totalItems: number,
    itemsPerPage: number,
    meta?: Record<string, any>
  ): ApiResponse {
    const pagination = {
      currentPage,
      totalPages,
      totalItems,
      itemsPerPage,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    };

    return new ApiResponse(true, message, data, pagination, meta);
  }

  static noContent(message: string = 'Aucun contenu'): ApiResponse {
    return new ApiResponse(true, message);
  }

  static validation(
    message: string = 'Erreurs de validation',
    errors: Record<string, string[]>
  ): ApiResponse {
    return new ApiResponse(false, message, null, undefined, { errors });
  }
}

export default ApiResponse;