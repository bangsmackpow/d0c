import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const storageDir = process.env.STORAGE_PATH || path.join(process.cwd(), 'data', 'storage');

// Ensure directory exists
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

/**
 * Saves a file to the local storage directory and returns the unique filename.
 */
export async function saveFile(file: File): Promise<string> {
  const fileId = crypto.randomUUID();
  const ext = path.extname(file.name) || '';
  // Sanitize extension and standard format
  const filename = `${fileId}${ext.toLowerCase()}`;
  const filePath = path.join(storageDir, filename);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.promises.writeFile(filePath, buffer);

  return filename;
}

/**
 * Validates and returns the absolute path to a file if it exists.
 * Returns null if the file doesn't exist or if directory traversal is attempted.
 */
export function getFilePath(filename: string): string | null {
  const filePath = path.resolve(storageDir, filename);
  
  // Security check: ensure path is within the storage directory
  const relative = path.relative(storageDir, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  return filePath;
}
