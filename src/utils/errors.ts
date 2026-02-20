//$ Base class for custom application errors
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

//$ 400 Bad Request - Validation errors
export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, 400);
  }
}

//$ 401 Unauthorized - Authentication required or failed
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

//$ 403 Forbidden - User doesn't have permission
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

//$ 404 Not Found - Resource not found
export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404);
  }
}
