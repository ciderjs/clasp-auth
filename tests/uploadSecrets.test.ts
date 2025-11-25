import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  checkRepoAccess,
  deleteSecrets,
  uploadSecrets,
} from '../src/uploadSecrets';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));
vi.mock('node:fs');

describe('uploadSecrets', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  // spawnSync の戻り値を簡単に作成するヘルパー
  const mockSpawn = ({
    stdout = '',
    stderr = '',
    status = 0,
    error = null as Error | null,
  } = {}) => {
    vi.mocked(spawnSync).mockReturnValue({
      stdout,
      stderr,
      status,
      error,
      pid: 123,
      signal: null,
      output: [stdout, stderr, null],
    } as any);
  };

  describe('checkRepoAccess', () => {
    test('should return exists: true and canPush: true when repo exists and user has push access', () => {
      // 成功時のレスポンスをモック
      mockSpawn({
        stdout: JSON.stringify({ permissions: { push: true } }),
        status: 0,
      });

      const result = checkRepoAccess('owner/repo');

      // 引数が配列で渡されているかチェック
      expect(spawnSync).toHaveBeenCalledWith(
        'gh',
        ['api', 'repos/owner/repo'],
        expect.objectContaining({ encoding: 'utf-8' }),
      );
      expect(result).toEqual({ exists: true, canPush: true });
    });

    test('should return exists: true and canPush: false when repo exists and user does not have push access', () => {
      mockSpawn({
        stdout: JSON.stringify({ permissions: { push: false } }),
        status: 0,
      });

      const result = checkRepoAccess('owner/repo');

      expect(result).toEqual({ exists: true, canPush: false });
    });

    test('should return exists: false when repo not found (404)', () => {
      // gh コマンドがエラー終了(status: 1)し、stderrに404を含む場合
      mockSpawn({
        status: 1,
        stderr: 'Not Found',
      });

      const result = checkRepoAccess('owner/repo');

      expect(result).toEqual({
        exists: false,
        canPush: false,
        error: 'Repository not found',
      });
    });

    test('should return error when gh command is missing', () => {
      // spawnSync自体がエラーを投げる（コマンドが見つからない場合など）
      vi.mocked(spawnSync).mockReturnValue({
        error: { code: 'ENOENT' } as any,
        status: null,
      } as any);

      const result = checkRepoAccess('owner/repo');

      expect(result.error).toBe('gh command missing');
    });
  });

  describe('uploadSecrets', () => {
    test('should upload secrets from .clasprc.json', () => {
      const clasprcData = {
        token: {
          access_token: 'token',
          expiry_date: 123456,
        },
      };

      // .clasprc.json の存在と読み込みをモック
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(clasprcData));

      // gh secret set の成功をモック
      mockSpawn({ status: 0 });

      uploadSecrets('owner/repo');

      // 正しい引数と標準入力(input)が渡されたか検証
      expect(spawnSync).toHaveBeenCalledTimes(1);
      expect(spawnSync).toHaveBeenCalledWith(
        'gh',
        ['secret', 'set', 'CLASPRC_JSON', '-R', 'owner/repo'],
        expect.objectContaining({
          input: expect.any(String), // Base64文字列が渡されているはず
        }),
      );
    });

    test('should exit if .clasprc.json does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      expect(() => uploadSecrets('owner/repo')).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('deleteSecrets', () => {
    test('should delete all clasp secrets', () => {
      mockSpawn({ status: 0 });

      deleteSecrets('owner/repo');

      expect(spawnSync).toHaveBeenCalledWith(
        'gh',
        ['secret', 'delete', 'CLASPRC_JSON', '-R', 'owner/repo'],
        expect.anything(),
      );
    });

    test('should warn if deleting a secret fails', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      // 削除失敗をモック
      mockSpawn({
        status: 1,
        stderr: 'secret not found',
      });

      deleteSecrets('owner/repo');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '❌ Failed to delete CLASPRC_JSON from GitHub Secrets (may not exist)',
      );
    });
  });

  describe('path construction', () => {
    // 環境変数のバックアップとリストア
    const ENV_BACKUP = { ...process.env };
    const PLATFORM_BACKUP = process.platform;

    afterEach(() => {
      process.env = { ...ENV_BACKUP };
      Object.defineProperty(process, 'platform', {
        value: PLATFORM_BACKUP,
      });
    });

    test('should use HOME on linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.HOME = '/fake/home';

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });

      expect(() => uploadSecrets('owner/repo')).toThrow();

      // getClasprcPath -> utils.ts 経由でパスが生成されているか確認
      expect(fs.existsSync).toHaveBeenCalledWith(
        path.join('/fake/home', '.clasprc.json'),
      );
    });

    test('should use USERPROFILE on windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.USERPROFILE = 'C:\\Users\\fake';

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });

      expect(() => uploadSecrets('owner/repo')).toThrow();

      expect(fs.existsSync).toHaveBeenCalledWith(
        path.join('C:\\Users\\fake', '.clasprc.json'),
      );
    });
  });
});