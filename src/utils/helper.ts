import jwt from "jsonwebtoken";
import env from "./env";
import { UnauthorizedError, ValidationError } from "./errors";
import { ZodType } from "zod";
import logger from "./logger";

//$ Interface for JWT payload structure
interface JwtPayload {
  email: string;
  id: string;
  username: string;
}

const extractAndVerifyJwtClaims = (token: string): JwtPayload => {
  try {
    // Remove "Bearer " prefix if present
    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;

    // Use provided secret or fallback to environment variable
    const jwtSecret = env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error("JWT secret is not configured");
    }

    // Verify and decode JWT
    const decoded = jwt.verify(cleanToken, jwtSecret) as JwtPayload;

    // Return structured claims
    return {
      email: decoded.email,
      id: decoded.id,
      username: decoded.username,
    };
  } catch (error) {
    throw new UnauthorizedError(`Failed to verify JWT: ${error}`);
  }
};

const getWeekNumber = (date: Date): number => {
  const startDate = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor(
    (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.ceil((days + startDate.getDay() + 1) / 7);
};

//$ Validates request body against Joi schema
const validate = <T>(schema: ZodType, data: unknown): T => {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errorMessages = result.error.issues
      .map((issue) => issue.message)
      .join(", ");
    throw new ValidationError("Invalid request data, " + errorMessages);
  }

  return result.data as T;
};

export default { extractAndVerifyJwtClaims, getWeekNumber, validate };
export type { JwtPayload };
