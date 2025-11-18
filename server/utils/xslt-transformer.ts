import { parseFatturaPAXML } from "./xml-parser.js";

/**
 * Generate HTML from parsed invoice data using a custom template
 * This is a fallback when XSLT transformation is not available
 */
async function generateHTMLFallback(xmlContent: string): Promise<string> {
  const invoice = await parseFatturaPAXML(xmlContent);

  // ─────────────────────────────────────────────────────────────
  // Helper (formattazione + decodifiche prese da FoglioStileAssoSoftware.xsl)
  // ─────────────────────────────────────────────────────────────

  const formatDateIta = (date?: string) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    return `${String(d.getDate()).padStart(2, "0")}-${String(
      d.getMonth() + 1
    ).padStart(2, "0")}-${d.getFullYear()}`;
  };

  const formatNumber = (val?: string | number) => {
    const n = parseFloat(String(val ?? "0"));
    return isNaN(n)
      ? "0,00"
      : n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const safe = (v?: string | null) => v ?? "";

  // TDxx => descrizioni (mappa basata sul FoglioStileAssoSoftware.xsl)
  const decodeDocumentType = (code?: string) => {
    const map: Record<string, string> = {
      TD01: "Fattura",
      TD02: "Acconto/Anticipo su fattura",
      TD03: "Acconto/Anticipo su parcella",
      TD04: "Nota di credito",
      TD05: "Nota di debito",
      TD06: "Parcella",
      TD07: "Fattura semplificata",
      TD08: "Nota di credito semplificata",
      TD09: "Nota di debito semplificata",
      TD10: "Fattura per autoconsumo o per cessioni gratuite",
      TD11: "Fattura reverse charge interno",
      TD12: "Documento riepilogativo",
      TD13: "Integrazione/autofattura",
      TD14: "Autofattura per acquisto extra UE di servizi",
      TD15: "Integrazione per acquisto intracomunitario di beni",
      TD16: "Integrazione fattura reverse charge interno",
      TD17: "Integrazione/autofattura per acquisto servizi dall'estero",
      TD18: "Integrazione per acquisto di beni intracomunitari",
      TD19: "Integrazione/autofattura per acquisto di beni ex art.17 c.2",
      TD20: "Autofattura per regolarizzazione e integrazione",
      TD21: "Autofattura per splafonamento",
      TD22: "Estrazione beni da Deposito IVA",
      TD23: "Estrazione beni da Deposito IVA con versamento dell'IVA",
      TD24: "Fattura differita",
      TD25: "Fattura differita per triangolazione",
      TD26: "Cessione beni ammortizzabili e per passaggi interni",
      TD27: "Fattura per autoconsumo o per cessioni gratuite",
      TD28: "Nota di debito da autoconsumo",
      TD29: "Nota di credito da autoconsumo",
    };
    return code ? `${code} - ${map[code] ?? "Documento"}` : "Documento";
  };

  // MPxx => descrizioni (mappa aggiornata secondo il FoglioStileAssoSoftware.xsl)
  const decodePaymentMethod = (code?: string) => {
    const map: Record<string, string> = {
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
      MP12: "RIBA",                            // <--- corretto dal foglio XSL
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
      MP23: "PagoPA",
    };
    return code ? `${code} - ${map[code] ?? "Non specificato"}` : "Non specificato";
  };

  // Esigibilità IVA
  const decodeEsigibilitaIVA = (code?: string) => {
    const map: Record<string, string> = {
      I: "IVA a esigibilità immediata",
      D: "IVA a esigibilità differita",
      S: "Scissione dei pagamenti (split payment)",
    };
    return code ? `${code} - ${map[code] ?? "-"}` : "-";
  };

  // ─────────────────────────────────────────────────────────────
  // HTML (layout e CSS originali mantenuti; larghezza pagina rispettata)
  // ─────────────────────────────────────────────────────────────

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fattura Elettronica - ${safe(invoice.invoiceNumber)}</title>
  <style>
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    
    @page { 
      size: A4; 
      margin: 5mm; 
      orphans: 3;
      widows: 3;
    }
    
    @media print {
      html, body { 
        height: 100%; 
        width: 210mm; 
        margin: 0 auto; 
        padding: 0;
      }
      body { 
        page-break-after: always;
        page-break-before: avoid;
      }
    }
    
    html, body { 
      height: 100%; 
      width: 210mm; 
      margin: 0 auto; 
    }
    
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      margin: 0; 
      background: #fff; 
      color: #000;
    }
    
    #fattura-elettronica { 
      width: 200mm; 
      margin: 0 auto; 
      padding: 5mm; 
      box-sizing: border-box; 
    }
    
    .tbHeader, .tbFoglio { 
      width: 100%; 
      border-collapse: collapse; 
      margin-bottom: 3px; 
      table-layout: fixed;
      page-break-inside: auto;
    }
    
    tbody { 
      display: table-row-group;
      page-break-inside: auto;
    }
    
    tr { 
      page-break-inside: auto;
      page-break-after: auto;
    }
    
    .tbHeader td, .tbFoglio td, .tbFoglio th { 
      border: 1px solid #000; 
      padding: 2px 4px; 
      font-size: 11px; 
      word-break: break-word; 
      overflow-wrap: break-word; 
      vertical-align: top; 
    }
    
    .tbFoglio th { 
      background: transparent; 
      font-size: 10px; 
      text-align: left; 
      font-weight: bold; 
      page-break-inside: avoid;
    }

    /* Forza le altre tabelle a non essere tagliate e a stare insieme */
    .tbHeader {
      page-break-after: avoid;
    }

    /* Stile speciale per la tabella degli articoli - niente bordi */
    .tbLineItems td {
      border: 0;
    }

    .tbLineItems thead {
      display: table-header-group;
    }

    .tbLineItems thead th {
      border: 1px solid #000;
      background: transparent;
      page-break-inside: avoid;
    }

    .tbLineItems tbody tr {
      page-break-inside: auto;
    }
    
    .import { text-align: right; }
    .textCenter { text-align: center; }
    .separa { height: 3px; }
    .yellowRow { 
      background: #fffacd; 
      font-weight: bold;
      page-break-inside: avoid;
    }

    /* Contenitore finale - permette page-break se necessario */
    .finalSection {
      page-break-inside: auto;
    }

    /* Separatore tra serie di articoli */
    .itemSeparator {
      height: 0;
      margin: 0;
      page-break-inside: avoid;
    }

    /* Tabella pagamenti - sempre visibile, anche in multi-pagina */
    .paymentTable {
      page-break-inside: auto;
      page-break-before: avoid;
      width: 100%;
      border-collapse: collapse;
      margin-top: 3px;
    }

    .paymentTable tbody {
      display: table-row-group;
      page-break-inside: auto;
    }

    .paymentTable thead {
      display: table-header-group;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div id="fattura-elettronica">

    <!-- Header -->
    <table class="tbHeader">
      <tr>
        <td style="width:50%;">
          <strong>Cedente/prestatore (fornitore)</strong><br/>
          ${safe(invoice.supplierName)}<br/>
          P.IVA: ${safe(invoice.supplierVat)}<br/>
          CF: ${safe(invoice.supplierFiscalCode)}
          ${invoice.supplierAddress ? `<div>${[
            invoice.supplierAddress.Indirizzo,
            invoice.supplierAddress.NumeroCivico,
            invoice.supplierAddress.CAP,
            invoice.supplierAddress.Comune,
            invoice.supplierAddress.Provincia ? "(" + invoice.supplierAddress.Provincia + ")" : "",
            invoice.supplierAddress.Nazione,
          ].filter(Boolean).join(" ")}</div>` : ""}
        </td>
        <td style="width:50%;">
          <strong>Cessionario/committente (cliente)</strong><br/>
          ${safe(invoice.customerName)}<br/>
          P.IVA: ${safe(invoice.customerVat)}
          ${invoice.customerAddress ? `<div>${[
            invoice.customerAddress.Indirizzo,
            invoice.customerAddress.NumeroCivico,
            invoice.customerAddress.CAP,
            invoice.customerAddress.Comune,
            invoice.customerAddress.Provincia ? "(" + invoice.customerAddress.Provincia + ")" : "",
            invoice.customerAddress.Nazione,
          ].filter(Boolean).join(" ")}</div>` : ""}
        </td>
      </tr>
    </table>

    <!-- Documento -->
    <table class="tbFoglio">
      <thead>
        <tr>
          <th>Tipologia documento</th>
          <th>Numero documento</th>
          <th>Data documento</th>
          <th>Valuta</th>
          <th>Esigibilità IVA</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${decodeDocumentType(invoice.documentType)}</td>
          <td class="textCenter">${safe(invoice.invoiceNumber)}</td>
          <td class="textCenter">${formatDateIta(invoice.invoiceDate)}</td>
          <td class="textCenter">${safe(invoice.currency)}</td>
          <td class="textCenter">IVA a esigibilità immediata</td>
        </tr>
      </tbody>
    </table>

    <!-- Linee -->
    ${invoice.lineItems?.length ? `
    <table class="tbFoglio tbLineItems">
      <thead>
        <tr>
          <th style="width:90px;">Codice</th>
          <th>Descrizione</th>
          <th style="width:70px;" class="import">Quantità</th>
          <th style="width:90px;" class="import">Prezzo Unit.</th>
          <th style="width:60px;" class="import">%Sconto</th>
          <th style="width:60px;" class="import">%IVA</th>
          <th style="width:100px;" class="import">Totale</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.lineItems.map((item: any, index: number) => {
          // Aggiungi separatore se questo articolo non ha quantità
          const separator = !item.hasQuantity ? `<tr><td colspan="7"><div class="itemSeparator"></div></td></tr>` : '';
          // Non mostrare quantità se non presente
          const quantityDisplay = item.hasQuantity ? formatNumber(item.quantity) : '';
          // Non mostrare prezzo unitario se totale è 0
          const unitPriceDisplay = item.hasTotalPrice ? `${safe(invoice.currency)} ${formatNumber(item.unitPrice)}` : '';
          // Hide values if total is 0.00
          const shouldHideValues = item.total === 0;
          const vatDisplay = shouldHideValues ? '' : formatNumber(item.vat);
          const discountDisplay = shouldHideValues ? '' : (item.discount ? formatNumber(item.discount) : "0,00");
          const totalDisplay = shouldHideValues ? '' : `${safe(invoice.currency)} ${formatNumber(item.total)}`;
          return separator + `
          <tr>
            <td class="textCenter">${safe(item.code)}</td>
            <td>${safe(item.description)}</td>
            <td class="import">${quantityDisplay}</td>
            <td class="import">${unitPriceDisplay}</td>
            <td class="import">${discountDisplay}</td>
            <td class="import">${vatDisplay}</td>
            <td class="import">${totalDisplay}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>` : ""}

    <!-- Riepiloghi e Totali -->
    <div class="finalSection">
    <table class="tbFoglio">
      <thead><tr><th>Descrizione</th><th style="width:150px;">Importo</th></tr></thead>
      <tbody>
        <tr><td>Imponibile</td><td class="import">${safe(invoice.currency)} ${formatNumber(invoice.taxableAmount)}</td></tr>
        <tr><td>IVA</td><td class="import">${safe(invoice.currency)} ${formatNumber(invoice.taxAmount)}</td></tr>
        <tr class="yellowRow"><td>TOTALE DOCUMENTO</td><td class="import">${safe(invoice.currency)} ${formatNumber(invoice.totalAmount)}</td></tr>
      </tbody>
    </table>
    </div>

    <!-- Pagamento - Sezione separata per visibilità in multi-pagina -->
    ${invoice.paymentDetails && invoice.paymentDetails.length > 0 ? `
    <table class="tbFoglio paymentTable">
      <thead>
        <tr>
          <th>Modalità pagamento</th>
          <th>Scadenza</th>
          <th style="width:150px;" class="import">Importo</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.paymentDetails.map((payment: any) => `
        <tr>
          <td>${decodePaymentMethod(payment.method)}</td>
          <td class="textCenter">${payment.dueDate ? formatDateIta(payment.dueDate) : "-"}</td>
          <td class="import">${safe(invoice.currency)} ${formatNumber(payment.amount)}</td>
        </tr>`).join("")}
      </tbody>
    </table>` : ""}

  </div>
</body>
</html>`;

  return html;
}






/**
 * Transform FatturaPA XML to HTML
 * Generates HTML from parsed invoice data using a custom template
 *
 * @param xmlContent - The FatturaPA XML content to transform
 * @returns HTML string with styled invoice
 */
export async function transformXMLToHTML(xmlContent: string): Promise<string> {
  try {
    const html = await generateHTMLFallback(xmlContent);
    return html;
  } catch (error) {
    console.error("Error generating HTML:", error);
    const e = new Error("Failed to transform XML to HTML");
    (e as any).status = 500;
    (e as any).details =
      error instanceof Error ? error.message : String(error);
    throw e;
  }
}
