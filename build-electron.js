import esbuild from "esbuild";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync, readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json to get dependencies
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));
const externalDependencies = Object.keys(packageJson.dependencies || {});

const outDir = join(__dirname, "dist", "electron");
mkdirSync(outDir, { recursive: true });

const files = [
  { in: "electron/main.ts", out: "dist/electron/main.js" },
  { in: "electron/preload.ts", out: "dist/electron/preload.js" },
  { in: "electron/server.ts", out: "dist/electron/server.js" },
  { in: "electron/database.ts", out: "dist/electron/database.js" },
  { in: "electron/config.ts", out: "dist/electron/config.js" },
  { in: "electron/backup-manager.ts", out: "dist/electron/backup-manager.js" },
  { in: "electron/utils/ipc-handlers.ts", out: "dist/electron/utils/ipc-handlers.js" },
];

async function build() {
  try {
    for (const file of files) {
      console.log(`📦 Building ${file.in}...`);
      await esbuild.build({
        entryPoints: [join(__dirname, file.in)],
        outfile: join(__dirname, file.out),
        bundle: true,
        format: "esm",
        target: "esnext",
        external: ["electron", "lightningcss", ...externalDependencies],
        platform: "node",
        sourcemap: process.env.NODE_ENV === "development",
      });
    }
    console.log("✅ Electron files built successfully!");
  } catch (error) {
    console.error("❌ Build failed:", error.message);
    process.exit(1);
  }
}

build();