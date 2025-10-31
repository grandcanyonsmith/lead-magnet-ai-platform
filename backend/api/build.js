const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'bundle/index.js',
  external: ['aws-sdk'], // Only externalize AWS SDK v2, bundle v3
  minify: true,
  sourcemap: true,
}).then(() => {
  // Copy bundle/index.js to index.js for Lambda handler
  const bundlePath = path.join(__dirname, 'bundle', 'index.js');
  const targetPath = path.join(__dirname, 'index.js');
  fs.copyFileSync(bundlePath, targetPath);
  console.log('Bundled and copied to index.js');
}).catch(() => process.exit(1));

