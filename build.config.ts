import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig([
  {
    entries: ['src/cli'],
    outDir: 'dist',
    clean: true,
    declaration: false,
    rollup: {
      emitCJS: true,
      cjsBridge: true,
    },
    externals: ['@inquirer/prompts', 'commander'],
  },
  {
    entries: ['src/action/main', 'src/action/post'],
    outDir: 'dist',
    clean: false,
    declaration: false,
    rollup: {
      emitCJS: false,
    },
    externals: [],
  },
]);
