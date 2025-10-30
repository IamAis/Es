import * as forge from "node-forge";

/**
 * Extract XML content from P7M (PKCS#7) signed file
 * P7M files are digitally signed documents commonly used for Italian electronic invoices
 */
export async function extractXMLFromP7M(p7mBuffer: Buffer): Promise<string> {
  try {
    // Convert buffer to binary string for forge
    const p7mBinary = p7mBuffer.toString('binary');
    
    // Try to parse as PEM first
    let p7asn1;
    try {
      const pem = forge.pki.pemToDer(p7mBinary);
      p7asn1 = forge.asn1.fromDer(pem.data);
    } catch {
      // If not PEM, try DER format
      p7asn1 = forge.asn1.fromDer(p7mBinary);
    }
    
    // Parse PKCS#7 message
    const p7 = forge.pkcs7.messageFromAsn1(p7asn1);
    
    // Extract the original content
    let content = '';
    
    if (p7.rawCapture && p7.rawCapture.content) {
      content = p7.rawCapture.content;
    } else if (p7.content) {
      content = p7.content.toString();
    }
    
    // Convert from binary string to UTF-8
    const xmlContent = Buffer.from(content, 'binary').toString('utf-8');
    
    return xmlContent;
  } catch (error) {
    console.error('Error extracting XML from P7M:', error);
    throw new Error('Failed to extract XML from P7M file. The file may be corrupted or in an unsupported format.');
  }
}
