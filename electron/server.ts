import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { createServer, type Server } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "../server/routes.js";
import { log } from "../server/vite.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let server: Server | null = null;

/**
 * Avvia il server Express nel main process
 */
export async function startServer(port: number): Promise<Server> {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  // Registra le route
  const httpServer = await registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
  });

  // Serve static files (React app)
  const publicDir = path.join(__dirname, "../public");
  app.use(express.static(publicDir));

  // Fallback per SPA
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  // Avvia il server su 0.0.0.0 per permettere connessioni locali
  return new Promise((resolve, reject) => {
    try {
      httpServer.listen(port, "0.0.0.0", () => {
        log(`Express server started on port ${port}`);
        server = httpServer;
        resolve(httpServer);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Ferma il server
 */
export async function stopServer(): Promise<void> {
  if (server) {
    return new Promise((resolve) => {
      server!.close(() => {
        log("Express server stopped");
        server = null;
        resolve();
      });
    });
  }
}

/**
 * Ottiene l'istanza del server
 */
export function getServer(): Server | null {
  return server;
}
