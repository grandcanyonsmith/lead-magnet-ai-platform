# Quick GitHub Secrets Setup (Access Keys)

## Quick Setup Steps

### 1. Create IAM User and Access Keys

```bash
# Create IAM user
aws iam create-user --user-name github-actions-deploy

# Attach policies
aws iam attach-user-policy --user-name github-actions-deploy --policy-arn arn:aws:iam::aws:policy/AWSLambda_FullAccess
aws iam attach-user-policy --user-name github-actions-deploy --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
aws iam attach-user-policy --user-name github-actions-deploy --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam attach-user-policy --user-name github-actions-deploy --policy-arn arn:aws:iam::aws:policy/CloudFrontFullAccess
aws iam attach-user-policy --user-name github-actions-deploy --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess
aws iam attach-user-policy --user-name github-actions-deploy --policy-arn arn:aws:iam::aws:policy/PowerUserAccess

# Create access key
aws iam create-access-key --user-name github-actions-deploy
```

**Save the `AccessKeyId` and `SecretAccessKey` from the output!**

### 2. Get Your Resource Values

```bash
# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account ID: $ACCOUNT_ID"

# Get S3 bucket (adjust pattern as needed)
aws s3 ls | grep leadmagnet

# Get CloudFront Distribution ID
aws cloudfront list-distributions --query "DistributionList.Items[*].[Id,Comment]" --output table

# Get Cognito User Pool ID
aws cognito-idp list-user-pools --max-results 10 --query "UserPools[*].[Id,Name]" --output table
```

### 3. Add GitHub Secrets

Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions`

Click **"New repository secret"** and add:

| Secret Name | Value | Where to Find |
|------------|-------|---------------|
| `AWS_ACCESS_KEY_ID` | From step 1 | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | From step 1 | IAM user secret key |
| `API_URL` | `https://czp5b77azd.execute-api.us-east-1.amazonaws.com` | Your API Gateway URL |
| `COGNITO_USER_POOL_ID` | `us-east-1_asu0YOrBD` | Cognito console |
| `COGNITO_CLIENT_ID` | `4lb3j8kqfvfgkvfeb4h4naani5` | Cognito console |
| `FRONTEND_BUCKET` | From step 2 | S3 console or infrastructure |
| `CLOUDFRONT_DISTRIBUTION_ID` | From step 2 | CloudFront console |

### 4. Update Workflows

I've created updated workflow files that support access keys. They're in `.github/workflows/` with `-access-key.yml` suffix.

Or manually update each workflow file - replace this section:

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    aws-region: ${{ env.AWS_REGION }}
```

With this:

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: ${{ env.AWS_REGION }}
```

### 5. Test

1. Go to **Actions** tab in GitHub
2. Select a workflow (e.g., "Deploy API Lambda")
3. Click **Run workflow**
4. Check if it runs successfully

---

## Alternative: Use OIDC (More Secure)

See `GITHUB_SECRETS_SETUP.md` for OIDC setup instructions (recommended for production).

