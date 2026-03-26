# Terraform Deployment

This folder provisions the AWS resources required for Incentra.

## Provisioned Resources

- S3 buckets for uploads and assets
- CloudFront distribution for playback delivery
- DynamoDB tables for application data
- Lambda function for the API
- HTTP API Gateway
- IAM roles and policies

## Backend Source

Terraform packages the backend built from:

- [backend/src/index.ts](C:/Users/pc/Documents/New%20project/backend/src/index.ts)

Build output must exist before deploy:

- `backend/dist/index.js`

## 1. Connect AWS

Choose one of these approaches before running Terraform.

### Option A: AWS CLI profile

```bash
aws configure --profile default
```

Then in `terraform.tfvars`:

```hcl
aws_profile = "default"
```

### Option B: Environment variables

```bash
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-south-1
```

If you use this method, leave `aws_profile = ""`.

## 2. Build the Lambda

From the project root:

```powershell
Set-Location backend
npm.cmd install
npm.cmd run build
Set-Location ..
```

## 3. Configure Terraform

Copy the example file:

```powershell
Set-Location terraform
Copy-Item terraform.tfvars.example terraform.tfvars
```

Edit at least:

- `aws_region`
- `aws_profile`
- `project_name`
- `environment`
- `frontend_origin`
- any model/API env vars used by the backend

For local frontend testing:

```hcl
frontend_origin = "http://localhost:3000"
```

## 4. Deploy

```powershell
terraform init
terraform plan
terraform apply
```

## 5. Connect the Frontend

After `terraform apply`, use the Terraform outputs to populate `.env.local` in the frontend:

```powershell
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_API_BASE_URL=<api_base_url>
NEXT_PUBLIC_CLOUDFRONT_BASE_URL=<cloudfront_base_url>
```

Then run:

```powershell
npm.cmd run dev
```

## 6. Current Backend Responsibilities

The deployed Lambda currently covers:

- auth login and Google auth
- video CRUD
- upload URL generation
- subtitle analysis
- subtitle reanalysis/reset
- companion chat
- comments and reactions
- admin stats

## 7. CORS / Frontend Origin

When the frontend origin changes, update `frontend_origin` and re-apply:

```powershell
terraform apply
```

This is required when moving from localhost to Vercel or another production domain.

## Notes

- This setup is optimized for a single-Lambda MVP, not a large microservice split.
- The backend depends on a successful build before deploy.
- Subtitle-aware features require the backend environment to include the active Gemini configuration.
