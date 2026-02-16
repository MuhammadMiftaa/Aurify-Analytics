import jwt from "jsonwebtoken";
import env from "./env";
import { UnauthorizedError, ValidationError } from "./errors";

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

export default { extractAndVerifyJwtClaims };
export type { JwtPayload };
