const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'bundle/index.js',
  external: ['aws-sdk', '@aws-sdk/*'], // Externalize AWS SDK (provided by Lambda runtime)
  minify: false, // Don't minify for easier debugging
  sourcemap: false,
  format: 'cjs', // Ensure CommonJS format for Lambda
}).then(() => {
  // Copy bundle/index.js to index.js for Lambda handler
  const bundlePath = path.join(__dirname, 'bundle', 'index.js');
  const targetPath = path.join(__dirname, 'index.js');
  fs.copyFileSync(bundlePath, targetPath);
  console.log('✅ Bundled and copied to index.js');
  
  // Create deployment package with AWS SDK dependencies
  const zipPath = path.join(__dirname, 'api-bundle.zip');
  try {
    // Remove old zip if it exists
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    
    // Create zip with bundled index.js and only AWS SDK dependencies
    execSync(`cd ${__dirname} && zip -r api-bundle.zip index.js node_modules/@aws-sdk 2>/dev/null || zip -r api-bundle.zip index.js`, { stdio: 'inherit' });
    console.log('✅ Created deployment package: api-bundle.zip');
  } catch (error) {
    console.error('❌ Failed to create deployment package:', error.message);
  }
}).catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});

