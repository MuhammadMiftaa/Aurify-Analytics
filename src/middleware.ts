import { NextFunction, Request, Response } from "express";
import logger from "./utils/logger";
import { UnauthorizedError, ValidationError } from "./utils/errors";
import { ERROR_MESSAGES } from "./utils/constant";
import { ZodType } from "zod";
import helper from "./utils/helper";
import { errorResponse } from "./utils/response";

//$ Authentication middleware
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn("Authentication failed: No authorization header");
      throw new UnauthorizedError(ERROR_MESSAGES.TOKEN_REQUIRED);
    }

    // Extract token from "Bearer <token>" format
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      logger.warn("Authentication failed: Invalid authorization header format");
      throw new UnauthorizedError(ERROR_MESSAGES.TOKEN_INVALID);
    }

    const token = parts[1];
    const user = helper.extractAndVerifyJwtClaims(token);
    req.user = user;

    logger.debug("User authenticated successfully", {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
    });
    next();
  } catch (error) {
    next(error);
  }
};

//$ Validates request body against Joi schema
const validate = (schema: ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = req.body;
    const result = schema.safeParse(data);

    if (!result.success) {
      const errorMessages = result.error.issues
        .map((issue) => issue.message)
        .join(", ");
      logger.warn("Validation failed", { errors: errorMessages });
      return next(new ValidationError(errorMessages));
    }

    req.body = result.data;
    next();
  };
};

//$ Handles all errors and sends appropriate response
const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Log the error
  if (err.isOperational) {
    logger.warn("Operational error", {
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error("Unexpected error", {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  const statusCode = err.statusCode || 500;

  const message = err.isOperational
    ? err.message
    : ERROR_MESSAGES.INTERNAL_SERVER_ERROR;

  res.status(statusCode).json(errorResponse(statusCode, message));
};

//$ 404 Not Found handler
const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  logger.warn("Route not found", { path: req.path, method: req.method });

  res
    .status(404)
    .json(errorResponse(404, `Route not found: ${req.method} ${req.path}`));
};

//$ Request logging middleware
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Log when response finishes
  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    };

    if (res.statusCode >= 500) {
      logger.error("Request completed with server error", logData);
    } else if (res.statusCode >= 400) {
      logger.warn("Request completed with client error", logData);
    } else {
      logger.http("Request completed", logData);
    }
  });

  next();
};

const responseInterceptor = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const originalJson = res.json;

  res.json = function (body) {
    logger.http("Response sent", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      message: body.message || "Success",
      data: body.data,
    });

    const wrapped = {
      status: true,
      statusCode: res.statusCode,
      message: body.message || "Success",
      data: body.data,
    };

    return originalJson.call(this, wrapped);
  };

  next();
};

export default {
  authMiddleware,
  validate,
  errorHandler,
  notFoundHandler,
  requestLogger,
  responseInterceptor,
};
