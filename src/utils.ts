// src/utils.ts (新規作成)
import path from 'node:path';

export function getClasprcPath(): string {
  const homeEnvVar = process.platform === 'win32' ? 'USERPROFILE' : 'HOME';
  const homeDir = process.env[homeEnvVar] || '';
  return path.join(homeDir, '.clasprc.json');
}

export function encodeToBase64(content: string): string {
  return Buffer.from(content, 'utf8').toString('base64');
}

export function decodeFromBase64(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf8');
}
