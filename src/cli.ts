import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { confirm } from '@inquirer/prompts';
import { Command } from 'commander';
import pkgJson from '../package.json';
import {
  deleteSecrets,
  uploadSecrets,
  validateRepoAccess,
} from './uploadSecrets';
import { getClasprcPath } from './utils';
import { validateClaspConfig } from './validation';

const program = new Command();

program
  .name(pkgJson.name)
  .description(pkgJson.description)
  .version(pkgJson.version, '-v, --version');

program
  .command('upload')
  .argument('<repo>', 'GitHub repository (owner/repo)')
  .option('-y, --yes', 'Skip confirmation prompt')
  .description(
    'Upload local ~/.clasprc.json credentials to GitHub Secrets via `gh secret set`',
  )
  .action(async (repo: string, options: { yes?: boolean }) => {
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

    uploadSecrets(repo);
  });

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

      const output = execSync(`gh secret list -R ${repo} --json name`, {
        encoding: 'utf-8',
      });
      const secrets: Array<{ name: string; [key: string]: string }> =
        JSON.parse(output);
      const claspSecrets = secrets.filter((s) => s.name === 'CLASPRC_JSON');

      if (claspSecrets.length > 0) {
        console.log('✅ Found clasp secrets:');
        for (const claspSecret of claspSecrets) {
          console.log(`  - ${claspSecret.name}`);
        }
      } else {
        console.log('ℹ️  No clasp secrets found');
      }
    } catch {
      console.error('❌ Failed to list secrets');
    }
  });

program
  .command('verify')
  .description('Verify local .clasprc.json is valid')
  .action(() => {
    const clasprcPath = getClasprcPath();

    if (!existsSync(clasprcPath)) {
      console.error('❌ No .clasprc.json found');
      process.exit(1);
    }

    const content = readFileSync(clasprcPath, 'utf8');
    if (!validateClaspConfig(content)) {
      console.error('❌ Invalid .clasprc.json format');
      process.exit(1);
    }

    console.log('✅ .clasprc.json is valid');
  });

program.parse(process.argv);
