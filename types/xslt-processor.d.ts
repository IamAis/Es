declare module "xslt-processor" {
  const xslt: {
    xmlParse(xml: string): any;
    xsltProcess(xml: any, stylesheet: any): string | Buffer;
  };
  export = xslt;
}
