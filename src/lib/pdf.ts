import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export type PDFOptions = {
  landscape?: boolean;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  format?: "A4" | "Letter";
  printBackground?: boolean;
};

async function launchPdfBrowser() {
  if (process.env.VERCEL) {
    const chromiumMod = await import("@sparticuz/chromium");
    const chromium = chromiumMod.default;
    const puppeteerMod = await import("puppeteer-core");
    const puppeteer = puppeteerMod.default;
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  const puppeteerMod = await import("puppeteer");
  const puppeteer = puppeteerMod.default;
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

/**
 * Lança browser headless, renderiza HTML e devolve PDF como Buffer.
 * Deve ser chamado server-side (route handler).
 */
export async function generatePDF(
  htmlContent: string,
  opts: PDFOptions = {}
): Promise<Buffer> {
  const browser = await launchPdfBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: opts.format ?? "A4",
      landscape: opts.landscape ?? false,
      printBackground: opts.printBackground ?? true,
      margin: opts.margin ?? {
        top: "12mm",
        right: "10mm",
        bottom: "12mm",
        left: "10mm",
      },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

let _s3: S3Client | null = null;
function r2Client(): S3Client | null {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    return null;
  }
  if (!_s3) {
    _s3 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _s3;
}

/**
 * Faz upload do PDF para R2. Devolve URL pública ou null se R2 não configurado.
 */
export async function uploadPDFtoR2(
  buffer: Buffer,
  key: string
): Promise<string | null> {
  const client = r2Client();
  if (!client || !process.env.R2_BUCKET_NAME) return null;

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
      ACL: "public-read",
    })
  );

  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!publicUrl) return null;
  return `${publicUrl}/${key}`;
}
