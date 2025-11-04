import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    {
      input: 'src/cli',
      outDir: 'dist/cli',
      name: 'cli/index',
    },
  ],
  clean: true,
  declaration: false,
  rollup: {
    emitCJS: true,
    cjsBridge: true,
  },
  externals: ['@inquirer/prompts', 'commander'],
});
