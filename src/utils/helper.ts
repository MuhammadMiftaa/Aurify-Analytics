import { ValidationError } from "./errors";
import { ZodType } from "zod";

//$ Interface for JWT payload structure
interface JwtPayload {
  email: string;
  id: string;
  username: string;
}

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

export default { getWeekNumber, validate };
export type { JwtPayload };
