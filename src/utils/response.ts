/**
 * Standard API Response Format
 * 
 * All API responses follow this structure:
 * {
 *   status: boolean,      // true for success, false for error
 *   statusCode: number,   // HTTP status code
 *   message: string,      // Human-readable message
 *   data?: any           // Optional: actual response data
 * }
 */

export interface ApiResponse<T = any> {
  status: boolean;
  statusCode: number;
  message: string;
  data?: T;
}

/**
 * Create a success response
 */
export function successResponse<T>(
  statusCode: number,
  message: string,
  data?: T
): ApiResponse<T> {
  const response: ApiResponse<T> = {
    status: true,
    statusCode,
    message,
  };

  // Only include data if provided
  if (data !== undefined) {
    response.data = data;
  }

  return response;
}

/**
 * Create an error response
 */
export function errorResponse(
  statusCode: number,
  message: string
): ApiResponse<null> {
  return {
    status: false,
    statusCode,
    message,
  };
}

/**
 * Common success responses
 */
export const SUCCESS_RESPONSES = {
  OK: (message: string, data?: any) => successResponse(200, message, data),
  CREATED: (message: string, data?: any) => successResponse(201, message, data),
  NO_CONTENT: (message: string) => successResponse(204, message),
};

/**
 * Common error responses
 */
export const ERROR_RESPONSES = {
  BAD_REQUEST: (message: string) => errorResponse(400, message),
  UNAUTHORIZED: (message: string) => errorResponse(401, message),
  FORBIDDEN: (message: string) => errorResponse(403, message),
  NOT_FOUND: (message: string) => errorResponse(404, message),
  INTERNAL_SERVER_ERROR: (message: string) => errorResponse(500, message),
};

export default {
  successResponse,
  errorResponse,
  SUCCESS_RESPONSES,
  ERROR_RESPONSES,
};