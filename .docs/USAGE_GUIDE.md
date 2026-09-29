# @ciderjs/clasp-auth 利用ガイド

## 1. 概要 (Introduction)

### このパッケージが解決する課題

Google Apps Script (GAS) をチーム開発する場合、`@google/clasp` を使ってローカルで開発し、GitHub Actions で CI/CD を行うのが一般的なワークフローです。しかし、この構成には以下の課題があります。

| 課題 | 詳細 |
| ------ | ------ |
| **認証情報の手動管理** | `clasp login` で生成される `~/.clasprc.json` には OAuth トークンが含まれており、CI 環境へ安全に渡す仕組みを自前で構築する必要がある |
| **プロジェクト設定の管理** | `.clasp.json`（scriptId 等）もリポジトリに含めたくない場合、別途 Secrets 管理が必要 |
| **Secrets の登録が煩雑** | `.clasprc.json` の内容を手動でコピーし、GitHub Secrets に正しいフォーマットで登録する作業はミスが起きやすい |
| **CI 環境での復元** | Secrets から各ファイルを復元するシェルスクリプトを各リポジトリで書く必要がある |
| **クリーンアップ** | ジョブ終了後に認証ファイルが残留しないよう `if: always()` でのクリーンアップを忘れると情報漏洩リスクになる |

`@ciderjs/clasp-auth` は、これらの課題を **CLI + GitHub Action** の 2 つのコンポーネントで解決します。

- **CLI**: ローカルの `~/.clasprc.json` と `.clasp.json` を読み込み、Base64 エンコードして GitHub Secrets（`CLASPRC_JSON` / `CLASP_JSON`）にワンコマンドでアップロード・削除・検証
- **GitHub Action**: Secrets から両ファイルを復元し、CI/CD 環境で `clasp push` を即座に実行可能にする。ワークフロー終了後は **post アクションで自動クリーンアップ**

### 導入するメリット

- `gh secret set` の引数構築やエンコード処理が不要
- リポジトリの存在確認・権限チェックが自動で行われるため、誤操作を防止
- GitHub Action との組み合わせにより、両ファイルの復元・クリーンアップをゼロコンフィグで実現
- 復元ファイルは `0600` パーミッションで保護され、ジョブ終了後は自動削除される

---

## 2. 基本的な使い方 (Basic Usage)

### 前提条件

以下のツールがインストール・認証済みであること。

```bash
# GitHub CLI のインストールと認証
gh auth login

# clasp のインストールとログイン
npm install -g @google/clasp
clasp login
```

### インストール

```bash
# グローバルインストール（推奨）
npm install -g @ciderjs/clasp-auth

# または npx で直接実行（インストール不要）
npx @ciderjs/clasp-auth <command>
```

### Secrets のアップロード

```bash
# 対話的に確認プロンプトが表示される
clasp-auth upload owner/repo

# 確認プロンプトをスキップ
clasp-auth upload owner/repo --yes

# .clasp.json が別ディレクトリにある場合
clasp-auth upload owner/repo --project-dir ./my-project
```

このコマンドは内部で以下の処理を実行します。

1. `gh api repos/owner/repo` でリポジトリの存在確認と push 権限チェック
2. `~/.clasprc.json` を読み込み、JSON を正規化（`JSON.parse` → `JSON.stringify`）
3. Base64 エンコードして `gh secret set CLASPRC_JSON` でアップロード
4. カレントディレクトリ（または `--project-dir`）の `.clasp.json` が存在すれば、同様に `CLASP_JSON` としてアップロード

### Secrets の削除

```bash
clasp-auth delete owner/repo

# 確認プロンプトをスキップ
clasp-auth delete owner/repo --yes
```

`CLASPRC_JSON` と `CLASP_JSON` の両方を削除します（存在しない場合は警告のみ）。

### Secrets の一覧確認

```bash
clasp-auth list owner/repo
```

`CLASPRC_JSON` または `CLASP_JSON` が登録されている場合は `✅ Found clasp secrets:` と表示されます。

### ローカル認証情報の検証

```bash
# .clasprc.json のみ検証
clasp-auth verify

# .clasp.json も検証する場合
clasp-auth verify --project-dir ./my-project
```

- `~/.clasprc.json`: `access_token`, `refresh_token`, `clientId`, `clientSecret` の存在を検証
- `.clasp.json`: `scriptId` の存在を検証（ファイルがない場合はスキップ）

### GitHub Actions で復元

```yaml
name: Deploy GAS
on:
  push:
    branches: ["main"]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      # clasp-auth Action で .clasprc.json と .clasp.json を復元
      # ワークフロー終了後に post アクションで自動削除される
      - name: Setup clasp auth
        uses: ciderjs/clasp-auth@v0.3.0
        with:
          clasprc_json: ${{ secrets.CLASPRC_JSON }}
          clasp_json: ${{ secrets.CLASP_JSON }}   # optional

      - name: Install clasp
        run: npm install -g @google/clasp

      - name: Push to GAS
        run: clasp push
```

Action の処理フロー:

**main アクション（ジョブ開始時）**:
1. `CLASPRC_JSON` をデコードして `~/.clasprc.json` に書き出し（パーミッション `0600`）
2. `CLASP_JSON` が指定されていれば `$GITHUB_WORKSPACE/.clasp.json` に書き出し（パーミッション `0600`）
3. 各ファイルパスを state に保存

**post アクション（ジョブ終了時）**:
1. state から各ファイルパスを取得し、ファイルが存在すれば削除

> [!NOTE]
> v0.3.0 より入力名が `json` → `clasprc_json` に変更されました。また、post アクションによる自動クリーンアップが追加されたため、`if: always()` での手動削除は不要になりました。

---

## 3. 実践的な活用方法とベストプラクティス (Advanced Recipes)

### レシピ 1: 複数リポジトリへの一括アップロード

同じ Google アカウントで複数の GAS プロジェクトを管理している場合、1 回の `clasp login` で生成した認証情報を複数リポジトリに展開できます。

```bash
#!/bin/bash
REPOS=("myorg/gas-project-a" "myorg/gas-project-b" "myorg/gas-project-c")

for repo in "${REPOS[@]}"; do
  clasp-auth upload "$repo" --yes
done
```

**なぜ効率的か**: `--yes` フラグにより確認プロンプトをスキップし、スクリプトで自動化できます。各リポジトリに対してアップロード前に `checkRepoAccess` が実行されるため、存在しないリポジトリや権限のないリポジトリは自動的にスキップされます。

### レシピ 2: CI/CD パイプラインでの clasp push 完全自動化

```yaml
name: Deploy GAS
on:
  push:
    branches: ["main"]

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup clasp auth
        uses: ciderjs/clasp-auth@v0.3.0
        with:
          clasprc_json: ${{ secrets.CLASPRC_JSON }}
          clasp_json: ${{ secrets.CLASP_JSON }}

      - name: Install clasp
        run: npm install -g @google/clasp

      - name: Push to GAS
        run: clasp push
      # post アクションで .clasprc.json と .clasp.json が自動削除される
```

**なぜ効率的か**: `permissions` を `contents: read` に限定し、post アクションが認証情報を確実にクリーンアップします。`if: always()` での手動削除は不要です。

### レシピ 3: Secrets のローテーション運用

OAuth トークンは有効期限があるため、定期的なローテーションが推奨されます。

```bash
# 1. ローカルで再ログイン
clasp login

# 2. 認証情報の妥当性を検証
clasp-auth verify

# 3. Secrets を更新（.clasp.json も合わせて更新される）
clasp-auth upload owner/repo --yes
```

**なぜ効率的か**: `verify` コマンドで事前に `access_token`、`refresh_token`、`clientId`、`clientSecret` の存在をバリデーションしてからアップロードすることで、壊れた認証情報をアップロードするリスクを回避できます。

### レシピ 4: テストコードにおけるモックパターン

テストで `uploadSecrets` や `checkRepoAccess` を検証する際は、`node:child_process` の `spawnSync` と `node:fs` をモックします。以下はテストコードから抽出した実践的なパターンです。

```typescript
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import { checkRepoAccess, uploadSecrets } from "@ciderjs/clasp-auth";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));
vi.mock("node:fs");

// spawnSync の戻り値を簡単に作成するヘルパー
const mockSpawn = ({
  stdout = "",
  stderr = "",
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

describe("checkRepoAccess", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  test("push 権限がある場合", () => {
    mockSpawn({
      stdout: JSON.stringify({ permissions: { push: true } }),
      status: 0,
    });

    const result = checkRepoAccess("owner/repo");
    expect(result).toEqual({ exists: true, canPush: true });
  });

  test("リポジトリが存在しない場合", () => {
    mockSpawn({ status: 1, stderr: "Not Found" });

    const result = checkRepoAccess("owner/repo");
    expect(result).toEqual({
      exists: false,
      canPush: false,
      error: "Repository not found",
    });
  });
});

describe("uploadSecrets", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  test(".clasprc.json と .clasp.json の両方をアップロードできる", () => {
    const clasprcData = {
      token: { access_token: "token", expiry_date: 123456 },
    };
    const claspJsonData = { scriptId: "my-script-id" };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(JSON.stringify(clasprcData))
      .mockReturnValueOnce(JSON.stringify(claspJsonData));
    mockSpawn({ status: 0 });

    uploadSecrets("owner/repo");

    expect(spawnSync).toHaveBeenCalledWith(
      "gh",
      ["secret", "set", "CLASPRC_JSON", "-R", "owner/repo"],
      expect.objectContaining({ input: expect.any(String) }),
    );
    expect(spawnSync).toHaveBeenCalledWith(
      "gh",
      ["secret", "set", "CLASP_JSON", "-R", "owner/repo"],
      expect.objectContaining({ input: expect.any(String) }),
    );
  });
});
```

**なぜ効率的か**: `runGhCommand` が内部で `spawnSync` を使用するため、`spawnSync` のみをモックすれば外部コマンドの実行を完全に制御できます。`mockSpawn` ヘルパーを使うことで、成功・失敗・エラーの各パターンを簡潔に記述できます。

---

## 4. 型定義と API リファレンスのハイライト (API Highlights)

### ClaspConfig

`~/.clasprc.json` のスキーマを表す型定義です。`verify` コマンドのバリデーションで使用されます。

```typescript
interface ClaspConfig {
  token: {
    access_token: string;
    refresh_token: string;
    scope: string;
    token_type: string;
    expiry_date: number;
  };
  oauth2ClientSettings: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
}
```

### ClaspProjectConfig

`.clasp.json` のスキーマを表す型定義です。`verify` コマンドの `--project-dir` 指定時に使用されます。

```typescript
interface ClaspProjectConfig {
  scriptId: string;
  rootDir?: string;
  projectId?: string;
  parentId?: string[];
}
```

### 主要な関数

| 関数 | 説明 | 引数 | 戻り値 |
|------|------|------|--------|
| `checkRepoAccess(repo)` | リポジトリの存在確認と push 権限チェック | `repo: string` (`owner/repo` 形式) | `{ exists: boolean; canPush: boolean; error?: string }` |
| `validateRepoAccess(repo)` | `checkRepoAccess` のラッパー。失敗時にエラーメッセージを出力 | `repo: string` | `boolean` |
| `uploadSecrets(repo, options?)` | `~/.clasprc.json` と `.clasp.json` を GitHub Secrets にアップロード | `repo: string`, `options?: { projectDir?: string }` | `void` |
| `deleteSecrets(repo)` | GitHub Secrets から `CLASPRC_JSON` と `CLASP_JSON` を削除 | `repo: string` | `void` |
| `validateClaspConfig(content)` | JSON 文字列が有効な `.clasprc.json` フォーマットかを検証 | `content: string` | `boolean` |
| `validateClaspProjectConfig(content)` | JSON 文字列が有効な `.clasp.json` フォーマットかを検証 | `content: string` | `boolean` |

### ユーティリティ関数

| 関数 | 説明 |
|------|------|
| `getClasprcPath()` | OS に応じた `~/.clasprc.json` のパスを返す。Windows では `USERPROFILE`、Linux/macOS では `HOME` 環境変数を使用 |
| `getClaspJsonPath(projectDir?)` | 指定ディレクトリ（デフォルト: cwd）の `.clasp.json` のパスを返す |
| `encodeToBase64(content)` | UTF-8 文字列を Base64 エンコード |
| `decodeFromBase64(encoded)` | Base64 文字列を UTF-8 デコード |
| `runGhCommand(args, input?)` | `gh` コマンドを `spawnSync` で安全に実行。シェルインジェクションを防ぐため引数を配列で渡す |

### Secret キー

```typescript
const SECRET_KEY = "CLASPRC_JSON";          // ~/.clasprc.json
const CLASP_JSON_SECRET_KEY = "CLASP_JSON"; // .clasp.json
```

---

## 5. よくある落とし穴と注意点 (Pitfalls & Troubleshooting)

### ❌ `gh: command not found` / `gh command missing`

**原因**: GitHub CLI (`gh`) がインストールされていない、または PATH に含まれていない。

**解決策**:

```bash
# macOS
brew install gh

# Windows
winget install --id GitHub.cli

# Linux
# https://cli.github.com/ を参照
```

インストール後、必ず `gh auth login` を実行してください。

### ❌ `No .clasprc.json found`

**原因**: `clasp login` が未実行のため、`~/.clasprc.json` が存在しない。

**解決策**:

```bash
npm install -g @google/clasp
clasp login
```

> [!WARNING]
> `.clasprc.json` のパスは OS によって異なります。
>
> - **Linux/macOS**: `$HOME/.clasprc.json`
> - **Windows**: `%USERPROFILE%\.clasprc.json`
>
> 環境変数 `HOME` / `USERPROFILE` が正しく設定されていることを確認してください。

### ❌ `Invalid .clasprc.json format`

**原因**: `.clasprc.json` に必須フィールドが欠けている。`verify` コマンドでは以下の 4 つのフィールドが検証されます。

- `token.access_token`
- `token.refresh_token`
- `oauth2ClientSettings.clientId`
- `oauth2ClientSettings.clientSecret`

**解決策**: `clasp login` を再実行して `.clasprc.json` を再生成してください。

### ❌ `Invalid .clasp.json format (scriptId is required)`

**原因**: `.clasp.json` に `scriptId` フィールドが存在しない。

**解決策**: `clasp create` または `clasp clone` を実行して正しい `.clasp.json` を生成してください。

### ❌ `Permission denied` / 権限エラー

**原因**: GitHub CLI で認証済みのアカウントが、対象リポジトリへの push 権限を持っていない。

**解決策**:

```bash
# 現在の認証状態を確認
gh auth status

# 必要に応じて再ログイン
gh auth login
```

リポジトリの Settings → Collaborators で適切な権限が付与されていることを確認してください。

### ❌ CI で `clasp push` が認証エラーになる

**原因**: 以下のいずれかが考えられます。

1. **Secret が未登録**: `clasp-auth list owner/repo` で確認
2. **トークンの有効期限切れ**: `clasp login` → `clasp-auth upload` でローテーション
3. **Action のバージョン不一致**: `uses: ciderjs/clasp-auth@v0.3.0` のように固定バージョンを指定
4. **入力名の誤り**: v0.3.0 以降は `json` ではなく `clasprc_json` を使用

### ⚠️ セキュリティに関する注意事項

| 注意点 | 推奨対策 |
|--------|----------|
| `.clasprc.json` には OAuth トークンが含まれる | **プライベートリポジトリ** での利用を推奨 |
| CI ログにトークンが露出するリスク | Workflow で `.clasprc.json` の内容を `echo` や `cat` しない |
| 認証情報の共有範囲 | `permissions` を明示的に最小限に設定する |
| トークンの有効期限 | 定期的に `clasp login` → `clasp-auth upload` でローテーション |
| ジョブ終了後の残存 | post アクションが自動削除するため追加対応不要（v0.3.0 以降） |
| ファイルの読み取り保護 | 復元ファイルは `0600` パーミッションで保護される（v0.3.0 以降） |

### ⚠️ GAS 特有の環境差異

- **ランタイムの違い**: clasp はローカルでは Node.js 上で動作しますが、デプロイ先は GAS ランタイム（V8）です。`clasp push` が成功しても、GAS ランタイムで利用できない Node.js API を使用している場合は実行時エラーになります
- **スクリプト ID の管理**: `.clasp.json`（スクリプト ID を含む設定ファイル）は `CLASP_JSON` シークレットで管理し、`clasp-auth upload` でアップロード・`clasp-auth@v0.3.0` の `clasp_json` 入力で復元できます
- **デプロイの冪等性**: `clasp push` は最新のソースコードで上書きするため、複数の CI ジョブが同時に走ると競合する可能性があります。ブランチ保護ルールやコンカレンシー制御の利用を推奨します

---

## 付録: CLI コマンド一覧

```text
@ciderjs/clasp-auth

Commands:
  upload <repo>    Upload local ~/.clasprc.json and .clasp.json credentials
                   to GitHub Secrets via `gh secret set`
  delete <repo>    Delete clasp-related GitHub Secrets from repository
                   (CLASPRC_JSON and CLASP_JSON)
  list <repo>      List clasp-related GitHub Secrets
  verify           Verify local .clasprc.json and .clasp.json are valid

Options:
  -v, --version    バージョンを表示
  -h, --help       ヘルプを表示

upload / delete 共通オプション:
  -y, --yes        確認プロンプトをスキップ

upload / verify 共通オプション:
  -p, --project-dir <path>   .clasp.json の探索ディレクトリ（デフォルト: cwd）
```
