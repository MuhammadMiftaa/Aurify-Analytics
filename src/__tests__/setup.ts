// ─────────────────────────────────────────────────────────────
// SHARED SETUP — setup.ts
// Dokumentasi mock yang digunakan di setiap test file.
//
// Karena project menggunakan ESM (type: "module"), mock dilakukan
// menggunakan jest.unstable_mockModule() di tiap test file,
// BUKAN di sini (jest.mock() hanya bisa di CommonJS setup files).
//
// Setiap test file melakukan mock-nya sendiri dengan pola:
//
//   jest.unstable_mockModule("../../utils/model", () => ({ ... }))
//
// File ini hanya sebagai dokumentasi / placeholder agar struktur
// direktori __tests__ tetap rapi.
// ─────────────────────────────────────────────────────────────
