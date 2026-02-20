# Refina Analytics

**CQRS Read Model Service** — Mengkonsumsi event keuangan dari microservice write-model melalui RabbitMQ dan mematerialisasinya ke dalam koleksi MongoDB yang dioptimalkan untuk query analitik.

## Daftar Isi

- [Gambaran Umum](#gambaran-umum)
- [Arsitektur](#arsitektur)
- [Tech Stack](#tech-stack)
- [Struktur Proyek](#struktur-proyek)
- [Memulai](#memulai)
- [Environment Variable](#environment-variable)
- [Koleksi MongoDB](#koleksi-mongodb)
  - [Koleksi Utama](#koleksi-utama)
  - [Koleksi Helper](#koleksi-helper)
- [Event Handling (RabbitMQ Consumer)](#event-handling-rabbitmq-consumer)
  - [Routing Key](#routing-key)
  - [Event Handler](#event-handler)
  - [Helper Bersama](#helper-bersama)
- [REST API Endpoint](#rest-api-endpoint)
  - [Autentikasi](#autentikasi)
  - [getUserTransaction](#1-getusertransaction)
  - [getUserBalance](#2-getuserbalance)
  - [getUserFinancialSummary](#3-getuserfinancialsummary)
  - [getUserNetWorthComposition](#4-getusernetworthcomposition)
  - [Initial Sync](#5-initial-sync)
- [Initial Sync (gRPC)](#initial-sync-grpc)
- [Script](#script)

---

## Gambaran Umum

Refina Analytics adalah salah satu microservice di platform keuangan pribadi **Refina**. Service ini mengikuti pola **CQRS (Command Query Responsibility Segregation)**:

- **Write model** (service lain) mempublikasikan domain event ke RabbitMQ setiap kali terjadi perubahan pada wallet, transaksi, atau investasi.
- **Service ini** (read model) berlangganan event tersebut dan membangun koleksi MongoDB yang terstruktur khusus untuk query analitik yang cepat — dikelompokkan berdasarkan kategori, diagregasi berdasarkan periode waktu, dll.

Pemisahan ini memungkinkan sisi write tetap sederhana sementara sisi read menyediakan analitik yang kaya dan sudah dihitung sebelumnya tanpa agregasi real-time yang mahal.

## Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│                     Write Model Services                    │
│   (Wallet Service, Transaction Service, Investment Service) │
└────────┬──────────────────────┬─────────────────────────────┘
         │ gRPC (initial sync)  │ RabbitMQ (event)
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

**Data masuk ke MongoDB melalui dua jalur:**

1. **Initial Sync** — Pada deployment pertama (atau reset data), mengambil semua data yang ada dari write service melalui gRPC dan melakukan bulk-upsert ke semua 6 koleksi.
2. **Event Consumer** — Terus-menerus mendengarkan event RabbitMQ dan memperbarui koleksi secara inkremental.

**Data keluar melalui:**

3. **REST API** — Endpoint Express yang melakukan query ke koleksi MongoDB yang sudah dihitung sebelumnya.

## Tech Stack

| Teknologi                                        | Kegunaan                                    |
| ------------------------------------------------ | ------------------------------------------- |
| **TypeScript**                                   | Kode aplikasi yang type-safe                |
| **Express 5**                                    | Framework REST API                          |
| **MongoDB / Mongoose**                           | Penyimpanan data read model                 |
| **RabbitMQ** (amqplib + amqp-connection-manager) | Konsumsi event dengan auto-reconnect        |
| **gRPC** (@muhammadmiftaa/refina-protobuf)       | Sinkronisasi data awal dari write service   |
| **Zod**                                          | Validasi schema untuk event dan request API |
| **Winston**                                      | Logging terstruktur                         |
| **JWT**                                          | Autentikasi (Bearer token)                  |
| **Swagger**                                      | Dokumentasi API                             |

## Struktur Proyek

```
src/
├── main.ts                    # Entry point: Express + MongoDB + RabbitMQ
├── route.ts                   # Definisi route untuk endpoint analitik
├── handler.ts                 # Express request handler
├── service.ts                 # Logika query (MongoDB aggregation pipeline)
├── middleware.ts               # Auth, validasi, error handling, logging
│
├── event/                     # Konsumsi event RabbitMQ
│   ├── config.ts              # Manajemen koneksi RabbitMQ
│   └── consumer/
│       ├── consumer.ts        # Registry handler + message processor + startConsumer
│       ├── consumer.helper.ts # Shared: recalcNetWorth, recalcFinancialSummary
│       ├── wallet.created.ts  # Upsert UserWallet → hitung ulang net worth
│       ├── wallet.updated.ts  # Update UserWallet → hitung ulang net worth
│       ├── wallet.deleted.ts  # Soft delete wallet → hitung ulang net worth
│       ├── transaction.created.ts  # UserTransaction + UserBalance + financial summary
│       ├── transaction.updated.ts  # Hapus lama → masukkan baru → hitung ulang
│       ├── transaction.deleted.ts  # Hapus → balikkan saldo → hitung ulang
│       ├── investment.buy.ts  # Upsert UserInvestment → hitung ulang
│       └── investment.sell.ts # Batch FIFO sell (array) → hitung ulang
│
├── grpc/
│   └── client/
│       ├── client.ts              # Base gRPC client
│       ├── client.wallet.ts       # Wallet gRPC client
│       ├── client.transaction.ts  # Transaction gRPC client
│       ├── client.investment.ts   # Investment gRPC client
│       ├── initSync.ts            # Orkestrator initial sync utama
│       ├── initSync.helper.ts     # Utilitas helper sinkronisasi
│       ├── initSync.userTransactions.ts
│       ├── initSync.userBalances.ts
│       ├── initSync.UserFinancialSummaries.ts
│       └── initSync.UserNetWorthComposition.ts
│
└── utils/
    ├── constant.ts   # Nama exchange, queue, routing key
    ├── dto.ts        # Zod schema + tipe TypeScript yang di-infer
    ├── env.ts        # Loader environment variable (required/requiredInt)
    ├── errors.ts     # Class error kustom (ValidationError, NotFoundError, dll.)
    ├── helper.ts     # Verifikasi JWT, getWeekNumber, helper validasi Zod
    ├── logger.ts     # Konfigurasi logger Winston
    ├── model.ts      # Semua 6 Mongoose schema + model
    ├── response.ts   # Helper response API yang terstandarisasi
    └── swagger.ts    # Setup Swagger/OpenAPI
```

## Memulai

### Prasyarat

- **Node.js** ≥ 18
- **MongoDB** (instance yang berjalan)
- **RabbitMQ** (instance yang berjalan dengan exchange `refina_microservice`)
- **gRPC service write-model** (Wallet, Transaction, Investment) — diperlukan untuk initial sync

### Instalasi

```bash
# Clone repository
git clone <repo-url>
cd refina-analytics

# Install dependensi
npm install

# Buat file .env (lihat bagian Environment Variable di bawah)
cp .env.example .env

# Development (hot reload)
npm run dev

# Build production
npm run build
npm start
```

## Environment Variable

| Variabel                | Tipe   | Deskripsi                                            |
| ----------------------- | ------ | ---------------------------------------------------- |
| `PORT`                  | number | Port server (contoh: `3002`)                         |
| `NODE_ENV`              | string | `development` atau `production`                      |
| `DATABASE_URL`          | string | String koneksi MongoDB                               |
| `JWT_SECRET`            | string | Secret key untuk verifikasi JWT                      |
| `LOG_LEVEL`             | string | Level log Winston (`info`, `debug`, `error`)         |
| `INITIAL_SYNC_KEY`      | string | Secret key untuk mengotorisasi endpoint initial sync |
| `WALLET_ADDRESS`        | string | Alamat gRPC untuk Wallet service                     |
| `TRANSACTION_ADDRESS`   | string | Alamat gRPC untuk Transaction service                |
| `INVESTMENT_ADDRESS`    | string | Alamat gRPC untuk Investment service                 |
| `RABBITMQ_HOST`         | string | Hostname RabbitMQ                                    |
| `RABBITMQ_PORT`         | string | Port RabbitMQ                                        |
| `RABBITMQ_USER`         | string | Username RabbitMQ                                    |
| `RABBITMQ_PASSWORD`     | string | Password RabbitMQ                                    |
| `RABBITMQ_VIRTUAL_HOST` | string | Virtual host RabbitMQ                                |

---

## Koleksi MongoDB

### Koleksi Utama

Ini adalah koleksi yang dioptimalkan untuk query yang dibaca oleh REST API.

#### 1. UserTransaction

**Granularitas:** Harian per Wallet + Kategori

Menyimpan data transaksi yang diagregasi berdasarkan user, wallet, kategori, dan tanggal. Setiap dokumen merepresentasikan _"semua transaksi user X, di wallet Y, di kategori Z, pada tanggal D"_.

| Field                                          | Deskripsi                                    |
| ---------------------------------------------- | -------------------------------------------- |
| `UserID`                                       | ID user pemilik                              |
| `WalletID` / `WalletName` / `WalletType`       | Informasi wallet                             |
| `CategoryID` / `CategoryName` / `CategoryType` | Informasi kategori (`income` atau `expense`) |
| `Date` / `Year` / `Month` / `Week` / `Day`     | Dimensi waktu                                |
| `TotalAmount`                                  | Jumlah total semua transaksi dalam grup ini  |
| `TransactionCount`                             | Jumlah transaksi                             |
| `Transactions[]`                               | Array berisi `{ ID, Description, Date }`     |

**Unique Index:** `{ UserID, WalletID, CategoryID, Date }`

#### 2. UserBalance

**Granularitas:** Harian per Wallet

Snapshot saldo harian per wallet, memungkinkan chart time-series.

| Field                                        | Deskripsi                |
| -------------------------------------------- | ------------------------ |
| `OpeningBalance` / `ClosingBalance`          | Saldo di awal/akhir hari |
| `TotalIncome` / `TotalExpense` / `NetChange` | Total harian             |
| `CumulativeIncome` / `CumulativeExpense`     | Total kumulatif          |

**Unique Index:** `{ WalletID, Date }`

#### 3. UserFinancialSummaries

**Granularitas:** Bulanan per User

Laporan kesehatan keuangan bulanan yang komprehensif dengan perbandingan pertumbuhan, rasio, ringkasan investasi, net worth, dan breakdown kategori.

| Bagian              | Field Utama                                                                  |
| ------------------- | ---------------------------------------------------------------------------- |
| Periode saat ini    | `IncomeNow`, `ExpenseNow`, `ProfitNow`, `BalanceNow`                         |
| Periode sebelumnya  | `IncomePrev`, `ExpensePrev`, `ProfitPrev`, `BalancePrev`                     |
| Pertumbuhan         | `IncomeGrowthPct`, `ExpenseGrowthPct`, `ProfitGrowthPct`, `BalanceGrowthPct` |
| Indikator kesehatan | `SavingsRate`, `ExpenseToIncomeRatio`, `BurnRateDaily`, `RunwayDays`         |
| Investasi           | `InvestmentSummary { TotalInvested, UnrealizedGain, RealizedGain, ... }`     |
| Net worth           | `NetWorth { Total, WalletPortion, InvestmentPortion, NetWorthGrowthPct }`    |
| Top kategori        | `TopExpenseCategories[]`, `TopIncomeCategories[]` (top 5)                    |
| Breakdown wallet    | `WalletSummaries[]`                                                          |

**Unique Index:** `{ UserID, PeriodType, PeriodKey }`

#### 4. UserNetWorthComposition

**Granularitas:** Snapshot (state terbaru per user)

Satu dokumen per user yang merepresentasikan pembagian net worth saat ini antara rekening tunai/bank dan investasi. Ideal untuk pie chart.

| Field      | Deskripsi                                             |
| ---------- | ----------------------------------------------------- |
| `Total`    | Total net worth                                       |
| `Slices[]` | Array berisi `{ Label, Amount, Percentage, Details }` |

**Unique Index:** `{ UserID }`

### Koleksi Helper

Ini adalah koleksi untuk penggunaan internal yang meng-cache data dari write service agar tidak perlu melakukan panggilan gRPC saat memproses event.

#### 5. UserWallet

Satu dokumen per wallet. Diperbarui oleh event `wallet.*`. Digunakan oleh `recalcNetWorth` dan `recalcFinancialSummary` untuk membaca saldo wallet saat ini tanpa memanggil Wallet service.

#### 6. UserInvestment

Satu dokumen per posisi beli. Diperbarui oleh event `investment.buy` dan `investment.sell`. Melacak kuantitas, harga beli rata-rata, realized gain, dan total penjualan. Digunakan oleh `recalcNetWorth` dan `recalcFinancialSummary`.

---

## Event Handling (RabbitMQ Consumer)

### Koneksi

- **Exchange:** `refina_microservice` (topic exchange, dideklarasikan oleh write service)
- **Queue:** `refina-analytics` (durable, prefetch = 1)
- Auto-reconnect dengan `amqp-connection-manager`

### Routing Key

| Pola            | Cocok Dengan                                                        |
| --------------- | ------------------------------------------------------------------- |
| `wallet.*`      | `wallet.created`, `wallet.updated`, `wallet.deleted`                |
| `transaction.*` | `transaction.created`, `transaction.updated`, `transaction.deleted` |
| `investment.*`  | `investment.buy`, `investment.sell`                                 |

### Event Handler

#### `wallet.created`

Membuat atau meng-upsert dokumen `UserWallet`, lalu menghitung ulang komposisi net worth user.

**Payload:** Objek wallet tunggal dengan `id`, `user_id`, `name`, `balance`, `wallet_type`, dll.

#### `wallet.updated`

Memperbarui dokumen `UserWallet` yang ada (saldo, nama, dll.), lalu menghitung ulang net worth.

**Payload:** Sama dengan `wallet.created`.

#### `wallet.deleted`

Melakukan soft-delete wallet (`IsActive = false`), lalu menghitung ulang net worth.

**Payload:** Sama dengan `wallet.created`.

#### `transaction.created`

1. Meng-upsert dokumen `UserTransaction` (dikelompokkan per wallet + kategori + tanggal), menambah `TotalAmount` dan `TransactionCount`.
2. Meng-upsert dokumen `UserBalance` untuk wallet + tanggal, menyesuaikan saldo pembuka/penutup dan pemasukan/pengeluaran.
3. Menghitung ulang `UserFinancialSummaries` untuk bulan tersebut.

**Payload:** Objek transaksi tunggal dengan `id`, `wallet_id`, `amount`, `category_id`, `category_name`, `category_type`, `transaction_date`, dll.

#### `transaction.updated`

Membalikkan transaksi lama (mengurangi dari `UserTransaction` dan `UserBalance`), lalu menerapkan nilai baru seolah-olah itu adalah `transaction.created` baru.

**Payload:** Objek dengan properti `old` (transaksi sebelumnya) dan `new` (transaksi yang diperbarui).

#### `transaction.deleted`

Menghapus transaksi dari `UserTransaction` (mengurangi jumlah), membalikkan dampak saldo pada `UserBalance`, lalu menghitung ulang ringkasan keuangan bulanan.

**Payload:** Objek transaksi tunggal (transaksi yang dihapus).

#### `investment.buy`

Meng-upsert dokumen `UserInvestment` untuk posisi beli, menyimpan kuantitas, jumlah, harga beli rata-rata, dan kurs terkini. Lalu menghitung ulang net worth dan ringkasan keuangan.

**Payload:** Objek investasi tunggal dengan `id`, `code`, `userId`, `quantity`, `amount`, `assetCode { code, name, unit, toUSD, toIDR, toEUR }`, dll.

#### `investment.sell`

Menerima **array item penjualan** (batch FIFO sell dari beberapa posisi beli dengan kode aset yang sama). Untuk setiap item:

1. Mencari posisi beli yang sesuai berdasarkan `investmentId`.
2. Mengurangi kuantitas yang dijual, menghitung realized gain (`jumlahJual − hargaBeliRata² × kuantitas`).
3. Memperbarui field tracking posisi beli (`TotalSoldQuantity`, `TotalSoldAmount`, `TotalDeficit`, `RealizedGain`).
4. Menandai posisi sebagai tidak aktif jika sudah habis terjual.
5. Memperbarui kurs jika tersedia (non-null).

Setelah memproses semua item, menghitung ulang net worth dan ringkasan keuangan **sekali saja**.

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
    "description": "Jual 0.5 BTC",
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

### Helper Bersama

#### `recalcNetWorth(userId)`

Membaca semua dokumen `UserWallet` dan `UserInvestment` yang aktif untuk user, menghitung total net worth, dan meng-upsert dokumen `UserNetWorthComposition` dengan slice untuk "Cash & Bank Accounts" dan "Investments".

#### `recalcFinancialSummary(userId, txDate)`

Re-agregasi penuh data keuangan bulanan user:

1. Membaca semua dokumen `UserTransaction` untuk bulan tersebut.
2. Menghitung total pemasukan/pengeluaran, breakdown kategori, pertumbuhan vs bulan sebelumnya.
3. Membaca `UserWallet` untuk saldo terkini.
4. Membaca `UserInvestment` untuk ringkasan investasi.
5. Menghitung indikator kesehatan (savings rate, burn rate, runway days, dll.).
6. Meng-upsert dokumen `UserFinancialSummaries` untuk bulan tersebut.

---

## REST API Endpoint

Semua endpoint analitik berada di bawah `/analytics` dan memerlukan autentikasi Bearer token.

### Autentikasi

Semua route (kecuali `/analytics/initial-sync`) memerlukan JWT Bearer token di header `Authorization`:

```
Authorization: Bearer <jwt-token>
```

Token diverifikasi menggunakan environment variable `JWT_SECRET`. Payload yang di-decode harus mengandung `id`, `email`, dan `username`.

### 1. getUserTransaction

```
POST /analytics/user-transactions
```

Mengembalikan data transaksi yang dikelompokkan berdasarkan kategori, dengan filter opsional berdasarkan wallet dan tanggal.

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

> Semua field di `dateOption` bersifat opsional. Prioritas: `date` > `range` > `year+month+day` > `year+month` > `year` > semua waktu.

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

Mengembalikan data saldo dengan level agregasi yang bisa dikonfigurasi.

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

> `aggregation` wajib diisi: `"daily"` | `"weekly"` | `"monthly"`. `walletID` dan `range` bersifat opsional.

**Perilaku agregasi:**

| Tipe      | Metode          | Dikelompokkan Berdasarkan                    |
| --------- | --------------- | -------------------------------------------- |
| `daily`   | `find()` + sort | Dokumen mentah diurutkan berdasarkan tanggal |
| `weekly`  | `aggregate()`   | Tahun + Minggu (+ Wallet jika semua wallet)  |
| `monthly` | `aggregate()`   | Tahun + Bulan (+ Wallet jika semua wallet)   |

### 3. getUserFinancialSummary

```
POST /analytics/user-financial-summary
```

Mengembalikan laporan kesehatan keuangan bulanan yang komprehensif.

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

> `walletID` dan `range` bersifat opsional.

**Response mencakup:** pemasukan/pengeluaran, persentase pertumbuhan, savings rate, burn rate, runway days, ringkasan investasi, net worth, top 5 kategori pengeluaran/pemasukan, dan breakdown per wallet.

### 4. getUserNetWorthComposition

```
POST /analytics/user-net-worth-composition
```

Mengembalikan breakdown net worth terbaru (data pie chart). Selalu merepresentasikan state saat ini di semua wallet.

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
      "Details": { "ItemCount": 3, "Description": "3 wallet" }
    },
    {
      "Label": "Investments",
      "Amount": 12500000,
      "Percentage": 33.33,
      "Details": {
        "ItemCount": 5,
        "Description": "5 investasi",
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

Memicu sinkronisasi data penuh dari write-model service. **Tidak memerlukan autentikasi JWT**, tetapi memerlukan secret key.

**Request Body:**

```json
{
  "secretKey": "your-initial-sync-key"
}
```

---

## Initial Sync (gRPC)

Proses initial sync digunakan untuk mengisi semua koleksi MongoDB dari awal. Mengambil data dari 3 service gRPC (Wallet, Transaction, Investment) dan memprosesnya secara berurutan:

1. **UserWallet** — Bulk upsert semua wallet.
2. **UserInvestment** — Bulk upsert semua posisi beli.
3. **UserTransaction** — Kelompokkan transaksi berdasarkan user + wallet + kategori + tanggal, lalu bulk upsert.
4. **UserBalance** — Hitung snapshot saldo harian per wallet, lalu bulk upsert.
5. **UserFinancialSummaries** — Hitung ringkasan bulanan dengan semua metrik, lalu bulk upsert.
6. **UserNetWorthComposition** — Hitung pembagian net worth per user, lalu bulk upsert.

Proses ini biasanya hanya perlu dijalankan sekali pada deployment awal atau untuk pemulihan data.

## Script

| Script      | Perintah           | Deskripsi                                          |
| ----------- | ------------------ | -------------------------------------------------- |
| Development | `npm run dev`      | Berjalan dengan hot-reload via `tsx watch`         |
| Start (TS)  | `npm run start:ts` | Menjalankan TypeScript langsung via `tsx`          |
| Build       | `npm run build`    | Kompilasi ke JavaScript via `tsc`                  |
| Production  | `npm start`        | Menjalankan JS yang sudah dikompilasi dari `dist/` |
