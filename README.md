# @ciderjs/clasp-auth

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@ciderjs/clasp-auth.svg)](https://www.npmjs.com/package/@ciderjs/clasp-auth)
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-@ciderjs/clasp--auth-blue?logo=github)](https://github.com/marketplace/actions/setup-clasp-auth)
[![GitHub issues](https://img.shields.io/github/issues/luthpg/clasp-auth.svg)](https://github.com/luthpg/clasp-auth/issues)

Google Apps Script (GAS) を GitHub Actions で CI/CD するための **clasp 認証補助ツール**。  
ローカルで `clasp login` した認証情報を GitHub Secrets にアップロード／削除し、CI/CD 環境で `.clasprc.json` を自動生成します。

---

## ⚠️ Prerequisites

このツールを利用するには以下が必要です:

- **GitHub CLI (`gh`)**
  - [インストール](https://cli.github.com/) してください
  - `gh auth login` を実行し、GitHub にログインしておく必要があります

- **Google Apps Script CLI (`clasp`)**
  - [インストール](https://github.com/google/clasp) してください
  - `clasp login` を実行し、Google アカウントでログインしておく必要があります

- **注意事項**
  - CI/CD は **実行者の Google アカウント情報** を利用して行われます
  - Secrets をアップロードするリポジトリは十分に注意してください  
    （誤ったリポジトリにアップロードすると、意図しない環境で認証情報が利用される可能性があります）

---

## ✨ Features

- **CLI**
  - `upload`: ローカルの `~/.clasprc.json` を読み込み、JSON 文字列として GitHub Secrets (`CLASPRC_JSON`) にアップロード
  - `delete`: 登録済みの Secret (`CLASPRC_JSON`) を削除
  - `--yes` オプションで確認プロンプトをスキップ可能
  - 実行前に **リポジトリの存在確認** と **編集権限チェック** を自動で行う

- **GitHub Action**
  - Secrets (`CLASPRC_JSON`) から `.clasprc.json` を生成し、CI/CD 環境で `clasp push` を実行可能にする

---

## 📦 Installation

グローバルインストール:

```bash
npm install -g @ciderjs/clasp-auth
```

プロジェクトローカル:

```bash
npm install --save-dev @ciderjs/clasp-auth
```

---

## 🚀 Usage

### 1. Secrets をアップロード (CLI)

まずローカルで `clasp login` を実行し、`~/.clasprc.json` を生成します。  
その後、以下のコマンドで GitHub Secrets にアップロードします:

```bash
npx @ciderjs/clasp-auth upload <owner/repo>
```

例:

```bash
npx @ciderjs/clasp-auth upload ciderjs/city-gas
```

登録される Secret:

- `CLASPRC_JSON` … `.clasprc.json` の内容を JSON 文字列としてBase64エンコードし保存

---

### 2. Secrets を削除 (CLI)

登録済みの Secret を削除するには:

```bash
npx @ciderjs/clasp-auth delete <owner/repo>
```

確認プロンプトをスキップする場合:

```bash
npx @ciderjs/clasp-auth delete <owner/repo> --yes
```

---

### 3. GitHub Actions で利用 (Action)

Workflow 内で Secret をファイルに復元し、`clasp` が利用できるようにします。

```diff yaml
 name: Deploy GAS
 on:
   push:
     branches: [ "main" ]

 jobs:
   deploy:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
       - uses: actions/setup-node@v4
         with:
           node-version: 20
 
+      - name: Setup clasp auth
+        uses: ciderjs/clasp-auth@v0.1.3
+        with:
+          json: {{ secrets.CLASPRC_JSON }}

       - name: Install clasp
         run: npm install -g @google/clasp

       - name: Push to GAS
         run: clasp push
```

---

## 📖 Examples

### プライベートリポジトリで使用

```bash
# Secrets をアップロード
clasp-auth upload myorg/private-gas-project

# GitHub Actions で使用
# (workflow 例を参照)
```

### 複数プロジェクトの管理

```bash
# プロジェクトごとに異なるリポジトリにアップロード
clasp-auth upload myorg/project-a
clasp-auth upload myorg/project-b
```

---

## 🛠 Development

```bash
# ビルド
pnpm build

# テスト (Vitest)
pnpm test

# ローカルで CLI を試す
npm link
clasp-auth upload <owner/repo>
```

---

## 🔒 Security Considerations

- Secrets は 1 つ (`CLASPRC_JSON`) のみを利用するため、管理が容易
- `.clasprc.json` の内部構造変更にも強い
- 公開リポジトリではなくプライベートリポジトリでの利用を推奨
- Secrets を参照できるジョブを限定するために `permissions` を明示的に設定すること
- `.clasprc.json` の内容をログに出力しないこと
- 定期的に `clasp login` をやり直し、Secrets をローテーションすること

---

## 🔧 Troubleshooting

### `gh: command not found`

GitHub CLI がインストールされていません。[こちら](https://cli.github.com/)からインストールしてください。

### `No .clasprc.json found`

`clasp login` を実行して認証情報を生成してください。

### `Permission denied`

`gh auth login` を実行し、適切な権限でログインしてください。

### `Repository not found`

リポジトリ名が正しいか確認してください (形式: `owner/repo`)。

---

## 🔄 Release

- タグを手動で付与してリリースをトリガーします（例: `v0.1.0`）
- リリースノートは **GitHub の自動生成ノート** を利用
- npm publish は CI により実行されます（`NPM_TOKEN` が必要）

---

## 📄 License

MIT
