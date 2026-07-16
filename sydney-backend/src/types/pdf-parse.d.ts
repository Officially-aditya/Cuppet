declare module "pdf-parse" {
  type PdfParseResult = {
    text?: string;
    numpages?: number;
    info?: Record<string, unknown>;
  };

  export default function pdfParse(data: Buffer): Promise<PdfParseResult>;
}
