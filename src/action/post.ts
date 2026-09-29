import { existsSync, unlinkSync } from 'node:fs';
import * as core from '@actions/core';

function cleanup(): void {
  try {
    const clasprcPath = core.getState('clasprc_path');
    if (clasprcPath && existsSync(clasprcPath)) {
      unlinkSync(clasprcPath);
      core.info(`🗑️ Cleaned up ${clasprcPath}`);
    }

    const claspJsonPath = core.getState('clasp_json_path');
    if (claspJsonPath && existsSync(claspJsonPath)) {
      unlinkSync(claspJsonPath);
      core.info(`🗑️ Cleaned up ${claspJsonPath}`);
    }
  } catch (error) {
    // post アクションでの失敗はワークフロー全体を失敗にしない
    if (error instanceof Error) {
      core.warning(`Failed to clean up: ${error.message}`);
    }
  }
}

cleanup();
