import dotenv from "dotenv";

dotenv.config();

const missing: string[] = [];

//$ Helper function to get required env
function required(key: string) {
  const value = process.env[key];
  if (!value) {
    missing.push(`${key} env is not set`);
    return "";
  }
  return value;
}

//$ Helper function to get required env as number
function requiredInt(key: string) {
  const value = process.env[key];
  if (!value) {
    missing.push(`${key} env is not set`);
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    missing.push(`${key} must be number, got "${value}"`);
    return 0;
  }
  return parsed;
}

//$ Load all environment variables
const env = {
  HTTP_PORT: requiredInt("HTTP_PORT"),
  GRPC_PORT: requiredInt("GRPC_PORT"),
  NODE_ENV: required("NODE_ENV"),
  DATABASE_URL: required("DATABASE_URL"),
  LOG_LEVEL: required("LOG_LEVEL"),
  INITIAL_SYNC_KEY: required("INITIAL_SYNC_KEY"),
  WALLET_ADDRESS: required("WALLET_ADDRESS"),
  TRANSACTION_ADDRESS: required("TRANSACTION_ADDRESS"),
  INVESTMENT_ADDRESS: required("INVESTMENT_ADDRESS"),
  RABBITMQ_HOST: required("RABBITMQ_HOST"),
  RABBITMQ_PORT: required("RABBITMQ_PORT"),
  RABBITMQ_USER: required("RABBITMQ_USER"),
  RABBITMQ_PASSWORD: required("RABBITMQ_PASSWORD"),
  RABBITMQ_VIRTUAL_HOST: required("RABBITMQ_VIRTUAL_HOST"),
};

//$ Exit if any env is missing
if (missing.length > 0) {
  console.error("\n❌ Missing environment variables:");
  missing.forEach((m) => console.error(`   - ${m}`));
  console.error("\n");
  process.exit(1);
}

Object.freeze(env);

export default env;