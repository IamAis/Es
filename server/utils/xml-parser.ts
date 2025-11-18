import { parseStringPromise } from "xml2js";

/**
 * Parse FatturaPA XML and extract invoice data
 * FatturaPA is the Italian electronic invoice standard format
 * Supports all FatturaPA versions and namespaces:
 * - v1.2: http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2
 * - v1.1: http://www.fatturapa.gov.it/sdi/fatturapa/v1.1
 * - v1.0: http://www.fatturapa.gov.it/sdi/fatturapa/v1.0
 * - v1.0 Simplified: http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.0
 */
export async function parseFatturaPAXML(xmlContent: string) {
  try {
    const result = await parseStringPromise(xmlContent, {
      explicitArray: false,
      mergeAttrs: true,
      trim: true,
      tagNameProcessors: [
        // Remove namespace prefixes to handle all versions uniformly
        (name) => name.replace(/^.*:/, ""),
      ],
    });

    // Try to find the invoice in all possible namespace variations
    const fattura =
      result.FatturaElettronica ||
      result.FatturaElettronicaSemplificata ||
      result["p:FatturaElettronica"] ||
      result["a:FatturaElettronica"] ||
      result["b:FatturaElettronica"] ||
      result["c:FatturaElettronica"] ||
      result["d:FatturaElettronicaSemplificata"];

    if (!fattura) {
      throw new Error(
        "Invalid FatturaPA XML format - unable to find root element",
      );
    }

    const header = fattura.FatturaElettronicaHeader;
    const body = Array.isArray(fattura.FatturaElettronicaBody)
      ? fattura.FatturaElettronicaBody[0]
      : fattura.FatturaElettronicaBody;

    // Extract supplier (Cedente/Prestatore)
    const supplier = header.CedentePrestatore;
    const supplierData = supplier.DatiAnagrafici;
    const supplierName =
      supplierData.Anagrafica.Denominazione ||
      `${supplierData.Anagrafica.Nome || ""} ${supplierData.Anagrafica.Cognome || ""}`.trim();

    // Extract customer (Cessionario/Committente)
    const customer = header.CessionarioCommittente;
    const customerData = customer.DatiAnagrafici;
    const customerName =
      customerData.Anagrafica.Denominazione ||
      `${customerData.Anagrafica.Nome || ""} ${customerData.Anagrafica.Cognome || ""}`.trim();

    // Extract document data
    const docData = body.DatiGenerali.DatiGeneraliDocumento;

    // Extract payment data
    const paymentDataRaw = body.DatiPagamento?.DettaglioPagamento || {};
    const paymentDetails = Array.isArray(paymentDataRaw)
      ? paymentDataRaw
      : [paymentDataRaw];

    // Extract line items summary
    const riepilogo = Array.isArray(body.DatiBeniServizi?.DatiRiepilogo)
      ? body.DatiBeniServizi.DatiRiepilogo[0]
      : body.DatiBeniServizi?.DatiRiepilogo;

    // Extract line items for PDF
    let lineItems = [];
    if (body.DatiBeniServizi?.DettaglioLinee) {
      const lines = Array.isArray(body.DatiBeniServizi.DettaglioLinee)
        ? body.DatiBeniServizi.DettaglioLinee
        : [body.DatiBeniServizi.DettaglioLinee];

      lineItems = lines.map((line: any) => ({
        number: line.NumeroLinea,
        code: line.CodiceArticolo?.CodiceValore || null,
        description: line.Descrizione,
        quantity: parseFloat(line.Quantita || "1"),
        unitPrice: parseFloat(line.PrezzoUnitario || "0"),
        total: parseFloat(line.PrezzoTotale || "0"),
        vat: parseFloat(line.AliquotaIVA || "0"),
        discount: line.ScontoMaggiorazione?.Percentuale
          ? parseFloat(line.ScontoMaggiorazione.Percentuale)
          : 0,
        hasQuantity: line.Quantita ? true : false,
        hasTotalPrice: parseFloat(line.PrezzoTotale || "0") !== 0,
      }));
    }

    return {
      invoiceNumber: docData.Numero,
      invoiceDate: docData.Data,

      // Supplier info
      supplierName,
      supplierVat: supplierData.IdFiscaleIVA?.IdCodice || null,
      supplierFiscalCode: supplierData.CodiceFiscale || null,
      supplierAddress: supplier.Sede,
      supplierContacts: supplier.Contatti,

      // Customer info
      customerName,
      customerVat: customerData.IdFiscaleIVA?.IdCodice || null,
      customerAddress: customer.Sede,

      // Financial data
      totalAmount: parseFloat(docData.ImportoTotaleDocumento || "0"),
      taxableAmount: parseFloat(riepilogo?.ImponibileImporto || "0"),
      taxAmount: parseFloat(riepilogo?.Imposta || "0"),
      currency: docData.Divisa || "EUR",

      // Payment info
      paymentMethod: paymentDetails[0]?.ModalitaPagamento || null,
      paymentDueDate: paymentDetails[0]?.DataScadenzaPagamento || null,
      paymentDetails: paymentDetails.map((p: any) => ({
        method: p.ModalitaPagamento,
        amount: parseFloat(p.ImportoPagamento || "0"),
        dueDate: p.DataScadenzaPagamento || null,
      })),

      // Line items for PDF generation
      lineItems,

      // Raw data for reference
      documentType: docData.TipoDocumento,
    };
  } catch (error) {
    console.error("Error parsing FatturaPA XML:", error);
    throw new Error(
      "Failed to parse FatturaPA XML. The file may be invalid or corrupted.",
    );
  }
}
