# Building Lambda Worker Without Docker

## Option 1: Use CDK with Docker (Current - Requires Docker)

CDK will automatically use Docker to build the Lambda package when you run `cdk deploy`.

**Pros:**
- Automatic - CDK handles everything
- Ensures Linux-compatible binaries
- Works in CI/CD pipelines

**Cons:**
- Requires Docker to be installed and running
- Slower builds (Docker overhead)

## Option 2: Build Package Manually (No Docker Required)

Use the provided script to build the package locally:

```bash
./scripts/build-lambda-worker.sh
```

This creates `/tmp/lambda-deployment.zip` which you can deploy directly:

```bash
aws lambda update-function-code \
  --function-name leadmagnet-compute-JobProcessorLambda4949D7F4-kqmEYYCZ4wa9 \
  --zip-file fileb:///tmp/lambda-deployment.zip \
  --region us-east-1
```

**Pros:**
- No Docker required
- Faster builds
- Works on any platform

**Cons:**
- Manual step
- Must rebuild when dependencies change
- Uses `--only-binary=:all:` which requires pre-built wheels

## Option 3: Disable CDK Bundling (Use Pre-built Package)

If you've already built the package, you can point CDK to use it directly:

```typescript
// In compute-stack.ts
code: lambda.Code.fromAsset('../backend/worker/lambda-package.zip'),
```

Then build the package before deploying:

```bash
./scripts/build-lambda-worker.sh
cp /tmp/lambda-deployment.zip backend/worker/lambda-package.zip
cdk deploy
```

## Recommendation

**For Local Development:**
- Use Option 2 (manual build script) - faster and no Docker needed

**For CI/CD:**
- Use Option 1 (CDK with Docker) - fully automated

**For Quick Updates:**
- Use Option 2 + direct Lambda update - fastest for code changes

The script uses `--only-binary=:all:` which means it only installs pre-built wheels. All your dependencies (boto3, openai, jinja2, markdown, etc.) have pre-built wheels available, so this works perfectly without Docker!

