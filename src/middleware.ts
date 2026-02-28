import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import logger from "./utils/logger";
import { UnauthorizedError, ValidationError } from "./utils/errors";
import { ERROR_MESSAGES } from "./utils/constant";
import { ZodType } from "zod";
import helper from "./utils/helper";
import { errorResponse } from "./utils/response";
import {
  HTTPServerService,
  LogAuthInvalidHeaderFormat,
  LogAuthMissingHeader,
  LogAuthSuccess,
  LogRequestCompleted,
  LogRouteNotFound,
  LogUnexpectedError,
  LogValidationFailed,
  REQUEST_ID_HEADER,
  REQUEST_ID_LOCAL_KEY,
} from "./utils/log";

//$ Generates / propagates a unique request ID per HTTP request.
//  MUST be mounted BEFORE requestLogger so request_id is available when log is written.
const requestIDMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let requestID = req.headers[REQUEST_ID_HEADER] as string | undefined;
  if (!requestID) {
    requestID = randomUUID();
  }
  req.requestID = requestID;
  res.setHeader(REQUEST_ID_HEADER, requestID);
  next();
};

//$ Extracts user info from token and attaches to req.user
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestID = req.requestID;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn(LogAuthMissingHeader, {
        service: HTTPServerService,
        request_id: requestID,
      });
      throw new UnauthorizedError(ERROR_MESSAGES.TOKEN_REQUIRED);
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      logger.warn(LogAuthInvalidHeaderFormat, {
        service: HTTPServerService,
        request_id: requestID,
      });
      throw new UnauthorizedError(ERROR_MESSAGES.TOKEN_INVALID);
    }

    const token = parts[1];
    const user = helper.extractAndVerifyJwtClaims(token);
    req.user = user;

    logger.debug(LogAuthSuccess, {
      service: HTTPServerService,
      request_id: requestID,
      user_id: req.user.id,
    });

    next();
  } catch (error) {
    next(error);
  }
};

//$ Validates request body against Zod schema
const validate = (schema: ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errorMessages = result.error.issues
        .map((issue) => issue.message)
        .join(", ");
      logger.warn(LogValidationFailed, {
        service: HTTPServerService,
        request_id: req.requestID,
        error: errorMessages,
      });
      return next(new ValidationError(errorMessages));
    }

    req.body = result.data;
    next();
  };
};

//$ HTTP access log — logs every request lifecycle with structured fields.
//  Level: 2xx/3xx → info, 4xx → warn, 5xx → error
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on("finish", () => {
    const latencyMs = Date.now() - start;
    const status = res.statusCode;

    const fields: Record<string, unknown> = {
      service: HTTPServerService,
      request_id: req.requestID,
      method: req.method,
      uri: req.originalUrl,
      status,
      latency: `${latencyMs}ms`,
      client_ip: req.ip,
      user_agent: req.headers["user-agent"] || "",
      request_size: req.headers["content-length"]
        ? parseInt(req.headers["content-length"] as string, 10)
        : 0,
      response_size: parseInt(
        (res.getHeader("content-length") as string) || "0",
        10,
      ),
      protocol: req.protocol,
    };

    if (req.user?.id) {
      fields.user_id = req.user.id;
    }

    if (status >= 500) {
      logger.error(LogRequestCompleted, fields);
    } else if (status >= 400) {
      logger.warn(LogRequestCompleted, fields);
    } else {
      logger.info(LogRequestCompleted, fields);
    }
  });

  next();
};

//$ Handles all errors and sends appropriate response
const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestID = req.requestID;
  const status = err.statusCode || 500;

  if (!err.isOperational) {
    logger.error(LogUnexpectedError, {
      service: HTTPServerService,
      request_id: requestID,
      path: req.path,
      method: req.method,
      error: err.message,
      stack: err.stack,
    });
  }

  res.status(status).json({
    statusCode: status,
    message: err.isOperational
      ? err.message
      : ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  });
};

//$ 404 Not Found handler
const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  logger.warn(LogRouteNotFound, {
    service: HTTPServerService,
    request_id: req.requestID,
    method: req.method,
    path: req.path,
  });
  res.status(404).json({
    statusCode: 404,
    message: "route not found",
  });
};

export default {
  requestIDMiddleware,
  authMiddleware,
  validate,
  requestLogger,
  errorHandler,
  notFoundHandler,
};
