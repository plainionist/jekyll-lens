import * as vscode from 'vscode';

export function isMarkdownFile(fileUri: vscode.Uri): boolean {
  return fileUri.path.toLowerCase().endsWith('.md');
}

export function decodeSearchableText(bytes: Uint8Array): string | undefined {
  if (bytes.length === 0) {
    return '';
  }

  if (hasUtf8Bom(bytes)) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }

  if (hasUtf16LeBom(bytes)) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }

  if (hasUtf16BeBom(bytes)) {
    const swapped = swapByteOrder(bytes.subarray(2));
    return new TextDecoder('utf-16le').decode(swapped);
  }

  if (looksBinary(bytes)) {
    return undefined;
  }

  return new TextDecoder('utf-8').decode(bytes);
}

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function hasUtf16LeBom(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;
}

function hasUtf16BeBom(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff;
}

function swapByteOrder(bytes: Uint8Array): Uint8Array {
  const swapped = new Uint8Array(bytes.length);

  for (let i = 0; i + 1 < bytes.length; i += 2) {
    swapped[i] = bytes[i + 1];
    swapped[i + 1] = bytes[i];
  }

  if (bytes.length % 2 === 1) {
    swapped[bytes.length - 1] = bytes[bytes.length - 1];
  }

  return swapped;
}

function looksBinary(bytes: Uint8Array): boolean {
  const sampleSize = Math.min(bytes.length, 1024);
  let suspiciousByteCount = 0;

  for (let i = 0; i < sampleSize; i += 1) {
    const value = bytes[i];

    if (value === 0) {
      return true;
    }

    const isAllowedControl = value === 9 || value === 10 || value === 12 || value === 13;
    const isSuspiciousControl = value < 32 && !isAllowedControl;
    const isSuspiciousHighByte = value >= 0x80 && value <= 0x9f;

    if (isSuspiciousControl || isSuspiciousHighByte) {
      suspiciousByteCount += 1;
    }
  }

  return suspiciousByteCount / sampleSize > 0.1;
}