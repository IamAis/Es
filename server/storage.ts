import path from "path";
import fs from "fs/promises";
import {
  type Invoice,
  type InsertInvoice,
  type UpdateInvoice,
} from "@shared/schema";
import { getStorageDir, getMetadataFile } from "./paths.js";

export interface IStorage {
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getAllInvoices(): Promise<Invoice[]>;
  updateInvoice(id: string, data: UpdateInvoice): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;
}

const STORAGE_DIR = getStorageDir();
const METADATA_FILE = getMetadataFile();

// In-memory cache for better performance with large datasets
let invoiceCache: Invoice[] | null = null;
let cacheInitialized = false;

async function readAll(): Promise<Invoice[]> {
  // Return from cache if available
  if (cacheInitialized && invoiceCache !== null) {
    return [...invoiceCache]; // Return a copy to prevent external modifications
  }

  // Load from disk and populate cache
  try {
    const buf = await fs.readFile(METADATA_FILE, "utf-8");
    const data = JSON.parse(buf) as Invoice[];
    invoiceCache = Array.isArray(data) ? data : [];
    cacheInitialized = true;
    return [...invoiceCache];
  } catch {
    invoiceCache = [];
    cacheInitialized = true;
    return [];
  }
}

async function writeAll(invoices: Invoice[]): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  await fs.writeFile(METADATA_FILE, JSON.stringify(invoices, null, 2), "utf-8");
  // Update cache after successful write
  invoiceCache = [...invoices];
  cacheInitialized = true;
}

// Clear cache (useful for testing or when external changes occur)
function clearCache(): void {
  invoiceCache = null;
  cacheInitialized = false;
}

class FileStorage implements IStorage {
  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const all = await readAll();
    const now = new Date();
    const invoice: Invoice = {
      id: crypto.randomUUID(),
      ...insertInvoice,
      createdAt: now as unknown as any,
      updatedAt: now as unknown as any,
    } as Invoice;
    all.push(invoice);
    await writeAll(all);
    return invoice;
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    // Optimized: use cache directly for single lookups
    const all = await readAll();
    return all.find((i) => i.id === id);
  }

  async getAllInvoices(): Promise<Invoice[]> {
    const all = await readAll();
    // Sort in-memory (fast with cache)
    return all.sort(
      (a: any, b: any) =>
        new Date(b.createdAt as any).getTime() -
        new Date(a.createdAt as any).getTime(),
    );
  }

  async updateInvoice(
    id: string,
    data: UpdateInvoice,
  ): Promise<Invoice | undefined> {
    const all = await readAll();
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) return undefined;
    const updated: Invoice = {
      ...all[idx],
      ...data,
      updatedAt: new Date() as unknown as any,
    } as Invoice;
    all[idx] = updated;
    await writeAll(all);
    return updated;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const all = await readAll();
    const next = all.filter((i) => i.id !== id);
    const changed = next.length !== all.length;
    if (changed) await writeAll(next);
    return changed;
  }

  // Manual cache control
  clearCache(): void {
    clearCache();
  }
}

export const storage = new FileStorage();
