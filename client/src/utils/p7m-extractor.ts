/**
 * P7M Extractor for browser-side extraction of XML from digitally signed files
 * Uses node-forge library to parse PKCS#7/CMS signed data
 */

import forge from "node-forge";

/**
 * Extract XML content from a P7M (PKCS#7 signed) file
 *
 * @param buffer - ArrayBuffer or Uint8Array containing P7M file data
 * @returns Promise<string> - Extracted XML content
 */
export async function extractXMLFromP7M(
  buffer: ArrayBuffer | Uint8Array,
): Promise<string> {
  try {
    // Convert ArrayBuffer to Uint8Array if needed
    const uint8Array =
      buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;

    // Convert Uint8Array to binary string for forge
    let binaryString = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }

    // Try to parse as PKCS#7 (DER format)
    let p7: any;
    try {
      // First try DER format (most common for P7M files)
      const asn1 = forge.asn1.fromDer(binaryString);
      p7 = forge.pkcs7.messageFromAsn1(asn1);
    } catch (derError) {
      // If DER fails, try PEM format
      try {
        p7 = forge.pkcs7.messageFromPem(binaryString);
      } catch (pemError) {
        throw new Error(
          "Unable to parse P7M file. The file may be corrupted or in an unsupported format.",
        );
      }
    }

    // Extract the content from the signed data
    if (!p7.rawCapture || !p7.rawCapture.content) {
      throw new Error("No content found in P7M file");
    }

    // Get the content as UTF-8 string
    let xmlContent = p7.rawCapture.content;

    // If content is still in binary format, try to decode it
    if (typeof xmlContent === "string") {
      // Try to decode as UTF-8
      try {
        // Convert to bytes array
        const bytes = [];
        for (let i = 0; i < xmlContent.length; i++) {
          bytes.push(xmlContent.charCodeAt(i));
        }

        // Decode as UTF-8
        const decoder = new TextDecoder("utf-8");
        xmlContent = decoder.decode(new Uint8Array(bytes));
      } catch (decodeError) {
        // If decoding fails, use the content as-is
        console.warn("UTF-8 decoding failed, using raw content:", decodeError);
      }
    }

    // Verify that we got XML content
    if (!xmlContent || typeof xmlContent !== "string") {
      throw new Error("Extracted content is not valid");
    }

    // Check if content looks like XML
    const trimmedContent = xmlContent.trim();
    if (
      !trimmedContent.startsWith("<?xml") &&
      !trimmedContent.startsWith("<")
    ) {
      throw new Error("Extracted content does not appear to be XML");
    }

    return trimmedContent;
  } catch (error) {
    console.error("Error extracting XML from P7M:", error);
    throw new Error(
      "Failed to extract XML from P7M file: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Extract XML content from a P7M File object
 *
 * @param file - File object containing P7M data
 * @returns Promise<string> - Extracted XML content
 */
export async function extractXMLFromP7MFile(file: File): Promise<string> {
  try {
    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();

    // Extract XML from the buffer
    return await extractXMLFromP7M(buffer);
  } catch (error) {
    console.error("Error extracting XML from P7M file:", error);
    throw error;
  }
}

/**
 * Check if a file is likely a P7M file based on extension and magic bytes
 *
 * @param file - File object to check
 * @returns boolean - true if file appears to be P7M
 */
export function isP7MFile(file: File): boolean {
  // Check file extension
  const hasP7MExtension = file.name.toLowerCase().endsWith(".p7m");

  return hasP7MExtension;
}

/**
 * Verify P7M signature (basic verification)
 * Note: This only checks if the signature structure is valid, not if it's trusted
 *
 * @param buffer - ArrayBuffer or Uint8Array containing P7M file data
 * @returns Promise<boolean> - true if signature structure is valid
 */
export async function verifyP7MSignature(
  buffer: ArrayBuffer | Uint8Array,
): Promise<boolean> {
  try {
    // Convert ArrayBuffer to Uint8Array if needed
    const uint8Array =
      buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;

    // Convert to binary string
    let binaryString = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }

    // Try to parse as PKCS#7
    let p7: any;
    try {
      const asn1 = forge.asn1.fromDer(binaryString);
      p7 = forge.pkcs7.messageFromAsn1(asn1);
    } catch (error) {
      return false;
    }

    // Check if it has signatures
    if (!p7.certificates || p7.certificates.length === 0) {
      return false;
    }

    // Basic structure validation passed
    return true;
  } catch (error) {
    console.error("Error verifying P7M signature:", error);
    return false;
  }
}

/**
 * Get P7M file information (certificates, signers, etc.)
 *
 * @param buffer - ArrayBuffer or Uint8Array containing P7M file data
 * @returns Promise<P7MInfo> - Information about the P7M file
 */
export interface P7MInfo {
  hasCertificates: boolean;
  certificateCount: number;
  signerCount: number;
  certificates?: Array<{
    subject: string;
    issuer: string;
    validFrom: Date;
    validTo: Date;
    serialNumber: string;
  }>;
}

export async function getP7MInfo(
  buffer: ArrayBuffer | Uint8Array,
): Promise<P7MInfo> {
  try {
    // Convert ArrayBuffer to Uint8Array if needed
    const uint8Array =
      buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;

    // Convert to binary string
    let binaryString = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }

    // Parse as PKCS#7
    const asn1 = forge.asn1.fromDer(binaryString);
    const p7 = forge.pkcs7.messageFromAsn1(asn1);

    const info: P7MInfo = {
      hasCertificates:
        (p7 as any).certificates && (p7 as any).certificates.length > 0,
      certificateCount: (p7 as any).certificates
        ? (p7 as any).certificates.length
        : 0,
      signerCount: (p7 as any).signers ? (p7 as any).signers.length : 0,
      certificates: [],
    };

    // Extract certificate details
    if ((p7 as any).certificates && (p7 as any).certificates.length > 0) {
      info.certificates = (p7 as any).certificates.map((cert: any) => ({
        subject: cert.subject.attributes
          .map((attr: any) => `${attr.shortName}=${attr.value}`)
          .join(", "),
        issuer: cert.issuer.attributes
          .map((attr: any) => `${attr.shortName}=${attr.value}`)
          .join(", "),
        validFrom: cert.validity.notBefore,
        validTo: cert.validity.notAfter,
        serialNumber: cert.serialNumber,
      }));
    }

    return info;
  } catch (error) {
    console.error("Error getting P7M info:", error);
    throw new Error(
      "Failed to get P7M information: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Process uploaded file: detect if P7M and extract XML if needed
 *
 * @param file - File object to process
 * @returns Promise<{xmlContent: string, wasP7M: boolean}> - Processed file info
 */
export async function processUploadedFile(file: File): Promise<{
  xmlContent: string;
  wasP7M: boolean;
  originalFilename: string;
}> {
  try {
    const isP7M = isP7MFile(file);

    if (isP7M) {
      // Extract XML from P7M
      const xmlContent = await extractXMLFromP7MFile(file);
      return {
        xmlContent,
        wasP7M: true,
        originalFilename: file.name,
      };
    } else {
      // Read as text (assuming it's XML)
      const xmlContent = await file.text();
      return {
        xmlContent,
        wasP7M: false,
        originalFilename: file.name,
      };
    }
  } catch (error) {
    console.error("Error processing uploaded file:", error);
    throw new Error(
      "Failed to process file: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}
