import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    {
      input: 'src/action',
      outDir: 'dist/action',
      name: 'action/index',
    },
  ],
  clean: true,
  declaration: false,
  rollup: {
    inlineDependencies: true,
    emitCJS: true,
    cjsBridge: true,
  },
});
