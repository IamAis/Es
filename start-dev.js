import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isWindows = process.platform === "win32";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Check if Vite dev server is ready
function checkViteServer(port = 5173, maxRetries = 60) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    let resolved = false;

    const check = () => {
      if (resolved) return;

      const req = http.get(`http://localhost:${port}`, (res) => {
        if (resolved) return;

        if (res.statusCode === 200 || res.statusCode === 404) {
          resolved = true;
          log("✅ Vite dev server is ready!", colors.green);
          resolve();
        } else {
          retry();
        }
      });

      req.on("error", () => {
        if (!resolved) retry();
      });

      req.setTimeout(2000, () => {
        req.destroy();
        if (!resolved) retry();
      });
    };

    const retry = () => {
      if (resolved) return;

      retries++;
      if (retries >= maxRetries) {
        resolved = true;
        reject(new Error("Vite dev server failed to start"));
      } else {
        setTimeout(check, 1000);
      }
    };

    check();
  });
}

// Start Vite dev server
function startVite() {
  return new Promise((resolve, reject) => {
    log("🚀 Starting Vite dev server...", colors.blue);

    const viteProcess = spawn(isWindows ? "npm.cmd" : "npm", ["run", "dev"], {
      cwd: __dirname,
      stdio: "inherit",
      shell: true,
    });

    viteProcess.on("error", (error) => {
      log(`❌ Failed to start Vite: ${error.message}`, colors.red);
      reject(error);
    });

    // Wait for Vite to be ready
    checkViteServer()
      .then(() => resolve(viteProcess))
      .catch(reject);
  });
}

// Build Electron source files
function buildElectron() {
  return new Promise((resolve, reject) => {
    log("🔨 Building Electron source files...", colors.yellow);

    const buildProcess = spawn(
      isWindows ? "npm.cmd" : "npm",
      ["run", "build:electron-src"],
      {
        cwd: __dirname,
        stdio: "inherit",
        shell: true,
      },
    );

    buildProcess.on("close", (code) => {
      if (code === 0) {
        log("✅ Electron build completed!", colors.green);
        resolve();
      } else {
        reject(new Error(`Build process exited with code ${code}`));
      }
    });

    buildProcess.on("error", (error) => {
      log(`❌ Failed to build Electron: ${error.message}`, colors.red);
      reject(error);
    });
  });
}

// Start Electron app
function startElectron() {
  log("⚡ Starting Electron...", colors.blue);

  const electronProcess = spawn(
    isWindows ? "npx.cmd" : "npx",
    ["cross-env", "NODE_ENV=development", "electron", "."],
    {
      cwd: __dirname,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, NODE_ENV: "development" },
    },
  );

  electronProcess.on("error", (error) => {
    log(`❌ Failed to start Electron: ${error.message}`, colors.red);
    process.exit(1);
  });

  return electronProcess;
}

// Main execution
async function main() {
  log("🎯 Starting development environment...", colors.bright);

  let viteProcess = null;
  let electronProcess = null;

  try {
    // Start Vite and wait for it to be ready
    viteProcess = await startVite();

    // Build Electron source files
    await buildElectron();

    // Start Electron
    electronProcess = startElectron();

    log("✨ Development environment is ready!", colors.green);

    // Handle cleanup on exit
    const cleanup = () => {
      log("\n🛑 Shutting down...", colors.yellow);

      if (electronProcess) {
        electronProcess.kill();
      }

      if (viteProcess) {
        viteProcess.kill();
      }

      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    process.on("exit", cleanup);

    // Keep the script running
    electronProcess.on("close", (code) => {
      log(`\n⚡ Electron exited with code ${code}`, colors.yellow);
      cleanup();
    });
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, colors.red);

    if (viteProcess) {
      viteProcess.kill();
    }

    process.exit(1);
  }
}

main();
