// Error Messages
export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: "Invalid credentials",
  TOKEN_REQUIRED: "Authentication token is required",
  TOKEN_INVALID: "Invalid or expired token",
  VALIDATION_FAILED: "Validation failed",
  INTERNAL_SERVER_ERROR: "Internal server error",
};

export const EXCHANGE_NAME = "refina_microservice";
export const EXCHANGE_TYPE = "topic";
export const QUEUE_NAME = "refina-analytics";
export const ROUTING_KEYS = [
  "wallet.*", //? wallet.created, wallet.updated, wallet.deleted
  "transaction.*", //? transaction.created, transaction.updated, transaction.deleted
  "investment.*", //? investment.buy, investment.sell
];
