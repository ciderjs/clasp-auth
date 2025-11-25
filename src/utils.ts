// src/utils.ts (新規作成)

import {
  type SpawnSyncOptionsWithStringEncoding,
  spawnSync,
} from 'node:child_process';
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

/**
 * gh コマンドを安全に実行するためのラッパー
 * シェルを介さず引数を配列として渡すことでインジェクションを防ぐ
 */
export function runGhCommand(args: string[], input?: string): string {
  // gh コマンドの存在確認も兼ねて実行
  const options: SpawnSyncOptionsWithStringEncoding = {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'], // inputを利用するため pipe に設定
    input, // 標準入力へ渡す文字列 (upload時のBase64など)
  };

  // Windowsでの .cmd / .exe 解決のため shell: false (デフォルト) でも動作するが、
  // 確実にPATHから引くために実行
  const result = spawnSync('gh', args, options);

  if (result.error) {
    if ((result.error as any).code === 'ENOENT') {
      throw new Error('GitHub CLI (gh) not found. Please install it first.');
    }
    throw result.error;
  }

  if (result.status !== 0) {
    // 標準エラー出力を取得してエラーメッセージとする
    const stderr = result.stderr
      ? result.stderr.toString().trim()
      : 'Unknown error';
    throw new Error(`gh command failed: ${stderr}`);
  }

  return result.stdout ? result.stdout.toString().trim() : '';
}
