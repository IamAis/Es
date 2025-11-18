import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { EventEmitter } from "events";
import type { Request, Response, NextFunction } from "express";
import JSZip from "jszip";
import { storage } from "./storage";
import { extractXMLFromP7M } from "./utils/p7m-extractor";
import { parseFatturaPAXML } from "./utils/xml-parser";
import { transformXMLToHTML } from "./utils/xslt-transformer";
import { generatePDFFromHTML } from "./utils/html-to-pdf.js";
import { insertInvoiceSchema, updateInvoiceSchema } from "@shared/schema";
import pdfRoutes from "./routes/pdf.js";
import backupRoutes from "./routes/backup.js";
import {
  getStorageDir,
  getXmlDir,
  getHtmlDir,
  getPdfDir,
  logStorageConfig,
} from "./paths.js";
import { getDatabasePath, getDataPath } from "../electron/database.js";

// Progress tracking for uploads
interface UploadProgress {
  jobId: string;
  total: number;
  completed: number;
  failed: number;
  status: "preparing" | "processing" | "completed" | "failed";
  currentFile: string;
  results?: any[];
  errors?: any[];
}

const progressEmitter = new EventEmitter();
const uploadJobs = new Map<string, UploadProgress>();

// Storage directories - dynamically resolved based on environment
const STORAGE_DIR = getStorageDir();
const XML_DIR = getXmlDir();
const HTML_DIR = getHtmlDir();
const PDF_DIR = getPdfDir();

// Ensure storage directories exist
async function ensureStorageDirectories() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    await fs.mkdir(XML_DIR, { recursive: true });
    await fs.mkdir(HTML_DIR, { recursive: true });
    await fs.mkdir(PDF_DIR, { recursive: true });
    console.log("Storage directories initialized:");
    console.log(`  Storage: ${STORAGE_DIR}`);
    console.log(`  XML: ${XML_DIR}`);
    console.log(`  HTML: ${HTML_DIR}`);
    console.log(`  PDF: ${PDF_DIR}`);
  } catch (error) {
    console.error("Error creating storage directories:", error);
  }
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".xml" || ext === ".p7m") {
      cb(null, true);
    } else {
      cb(new Error("Only .xml and .p7m files are allowed"));
    }
  },
});

// Add error handling middleware
const handleError = (error: any) => {
  const message = error?.message || "Internal server error";
  const status = error?.status || 500;
  return { status, message };
};

async function removeInvoiceFile(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch (err: any) {
    if (err && err.code === "ENOENT") {
      return;
    }
    console.error(`Error deleting file ${filePath}:`, err);
    const error = new Error(`Failed to delete file ${path.basename(filePath)}`);
    (error as any).details = err instanceof Error ? err.message : String(err);
    (error as any).status = 500;
    throw error;
  }
}

async function deleteInvoiceWithFiles(id: string) {
  const invoice = await storage.getInvoice(id);
  if (!invoice) {
    const error = new Error("Invoice not found");
    (error as any).status = 404;
    throw error;
  }

  await removeInvoiceFile(path.join(XML_DIR, invoice.xmlPath));
  if (invoice.htmlPath) {
    await removeInvoiceFile(path.join(HTML_DIR, invoice.htmlPath));
  }
  if (invoice.pdfPath) {
    await removeInvoiceFile(path.join(PDF_DIR, invoice.pdfPath));
  }

  const deleted = await storage.deleteInvoice(id);
  if (!deleted) {
    const error = new Error("Invoice not found or already deleted");
    (error as any).status = 404;
    throw error;
  }

  return { id };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure storage directories exist on startup
  await ensureStorageDirectories();

  // CORS headers for all API routes
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    
    next();
  });

  // Register PDF generation routes
  app.use("/api/pdf", pdfRoutes);

  // Register backup/restore routes
  app.use("/api/backup", backupRoutes);

  // SSE endpoint for upload progress tracking
  app.get("/api/invoices/upload/progress/:jobId", (req, res) => {
    const { jobId } = req.params;

    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Send initial progress if job exists
    const currentProgress = uploadJobs.get(jobId);
    if (currentProgress) {
      res.write(`data: ${JSON.stringify(currentProgress)}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ error: "Job not found" })}\n\n`);
    }

    // Listen for progress updates
    const progressHandler = (data: {
      jobId: string;
      progress: UploadProgress;
    }) => {
      if (data.jobId === jobId) {
        res.write(`data: ${JSON.stringify(data.progress)}\n\n`);

        // Close connection when completed or failed
        if (
          data.progress.status === "completed" ||
          data.progress.status === "failed"
        ) {
          setTimeout(() => {
            progressEmitter.removeListener("progress", progressHandler);
            res.end();
          }, 100);
        }
      }
    };

    progressEmitter.on("progress", progressHandler);

    // Clean up on client disconnect
    req.on("close", () => {
      progressEmitter.removeListener("progress", progressHandler);
      res.end();
    });
  });

  // GET /api/invoices - Fetch invoices with pagination and filters
  app.get("/api/invoices", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 1000; // Default high limit for compatibility
      const search = (req.query.search as string) || "";
      const status = (req.query.status as string) || "all";
      const year = (req.query.year as string) || "all";
      const month = (req.query.month as string) || "all";

      let invoices = await storage.getAllInvoices();

      // Apply filters
      if (search) {
        const searchLower = search.toLowerCase();
        invoices = invoices.filter(
          (inv) =>
            inv.invoiceNumber.toLowerCase().includes(searchLower) ||
            inv.supplierName.toLowerCase().includes(searchLower) ||
            inv.customerName?.toLowerCase().includes(searchLower),
        );
      }

      if (status !== "all") {
        invoices = invoices.filter((inv) => inv.status === status);
      }

      if (year !== "all" || month !== "all") {
        invoices = invoices.filter((inv) => {
          const invoiceDate = new Date(inv.invoiceDate);
          const invoiceYear = invoiceDate.getFullYear().toString();
          const invoiceMonth = (invoiceDate.getMonth() + 1)
            .toString()
            .padStart(2, "0");

          const matchesYear = year === "all" || invoiceYear === year;
          const matchesMonth = month === "all" || invoiceMonth === month;

          return matchesYear && matchesMonth;
        });
      }

      // Calculate pagination
      const total = invoices.length;
      const totalPages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedInvoices = invoices.slice(start, end);

      // Return paginated response
      res.json({
        invoices: paginatedInvoices,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    } catch (error: any) {
      const { status, message } = handleError(error);
      res.status(status).json({ error: message });
    }
  });

  // POST /api/invoices/upload - Upload and process invoice files
  app.post(
    "/api/invoices/upload",
    upload.array("files", 10),
    (req, res) => {
      try {
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
          return res.status(400).json({ error: "No files uploaded" });
        }

        const maxFileSize = 10 * 1024 * 1024; // 10MB
        const oversizedFiles = (req.files as Express.Multer.File[]).filter(
          (file) => file.size > maxFileSize,
        );

        if (oversizedFiles.length > 0) {
          return res.status(400).json({
            error: "Files too large",
            files: oversizedFiles.map((f) => f.originalname),
          });
        }

        // Create job ID and initial progress
        const jobId = `upload-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        const files = req.files as Express.Multer.File[];

        const progress: UploadProgress = {
          jobId,
          total: files.length,
          completed: 0,
          failed: 0,
          status: "preparing",
          currentFile: "Inizializzazione...",
        };

        uploadJobs.set(jobId, progress);
        progressEmitter.emit("progress", { jobId, progress });

        // Respond immediately to the client
        res.status(202).json({ jobId });

        // Process files in the background
        (async () => {
          // Switch to processing state
          progress.status = "processing";
          progress.currentFile = "";
          progressEmitter.emit("progress", { jobId, progress });

          const results: any[] = [];
          const errors: any[] = [];

          const processFile = async (
            file: Express.Multer.File,
            index: number,
          ) => {
            progress.currentFile = file.originalname;
            progressEmitter.emit("progress", { jobId, progress });

            try {
              let xmlContent: string;
              let originalFormat: "xml" | "p7m";

              if (file.originalname.toLowerCase().endsWith(".p7m")) {
                originalFormat = "p7m";
                xmlContent = await extractXMLFromP7M(file.buffer);
              } else {
                originalFormat = "xml";
                xmlContent = file.buffer.toString("utf-8");
              }

              const invoiceData = await parseFatturaPAXML(xmlContent);

              const existingInvoices = await storage.getAllInvoices();
              const isDuplicate = existingInvoices.some(
                (inv) =>
                  inv.invoiceNumber === invoiceData.invoiceNumber &&
                  inv.invoiceDate === invoiceData.invoiceDate &&
                  (inv.supplierVat === invoiceData.supplierVat ||
                    inv.supplierFiscalCode ===
                      invoiceData.supplierFiscalCode),
              );

              if (isDuplicate) {
                const duplicateError = new Error(
                  `Fattura duplicata: ${file.originalname} (Numero: ${invoiceData.invoiceNumber}, Data: ${invoiceData.invoiceDate})`,
                );
                (duplicateError as any).code = "DUPLICATE_INVOICE";
                throw duplicateError;
              }

              // Usa un filename stabile basato sul numero fattura e data
              // Non usare timestamp random per evitare duplicati
              const safeInvoiceNumber = invoiceData.invoiceNumber.replace(
                /[^a-zA-Z0-9]/g,
                "_",
              );
              const safeDate = invoiceData.invoiceDate.replace(/[^0-9]/g, "");
              const stableFilename = `${safeInvoiceNumber}_${safeDate}`;

              const xmlFilename = `${stableFilename}.xml`;
              const htmlFilename = `${stableFilename}.html`;
              const pdfFilename = `${stableFilename}.pdf`;

              // Verifica se i file esistono già (evita sovrascritture accidentali)
              const xmlPath = path.join(XML_DIR, xmlFilename);
              const htmlPath = path.join(HTML_DIR, htmlFilename);
              const pdfPath = path.join(PDF_DIR, pdfFilename);

              // Se i file esitono già, significa che la fattura è stata processata
              const xmlExists = await fs.stat(xmlPath).then(() => true).catch(() => false);
              const htmlExists = await fs.stat(htmlPath).then(() => true).catch(() => false);
              const pdfExists = await fs.stat(pdfPath).then(() => true).catch(() => false);

              // Scrivi solo se non esiste (idempotente)
              if (!xmlExists) {
                await fs.writeFile(xmlPath, xmlContent, "utf-8");
              }

              const htmlContent = await transformXMLToHTML(xmlContent);
              if (!htmlExists) {
                await fs.writeFile(htmlPath, htmlContent, "utf-8");
              }

              const pdfBuffer = await generatePDFFromHTML(htmlContent);
              if (!pdfExists) {
                await fs.writeFile(pdfPath, pdfBuffer);
              }

              const invoice = await storage.createInvoice({
                filename: file.originalname,
                originalFormat,
                invoiceNumber: invoiceData.invoiceNumber,
                invoiceDate: invoiceData.invoiceDate,
                supplierName: invoiceData.supplierName,
                supplierVat: invoiceData.supplierVat,
                supplierFiscalCode: invoiceData.supplierFiscalCode,
                customerName: invoiceData.customerName,
                customerVat: invoiceData.customerVat,
                totalAmount: invoiceData.totalAmount.toString(),
                taxAmount: invoiceData.taxAmount.toString(),
                taxableAmount: invoiceData.taxableAmount.toString(),
                currency: invoiceData.currency,
                paymentMethod: invoiceData.paymentMethod,
                paymentDueDate: invoiceData.paymentDueDate,
                status: "not_printed",
                marked: false,
                notes: null,
                tags: null,
                xmlPath: xmlFilename,
                htmlPath: htmlFilename,
                pdfPath: pdfFilename,
              });

              progress.completed++;
              progressEmitter.emit("progress", { jobId, progress });

              return { success: true, invoice };
            } catch (error: any) {
              console.error(
                `Error processing file ${file.originalname}:`,
                error,
              );

              progress.failed++;
              progressEmitter.emit("progress", { jobId, progress });

              return {
                success: false,
                error: {
                  filename: file.originalname,
                  error: error.message || "Processing failed",
                  code: error.code,
                },
              };
            }
          };

          const allResults = await Promise.all(
            files.map((file, index) => processFile(file, index)),
          );

          allResults.forEach((result) => {
            if (result.success) {
              results.push(result.invoice);
            } else {
              errors.push(result.error);
            }
          });

          progress.results = results;
          progress.errors = errors;
          progress.status =
            errors.length === files.length ? "failed" : "completed";
          progress.currentFile = "";
          uploadJobs.set(jobId, progress);
          progressEmitter.emit("progress", { jobId, progress });

          setTimeout(
            () => {
              uploadJobs.delete(jobId);
            },
            5 * 60 * 1000,
          );
        })();
      } catch (error: any) {
        console.error("Error in upload endpoint:", error);
        if (!res.headersSent) {
          const { status, message } = handleError(error);
          res.status(status).json({ error: message });
        }
      }
    },
  );

  // GET /api/invoices/:id/xml - Get XML content
  app.get("/api/invoices/:id/xml", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const xmlPath = path.join(XML_DIR, invoice.xmlPath);
      const xmlContent = await fs.readFile(xmlPath, "utf-8");
      res.type("text/xml").send(xmlContent);
    } catch (error) {
      console.error("Error fetching XML:", error);
      res.status(500).json({ error: "Failed to fetch XML" });
    }
  });

  // GET /api/invoices/:id/xml/download - Download XML file
  app.get("/api/invoices/:id/xml/download", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const xmlPath = path.join(XML_DIR, invoice.xmlPath);
      res.download(xmlPath, `${invoice.invoiceNumber}.xml`);
    } catch (error) {
      console.error("Error downloading XML:", error);
      res.status(500).json({ error: "Failed to download XML" });
    }
  });

  // GET /api/invoices/:id/html - Get HTML formatted invoice using XSL stylesheet
  app.get("/api/invoices/:id/html", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const xmlPath = path.join(XML_DIR, invoice.xmlPath);
      const xmlContent = await fs.readFile(xmlPath, "utf-8");

      // Transform XML to HTML using the official XSL stylesheet
      const htmlContent = await transformXMLToHTML(xmlContent);

      res.type("text/html").send(htmlContent);
    } catch (error) {
      console.error("Error generating HTML:", error);
      res.status(500).json({ error: "Failed to generate HTML from invoice" });
    }
  });

  // GET /api/invoices/:id/pdf - Return cached PDF or generate on-the-fly
  app.get("/api/invoices/:id/pdf", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Check if cached PDF exists (faster)
      if (invoice.pdfPath) {
        try {
          const pdfPath = path.join(PDF_DIR, invoice.pdfPath);
          const pdfBuffer = await fs.readFile(pdfPath);
          return res.type("application/pdf").send(pdfBuffer);
        } catch (err) {
          console.warn("Cached PDF not found, generating on-the-fly:", err);
        }
      }

      // Fallback: generate PDF on-the-fly (for backward compatibility)
      if (!invoice.htmlPath) {
        return res
          .status(404)
          .json({ error: "HTML file not found for this invoice" });
      }

      const htmlPath = path.join(HTML_DIR, invoice.htmlPath);
      const htmlContent = await fs.readFile(htmlPath, "utf-8");
      const pdfBuffer = await generatePDFFromHTML(htmlContent);
      res.type("application/pdf").send(pdfBuffer);
    } catch (error) {
      console.error("Error serving PDF:", error);
      res.status(500).json({ error: "Failed to serve PDF" });
    }
  });

  // GET /api/invoices/:id/pdf/download - Download cached PDF or generate on-the-fly
  app.get("/api/invoices/:id/pdf/download", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      let pdfBuffer: Buffer;

      // Check if cached PDF exists (faster)
      if (invoice.pdfPath) {
        try {
          const pdfPath = path.join(PDF_DIR, invoice.pdfPath);
          pdfBuffer = await fs.readFile(pdfPath);
        } catch (err) {
          console.warn("Cached PDF not found, generating on-the-fly:", err);
          // Fallback to generation
          if (!invoice.htmlPath) {
            return res
              .status(404)
              .json({ error: "HTML file not found for this invoice" });
          }
          const htmlPath = path.join(HTML_DIR, invoice.htmlPath);
          const htmlContent = await fs.readFile(htmlPath, "utf-8");
          pdfBuffer = await generatePDFFromHTML(htmlContent);
        }
      } else {
        // Generate PDF on-the-fly (for backward compatibility)
        if (!invoice.htmlPath) {
          return res
            .status(404)
            .json({ error: "HTML file not found for this invoice" });
        }
        const htmlPath = path.join(HTML_DIR, invoice.htmlPath);
        const htmlContent = await fs.readFile(htmlPath, "utf-8");
        pdfBuffer = await generatePDFFromHTML(htmlContent);
      }

      // Set headers for download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      res.status(500).json({ error: "Failed to download PDF" });
    }
  });

  // PATCH /api/invoices/:id - Update invoice
  app.patch("/api/invoices/:id", async (req, res) => {
    try {
      const validation = updateInvoiceSchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({ error: "Invalid update data", details: validation.error });
      }

      const updated = await storage.updateInvoice(
        req.params.id,
        validation.data,
      );
      if (!updated) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  // POST /api/invoices/:id/mark - Toggle invoice marked status
  app.post("/api/invoices/:id/mark", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const updated = await storage.updateInvoice(req.params.id, {
        marked: !invoice.marked,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error toggling mark:", error);
      res.status(500).json({ error: "Failed to toggle mark" });
    }
  });

  app.post("/api/invoices/batch-delete", async (req, res) => {
    try {
      const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const ids = Array.from(
        new Set(
          rawIds
            .filter(
              (value: unknown): value is string => typeof value === "string",
            )
            .map((value: string) => value.trim())
            .filter((value: string) => value.length > 0),
        ),
      );

      if (ids.length === 0) {
        return res.status(400).json({ error: "Invalid request payload" });
      }

      const failed: Array<{ id: string; status: number; message: string }> = [];
      let deletedCount = 0;

      for (const id of ids) {
        try {
          await deleteInvoiceWithFiles(id as string);
          deletedCount += 1;
        } catch (error: any) {
          failed.push({
            id: id as string,
            status: error?.status || 500,
            message: error?.message || "Failed to delete invoice",
          });
        }
      }

      if (failed.length > 0) {
        return res.status(207).json({ deleted: deletedCount, failed });
      }

      return res.json({ success: true, deleted: deletedCount });
    } catch (err: any) {
      console.error("Error in batch delete:", err);
      const status = err?.status || 500;
      const payload: any = {
        error: err?.message || "Failed to delete invoices",
      };
      if (process.env.NODE_ENV !== "production") {
        payload.details = err?.details ?? err?.stack ?? null;
      }
      return res.status(status).json(payload);
    }
  });

  // POST /api/invoices/batch-update-status - Update status for multiple invoices
  app.post("/api/invoices/batch-update-status", async (req, res) => {
    try {
      const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const status = req.body?.status;

      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      const ids = Array.from(
        new Set(
          rawIds
            .filter(
              (value: unknown): value is string => typeof value === "string",
            )
            .map((value: string) => value.trim())
            .filter((value: string) => value.length > 0),
        ),
      );

      if (ids.length === 0) {
        return res.status(400).json({ error: "No invoice IDs provided" });
      }

      const failed: Array<{ id: string; status: number; message: string }> = [];
      const updated: any[] = [];

      for (const id of ids) {
        try {
          const result = await storage.updateInvoice(id, { status });
          if (result) {
            updated.push(result);
          } else {
            failed.push({
              id,
              status: 404,
              message: "Invoice not found",
            });
          }
        } catch (error: any) {
          failed.push({
            id,
            status: error?.status || 500,
            message: error?.message || "Failed to update invoice",
          });
        }
      }

      if (failed.length > 0) {
        return res.status(207).json({ updated: updated.length, failed, invoices: updated });
      }

      return res.json({ success: true, updated: updated.length, invoices: updated });
    } catch (err: any) {
      console.error("Error in batch update status:", err);
      const status = err?.status || 500;
      const payload: any = {
        error: err?.message || "Failed to update invoice statuses",
      };
      if (process.env.NODE_ENV !== "production") {
        payload.details = err?.details ?? err?.stack ?? null;
      }
      return res.status(status).json(payload);
    }
  });

  // DELETE /api/invoices/:id - Delete invoice and associated files
  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const { id } = await deleteInvoiceWithFiles(req.params.id);
      return res.json({
        success: true,
        id,
        message: "Invoice deleted successfully",
      });
    } catch (err: any) {
      console.error("Error deleting invoice:", err);
      const status = err?.status || 500;
      const payload: any = {
        error: err?.message || "Failed to delete invoice",
      };
      if (process.env.NODE_ENV !== "production") {
        payload.details = err?.details ?? err?.stack ?? null;
      }
      return res.status(status).json(payload);
    }
  });

  // POST /api/invoices/batch-generate-pdf - Generate PDFs for multiple invoices in background
  app.post("/api/invoices/batch-generate-pdf", async (req, res) => {
    try {
      const invoiceIds = Array.isArray(req.body?.ids) ? req.body.ids : [];

      if (invoiceIds.length === 0) {
        return res.status(400).json({ error: "No invoice IDs provided" });
      }

      // Start background processing (don't wait for completion)
      const startTime = Date.now();
      let processed = 0;
      let failed = 0;

      // Process in parallel with concurrency limit
      const CONCURRENCY = 3;
      const errors: { id: string; message: string }[] = [];

      for (let i = 0; i < invoiceIds.length; i += CONCURRENCY) {
        const batch = invoiceIds.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map(async (id: string) => {
            const invoice = await storage.getInvoice(id);
            if (!invoice || !invoice.htmlPath || !invoice.pdfPath) {
              throw new Error(`Invoice ${id} not found or missing paths`);
            }

            const pdfPath = path.join(PDF_DIR, invoice.pdfPath);

            // Check if PDF already exists
            try {
              await fs.access(pdfPath);
              return { id, status: "skipped" }; // Already exists
            } catch {
              // Generate PDF
              const htmlPath = path.join(HTML_DIR, invoice.htmlPath);
              const htmlContent = await fs.readFile(htmlPath, "utf-8");
              const pdfBuffer = await generatePDFFromHTML(htmlContent);
              await fs.writeFile(pdfPath, pdfBuffer);
              return { id, status: "generated" };
            }
          }),
        );

        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            processed++;
          } else {
            failed++;
            const invoiceId = batch[index];
            errors.push({
              id: invoiceId,
              message: result.reason?.message || "Unknown error",
            });
          }
        });
      }

      const duration = Date.now() - startTime;

      res.json({
        success: true,
        processed,
        failed,
        duration: `${duration}ms`,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Error in batch PDF generation:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to generate PDFs" });
    }
  });

  // POST /api/invoices/batch-download/xml - Download multiple XMLs as ZIP
  app.post("/api/invoices/batch-download/xml", async (req, res) => {
    try {
      const { ids } = req.body as { ids: string[] };

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res
          .status(400)
          .json({ error: "No invoice IDs provided" });
      }

      const zip = new JSZip();
      let addedCount = 0;

      for (const id of ids) {
        try {
          const invoice = await storage.getInvoice(id);
          if (!invoice) {
            console.warn(`Invoice ${id} not found`);
            continue;
          }

          const xmlPath = path.join(XML_DIR, invoice.xmlPath);
          const xmlContent = await fs.readFile(xmlPath, "utf-8");
          
          // Use invoice number as filename, sanitize for file system
          const filename = `${invoice.invoiceNumber}.xml`;
          zip.file(filename, xmlContent);
          addedCount++;
        } catch (err) {
          console.warn(`Failed to add XML for invoice ${id}:`, err);
        }
      }

      if (addedCount === 0) {
        return res
          .status(400)
          .json({ error: "No XMLs could be added to the archive" });
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="fatture_xml_${Date.now()}.zip"`
      );
      res.setHeader("Content-Length", zipBuffer.length);

      res.send(zipBuffer);
    } catch (error) {
      console.error("Error creating XML ZIP archive:", error);
      res.status(500).json({ error: "Failed to create ZIP archive" });
    }
  });

  // POST /api/invoices/batch-download/pdf - Download multiple PDFs as ZIP
  app.post("/api/invoices/batch-download/pdf", async (req, res) => {
    try {
      const { ids } = req.body as { ids: string[] };

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res
          .status(400)
          .json({ error: "No invoice IDs provided" });
      }

      const zip = new JSZip();
      let addedCount = 0;

      for (const id of ids) {
        try {
          const invoice = await storage.getInvoice(id);
          if (!invoice) {
            console.warn(`Invoice ${id} not found`);
            continue;
          }

          let pdfBuffer: Buffer;

          // Try to use cached PDF first
          if (invoice.pdfPath) {
            try {
              const pdfPath = path.join(PDF_DIR, invoice.pdfPath);
              pdfBuffer = await fs.readFile(pdfPath);
            } catch (err) {
              console.warn(`Cached PDF not found for ${id}, generating...`);
              // Fallback to generation
              if (invoice.htmlPath) {
                const htmlPath = path.join(HTML_DIR, invoice.htmlPath);
                const htmlContent = await fs.readFile(htmlPath, "utf-8");
                pdfBuffer = await generatePDFFromHTML(htmlContent);
              } else {
                throw new Error("No HTML file available for PDF generation");
              }
            }
          } else if (invoice.htmlPath) {
            // Generate on-the-fly if no cached PDF
            const htmlPath = path.join(HTML_DIR, invoice.htmlPath);
            const htmlContent = await fs.readFile(htmlPath, "utf-8");
            pdfBuffer = await generatePDFFromHTML(htmlContent);
          } else {
            throw new Error("No HTML or PDF file available");
          }

          const filename = `${invoice.invoiceNumber}.pdf`;
          zip.file(filename, pdfBuffer);
          addedCount++;
        } catch (err) {
          console.warn(`Failed to add PDF for invoice ${id}:`, err);
        }
      }

      if (addedCount === 0) {
        return res
          .status(400)
          .json({ error: "No PDFs could be added to the archive" });
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="fatture_pdf_${Date.now()}.zip"`
      );
      res.setHeader("Content-Length", zipBuffer.length);

      res.send(zipBuffer);
    } catch (error) {
      console.error("Error creating PDF ZIP archive:", error);
      res.status(500).json({ error: "Failed to create ZIP archive" });
    }
  });

  // GET /api/invoices/stats - Get performance statistics
  app.get("/api/invoices/stats", async (req, res) => {
    try {
      const invoices = await storage.getAllInvoices();

      let pdfCached = 0;
      let pdfMissing = 0;

      // Check which PDFs are actually cached
      await Promise.all(
        invoices.map(async (invoice) => {
          if (invoice.pdfPath) {
            try {
              const pdfPath = path.join(PDF_DIR, invoice.pdfPath);
              await fs.access(pdfPath);
              pdfCached++;
            } catch {
              pdfMissing++;
            }
          }
        }),
      );

      const stats = {
        total: invoices.length,
        pdfCached,
        pdfMissing,
        cacheRate:
          invoices.length > 0
            ? ((pdfCached / invoices.length) * 100).toFixed(1) + "%"
            : "0%",
        byStatus: {
          not_printed: invoices.filter((i) => i.status === "not_printed")
            .length,
          printed: invoices.filter((i) => i.status === "printed").length,
        },
      };

      res.json(stats);
    } catch (error: any) {
      console.error("Error getting stats:", error);
      res.status(500).json({ error: "Failed to get statistics" });
    }
  });

  app.get("/api/database/export", async (req, res) => {
    try {
      const dbPath = getDatabasePath();
      const fileName = `app-fatture-backup-${new Date().toISOString().split("T")[0]}.db`;

      res.download(dbPath, fileName, (err) => {
        if (err) {
          console.error("Error downloading database:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Failed to download database" });
          }
        }
      });
    } catch (error: any) {
      console.error("Error exporting database:", error);
      res.status(500).json({ error: "Failed to export database" });
    }
  });

  app.post("/api/database/import", multer({ storage: multer.memoryStorage() }).single("database"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No database file provided" });
        return;
      }

      if (!req.file.originalname.endsWith(".db")) {
        res.status(400).json({ error: "Invalid file format. Only .db files are allowed" });
        return;
      }

      const dbPath = getDatabasePath();
      const backupPath = `${dbPath}.backup-${new Date().getTime()}`;

      await fs.writeFile(backupPath, req.file.buffer);

      await fs.writeFile(dbPath, req.file.buffer);

      res.json({
        success: true,
        message: "Database imported successfully. Please restart the application.",
        backupPath: backupPath,
      });
    } catch (error: any) {
      console.error("Error importing database:", error);
      res.status(500).json({ error: "Failed to import database" });
    }
  });

  app.use((error: any, req: any, res: any, next: any) => {
    const { status, message } = handleError(error);
    res.status(status).json({ error: message });
  });

  const httpServer = createServer(app);
  return httpServer;
}
