import forge from "node-forge";

export async function extractXMLFromP7M(p7mBuffer: Buffer): Promise<string> {
  // Try node-forge method first
  try {
    return extractWithNodeForge(p7mBuffer);
  } catch (forgeError: any) {
    console.log("node-forge extraction failed, trying manual fallback...", forgeError.message);
    
    // Fallback to manual extraction
    return extractXMLWithFallback(p7mBuffer);
  }
}

/**
 * Extract XML from P7M using node-forge library
 * This method works without external dependencies
 */
function extractWithNodeForge(p7mBuffer: Buffer): string {
  try {
    // Try multiple approaches with node-forge
    let xmlContent: string | null = null;
    
    // Approach 1: Standard DER parsing
    try {
      const p7mString = p7mBuffer.toString('binary');
      const p7asn1 = forge.asn1.fromDer(p7mString);
      const p7 = forge.pkcs7.messageFromAsn1(p7asn1);
      
      // Try different content extraction methods
      let content: any = null;
      
      if (p7.rawCapture && p7.rawCapture.content) {
        content = p7.rawCapture.content;
      } else if (p7.content) {
        content = p7.content;
      }
      
      if (content) {
        xmlContent = extractContentAsString(content);
      }
    } catch (derError) {
      console.log("DER parsing failed, trying PEM...");
    }
    
    // Approach 2: Try as PEM format
    if (!xmlContent) {
      try {
        const p7mString = p7mBuffer.toString('utf-8');
        if (p7mString.includes('-----BEGIN')) {
          const p7 = forge.pkcs7.messageFromPem(p7mString);
          if (p7.rawCapture && p7.rawCapture.content) {
            xmlContent = extractContentAsString(p7.rawCapture.content);
          } else if (p7.content) {
            xmlContent = extractContentAsString(p7.content);
          }
        }
      } catch (pemError) {
        console.log("PEM parsing failed");
      }
    }
    
    // Approach 3: Try to extract from signed data directly
    if (!xmlContent) {
      try {
        const p7mString = p7mBuffer.toString('binary');
        const p7asn1 = forge.asn1.fromDer(p7mString);
        const p7 = forge.pkcs7.messageFromAsn1(p7asn1);
        
        // Look for content in signers
        if (p7.rawCapture && p7.rawCapture.authenticatedAttributes) {
          for (const attr of p7.rawCapture.authenticatedAttributes) {
            if (attr && attr.value) {
              const testContent = extractContentAsString(attr.value);
              if (testContent && testContent.includes('<?xml')) {
                xmlContent = testContent;
                break;
              }
            }
          }
        }
      } catch (signerError) {
        console.log("Signer content extraction failed");
      }
    }
    
    if (!xmlContent) {
      throw new Error("No valid XML content found in P7M file");
    }
    
    // Clean and validate the XML content
    xmlContent = cleanXMLContent(xmlContent);
    
    if (!xmlContent.includes('<?xml')) {
      throw new Error("Extracted content does not appear to be valid XML");
    }
    
    return xmlContent;
  } catch (error: any) {
    console.error("Error with node-forge extraction:", error);
    throw new Error(`node-forge extraction failed: ${error.message}`);
  }
}

function extractContentAsString(content: any): string | null {
  try {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Buffer.isBuffer(content)) {
      return content.toString('utf-8');
    }
    
    if (content && typeof content.toString === 'function') {
      try {
        return content.toString('utf-8');
      } catch {
        return content.toString();
      }
    }
    
    if (content && content.value) {
      return extractContentAsString(content.value);
    }
    
    return null;
  } catch {
    return null;
  }
}

// Function to safely remove p: prefixes from XML and clean up the content
function cleanXMLContent(xmlContent: string): string {
  if (!xmlContent) return '';
  
  // Remove any null bytes or invalid characters
  xmlContent = xmlContent.replace(/\0/g, '');
  
  // Try UTF-8 decoding if it doesn't look like XML
  if (!xmlContent.includes('<?xml')) {
    try {
      xmlContent = forge.util.decodeUtf8(xmlContent);
    } catch (e) {
      // Keep original if decoding fails
    }
  }
  
  // Remove p: from all opening tags
  let result = xmlContent.replace(/<p:([a-zA-Z][^>]*)>/g, '<$1>')
    // Remove p: from all closing tags
    .replace(/<\/p:([a-zA-Z][^>]*)>/g, '</$1>')
    // Remove p namespace declaration
    .replace(/\s+xmlns:p="[^"]*"/g, '');
    
  // Ensure proper namespace
  if (!result.includes('xmlns="http://ivaservizi.agenziaentrate.gov.it/')) {
    result = result.replace(
      /<FatturaElettronica([^>]*)>/, 
      '<FatturaElettronica$1 xmlns="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">'
    );
  }
  
  // Ensure proper XML structure
  if (!result.includes('<?xml') && result.includes('<FatturaElettronica')) {
    result = '<?xml version="1.0" encoding="UTF-8"?>\n' + result;
  }
  
  return result.trim();
}

// Enhanced fallback method with multiple strategies
async function extractXMLWithFallback(p7mBuffer: Buffer): Promise<string> {
  try {
    // Strategy 1: Look for XML declaration
    let start = p7mBuffer.indexOf(Buffer.from("<?xml"));
    if (start !== -1) {
      const closingTags = [
        "</FatturaElettronica>",
        "</p:FatturaElettronica>",
        "</a:FatturaElettronica>",
        "</ns2:FatturaElettronica>",
        "</ns3:FatturaElettronica>",
      ];
      for (const closeTag of closingTags) {
        const end = p7mBuffer.indexOf(Buffer.from(closeTag));
        if (end !== -1) {
          const slice = p7mBuffer.slice(
            start,
            end + Buffer.from(closeTag).length
          );
          let xmlContent = slice.toString("utf-8");
          if (xmlContent.includes("<?xml")) {
            return cleanXMLContent(xmlContent);
          }
        }
      }
    }

    // Strategy 2: Look for FatturaElettronica without XML declaration
    start = p7mBuffer.indexOf(Buffer.from("<FatturaElettronica"));
    if (start !== -1) {
      // Cerca sia il tag di chiusura con che senza prefisso
      const end = p7mBuffer.indexOf(Buffer.from("</FatturaElettronica>")) !== -1 
        ? p7mBuffer.indexOf(Buffer.from("</FatturaElettronica>")) 
        : p7mBuffer.indexOf(Buffer.from("</p:FatturaElettronica>"));
        
      if (end !== -1) {
        const slice = p7mBuffer.slice(start, end + Buffer.from("</FatturaElettronica>").length);
        let xmlContent = slice.toString("utf-8");
        // Add XML declaration if missing
        if (!xmlContent.includes("<?xml")) {
          xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlContent;
        }
        return cleanXMLContent(xmlContent);
      }
    }

    // Strategy 3: Try different encodings
    const encodings = ['utf-8', 'latin1', 'ascii'];
    for (const encoding of encodings) {
      try {
        const content = p7mBuffer.toString(encoding as BufferEncoding);
        const xmlStart = content.indexOf("<?xml") !== -1 
          ? content.indexOf("<?xml") 
          : content.indexOf("<FatturaElettronica");
          
        if (xmlStart !== -1) {
          // Cerca il tag di chiusura sia con che senza prefisso
          const xmlEnd1 = content.indexOf("</FatturaElettronica>");
          const xmlEnd2 = content.indexOf("</p:FatturaElettronica>");
          const xmlEnd = content.lastIndexOf("</FatturaElettronica>");
          if (xmlEnd !== -1) {
            let xmlContent = content.slice(xmlStart, xmlEnd + "</FatturaElettronica>".length);
            return cleanXMLContent(xmlContent);
          }  
        }
      } catch (e) {
        // Continue to next encoding
      }
    }

    throw new Error("All fallback strategies failed.");
  } catch (error) {
    console.error("Error in fallback XML extraction:", error);
    throw new Error(
      "Failed to extract XML from P7M file using all available methods. The file may be corrupted or in an unsupported format."
    );
  }
}
