import { JwtPayload } from "../utils/helper";

//$ Extend Express Request to include custom user property and requestID
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      requestID?: string;
    }
  }
}
