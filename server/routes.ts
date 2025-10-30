import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { storage } from "./storage";
import { extractXMLFromP7M } from "./utils/p7m-extractor";
import { parseFatturaPAXML } from "./utils/xml-parser";
import { generateInvoicePDF } from "./utils/pdf-generator";
import { insertInvoiceSchema, updateInvoiceSchema } from "@shared/schema";

// Storage directories
const STORAGE_DIR = path.join(process.cwd(), "invoice_storage");
const XML_DIR = path.join(STORAGE_DIR, "xml");
const PDF_DIR = path.join(STORAGE_DIR, "pdf");

// Ensure storage directories exist
async function ensureStorageDirectories() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    await fs.mkdir(XML_DIR, { recursive: true });
    await fs.mkdir(PDF_DIR, { recursive: true });
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure storage directories exist on startup
  await ensureStorageDirectories();

  // GET /api/invoices - List all invoices
  app.get("/api/invoices", async (req, res) => {
    try {
      const invoices = await storage.getAllInvoices();
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  // POST /api/invoices/upload - Upload and process invoice files
  app.post("/api/invoices/upload", upload.array("files", 10), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const results = [];
      const errors = [];

      for (const file of req.files) {
        try {
          let xmlContent: string;
          let originalFormat: "xml" | "p7m";

          // Determine if it's a P7M or XML file
          if (file.originalname.toLowerCase().endsWith(".p7m")) {
            originalFormat = "p7m";
            xmlContent = await extractXMLFromP7M(file.buffer);
          } else {
            originalFormat = "xml";
            xmlContent = file.buffer.toString("utf-8");
          }

          // Parse the XML to extract invoice data
          const invoiceData = await parseFatturaPAXML(xmlContent);

          // Generate unique filename based on invoice number and timestamp
          const timestamp = Date.now();
          const safeFilename = invoiceData.invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_");
          const xmlFilename = `${safeFilename}_${timestamp}.xml`;
          const pdfFilename = `${safeFilename}_${timestamp}.pdf`;

          // Save XML file
          const xmlPath = path.join(XML_DIR, xmlFilename);
          await fs.writeFile(xmlPath, xmlContent, "utf-8");

          // Generate and save PDF
          const pdfBuffer = await generateInvoicePDF(invoiceData);
          const pdfPath = path.join(PDF_DIR, pdfFilename);
          await fs.writeFile(pdfPath, pdfBuffer);

          // Create invoice record in database
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
            status: "received",
            notes: null,
            tags: null,
            xmlPath: xmlFilename,
            pdfPath: pdfFilename,
          });

          results.push(invoice);
        } catch (error: any) {
          console.error(`Error processing file ${file.originalname}:`, error);
          errors.push({
            filename: file.originalname,
            error: error.message || "Processing failed",
          });
        }
      }

      if (results.length === 0 && errors.length > 0) {
        return res.status(400).json({ error: "All files failed to process", errors });
      }

      res.json({
        success: true,
        processed: results.length,
        failed: errors.length,
        invoices: results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Error uploading invoices:", error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  });

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

  // GET /api/invoices/:id/pdf - Get PDF content
  app.get("/api/invoices/:id/pdf", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const pdfPath = path.join(PDF_DIR, invoice.pdfPath);
      const pdfBuffer = await fs.readFile(pdfPath);
      res.type("application/pdf").send(pdfBuffer);
    } catch (error) {
      console.error("Error fetching PDF:", error);
      res.status(500).json({ error: "Failed to fetch PDF" });
    }
  });

  // GET /api/invoices/:id/pdf/download - Download PDF file
  app.get("/api/invoices/:id/pdf/download", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const pdfPath = path.join(PDF_DIR, invoice.pdfPath);
      res.download(pdfPath, `${invoice.invoiceNumber}.pdf`);
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
        return res.status(400).json({ error: "Invalid update data", details: validation.error });
      }

      const updated = await storage.updateInvoice(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  // DELETE /api/invoices/:id - Delete invoice and associated files
  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Delete physical files
      const xmlPath = path.join(XML_DIR, invoice.xmlPath);
      const pdfPath = path.join(PDF_DIR, invoice.pdfPath);

      try {
        await fs.unlink(xmlPath);
      } catch (error) {
        console.error("Error deleting XML file:", error);
      }

      try {
        await fs.unlink(pdfPath);
      } catch (error) {
        console.error("Error deleting PDF file:", error);
      }

      // Delete database record
      await storage.deleteInvoice(req.params.id);

      res.json({ success: true, message: "Invoice deleted successfully" });
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
