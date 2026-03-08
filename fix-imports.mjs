import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

async function fixImports(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await fixImports(fullPath);
    } else if (entry.name.endsWith(".js")) {
      let content = await readFile(fullPath, "utf8");
      content = content.replace(
        /from\s+["'](\.{1,2}\/[^"']+?)["']/g,
        (match, p1) => {
          // Skip jika sudah ada extension file yang valid di akhir
          if (/\.[a-z]+$/i.test(p1) && !p1.endsWith(".js")) {
            // Cek apakah extension-nya bukan bagian dari nama file (misal client.wallet)
            // Kalau tidak diakhiri .js tapi punya dot, tetap tambahkan .js
            const lastSegment = p1.split("/").pop();
            const knownExtensions = ["json", "yaml", "yml", "css", "html"];
            const ext = lastSegment.split(".").pop().toLowerCase();
            if (knownExtensions.includes(ext)) return match; // skip file non-JS
          }
          if (p1.endsWith(".js")) return match; // sudah ada .js
          return match.replace(p1, p1 + ".js");
        }
      );
      await writeFile(fullPath, content);
    }
  }
}

await fixImports("./dist");
console.log("✅ Import paths fixed");