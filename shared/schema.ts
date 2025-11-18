import { z } from "zod";

const statusEnum = z.enum(["not_printed", "printed"]);
const currencyString = z.string().min(1, "Currency is required");

const amountString = z
    .union([z.string(), z.number()])
    .transform((value) => value.toString());

// Canonical invoice representation used across server and client
export const invoiceSchema = z.object({
    id: z.string().uuid(),

    // File information
    filename: z.string(),
    originalFormat: z.enum(["xml", "p7m"]),

    // Invoice data from XML
    invoiceNumber: z.string(),
    invoiceDate: z.string(), // ISO date string

    // Supplier (Cedente/Prestatore)
    supplierName: z.string(),
    supplierVat: z.string().nullable(),
    supplierFiscalCode: z.string().nullable(),

    // Customer (Cessionario/Committente)
    customerName: z.string().nullable(),
    customerVat: z.string().nullable(),

    // Financial data
    totalAmount: amountString,
    taxAmount: amountString.nullable(),
    taxableAmount: amountString.nullable(),
    currency: currencyString,

    // Payment information
    paymentMethod: z.string().nullable(),
    paymentDueDate: z.string().nullable(),

    // Status and management
    status: statusEnum.default("not_printed"),
    marked: z.boolean().default(false),
    notes: z.string().nullable(),
    tags: z.array(z.string()).nullable(),

    // File paths (stored in local filesystem)
    xmlPath: z.string(),
    pdfPath: z.string().optional(),
    htmlPath: z.string(),

    // Timestamps
    createdAt: z.string(),
    updatedAt: z.string(),
});

// Shape required for creating a new invoice
export const insertInvoiceSchema = invoiceSchema
    .omit({
        id: true,
        createdAt: true,
        updatedAt: true,
    })
    .extend({
        status: statusEnum.default("not_printed"),
        marked: z.boolean().default(false),
        currency: currencyString.default("EUR"),
        totalAmount: amountString,
        taxAmount: amountString.nullable(),
        taxableAmount: amountString.nullable(),
        pdfPath: z.string().optional(),
        htmlPath: z.string(),
    });

// Shape allowed when updating an invoice
export const updateInvoiceSchema = invoiceSchema
    .omit({
        id: true,
        createdAt: true,
        updatedAt: true,
    })
    .partial();

export type Invoice = z.infer<typeof invoiceSchema>;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type UpdateInvoice = z.infer<typeof updateInvoiceSchema>;

// Type for invoice filters
export const invoiceFiltersSchema = z.object({
    status: z.enum(["all", "not_printed", "printed"]).optional(),
    search: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    minAmount: z.number().optional(),
    maxAmount: z.number().optional(),
});

export type InvoiceFilters = z.infer<typeof invoiceFiltersSchema>;
