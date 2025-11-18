/**
 * XSLT Transformer for browser-side XML to HTML transformation
 * Uses native browser XSLTProcessor API
 */

export interface XSLTTransformOptions {
  parameters?: Record<string, string>;
}

/**
 * Parse XML string to Document
 */
function parseXML(xmlString: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  // Check for parsing errors
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error("XML parsing error: " + parserError.textContent);
  }

  return doc;
}

/**
 * Transform XML to HTML using XSLT stylesheet
 *
 * @param xmlContent - The XML content to transform
 * @param xslContent - The XSLT stylesheet content
 * @param options - Transformation options
 * @returns HTML string
 */
export async function transformXMLWithXSLT(
  xmlContent: string,
  xslContent: string,
  options: XSLTTransformOptions = {},
): Promise<string> {
  try {
    // Parse XML and XSL documents
    const xmlDoc = parseXML(xmlContent);
    const xslDoc = parseXML(xslContent);

    // Create XSLT processor
    const processor = new XSLTProcessor();
    processor.importStylesheet(xslDoc);

    // Set parameters if provided
    if (options.parameters) {
      Object.entries(options.parameters).forEach(([key, value]) => {
        processor.setParameter(null, key, value);
      });
    }

    // Transform XML to HTML
    const resultDoc = processor.transformToDocument(xmlDoc);

    // Serialize the result to string
    const serializer = new XMLSerializer();
    const htmlString = serializer.serializeToString(resultDoc);

    return htmlString;
  } catch (error) {
    console.error("Error transforming XML with XSLT:", error);
    throw new Error(
      "Failed to transform XML with XSLT: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Transform FatturaPA XML to HTML using custom template
 * This is a fallback method that doesn't require XSLT
 *
 * @param xmlContent - The FatturaPA XML content
 * @returns HTML string
 */
export async function transformFatturaPAToHTML(
  xmlContent: string,
): Promise<string> {
  try {
    const xmlDoc = parseXML(xmlContent);

    // Extract invoice data from XML
    const invoiceData = extractInvoiceData(xmlDoc);

    // Generate HTML from extracted data
    return generateInvoiceHTML(invoiceData);
  } catch (error) {
    console.error("Error transforming FatturaPA to HTML:", error);
    throw new Error(
      "Failed to transform FatturaPA to HTML: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Extract invoice data from FatturaPA XML
 */
function extractInvoiceData(xmlDoc: Document): any {
  const getValue = (xpath: string, parent?: Element | null): string => {
    const element = parent
      ? parent.querySelector(xpath)
      : xmlDoc.querySelector(xpath);
    return element?.textContent?.trim() || "";
  };

  // Namespace handling for FatturaPA
  const ns = "http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2";

  // Get root elements
  const cedentePrestatore = xmlDoc.querySelector(
    "FatturaElettronicaHeader CedentePrestatore",
  );
  const cessionarioCommittente = xmlDoc.querySelector(
    "FatturaElettronicaHeader CessionarioCommittente",
  );
  const datiGeneraliDocumento = xmlDoc.querySelector(
    "FatturaElettronicaBody DatiGenerali DatiGeneraliDocumento",
  );
  const datiPagamento = xmlDoc.querySelector(
    "FatturaElettronicaBody DatiPagamento",
  );

  // Extract supplier data
  const supplierIdFiscaleIVA = cedentePrestatore?.querySelector(
    "DatiAnagrafici IdFiscaleIVA",
  );
  const supplierVat =
    getValue("IdPaese", supplierIdFiscaleIVA) +
    getValue("IdCodice", supplierIdFiscaleIVA);
  const supplierFiscalCode = getValue(
    "DatiAnagrafici CodiceFiscale",
    cedentePrestatore,
  );
  const supplierAnagrafica = cedentePrestatore?.querySelector(
    "DatiAnagrafici Anagrafica",
  );
  const supplierName =
    getValue("Denominazione", supplierAnagrafica) ||
    `${getValue("Nome", supplierAnagrafica)} ${getValue("Cognome", supplierAnagrafica)}`;
  const supplierSede = cedentePrestatore?.querySelector("Sede");

  // Extract customer data
  const customerIdFiscaleIVA = cessionarioCommittente?.querySelector(
    "DatiAnagrafici IdFiscaleIVA",
  );
  const customerVat = customerIdFiscaleIVA
    ? getValue("IdPaese", customerIdFiscaleIVA) +
      getValue("IdCodice", customerIdFiscaleIVA)
    : "";
  const customerAnagrafica = cessionarioCommittente?.querySelector(
    "DatiAnagrafici Anagrafica",
  );
  const customerName =
    getValue("Denominazione", customerAnagrafica) ||
    `${getValue("Nome", customerAnagrafica)} ${getValue("Cognome", customerAnagrafica)}`;
  const customerSede = cessionarioCommittente?.querySelector("Sede");

  // Extract document data
  const documentType = getValue("TipoDocumento", datiGeneraliDocumento);
  const invoiceNumber = getValue("Numero", datiGeneraliDocumento);
  const invoiceDate = getValue("Data", datiGeneraliDocumento);
  const currency = getValue("Divisa", datiGeneraliDocumento) || "EUR";

  // Extract payment data
  const paymentMethod = getValue(
    "DettaglioPagamento ModalitaPagamento",
    datiPagamento,
  );
  const paymentDueDate = getValue(
    "DettaglioPagamento DataScadenzaPagamento",
    datiPagamento,
  );
  const paymentAmount = getValue(
    "DettaglioPagamento ImportoPagamento",
    datiPagamento,
  );

  // Extract line items
  const lineItems: any[] = [];
  const dettaglioLinee = xmlDoc.querySelectorAll(
    "FatturaElettronicaBody DatiBeniServizi DettaglioLinee",
  );
  dettaglioLinee.forEach((linea, index) => {
    lineItems.push({
      number: index + 1,
      code: getValue("CodiceArticolo CodiceValore", linea),
      description: getValue("Descrizione", linea),
      quantity: parseFloat(getValue("Quantita", linea)) || 0,
      unitPrice: parseFloat(getValue("PrezzoUnitario", linea)) || 0,
      discount:
        parseFloat(getValue("ScontoMaggiorazione Percentuale", linea)) || 0,
      vat: parseFloat(getValue("AliquotaIVA", linea)) || 0,
      total: parseFloat(getValue("PrezzoTotale", linea)) || 0,
    });
  });

  // Extract totals
  const datiRiepilogo = xmlDoc.querySelector("DatiRiepilogo");
  const taxableAmount =
    parseFloat(getValue("ImponibileImporto", datiRiepilogo)) || 0;
  const taxAmount = parseFloat(getValue("Imposta", datiRiepilogo)) || 0;
  const totalAmount =
    parseFloat(getValue("ImportoPagamento", datiPagamento)) ||
    taxableAmount + taxAmount;

  return {
    documentType,
    invoiceNumber,
    invoiceDate,
    currency,
    supplierName,
    supplierVat,
    supplierFiscalCode,
    supplierAddress: supplierSede
      ? {
          Indirizzo: getValue("Indirizzo", supplierSede),
          NumeroCivico: getValue("NumeroCivico", supplierSede),
          CAP: getValue("CAP", supplierSede),
          Comune: getValue("Comune", supplierSede),
          Provincia: getValue("Provincia", supplierSede),
          Nazione: getValue("Nazione", supplierSede),
        }
      : null,
    customerName,
    customerVat,
    customerAddress: customerSede
      ? {
          Indirizzo: getValue("Indirizzo", customerSede),
          NumeroCivico: getValue("NumeroCivico", customerSede),
          CAP: getValue("CAP", customerSede),
          Comune: getValue("Comune", customerSede),
          Provincia: getValue("Provincia", customerSede),
          Nazione: getValue("Nazione", customerSede),
        }
      : null,
    paymentMethod,
    paymentDueDate,
    lineItems,
    taxableAmount,
    taxAmount,
    totalAmount,
  };
}

/**
 * Generate HTML from invoice data
 */
function generateInvoiceHTML(invoice: any): string {
  const formatCurrency = (value: number): string => {
    return value.toFixed(2).replace(".", ",");
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("it-IT");
  };

  const getDocumentTypeLabel = (type: string): string => {
    const types: Record<string, string> = {
      TD01: "Fattura",
      TD02: "Acconto/Anticipo su fattura",
      TD03: "Acconto/Anticipo su parcella",
      TD04: "Nota di Credito",
      TD05: "Nota di Debito",
      TD06: "Parcella",
    };
    return types[type] || type || "Documento";
  };

  const getPaymentMethodLabel = (method: string): string => {
    const methods: Record<string, string> = {
      MP01: "Contanti",
      MP02: "Assegno",
      MP03: "Assegno circolare",
      MP04: "Contanti presso Tesoreria",
      MP05: "Bonifico",
      MP06: "Vaglia cambiario",
      MP07: "Bollettino bancario",
      MP08: "Carta di pagamento",
      MP09: "RID",
      MP10: "RID utenze",
      MP11: "RID veloce",
      MP12: "RIBA",
      MP13: "MAV",
      MP14: "Quietanza erario",
      MP15: "Giroconto su conti di contabilità speciale",
      MP16: "Domiciliazione bancaria",
      MP17: "Domiciliazione postale",
      MP18: "Bollettino di c/c postale",
      MP19: "SEPA Direct Debit",
      MP20: "SEPA Direct Debit CORE",
      MP21: "SEPA Direct Debit B2B",
      MP22: "Trattenuta su somme già riscosse",
    };
    return methods[method] || method || "Non specificato";
  };

  return `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fattura Elettronica - ${invoice.invoiceNumber}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            color: #000000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        #fattura-elettronica {
            max-width: 1280px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .tbHeader {
            width: 100%;
            border: 2px solid #000;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .tdHead {
            width: 50%;
            border: 1px solid #000;
            padding: 15px;
            vertical-align: top;
        }
        .headerLabel {
            color: #000;
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 10px;
            display: block;
            text-transform: uppercase;
        }
        .headContent {
            margin-bottom: 5px;
            font-size: 12px;
            line-height: 1.5;
            color: #000000;
        }
        .headContent strong {
            font-weight: 700;
            color: #000000;
        }
        .tbFoglio {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        .tbFoglio th {
            padding: 10px 8px;
            border: 1px solid #000;
            background-color: #d3d3d3;
            font-size: 11px;
            text-align: left;
            font-weight: 700;
            color: #000000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .tbFoglio td {
            padding: 8px;
            border: 1px solid #000;
            font-size: 12px;
            color: #000000;
        }
        .import {
            text-align: right;
        }
        .textCenter {
            text-align: center;
        }
        .separa {
            height: 20px;
        }
        .highlight {
            background-color: #fffacd;
            font-weight: bold;
        }
        @media print {
            body {
                background: white;
                padding: 0;
                color: #000000 !important;
            }
            #fattura-elettronica {
                box-shadow: none;
            }
            .tbFoglio th,
            .tbFoglio td,
            .headContent,
            .headerLabel {
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .tbFoglio th {
                background-color: #d3d3d3 !important;
                font-weight: 700 !important;
            }
            strong {
                font-weight: 700 !important;
                color: #000000 !important;
            }
        }
    </style>
</head>
<body>
    <div id="fattura-elettronica">
        <!-- Header -->
        <table class="tbHeader">
            <tr>
                <td class="tdHead">
                    <label class="headerLabel">Cedente/Prestatore (Fornitore)</label>
                    <div class="headContent">
                        <strong>P.IVA:</strong> ${invoice.supplierVat || "N/A"}
                    </div>
                    ${invoice.supplierFiscalCode ? `<div class="headContent"><strong>Codice Fiscale:</strong> ${invoice.supplierFiscalCode}</div>` : ""}
                    <div class="headContent">
                        <strong>Denominazione:</strong> ${invoice.supplierName}
                    </div>
                    ${
                      invoice.supplierAddress
                        ? `<div class="headContent">
                        <strong>Indirizzo:</strong> ${invoice.supplierAddress.Indirizzo || ""} ${invoice.supplierAddress.NumeroCivico || ""}, ${invoice.supplierAddress.CAP || ""} ${invoice.supplierAddress.Comune || ""} ${invoice.supplierAddress.Provincia ? "(" + invoice.supplierAddress.Provincia + ")" : ""} ${invoice.supplierAddress.Nazione || ""}
                    </div>`
                        : ""
                    }
                </td>
                <td class="tdHead">
                    <label class="headerLabel">Cessionario/Committente (Cliente)</label>
                    <div class="headContent">
                        <strong>P.IVA:</strong> ${invoice.customerVat || "N/A"}
                    </div>
                    <div class="headContent">
                        <strong>Denominazione:</strong> ${invoice.customerName || "N/A"}
                    </div>
                    ${
                      invoice.customerAddress
                        ? `<div class="headContent">
                        <strong>Indirizzo:</strong> ${invoice.customerAddress.Indirizzo || ""} ${invoice.customerAddress.NumeroCivico || ""}, ${invoice.customerAddress.CAP || ""} ${invoice.customerAddress.Comune || ""} ${invoice.customerAddress.Provincia ? "(" + invoice.customerAddress.Provincia + ")" : ""} ${invoice.customerAddress.Nazione || ""}
                    </div>`
                        : ""
                    }
                </td>
            </tr>
        </table>

        <div class="separa"></div>

        <!-- Document Info -->
        <table class="tbFoglio">
            <thead>
                <tr>
                    <th>Tipologia Documento</th>
                    <th>Numero</th>
                    <th>Data</th>
                    <th>Valuta</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${getDocumentTypeLabel(invoice.documentType)}</td>
                    <td class="textCenter">${invoice.invoiceNumber}</td>
                    <td class="textCenter">${formatDate(invoice.invoiceDate)}</td>
                    <td class="textCenter">${invoice.currency}</td>
                </tr>
            </tbody>
        </table>

        <div class="separa"></div>

        <!-- Line Items -->
        ${
          invoice.lineItems && invoice.lineItems.length > 0
            ? `
        <table class="tbFoglio">
            <thead>
                <tr>
                    <th style="width: 40px">#</th>
                    <th style="width: 80px">Codice</th>
                    <th>Descrizione</th>
                    <th style="width: 70px" class="import">Quantità</th>
                    <th style="width: 90px" class="import">Prezzo Unit.</th>
                    <th style="width: 60px" class="import">% IVA</th>
                    <th style="width: 100px" class="import">Sconto</th>
                    <th style="width: 100px" class="import">Totale</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.lineItems
                  .map(
                    (item: any) => {
                      // Hide values if total is 0.00
                      const shouldHideValues = item.total === 0;
                      return `
                <tr>
                    <td class="textCenter">${item.number}</td>
                    <td class="textCenter">${item.code || "-"}</td>
                    <td>${item.description || ""}</td>
                    <td class="import">${formatCurrency(item.quantity)}</td>
                    <td class="import">${invoice.currency} ${formatCurrency(item.unitPrice)}</td>
                    <td class="import">${shouldHideValues ? "" : formatCurrency(item.vat) + "%"}</td>
                    <td class="import">${shouldHideValues ? "" : (item.discount ? formatCurrency(item.discount) + "%" : "-")}</td>
                    <td class="import">${shouldHideValues ? "" : invoice.currency + " " + formatCurrency(item.total)}</td>
                </tr>
                `;
                    }
                  )
                  .join("")}
            </tbody>
        </table>
        <div class="separa"></div>
        `
            : ""
        }

        <!-- Totals -->
        <table class="tbFoglio">
            <thead>
                <tr>
                    <th colspan="2">RIEPILOGO IVA E TOTALI</th>
                </tr>
            </thead>
        </table>
        <table class="tbFoglio">
            <tbody>
                <tr>
                    <td style="width: 60%">Imponibile</td>
                    <td class="import">${invoice.currency} ${formatCurrency(invoice.taxableAmount)}</td>
                </tr>
                <tr>
                    <td>IVA</td>
                    <td class="import">${invoice.currency} ${formatCurrency(invoice.taxAmount)}</td>
                </tr>
                <tr class="highlight">
                    <td>TOTALE DOCUMENTO</td>
                    <td class="import">${invoice.currency} ${formatCurrency(invoice.totalAmount)}</td>
                </tr>
            </tbody>
        </table>

        ${
          invoice.paymentMethod
            ? `
        <div class="separa"></div>
        <table class="tbFoglio">
            <thead>
                <tr>
                    <th>Modalità Pagamento</th>
                    <th>Data Scadenza</th>
                    <th style="width: 150px" class="import">Importo</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${getPaymentMethodLabel(invoice.paymentMethod)}</td>
                    <td class="textCenter">${formatDate(invoice.paymentDueDate)}</td>
                    <td class="import">${invoice.currency} ${formatCurrency(invoice.totalAmount)}</td>
                </tr>
            </tbody>
        </table>
        `
            : ""
        }
    </div>
</body>
</html>`;
}

/**
 * Transform XML to HTML - Main function
 * Tries to use browser's native transformation, falls back to custom template
 *
 * @param xmlContent - The XML content to transform
 * @returns HTML string
 */
export async function transformXMLToHTML(xmlContent: string): Promise<string> {
  try {
    // Use fallback method for FatturaPA
    return await transformFatturaPAToHTML(xmlContent);
  } catch (error) {
    console.error("Error transforming XML to HTML:", error);
    throw error;
  }
}
