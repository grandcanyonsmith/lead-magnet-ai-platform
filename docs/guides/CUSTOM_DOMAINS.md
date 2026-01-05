# Custom Domains (Per Account)

This platform supports **per-tenant custom domains** for public form URLs (e.g. `https://forms.yourdomain.com/v1/forms/<slug>`). This lets a single tenant (account) use a branded domain without changing the default CloudFront URL used by everyone else.

## What “per account” means

- **CloudFront**: You attach one or more custom hostnames to the shared CloudFront distribution (alternate domain names + TLS certificate).
- **App settings**: Only the tenant whose **Settings → Custom Domain** matches the request origin will be served on that hostname (other tenants’ forms are blocked on that hostname).

## Recommended setup

Use **two subdomains**:

- `forms.mycoursecreator360.com` for public forms
- `assets.mycoursecreator360.com` for lead magnet output (HTML/images)

Using the apex/root (`mycoursecreator360.com`) will point the entire domain at the platform, which usually conflicts with an existing marketing site.

## Option A (recommended): Bring your own ACM certificate

1. **Request an ACM certificate in `us-east-1`** (required for CloudFront).
   - Include the domain(s) you want (e.g. `forms.mycoursecreator360.com` and `assets.mycoursecreator360.com`).
   - Validate via DNS.

2. **Deploy CDK with env vars set**:

   - `CLOUDFRONT_CUSTOM_DOMAIN_NAMES` (comma-separated)
   - `CLOUDFRONT_CUSTOM_CERTIFICATE_ARN` (ACM cert ARN in `us-east-1`)
   - `CLOUDFRONT_DOMAIN` (set this to your **assets** hostname so generated lead-magnet URLs use it)

   Example:

   - `CLOUDFRONT_CUSTOM_DOMAIN_NAMES=forms.mycoursecreator360.com,assets.mycoursecreator360.com`
   - `CLOUDFRONT_CUSTOM_CERTIFICATE_ARN=arn:aws:acm:us-east-1:...`
   - `CLOUDFRONT_DOMAIN=assets.mycoursecreator360.com`

3. **DNS**:
   - For a subdomain (like `forms.*` or `assets.*`), create a **CNAME** pointing to your CloudFront distribution domain (the `DistributionDomainName` stack output).
   - For an apex domain, use **A/AAAA ALIAS/ANAME** to CloudFront (provider-specific), or Route53 alias.

4. In the dashboard, for the target tenant:
   - Go to **Settings → Delivery → Custom Domain**
   - Set it to `https://forms.mycoursecreator360.com`

## Cloudflare DNS (your case)

In Cloudflare → **DNS**:

1. Create a **CNAME** record:
   - **Name**: `forms`
   - **Target**: `<your DistributionDomainName>` (looks like `d123abc.cloudfront.net`)
   - **Proxy status**: start with **DNS only** (recommended). If you later proxy it, use **SSL/TLS = Full (strict)**.

2. Create a **CNAME** record:
   - **Name**: `assets`
   - **Target**: `<your DistributionDomainName>` (same CloudFront domain)
   - **Proxy status**: same as above

3. ACM validation (Cloudflare):
   - When ACM shows DNS validation records, add the provided **CNAME** record(s) in Cloudflare exactly as shown.

## Option B: Route53 automation (certificate + DNS records)

If the domain is hosted in Route53, CDK can auto-create:

- A DNS-validated ACM certificate (in `us-east-1`)
- Route53 **A/AAAA alias** records pointing to CloudFront

Set:

- `CLOUDFRONT_CUSTOM_DOMAIN_NAMES`
- `ROUTE53_HOSTED_ZONE_ID`
- `ROUTE53_HOSTED_ZONE_NAME` (e.g. `mycoursecreator360.com`)

Then deploy your stacks.

## Troubleshooting

- **SSL certificate mismatch**: CloudFront does not have your domain attached, or the certificate doesn’t include the hostname.
- **Form works on CloudFront but not on custom domain**: The tenant’s **Settings → Custom Domain** must match the origin exactly (including `https://` and any `www`).
- **Forms work on `forms.*` but not on `assets.*`**: this is expected if the tenant custom domain is set to the forms domain — the API intentionally blocks serving forms from other hostnames.

