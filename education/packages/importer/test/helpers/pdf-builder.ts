/**
 * Minimal PDF writer for tests: produces real PDF files with a classic
 * cross-reference table, one text layer per page and an optional /Encrypt
 * trailer. No third-party code and no binary fixtures in Git.
 */

export interface PdfBuildOptions {
  readonly title?: string;
  readonly pageWidth?: number;
  readonly pageHeight?: number;
  /** Adds a /Encrypt trailer entry (the importer must refuse such files). */
  readonly encrypted?: boolean;
  /** Shifts every cross-reference offset so the reader has to recover. */
  readonly breakXrefOffsets?: boolean;
}

const encoder = new TextEncoder();

function latin1(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}

function escapeLiteral(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** One text-showing operation in PDF content-stream syntax. */
export function textOp(
  x: number,
  y: number,
  size: number,
  text: string,
  font = 'F1',
): string {
  return `BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapeLiteral(text)}) Tj ET`;
}

/** Content stream for a page with a list of positioned text lines. */
export function textPage(
  lines: readonly { readonly x: number; readonly y: number; readonly size: number; readonly text: string; readonly font?: string }[],
): string {
  return lines.map((line) => textOp(line.x, line.y, line.size, line.text, line.font ?? 'F1')).join('\n');
}

export function buildPdf(pages: readonly string[], options: PdfBuildOptions = {}): Uint8Array {
  const width = options.pageWidth ?? 595;
  const height = options.pageHeight ?? 842;
  const objects: string[] = [];
  const add = (body: string): number => {
    objects.push(body);
    return objects.length; // 1-based object number
  };

  const catalog = add('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesObj = add('PLACEHOLDER_PAGES');
  const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const info = add(
    `<< /Title (${escapeLiteral(options.title ?? 'T03 synthetic fixture')}) /Producer (t03-importer-tests) /Creator (t03-importer-tests) >>`,
  );

  const kids: number[] = [];
  for (const content of pages) {
    const contentBytes = latin1(content);
    const contentRef = add(`<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`);
    const pageRef = add(
      `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${width} ${height}] ` +
        `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentRef} 0 R >>`,
    );
    kids.push(pageRef);
  }
  objects[pagesObj - 1] =
    `<< /Type /Pages /Kids [${kids.map((ref) => `${ref} 0 R`).join(' ')}] /Count ${kids.length} ` +
    `/MediaBox [0 0 ${width} ${height}] >>`;

  const chunks: Uint8Array[] = [];
  let offset = 0;
  const push = (text: string): void => {
    const bytes = latin1(text);
    chunks.push(bytes);
    offset += bytes.length;
  };
  push('%PDF-1.7\n%\u00e2\u00e3\u00cf\u00d3\n');
  const offsets: number[] = [];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(offset);
    push(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`);
  }
  const xrefOffset = offset;
  const size = objects.length + 1;
  let table = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (const entry of offsets) {
    const value = options.breakXrefOffsets === true ? entry + 5 : entry;
    table += `${String(value).padStart(10, '0')} 00000 n \n`;
  }
  push(table);
  const encrypt = options.encrypted === true ? ' /Encrypt << /Filter /Standard /V 1 /R 2 /O <0000> /U <0000> /P -4 >>' : '';
  push(`trailer\n<< /Size ${size} /Root ${catalog} 0 R /Info ${info} 0 R${encrypt} >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** A page whose content stream draws nothing (an image-only scan in the wild). */
export const SCANNED_PAGE_CONTENT = 'q 595 0 0 842 0 0 cm Q';

export const FOOTER_Y = 24;
