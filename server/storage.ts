// Storage interface and implementation for invoice management
// Reference: javascript_database blueprint for database operations
import { invoices, type Invoice, type InsertInvoice, type UpdateInvoice } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Invoice operations
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getAllInvoices(): Promise<Invoice[]>;
  updateInvoice(id: string, data: UpdateInvoice): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db
      .insert(invoices)
      .values(insertInvoice)
      .returning();
    return invoice;
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return await db
      .select()
      .from(invoices)
      .orderBy(desc(invoices.createdAt));
  }

  async updateInvoice(id: string, data: UpdateInvoice): Promise<Invoice | undefined> {
    const [updated] = await db
      .update(invoices)
      .set({
        ...data,
        updatedAt: sql`now()`,
      })
      .where(eq(invoices.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const result = await db
      .delete(invoices)
      .where(eq(invoices.id, id))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
