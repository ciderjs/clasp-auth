// src/uploadSecrets.ts

// execSync, existsSync, readFileSync の import は削除または整理
import { existsSync, readFileSync } from 'node:fs';
import { getClaspJsonPath, getClasprcPath, runGhCommand } from './utils'; // 作成した関数をインポート

export function checkRepoAccess(repo: string): {
  exists: boolean;
  canPush: boolean;
  error?: string;
} {
  try {
    // リポジトリ情報を取得
    const output = runGhCommand(['api', `repos/${repo}`]);
    const data = JSON.parse(output);

    // push 権限の有無を確認
    const canPush = data.permissions?.push === true;
    return { exists: true, canPush };
  } catch (error) {
    // エラー理由を判別
    const message = error instanceof Error ? error.message : '';
    if (message.includes('404') || message.includes('Not Found')) {
      return { exists: false, canPush: false, error: 'Repository not found' };
    }
    if (message.includes('403') || message.includes('Permission denied')) {
      return { exists: true, canPush: false, error: 'Permission denied' };
    }
    // gh コマンド自体がない場合などのハンドリング
    if (message.includes('not found')) {
      return { exists: false, canPush: false, error: 'gh command missing' };
    }
    return { exists: false, canPush: false, error: message };
  }
}

export function validateRepoAccess(repo: string) {
  const { exists, canPush } = checkRepoAccess(repo);
  if (!exists) {
    console.error(`❌ リポジトリ "${repo}" は存在しません。`);
    return false;
  }
  if (!canPush) {
    console.error(`❌ リポジトリ "${repo}" に対する編集権限がありません。`);
    return false;
  }
  return true;
}

export const SECRET_KEY = 'CLASPRC_JSON';
export const CLASP_JSON_SECRET_KEY = 'CLASP_JSON';

export interface UploadOptions {
  projectDir?: string | undefined;
}

/**
 * ~/.clasprc.json を読み込み、JSON文字列として GitHub Secrets に登録する
 * projectDir が指定されている場合、そのディレクトリの .clasp.json も CLASP_JSON として登録する
 */
export function uploadSecrets(repo: string, options?: UploadOptions) {
  const clasprcPath = getClasprcPath();

  if (!existsSync(clasprcPath)) {
    console.error('No .clasprc.json found. Run `clasp login` first.');
    process.exit(1);
  }

  // .clasprc.json のアップロード
  // 再JSON化することでフラット化
  const content = JSON.stringify(
    JSON.parse(readFileSync(clasprcPath, 'utf8').trim()),
  );
  // base64 にエンコード
  const encoded = Buffer.from(content, 'utf8').toString('base64');

  try {
    runGhCommand(['secret', 'set', SECRET_KEY, '-R', repo], encoded);

    console.log(`✅ Uploaded .clasprc.json to GitHub Secrets (${SECRET_KEY})`);
  } catch (e) {
    console.error('❌ Failed to upload .clasprc.json to GitHub Secrets');
    if (e instanceof Error) console.error(e.message);
    process.exit(1);
  }

  // .clasp.json のアップロード
  const claspJsonPath = getClaspJsonPath(options?.projectDir);
  if (existsSync(claspJsonPath)) {
    const claspJsonContent = JSON.stringify(
      JSON.parse(readFileSync(claspJsonPath, 'utf8').trim()),
    );
    const claspJsonEncoded = Buffer.from(claspJsonContent, 'utf8').toString(
      'base64',
    );

    try {
      runGhCommand(
        ['secret', 'set', CLASP_JSON_SECRET_KEY, '-R', repo],
        claspJsonEncoded,
      );

      console.log(
        `✅ Uploaded .clasp.json to GitHub Secrets (${CLASP_JSON_SECRET_KEY})`,
      );
    } catch (e) {
      console.error('❌ Failed to upload .clasp.json to GitHub Secrets');
      if (e instanceof Error) console.error(e.message);
      process.exit(1);
    }
  } else {
    console.log('ℹ️  No .clasp.json found, skipping CLASP_JSON upload');
  }
}

/**
 * Secrets を削除する
 */
export function deleteSecrets(repo: string) {
  try {
    runGhCommand(['secret', 'delete', SECRET_KEY, '-R', repo]);

    console.log(`🗑️ Deleted ${SECRET_KEY} from GitHub Secrets`);
  } catch {
    console.warn(
      `❌ Failed to delete ${SECRET_KEY} from GitHub Secrets (may not exist)`,
    );
  }

  try {
    runGhCommand(['secret', 'delete', CLASP_JSON_SECRET_KEY, '-R', repo]);

    console.log(`🗑️ Deleted ${CLASP_JSON_SECRET_KEY} from GitHub Secrets`);
  } catch {
    console.warn(
      `❌ Failed to delete ${CLASP_JSON_SECRET_KEY} from GitHub Secrets (may not exist)`,
    );
  }
}
