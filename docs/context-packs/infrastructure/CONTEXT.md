# Infrastructure Context Pack

For work inside `infrastructure/` (AWS CDK TypeScript stacks).

## Scope

- Provisions API Gateway, Lambda API, DynamoDB tables, Step Functions, worker Lambda, S3 buckets, Cognito pools, alarms, and Shared VPC components.
- CDK app entry: `infrastructure/bin/app.ts`.
- Stacks live under `infrastructure/lib/*.ts` (api, auth, compute, database, monitoring, storage, worker, stepfunctions, utils).

## Commands

```bash
cd infrastructure
npm install

# Bootstrap if the account/region is new
cdk bootstrap

# See pending changes
cdk diff leadmagnet-compute

# Deploy individual stacks
cdk deploy leadmagnet-api
cdk deploy leadmagnet-compute

# Destroy when finished
cdk destroy leadmagnet-*    # confirm prompts
```

## Tips

- Runtime config shared between stacks lives under `lib/config/constants.ts`.
- Step Functions definitions are TypeScript files in `lib/stepfunctions/*`; update both `.ts` and generated `.d.ts`/`.js` outputs if you transpile.
- When adding environment variables, thread them through `lib/utils/environment-helpers.ts` so both API and worker stacks stay in sync.
- All stacks use the same context values defined in `infrastructure/cdk.json`; update them if you change account/region names.
- Keep an eye on IAM diff noise—`cdk diff --security-only` is helpful during reviews.
