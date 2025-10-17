# AWS Amplify Setup Guide

## 🚀 Deploy Frontend to Production with AWS Amplify

### Option 1: AWS Console (Recommended)

1. **Navigate to AWS Amplify Console:**
   https://console.aws.amazon.com/amplify/home?region=us-east-1

2. **Create New App:**
   - Click "New app" → "Host web app"
   - Select "GitHub"
   - Authorize GitHub access (one-time)
   - Select repository: `grandcanyonsmith/lead-magnet-ai-platform`
   - Branch: `main`

3. **Configure Build Settings:**
   - App name: `lead-magnet-ai-frontend`
   - Environment: Production
   - Build settings will auto-detect from `amplify.yml`

4. **Add Environment Variables:**
   Click "Environment variables" and add:
   ```
   NEXT_PUBLIC_API_URL=https://czp5b77azd.execute-api.us-east-1.amazonaws.com
   NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_asu0YOrBD
   NEXT_PUBLIC_COGNITO_CLIENT_ID=4lb3j8kqfvfgkvfeb4h4naani5
   NEXT_PUBLIC_AWS_REGION=us-east-1
   ```

5. **Deploy:**
   - Click "Save and deploy"
   - Wait ~5 minutes for deployment
   - Get production URL (e.g., `https://main.xxxxx.amplifyapp.com`)

6. **Update Cognito Callback URLs:**
   ```bash
   aws cognito-idp update-user-pool-client \
     --user-pool-id us-east-1_asu0YOrBD \
     --client-id 4lb3j8kqfvfgkvfeb4h4naani5 \
     --callback-urls "http://localhost:3000/auth/callback" "http://localhost:3002/auth/callback" "https://YOUR-AMPLIFY-URL/auth/callback" \
     --logout-urls "http://localhost:3000/" "http://localhost:3002/" "https://YOUR-AMPLIFY-URL/"
   ```

---

### Option 2: AWS CLI (Alternative)

**Prerequisites:**
- GitHub Personal Access Token with repo permissions

**Steps:**

1. **Create GitHub Token:**
   - Go to: https://github.com/settings/tokens
   - Generate new token (classic)
   - Select scopes: `repo`, `admin:repo_hook`
   - Copy token

2. **Create Amplify App:**
   ```bash
   GITHUB_TOKEN="your_github_token_here"
   
   aws amplify create-app \
     --name lead-magnet-ai-frontend \
     --repository https://github.com/grandcanyonsmith/lead-magnet-ai-platform \
     --platform WEB \
     --oauth-token "$GITHUB_TOKEN" \
     --environment-variables \
       NEXT_PUBLIC_API_URL=https://czp5b77azd.execute-api.us-east-1.amazonaws.com \
       NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_asu0YOrBD \
       NEXT_PUBLIC_COGNITO_CLIENT_ID=4lb3j8kqfvfgkvfeb4h4naani5 \
       NEXT_PUBLIC_AWS_REGION=us-east-1
   ```

3. **Create Branch:**
   ```bash
   APP_ID=$(aws amplify list-apps --query 'apps[?name==`lead-magnet-ai-frontend`].appId' --output text)
   
   aws amplify create-branch \
     --app-id $APP_ID \
     --branch-name main \
     --enable-auto-build
   ```

4. **Start Deployment:**
   ```bash
   aws amplify start-job \
     --app-id $APP_ID \
     --branch-name main \
     --job-type RELEASE
   ```

---

### Option 3: Use Existing CloudFront (Current Setup)

The frontend is already in S3 and can be accessed via CloudFront.

**Current Setup:**
- S3 Bucket: `leadmagnet-artifacts-471112574622`
- CloudFront: `dmydkyj79auy7.cloudfront.net`
- Deployed Path: `/app/`

**To update:**
```bash
cd frontend
npm run build
aws s3 sync out/ s3://leadmagnet-artifacts-471112574622/app/ --delete
aws cloudfront create-invalidation --distribution-id E1GPKD58HXUDIV --paths "/app/*"
```

**Access:**
https://dmydkyj79auy7.cloudfront.net/app/

---

## 🔧 Post-Deployment Configuration

### Update Cognito Callback URLs

Once you have your Amplify URL, update Cognito:

```bash
AMPLIFY_URL="https://main.xxxxx.amplifyapp.com"  # Replace with your URL

aws cognito-idp update-user-pool-client \
  --user-pool-id us-east-1_asu0YOrBD \
  --client-id 4lb3j8kqfvfgkvfeb4h4naani5 \
  --callback-urls \
    "http://localhost:3000/auth/callback" \
    "http://localhost:3002/auth/callback" \
    "${AMPLIFY_URL}/auth/callback" \
  --logout-urls \
    "http://localhost:3000/" \
    "http://localhost:3002/" \
    "${AMPLIFY_URL}/" \
  --allowed-o-auth-flows authorization_code_grant \
  --allowed-o-auth-scopes openid email profile \
  --supported-identity-providers COGNITO
```

---

## ✅ Verification

### Test Production Frontend

1. **Access Amplify URL**
2. **Login with credentials:**
   - Email: test@example.com
   - Password: TestPass123!
3. **Verify all features work**
4. **Check browser console for errors**

### Expected Result
- ✅ Login works
- ✅ Dashboard loads
- ✅ All pages accessible
- ✅ Data loads from backend
- ✅ No CORS errors

---

## 🎯 Recommendation

**Best Option:** Use AWS Amplify (Option 1) because:
- ✅ Automatic deployments on git push
- ✅ Preview deployments for PRs
- ✅ Built-in SSL/TLS
- ✅ Global CDN
- ✅ Easy custom domain setup
- ✅ Free tier available

**Current Option:** CloudFront works but requires manual updates

---

## 📝 Next Steps

1. Choose deployment option above
2. Deploy frontend to production
3. Test production URL
4. Update documentation with production URL
5. Configure custom domain (optional)

---

**Status:** GitHub repo created ✅  
**Repository:** https://github.com/grandcanyonsmith/lead-magnet-ai-platform  
**Ready for:** Amplify deployment or CloudFront configuration

