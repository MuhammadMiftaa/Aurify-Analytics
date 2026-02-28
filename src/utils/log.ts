// ============================================================
// Single source of truth untuk semua nilai field logging.
// Tidak ada string literal log yang boleh ditulis di luar file ini.
// ============================================================

// ─── Request ID constants ─────────────────────────────────────
export const REQUEST_ID_HEADER = "x-request-id";
export const REQUEST_ID_LOCAL_KEY = "requestID";

// ─── Service constants ────────────────────────────────────────
// Seluruh nilai field "service" HARUS didefinisikan di sini.
export const MainService = "main";
export const EnvService = "env";
export const DatabaseService = "database";
export const GRPCClientService = "grpc_client";
export const HTTPServerService = "http_server";
export const AnalyticsService = "analytics";

// ─── Message constants ────────────────────────────────────────
// Seluruh string pertama pada setiap log.*() call HARUS terdaftar di sini.
// Konvensi penamaan: prefix Log + PascalCase, pola {resource}_{operation}_{outcome}

// --- env / startup ---
export const LogEnvVarMissing = "env_var_missing";

// --- infrastructure setup ---
export const LogDBConnected = "db_connected";
export const LogDBConnectFailed = "db_connect_failed";

// --- server lifecycle ---
export const LogHTTPServerStarted = "http_server_started";
export const LogHTTPServerClosed = "http_server_closed";
export const LogShutdownStarted = "shutdown_started";
export const LogUncaughtException = "uncaught_exception";
export const LogUnhandledRejection = "unhandled_rejection";

// --- http middleware ---
export const LogAuthMissingHeader = "auth_missing_header";
export const LogAuthInvalidHeaderFormat = "auth_invalid_header_format";
export const LogAuthSuccess = "auth_success";
export const LogRouteNotFound = "route_not_found";
export const LogRequestCompleted = "request_completed";
export const LogUnexpectedError = "unexpected_error";
export const LogValidationFailed = "validation_failed";

// --- analytics (handler) ---
export const LogGetUserTransactionFailed = "get_user_transaction_failed";
export const LogGetUserBalanceFailed = "get_user_balance_failed";
export const LogGetUserFinancialSummaryFailed =
  "get_user_financial_summary_failed";
export const LogGetUserNetWorthCompositionFailed =
  "get_user_net_worth_composition_failed";
export const LogInitialSyncFailed = "initial_sync_failed";
export const LogInitialSyncCompleted = "initial_sync_completed";
export const LogInitialSyncForbidden = "initial_sync_forbidden";

// --- grpc client (wallet) ---
export const LogGetWalletsStreamCompleted = "get_wallets_stream_completed";
export const LogGetWalletsStreamFailed = "get_wallets_stream_failed";
export const LogGetUserWalletsStreamCompleted =
  "get_user_wallets_stream_completed";
export const LogGetUserWalletsStreamFailed = "get_user_wallets_stream_failed";

// --- grpc client (transaction) ---
export const LogGetTransactionsStreamCompleted =
  "get_transactions_stream_completed";
export const LogGetTransactionsStreamFailed = "get_transactions_stream_failed";
export const LogGetUserTransactionsStreamCompleted =
  "get_user_transactions_stream_completed";
export const LogGetUserTransactionsStreamFailed =
  "get_user_transactions_stream_failed";

// --- grpc client (investment) ---
export const LogGetInvestmentsStreamCompleted =
  "get_investments_stream_completed";
export const LogGetInvestmentsStreamFailed = "get_investments_stream_failed";
export const LogGetUserInvestmentsStreamCompleted =
  "get_user_investments_stream_completed";
export const LogGetUserInvestmentsStreamFailed =
  "get_user_investments_stream_failed";
