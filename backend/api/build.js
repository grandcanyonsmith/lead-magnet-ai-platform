const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'bundle/index.js',
  external: ['aws-sdk', '@aws-sdk/*'],
  minify: true,
  sourcemap: true,
}).catch(() => process.exit(1));

