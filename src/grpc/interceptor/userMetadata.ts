import { randomUUID } from "crypto";
import logger from "../../utils/logger.js";
import { GRPCServerService, REQUEST_ID_LOCAL_KEY } from "../../utils/log.js";

// ─── Metadata keys — must match the BFF client interceptor keys exactly ───
export const MD_KEY_USER_ID = "x-user-id";
export const MD_KEY_USER_EMAIL = "x-user-email";
export const MD_KEY_USER_PROVIDER = "x-user-provider";
export const MD_KEY_PROVIDER_USER_ID = "x-provider-user-id";
export const MD_KEY_REQUEST_ID = "x-request-id";

// ─── Context helper keys ─────────────────────────────────────
export const CTX_USER_ID = "user_id";
export const CTX_USER_EMAIL = "user_email";
export const CTX_USER_PROVIDER = "user_provider";
export const CTX_PROVIDER_USER_ID = "provider_user_id";
export const CTX_REQUEST_ID = REQUEST_ID_LOCAL_KEY;

/**
 * Extracts the first value for a given metadata key.
 * gRPC metadata values are arrays; we only care about the first entry.
 */
function firstValue(metadata: any, key: string): string {
  const vals = metadata.get(key);
  if (vals && vals.length > 0) {
    return String(vals[0]);
  }
  return "";
}

/**
 * Extracts user metadata + request ID from incoming gRPC metadata,
 * stores them on `call.userMetadata` so downstream handlers can access them.
 *
 * If request_id is empty a new UUID is generated.
 */
function extractUserMetadata(call: any): void {
  const md = call.metadata;

  const userId = firstValue(md, MD_KEY_USER_ID);
  const email = firstValue(md, MD_KEY_USER_EMAIL);
  const provider = firstValue(md, MD_KEY_USER_PROVIDER);
  const providerUserId = firstValue(md, MD_KEY_PROVIDER_USER_ID);
  let requestId = firstValue(md, MD_KEY_REQUEST_ID);

  if (!requestId) {
    requestId = randomUUID();
  }

  // Attach to call so every handler can read call.userMetadata.*
  call.userMetadata = {
    [CTX_USER_ID]: userId,
    [CTX_USER_EMAIL]: email,
    [CTX_USER_PROVIDER]: provider,
    [CTX_PROVIDER_USER_ID]: providerUserId,
    [CTX_REQUEST_ID]: requestId,
  };
}

/**
 * Returns structured log fields from call.userMetadata.
 * Intended to be spread into every logger call inside gRPC handlers.
 */
export function logFieldsFromCall(call: any): Record<string, string> {
  const um = call.userMetadata || {};
  const fields: Record<string, string> = {
    service: GRPCServerService,
    request_id: um[CTX_REQUEST_ID] || "",
  };
  if (um[CTX_USER_ID]) {
    fields.user_id = um[CTX_USER_ID];
  }
  return fields;
}

// ─── Interceptor factory ─────────────────────────────────────

/**
 * Creates a unary gRPC server interceptor that extracts user metadata
 * and request ID from incoming gRPC metadata and injects them into
 * `call.userMetadata` for downstream handlers.
 */
export function unaryServerInterceptor(
  handler: (call: any, callback: any) => void | Promise<void>,
) {
  return async (call: any, callback: any) => {
    extractUserMetadata(call);

    logger.debug("grpc_request_received", {
      service: GRPCServerService,
      request_id: call.userMetadata[CTX_REQUEST_ID],
      user_id: call.userMetadata[CTX_USER_ID] || "",
      method: call.call?.handler?.path || "",
    });

    try {
      await handler(call, callback);
    } catch (error: any) {
      callback({
        code: error.code || 13, // INTERNAL
        message: error.message,
      });
    }
  };
}

/**
 * Creates a server-streaming gRPC interceptor.
 * For server streaming, the handler signature is (call) — no callback.
 */
export function serverStreamInterceptor(
  handler: (call: any) => void | Promise<void>,
) {
  return async (call: any) => {
    extractUserMetadata(call);

    logger.debug("grpc_stream_request_received", {
      service: GRPCServerService,
      request_id: call.userMetadata[CTX_REQUEST_ID],
      user_id: call.userMetadata[CTX_USER_ID] || "",
    });

    await handler(call);
  };
}
