import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function checkRepoAccess(repo: string): {
  exists: boolean;
  canPush: boolean;
  error?: string;
} {
  try {
    // リポジトリ情報を取得
    const output = execSync(`gh api repos/${repo}`, { encoding: 'utf-8' });
    const data = JSON.parse(output);

    // push 権限の有無を確認
    const canPush = data.permissions?.push === true;
    return { exists: true, canPush };
  } catch (error) {
    // エラー理由を判別
    const message = error instanceof Error ? error.message : '';
    if (message.includes('404')) {
      return { exists: false, canPush: false, error: 'Repository not found' };
    }
    if (message.includes('403')) {
      return { exists: true, canPush: false, error: 'Permission denied' };
    }
    return { exists: false, canPush: false, error: 'Unknown error' };
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

/**
 * ~/.clasprc.json を読み込み、JSON文字列として GitHub Secrets に登録する
 */
export function uploadSecrets(repo: string) {
  const clasprcPath = path.join(
    process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'] || '',
    '.clasprc.json',
  );

  if (!existsSync(clasprcPath)) {
    console.error('No .clasprc.json found. Run `clasp login` first.');
    process.exit(1);
  }

  // 再JSON化することでフラット化
  const content = JSON.stringify(
    JSON.parse(readFileSync(clasprcPath, 'utf8').trim()),
  );
  // base64 にエンコード
  const encoded = Buffer.from(content, 'utf8').toString('base64');

  try {
    // gh CLI を使って Secret に登録
    execSync(`gh secret set ${SECRET_KEY} -R ${repo}`, {
      input: encoded,
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    console.log(`✅ Uploaded .clasprc.json to GitHub Secrets (CLASPRC_JSON)`);
  } catch {
    console.error(`❌ Failed to upload .clasprc.json to GitHub Secrets`);
    process.exit(1);
  }
}

/**
 * Secrets を削除する
 */
export function deleteSecrets(repo: string) {
  try {
    execSync(`gh secret delete CLASPRC_JSON -R ${repo}`, {
      stdio: 'inherit',
    });
    console.log(`🗑️ Deleted ${SECRET_KEY} from GitHub Secrets`);
  } catch {
    console.warn(
      '❌ Failed to delete CLASPRC_JSON from GitHub Secrets (may not exist)',
    );
  }
}
