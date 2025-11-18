import { useState } from "react";
import { usePDFGenerator } from "@/hooks/usePDFGenerator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PDFGenerationProgress,
  PDFGenerationProgressInline,
  PDFGenerationBadge,
} from "@/components/pdf-generation-progress";
import { Upload, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Componente di test per la generazione PDF lato client
 * Dimostra l'uso delle nuove utility frontend
 */
export function PDFTestComponent() {
  const { toast } = useToast();
  const pdfGenerator = usePDFGenerator();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [testInvoiceId, setTestInvoiceId] = useState("");
  const [testInvoiceNumber, setTestInvoiceNumber] = useState("");
  const [xmlContent, setXmlContent] = useState("");

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      toast({
        title: "File selezionato",
        description: `${file.name} (${(file.size / 1024).toFixed(2)} KB)`,
      });
    }
  };

  const handleGenerateFromFile = async () => {
    if (!selectedFile) {
      toast({
        title: "Errore",
        description: "Seleziona prima un file",
        variant: "destructive",
      });
      return;
    }

    try {
      const pdfBlob = await pdfGenerator.generatePDFFromFile(
        selectedFile,
        selectedFile.name.replace(/\.(xml|p7m)$/i, ".pdf")
      );

      if (pdfBlob) {
        toast({
          title: "PDF generato!",
          description: "Il PDF è stato scaricato con successo",
        });
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  const handleGenerateFromInvoiceId = async () => {
    if (!testInvoiceId || !testInvoiceNumber) {
      toast({
        title: "Errore",
        description: "Inserisci ID e numero fattura",
        variant: "destructive",
      });
      return;
    }

    try {
      const pdfBlob = await pdfGenerator.generatePDFFromInvoiceId(
        testInvoiceId,
        testInvoiceNumber
      );

      if (pdfBlob) {
        toast({
          title: "PDF generato!",
          description: `${testInvoiceNumber}.pdf scaricato`,
        });
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  const handleGenerateFromXML = async () => {
    if (!xmlContent.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci contenuto XML",
        variant: "destructive",
      });
      return;
    }

    try {
      const pdfBlob = await pdfGenerator.generatePDFFromXML(
        xmlContent,
        "test-fattura.pdf"
      );

      if (pdfBlob) {
        toast({
          title: "PDF generato!",
          description: "Il PDF è stato scaricato con successo",
        });
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  const loadSampleXML = () => {
    const sampleXML = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>01234567890</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>00001</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>XXXXXXX</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>01234567890</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>RSSMRA80A01H501U</CodiceFiscale>
        <Anagrafica>
          <Denominazione>Fornitore Esempio SRL</Denominazione>
        </Anagrafica>
        <RegimeFiscale>RF01</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Roma</Indirizzo>
        <NumeroCivico>1</NumeroCivico>
        <CAP>00100</CAP>
        <Comune>Roma</Comune>
        <Provincia>RM</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>09876543210</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>Cliente Esempio SPA</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Milano</Indirizzo>
        <NumeroCivico>10</NumeroCivico>
        <CAP>20100</CAP>
        <Comune>Milano</Comune>
        <Provincia>MI</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2024-01-15</Data>
        <Numero>001</Numero>
        <ImportoTotaleDocumento>1220.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Servizio di consulenza</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>1000.00</PrezzoUnitario>
        <PrezzoTotale>1000.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>22.00</AliquotaIVA>
        <ImponibileImporto>1000.00</ImponibileImporto>
        <Imposta>220.00</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP05</ModalitaPagamento>
        <DataScadenzaPagamento>2024-02-15</DataScadenzaPagamento>
        <ImportoPagamento>1220.00</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;
    setXmlContent(sampleXML);
    toast({
      title: "XML di esempio caricato",
      description: "Puoi ora generare il PDF dal contenuto XML",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Test Generazione PDF</h1>
          <p className="text-muted-foreground">
            Testa le funzionalità di generazione PDF lato client
          </p>
        </div>
        <PDFGenerationBadge
          isGenerating={pdfGenerator.isGenerating}
          progress={pdfGenerator.progress}
          error={pdfGenerator.error}
        />
      </div>

      {/* Status Card */}
      {(pdfGenerator.isGenerating || pdfGenerator.error) && (
        <PDFGenerationProgress
          isGenerating={pdfGenerator.isGenerating}
          progress={pdfGenerator.progress}
          error={pdfGenerator.error}
          onComplete={() => {
            console.log("PDF generation completed!");
          }}
        />
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Test 1: Da File */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Test 1: Genera da File
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="file-upload">
                Carica file XML o P7M
              </Label>
              <Input
                id="file-upload"
                type="file"
                accept=".xml,.p7m"
                onChange={handleFileSelect}
                className="mt-2"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  File selezionato: {selectedFile.name}
                </p>
              )}
            </div>
            <Button
              onClick={handleGenerateFromFile}
              disabled={!selectedFile || pdfGenerator.isGenerating}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Genera PDF
            </Button>
            <PDFGenerationProgressInline
              isGenerating={pdfGenerator.isGenerating}
              progress={pdfGenerator.progress}
              error={pdfGenerator.error}
            />
          </CardContent>
        </Card>

        {/* Test 2: Da Invoice ID */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Test 2: Genera da ID Fattura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="invoice-id">ID Fattura</Label>
              <Input
                id="invoice-id"
                type="text"
                placeholder="es: 123"
                value={testInvoiceId}
                onChange={(e) => setTestInvoiceId(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="invoice-number">Numero Fattura</Label>
              <Input
                id="invoice-number"
                type="text"
                placeholder="es: FATT-2024-001"
                value={testInvoiceNumber}
                onChange={(e) => setTestInvoiceNumber(e.target.value)}
                className="mt-2"
              />
            </div>
            <Button
              onClick={handleGenerateFromInvoiceId}
              disabled={
                !testInvoiceId ||
                !testInvoiceNumber ||
                pdfGenerator.isGenerating
              }
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Genera PDF
            </Button>
          </CardContent>
        </Card>

        {/* Test 3: Da XML Content */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Test 3: Genera da Contenuto XML
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="xml-content">Contenuto XML FatturaPA</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadSampleXML}
                >
                  Carica Esempio
                </Button>
              </div>
              <textarea
                id="xml-content"
                className="w-full h-64 p-3 border rounded-md font-mono text-sm"
                placeholder="Incolla qui il contenuto XML della fattura..."
                value={xmlContent}
                onChange={(e) => setXmlContent(e.target.value)}
              />
            </div>
            <Button
              onClick={handleGenerateFromXML}
              disabled={!xmlContent.trim() || pdfGenerator.isGenerating}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Genera PDF da XML
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Come funziona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Test 1:</strong> Carica un file XML o P7M dal tuo computer.
            Il sistema estrarrà automaticamente l'XML (se P7M), lo trasformerà
            in HTML e genererà un PDF.
          </p>
          <p>
            <strong>Test 2:</strong> Inserisci l'ID e il numero di una fattura
            esistente nel database. Il sistema recupererà l'XML dal backend e
            genererà il PDF localmente nel browser.
          </p>
          <p>
            <strong>Test 3:</strong> Incolla direttamente contenuto XML
            FatturaPA. Puoi usare l'esempio fornito o copiare un XML reale.
          </p>
          <p className="pt-2 border-t">
            <strong>Nota:</strong> Tutta la generazione PDF avviene nel browser!
            Non vengono effettuate chiamate al backend per la conversione.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
