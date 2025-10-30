import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Invoice table for storing FatturaPA electronic invoices metadata
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // File information
  filename: text("filename").notNull(),
  originalFormat: text("original_format").notNull(), // 'xml' or 'p7m'
  
  // Invoice data from XML
  invoiceNumber: text("invoice_number").notNull(),
  invoiceDate: text("invoice_date").notNull(), // ISO date string
  
  // Supplier (Cedente/Prestatore)
  supplierName: text("supplier_name").notNull(),
  supplierVat: text("supplier_vat"),
  supplierFiscalCode: text("supplier_fiscal_code"),
  
  // Customer (Cessionario/Committente)
  customerName: text("customer_name"),
  customerVat: text("customer_vat"),
  
  // Financial data
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  taxableAmount: decimal("taxable_amount", { precision: 10, scale: 2 }),
  currency: text("currency").default("EUR"),
  
  // Payment information
  paymentMethod: text("payment_method"),
  paymentDueDate: text("payment_due_date"),
  
  // Status and management
  status: text("status").notNull().default("received"), // 'received', 'paid', 'overdue'
  notes: text("notes"),
  tags: text("tags").array(),
  
  // File paths (stored in local filesystem)
  xmlPath: text("xml_path").notNull(),
  pdfPath: text("pdf_path").notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateInvoiceSchema = createInsertSchema(invoices).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type UpdateInvoice = z.infer<typeof updateInvoiceSchema>;

// Type for invoice filters
export const invoiceFiltersSchema = z.object({
  status: z.enum(["all", "received", "paid", "overdue"]).optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
});

export type InvoiceFilters = z.infer<typeof invoiceFiltersSchema>;
