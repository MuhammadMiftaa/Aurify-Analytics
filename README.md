# Refina Analytics

**CQRS Read Model Service** — Consumes financial events from write-model microservices via RabbitMQ and materializes them into MongoDB collections optimized for analytics queries.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [MongoDB Collections](#mongodb-collections)
  - [Main Collections](#main-collections)
  - [Helper Collections](#helper-collections)
- [Event Handling (RabbitMQ Consumer)](#event-handling-rabbitmq-consumer)
  - [Routing Keys](#routing-keys)
  - [Event Handlers](#event-handlers)
  - [Shared Helpers](#shared-helpers)
- [REST API Endpoints](#rest-api-endpoints)
  - [Authentication](#authentication)
  - [getUserTransaction](#1-getusertransaction)
  - [getUserBalance](#2-getuserbalance)
  - [getUserFinancialSummary](#3-getuserfinancialsummary)
  - [getUserNetWorthComposition](#4-getusernetworthcomposition)
  - [Initial Sync](#5-initial-sync)
- [Initial Sync (gRPC)](#initial-sync-grpc)
- [Scripts](#scripts)

---

## Overview

Refina Analytics is one of the microservices in the **Refina** personal finance platform. It follows the **CQRS (Command Query Responsibility Segregation)** pattern:

- **Write model** (other services) publishes domain events to RabbitMQ whenever wallets, transactions, or investments change.
- **This service** (read model) subscribes to those events and builds MongoDB collections that are structured specifically for fast analytics queries — grouped by category, aggregated by time period, etc.

This separation allows the write side to stay simple while the read side provides rich, pre-computed analytics without expensive real-time aggregations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Write Model Services                    │
│  (Wallet Service, Transaction Service, Investment Service)  │
└────────┬──────────────────────┬─────────────────────────────┘
         │ gRPC (initial sync)  │ RabbitMQ (events)
         ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Refina Analytics Service                  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ gRPC Client   │  │ RabbitMQ     │  │ REST API         │  │
│  │ (Initial Sync)│  │ Consumer     │  │ (Express)        │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │             │
│         ▼                 ▼                    ▼             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    MongoDB (Read Store)                 │ │
│  │  UserTransaction │ UserBalance │ UserFinancialSummaries │ │
│  │  UserNetWorthComposition │ UserWallet │ UserInvestment  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Data flows into MongoDB through two paths:**

1. **Initial Sync** — On first deployment (or data reset), fetches all existing data from write services via gRPC and bulk-upserts into all 6 collections.
2. **Event Consumer** — Continuously listens to RabbitMQ events and incrementally updates the collections.

**Data flows out via:**

3. **REST API** — Express endpoints that query the pre-computed MongoDB collections.

## Tech Stack

| Technology                                       | Purpose                                       |
| ------------------------------------------------ | --------------------------------------------- |
| **TypeScript**                                   | Type-safe application code                    |
| **Express 5**                                    | REST API framework                            |
| **MongoDB / Mongoose**                           | Read model data store                         |
| **RabbitMQ** (amqplib + amqp-connection-manager) | Event consumption with auto-reconnect         |
| **gRPC** (@muhammadmiftaa/refina-protobuf)       | Initial data sync from write services         |
| **Zod**                                          | Schema validation for events and API requests |
| **Winston**                                      | Structured logging                            |
| **JWT**                                          | Authentication (Bearer token)                 |
| **Swagger**                                      | API documentation                             |

## Project Structure

```
src/
├── main.ts                    # App entry point: Express + MongoDB + RabbitMQ
├── route.ts                   # Route definitions for analytics endpoints
├── handler.ts                 # Express request handlers
├── service.ts                 # Query logic (MongoDB aggregation pipelines)
├── middleware.ts               # Auth, validation, error handling, logging
│
├── event/                     # RabbitMQ event consumption
│   ├── config.ts              # RabbitMQ connection management
│   └── consumer/
│       ├── consumer.ts        # Handler registry + message processor + startConsumer
│       ├── consumer.helper.ts # Shared: recalcNetWorth, recalcFinancialSummary
│       ├── wallet.created.ts  # Upsert UserWallet → recalc net worth
│       ├── wallet.updated.ts  # Update UserWallet → recalc net worth
│       ├── wallet.deleted.ts  # Soft delete wallet → recalc net worth
│       ├── transaction.created.ts  # UserTransaction + UserBalance + financial summary
│       ├── transaction.updated.ts  # Remove old → insert new → recalc
│       ├── transaction.deleted.ts  # Remove → reverse balance → recalc
│       ├── investment.buy.ts  # Upsert UserInvestment → recalc
│       └── investment.sell.ts # Batch FIFO sell (array) → recalc
│
├── grpc/
│   └── client/
│       ├── client.ts              # Base gRPC client
│       ├── client.wallet.ts       # Wallet gRPC client
│       ├── client.transaction.ts  # Transaction gRPC client
│       ├── client.investment.ts   # Investment gRPC client
│       ├── initSync.ts            # Main initial sync orchestrator
│       ├── initSync.helper.ts     # Sync helper utilities
│       ├── initSync.userTransactions.ts
│       ├── initSync.userBalances.ts
│       ├── initSync.UserFinancialSummaries.ts
│       └── initSync.UserNetWorthComposition.ts
│
└── utils/
    ├── constant.ts   # Exchange name, queue name, routing keys
    ├── dto.ts        # Zod schemas + inferred TypeScript types
    ├── env.ts        # Environment variable loader (required/requiredInt)
    ├── errors.ts     # Custom error classes (ValidationError, NotFoundError, etc.)
    ├── helper.ts     # JWT verification, getWeekNumber, Zod validate helper
    ├── logger.ts     # Winston logger configuration
    ├── model.ts      # All 6 Mongoose schemas + models
    ├── response.ts   # Standardized API response helpers
    └── swagger.ts    # Swagger/OpenAPI setup
```

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **MongoDB** (running instance)
- **RabbitMQ** (running instance with the `refina_microservice` exchange)
- **Write-model gRPC services** (Wallet, Transaction, Investment) — required for initial sync

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd refina-analytics

# Install dependencies
npm install

# Create .env file (see Environment Variables section below)
cp .env.example .env

# Development (hot reload)
npm run dev

# Production build
npm run build
npm start
```

## Environment Variables

| Variable                | Type   | Description                                   |
| ----------------------- | ------ | --------------------------------------------- |
| `PORT`                  | number | Server port (e.g. `3002`)                     |
| `NODE_ENV`              | string | `development` or `production`                 |
| `DATABASE_URL`          | string | MongoDB connection string                     |
| `JWT_SECRET`            | string | Secret key for JWT verification               |
| `LOG_LEVEL`             | string | Winston log level (`info`, `debug`, `error`)  |
| `INITIAL_SYNC_KEY`      | string | Secret key to authorize initial sync endpoint |
| `WALLET_ADDRESS`        | string | gRPC address for Wallet service               |
| `TRANSACTION_ADDRESS`   | string | gRPC address for Transaction service          |
| `INVESTMENT_ADDRESS`    | string | gRPC address for Investment service           |
| `RABBITMQ_HOST`         | string | RabbitMQ hostname                             |
| `RABBITMQ_PORT`         | string | RabbitMQ port                                 |
| `RABBITMQ_USER`         | string | RabbitMQ username                             |
| `RABBITMQ_PASSWORD`     | string | RabbitMQ password                             |
| `RABBITMQ_VIRTUAL_HOST` | string | RabbitMQ virtual host                         |

---

## MongoDB Collections

### Main Collections

These are the query-optimized collections that the REST API reads from.

#### 1. UserTransaction

**Granularity:** Daily per Wallet + Category

Stores aggregated transaction data grouped by user, wallet, category, and date. Each document represents _"all transactions for user X, in wallet Y, in category Z, on date D"_.

| Field                                          | Description                           |
| ---------------------------------------------- | ------------------------------------- |
| `UserID`                                       | Owner user ID                         |
| `WalletID` / `WalletName` / `WalletType`       | Wallet info                           |
| `CategoryID` / `CategoryName` / `CategoryType` | Category info (`income` or `expense`) |
| `Date` / `Year` / `Month` / `Week` / `Day`     | Time dimensions                       |
| `TotalAmount`                                  | Sum of all transactions in this group |
| `TransactionCount`                             | Number of transactions                |
| `Transactions[]`                               | Array of `{ ID, Description, Date }`  |

**Unique Index:** `{ UserID, WalletID, CategoryID, Date }`

#### 2. UserBalance

**Granularity:** Daily per Wallet

Daily balance snapshots per wallet, enabling time-series charts.

| Field                                        | Description                 |
| -------------------------------------------- | --------------------------- |
| `OpeningBalance` / `ClosingBalance`          | Balance at start/end of day |
| `TotalIncome` / `TotalExpense` / `NetChange` | Day's totals                |
| `CumulativeIncome` / `CumulativeExpense`     | Running totals              |

**Unique Index:** `{ WalletID, Date }`

#### 3. UserFinancialSummaries

**Granularity:** Monthly per User

Comprehensive monthly financial health report with growth comparisons, ratios, investment summary, net worth, and category breakdowns.

| Section           | Key Fields                                                                   |
| ----------------- | ---------------------------------------------------------------------------- |
| Current period    | `IncomeNow`, `ExpenseNow`, `ProfitNow`, `BalanceNow`                         |
| Previous period   | `IncomePrev`, `ExpensePrev`, `ProfitPrev`, `BalancePrev`                     |
| Growth            | `IncomeGrowthPct`, `ExpenseGrowthPct`, `ProfitGrowthPct`, `BalanceGrowthPct` |
| Health indicators | `SavingsRate`, `ExpenseToIncomeRatio`, `BurnRateDaily`, `RunwayDays`         |
| Investment        | `InvestmentSummary { TotalInvested, UnrealizedGain, RealizedGain, ... }`     |
| Net worth         | `NetWorth { Total, WalletPortion, InvestmentPortion, NetWorthGrowthPct }`    |
| Top categories    | `TopExpenseCategories[]`, `TopIncomeCategories[]` (top 5)                    |
| Wallet breakdown  | `WalletSummaries[]`                                                          |

**Unique Index:** `{ UserID, PeriodType, PeriodKey }`

#### 4. UserNetWorthComposition

**Granularity:** Snapshot (latest state per user)

A single document per user representing their current net worth split between cash/bank accounts and investments. Ideal for pie charts.

| Field      | Description                                       |
| ---------- | ------------------------------------------------- |
| `Total`    | Total net worth                                   |
| `Slices[]` | Array of `{ Label, Amount, Percentage, Details }` |

**Unique Index:** `{ UserID }`

### Helper Collections

These are internal-use collections that cache data from write services to avoid gRPC calls during event processing.

#### 5. UserWallet

One document per wallet. Updated by `wallet.*` events. Used by `recalcNetWorth` and `recalcFinancialSummary` to read current wallet balances without calling the Wallet service.

#### 6. UserInvestment

One document per buy position. Updated by `investment.buy` and `investment.sell` events. Tracks quantity, average buy price, realized gain, and sell totals. Used by `recalcNetWorth` and `recalcFinancialSummary`.

---

## Event Handling (RabbitMQ Consumer)

### Connection

- **Exchange:** `refina_microservice` (topic exchange, declared by the write services)
- **Queue:** `refina-analytics` (durable, prefetch = 1)
- Auto-reconnect with `amqp-connection-manager`

### Routing Keys

| Pattern         | Matches                                                             |
| --------------- | ------------------------------------------------------------------- |
| `wallet.*`      | `wallet.created`, `wallet.updated`, `wallet.deleted`                |
| `transaction.*` | `transaction.created`, `transaction.updated`, `transaction.deleted` |
| `investment.*`  | `investment.buy`, `investment.sell`                                 |

### Event Handlers

#### `wallet.created`

Creates or upserts a `UserWallet` document, then recalculates the user's net worth composition.

**Payload:** Single wallet object with `id`, `user_id`, `name`, `balance`, `wallet_type`, etc.

#### `wallet.updated`

Updates the existing `UserWallet` document (balance, name, etc.), then recalculates net worth.

**Payload:** Same as `wallet.created`.

#### `wallet.deleted`

Soft-deletes the wallet (`IsActive = false`), then recalculates net worth.

**Payload:** Same as `wallet.created`.

#### `transaction.created`

1. Upserts a `UserTransaction` document (grouped by wallet + category + date), incrementing `TotalAmount` and `TransactionCount`.
2. Upserts a `UserBalance` document for the wallet + date, adjusting opening/closing balance and income/expense.
3. Recalculates `UserFinancialSummaries` for the month.

**Payload:** Single transaction object with `id`, `wallet_id`, `amount`, `category_id`, `category_name`, `category_type`, `transaction_date`, etc.

#### `transaction.updated`

Reverses the old transaction (decrement from `UserTransaction` and `UserBalance`), then applies the new values as if it were a fresh `transaction.created`.

**Payload:** Object with `old` (previous transaction) and `new` (updated transaction) properties.

#### `transaction.deleted`

Removes the transaction from `UserTransaction` (decrement counts), reverses the balance impact on `UserBalance`, then recalculates the monthly financial summary.

**Payload:** Single transaction object (the deleted transaction).

#### `investment.buy`

Upserts a `UserInvestment` document for the buy position, storing quantity, amount, average buy price, and current exchange rates. Then recalculates net worth and financial summary.

**Payload:** Single investment object with `id`, `code`, `userId`, `quantity`, `amount`, `assetCode { code, name, unit, toUSD, toIDR, toEUR }`, etc.

#### `investment.sell`

Receives an **array of sell items** (batch FIFO sell from multiple buy positions of the same asset code). For each item:

1. Finds the corresponding buy position by `investmentId`.
2. Deducts the sold quantity, calculates realized gain (`sellAmount − avgBuyPrice × quantity`).
3. Updates the buy position's tracking fields (`TotalSoldQuantity`, `TotalSoldAmount`, `TotalDeficit`, `RealizedGain`).
4. Marks the position as inactive if fully sold.
5. Updates exchange rates if provided (non-null).

After processing all items, recalculates net worth and financial summary **once**.

**Payload:**

```json
[
  {
    "id": "sell-uuid",
    "userId": "user-uuid",
    "investmentId": "buy-position-uuid",
    "quantity": 0.5,
    "sellPrice": 100000,
    "amount": 50000,
    "date": "2025-01-15T00:00:00.000Z",
    "description": "Sell 0.5 BTC",
    "deficit": 0,
    "investment": {
      "assetCode": {
        "code": "BTC",
        "name": "Bitcoin",
        "unit": "BTC",
        "toUSD": 100000,
        "toIDR": 1600000000,
        "toEUR": null
      }
    }
  }
]
```

### Shared Helpers

#### `recalcNetWorth(userId)`

Reads all active `UserWallet` and `UserInvestment` documents for the user, computes total net worth, and upserts a `UserNetWorthComposition` document with slices for "Cash & Bank Accounts" and "Investments".

#### `recalcFinancialSummary(userId, txDate)`

Full re-aggregation of the user's monthly financial data:

1. Reads all `UserTransaction` documents for the month.
2. Computes income/expense totals, category breakdowns, growth vs previous month.
3. Reads `UserWallet` for current balances.
4. Reads `UserInvestment` for investment summary.
5. Computes health indicators (savings rate, burn rate, runway days, etc.).
6. Upserts the `UserFinancialSummaries` document for that month.

---

## REST API Endpoints

All analytics endpoints are under `/analytics` and require Bearer token authentication.

### Authentication

All routes (except `/analytics/initial-sync`) require a JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer <jwt-token>
```

The token is verified using the `JWT_SECRET` environment variable. The decoded payload must contain `id`, `email`, and `username`.

### 1. getUserTransaction

```
POST /analytics/user-transactions
```

Returns transaction data grouped by category, with optional filtering by wallet and date.

**Request Body:**

```json
{
  "userID": "uuid",
  "walletID": "uuid",
  "dateOption": {
    "date": "2025-01-15",
    "year": 2025,
    "month": 1,
    "day": 15,
    "range": {
      "start": "2025-01-01",
      "end": "2025-01-31"
    }
  }
}
```

> All fields in `dateOption` are optional. Priority: `date` > `range` > `year+month+day` > `year+month` > `year` > all time.

**Response:**

```json
[
  {
    "CategoryID": "category-uuid",
    "CategoryName": "Food & Beverage",
    "CategoryType": "expense",
    "TotalAmount": 4500000,
    "TotalTransactions": 30
  }
]
```

### 2. getUserBalance

```
POST /analytics/user-balance
```

Returns balance data with configurable aggregation level.

**Request Body:**

```json
{
  "userID": "uuid",
  "walletID": "uuid",
  "aggregation": "daily",
  "range": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  }
}
```

> `aggregation` is required: `"daily"` | `"weekly"` | `"monthly"`. `walletID` and `range` are optional.

**Aggregation behavior:**

| Type      | Method          | Groups by                              |
| --------- | --------------- | -------------------------------------- |
| `daily`   | `find()` + sort | Raw documents sorted by date           |
| `weekly`  | `aggregate()`   | Year + Week (+ Wallet if all wallets)  |
| `monthly` | `aggregate()`   | Year + Month (+ Wallet if all wallets) |

### 3. getUserFinancialSummary

```
POST /analytics/user-financial-summary
```

Returns comprehensive monthly financial health reports.

**Request Body:**

```json
{
  "userID": "uuid",
  "walletID": "uuid",
  "range": {
    "start": "2025-01-01",
    "end": "2025-06-30"
  }
}
```

> `walletID` and `range` are optional.

**Response includes:** income/expense, growth percentages, savings rate, burn rate, runway days, investment summary, net worth, top 5 expense/income categories, and per-wallet breakdown.

### 4. getUserNetWorthComposition

```
POST /analytics/user-net-worth-composition
```

Returns the latest net worth breakdown (pie chart data). Always represents the current state across all wallets.

**Request Body:**

```json
{
  "userID": "uuid"
}
```

**Response:**

```json
{
  "UserID": "uuid",
  "Total": 37500000,
  "Slices": [
    {
      "Label": "Cash & Bank Accounts",
      "Amount": 25000000,
      "Percentage": 66.67,
      "Details": { "ItemCount": 3, "Description": "3 wallet(s)" }
    },
    {
      "Label": "Investments",
      "Amount": 12500000,
      "Percentage": 33.33,
      "Details": {
        "ItemCount": 5,
        "Description": "5 investment(s)",
        "UnrealizedGain": 2500000
      }
    }
  ]
}
```

### 5. Initial Sync

```
POST /analytics/initial-sync
```

Triggers a full data sync from the write-model services. **Does not require JWT auth**, but requires a secret key.

**Request Body:**

```json
{
  "secretKey": "your-initial-sync-key"
}
```

---

## Initial Sync (gRPC)

The initial sync process is used to populate all MongoDB collections from scratch. It fetches data from 3 gRPC services (Wallet, Transaction, Investment) and processes them in order:

1. **UserWallet** — Bulk upsert all wallets.
2. **UserInvestment** — Bulk upsert all buy positions.
3. **UserTransaction** — Group transactions by user + wallet + category + date, then bulk upsert.
4. **UserBalance** — Calculate daily balance snapshots per wallet, then bulk upsert.
5. **UserFinancialSummaries** — Compute monthly summaries with all metrics, then bulk upsert.
6. **UserNetWorthComposition** — Compute net worth splits per user, then bulk upsert.

This should typically only be run once on initial deployment or for data recovery.

## Scripts

| Script      | Command            | Description                          |
| ----------- | ------------------ | ------------------------------------ |
| Development | `npm run dev`      | Runs with hot-reload via `tsx watch` |
| Start (TS)  | `npm run start:ts` | Runs TypeScript directly via `tsx`   |
| Build       | `npm run build`    | Compiles to JavaScript via `tsc`     |
| Production  | `npm start`        | Runs compiled JS from `dist/`        |
