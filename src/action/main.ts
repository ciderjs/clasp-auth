import { chmodSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as core from '@actions/core';

function run(): void {
  try {
    // .clasprc.json の復元
    const clasprcJson = core.getInput('clasprc_json', { required: true });
    const clasprcPath = join(homedir(), '.clasprc.json');
    const clasprcDecoded = Buffer.from(clasprcJson, 'base64').toString('utf8');
    writeFileSync(clasprcPath, clasprcDecoded, 'utf8');
    chmodSync(clasprcPath, 0o600);
    core.info(`✅ Restored .clasprc.json to ${clasprcPath}`);

    // 復元したパスを state に保存（post アクションで削除するため）
    core.saveState('clasprc_path', clasprcPath);

    // .clasp.json の復元（optional）
    const claspJson = core.getInput('clasp_json');
    if (claspJson) {
      const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
      const claspJsonPath = join(workspace, '.clasp.json');
      const claspJsonDecoded = Buffer.from(claspJson, 'base64').toString(
        'utf8',
      );
      writeFileSync(claspJsonPath, claspJsonDecoded, 'utf8');
      chmodSync(claspJsonPath, 0o600);
      core.info(`✅ Restored .clasp.json to ${claspJsonPath}`);

      core.saveState('clasp_json_path', claspJsonPath);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

run();
