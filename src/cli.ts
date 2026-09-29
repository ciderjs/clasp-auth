import { existsSync, readFileSync } from 'node:fs';
import { confirm } from '@inquirer/prompts';
import { Command } from 'commander';
import pkgJson from '../package.json';
import {
  CLASP_JSON_SECRET_KEY,
  deleteSecrets,
  SECRET_KEY,
  uploadSecrets,
  validateRepoAccess,
} from './uploadSecrets';
import { getClaspJsonPath, getClasprcPath, runGhCommand } from './utils';
import { validateClaspConfig, validateClaspProjectConfig } from './validation';

const program = new Command();

program
  .name(pkgJson.name)
  .description(pkgJson.description)
  .version(pkgJson.version, '-v, --version');

program
  .command('upload')
  .argument('<repo>', 'GitHub repository (owner/repo)')
  .option('-y, --yes', 'Skip confirmation prompt')
  .option(
    '-p, --project-dir <path>',
    'Path to directory containing .clasp.json (defaults to cwd)',
  )
  .description(
    'Upload local ~/.clasprc.json and .clasp.json credentials to GitHub Secrets via `gh secret set`',
  )
  .action(
    async (repo: string, options: { yes?: boolean; projectDir?: string }) => {
      const isValid = validateRepoAccess(repo);
      if (!isValid) {
        process.exit(1);
      }

      if (!options.yes) {
        const ok = await confirm({
          message: `対象のリポジトリは "${repo}" です。実行してよいですか？`,
          default: false,
        });
        if (!ok) {
          console.log('キャンセルしました。');
          process.exit(0);
        }
      }

      uploadSecrets(repo, { projectDir: options.projectDir });
    },
  );

program
  .command('delete')
  .argument('<repo>', 'GitHub repository (owner/repo)')
  .option('-y, --yes', 'Skip confirmation prompt')
  .description('Delete clasp-related GitHub Secrets from repository')
  .action(async (repo: string, options: { yes?: boolean }) => {
    const isValid = validateRepoAccess(repo);
    if (!isValid) {
      process.exit(1);
    }

    if (!options.yes) {
      const ok = await confirm({
        message: `対象のリポジトリ "${repo}" から Secrets を削除してよいですか？`,
        default: false,
      });
      if (!ok) {
        console.log('キャンセルしました。');
        process.exit(0);
      }
    }

    deleteSecrets(repo);
  });

program
  .command('list')
  .argument('<repo>', 'GitHub repository (owner/repo)')
  .description('List clasp-related GitHub Secrets')
  .action(async (repo: string) => {
    try {
      const isValid = validateRepoAccess(repo);
      if (!isValid) {
        process.exit(1);
      }

      const output = runGhCommand([
        'secret',
        'list',
        '-R',
        repo,
        '--json',
        'name',
      ]);

      const secrets: Array<{ name: string; [key: string]: string }> =
        JSON.parse(output);
      const claspSecretKeys = [SECRET_KEY, CLASP_JSON_SECRET_KEY];
      const claspSecrets = secrets.filter((s) =>
        claspSecretKeys.includes(s.name),
      );

      if (claspSecrets.length > 0) {
        console.log('✅ Found clasp secrets:');
        for (const claspSecret of claspSecrets) {
          console.log(`  - ${claspSecret.name}`);
        }
      } else {
        console.log('ℹ️  No clasp secrets found');
      }
    } catch (e) {
      console.error('❌ Failed to list secrets');
      if (process.env.DEBUG) console.error(e);
    }
  });

program
  .command('verify')
  .option(
    '-p, --project-dir <path>',
    'Path to directory containing .clasp.json (defaults to cwd)',
  )
  .description('Verify local .clasprc.json and .clasp.json are valid')
  .action((options: { projectDir?: string }) => {
    // .clasprc.json のバリデーション
    const clasprcPath = getClasprcPath();

    if (!existsSync(clasprcPath)) {
      console.error('❌ No .clasprc.json found');
      process.exit(1);
    }

    const clasprcContent = readFileSync(clasprcPath, 'utf8');
    if (!validateClaspConfig(clasprcContent)) {
      console.error('❌ Invalid .clasprc.json format');
      process.exit(1);
    }

    console.log('✅ .clasprc.json is valid');

    // .clasp.json のバリデーション
    const claspJsonPath = getClaspJsonPath(options.projectDir);

    if (!existsSync(claspJsonPath)) {
      console.log('ℹ️  No .clasp.json found, skipping validation');
      return;
    }

    const claspJsonContent = readFileSync(claspJsonPath, 'utf8');
    if (!validateClaspProjectConfig(claspJsonContent)) {
      console.error('❌ Invalid .clasp.json format (scriptId is required)');
      process.exit(1);
    }

    console.log('✅ .clasp.json is valid');
  });

program.parse(process.argv);
