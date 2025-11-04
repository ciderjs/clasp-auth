import { confirm } from '@inquirer/prompts';
import { Command } from 'commander';
import pkgJson from '../package.json';
import { checkRepoAccess, deleteSecrets, uploadSecrets } from './uploadSecrets';

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
    const { exists, canPush } = checkRepoAccess(repo);

    if (!exists) {
      console.error(`❌ リポジトリ "${repo}" は存在しません。`);
      process.exit(1);
    }
    if (!canPush) {
      console.error(`❌ リポジトリ "${repo}" に対する編集権限がありません。`);
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
    const { exists, canPush } = checkRepoAccess(repo);
    if (!exists) {
      console.error(`❌ リポジトリ "${repo}" は存在しません。`);
      process.exit(1);
    }
    if (!canPush) {
      console.error(`❌ リポジトリ "${repo}" に対する編集権限がありません。`);
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

program.parse(process.argv);
