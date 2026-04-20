# Environment Variables Validation & Reference

## .env File Template

Create a `.env` file in the project root with these exact variables:

```env
# ============================================
# AWS Configuration
# ============================================
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# ============================================
# DynamoDB Table Names
# ============================================
DDB_EMPLOYEE_TABLE=sentinel-employees
DDB_TELEMETRY_TABLE=sentinel-telemetry
DDB_SETTINGS_TABLE=sentinel-settings

# ============================================
# Backend Configuration
# ============================================
BACKEND_PORT=4000
TELEMETRY_API_URL=https://76ezf3ssob.execute-api.eu-north-1.amazonaws.com/apistage/data

# ============================================
# Frontend Configuration
# ============================================
VITE_BACKEND_API_URL=http://localhost:8080/api
VITE_EMPLOYEE_ID=EMP001
```

---

## Variable Reference

### AWS Credentials

| Variable | Value | Example | Notes |
|----------|-------|---------|-------|
| `AWS_REGION` | AWS region | `eu-north-1` | ✅ Must be eu-north-1 |
| `AWS_ACCESS_KEY_ID` | IAM user key | `AKIA...` | ⚠️ Keep secret! |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret | `wJal...` | ⚠️ Keep secret! |

### DynamoDB Tables

| Variable | Value | Purpose |
|----------|-------|---------|
| `DDB_EMPLOYEE_TABLE` | `sentinel-employees` | Employee/worker records |
| `DDB_TELEMETRY_TABLE` | `sentinel-telemetry` | Sensor data points |
| `DDB_SETTINGS_TABLE` | `sentinel-settings` | Threshold configurations |

### Backend

| Variable | Value | Purpose |
|----------|-------|---------|
| `BACKEND_PORT` | `4000` | Express.js server port |
| `TELEMETRY_API_URL` | AWS API URL | External telemetry source |

### Frontend

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_BACKEND_API_URL` | `http://localhost:8080/api` | Backend API endpoint (dev proxy) |
| `VITE_EMPLOYEE_ID` | `EMP001` | Default monitored employee |

---

## Step-by-Step Setup

### 1. Get Credentials from AWS

**Path:** AWS Console → IAM → Users → sentinel-dynamodb-user

```
Copy these values:
├─ Access Key ID: AKIA... (copy to AWS_ACCESS_KEY_ID)
└─ Secret Access Key: wJal... (copy to AWS_SECRET_ACCESS_KEY)
```

### 2. Create .env File

**Windows (PowerShell):**
```powershell
cd c:\Users\USER\sentinel-site
echo 'AWS_REGION=eu-north-1' > .env
echo 'AWS_ACCESS_KEY_ID=AKIA...' >> .env
echo 'AWS_SECRET_ACCESS_KEY=wJal...' >> .env
# ... add other variables
```

**macOS/Linux (Bash):**
```bash
cd /path/to/sentinel-site
cat > .env << 'EOF'
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJal...
# ... add other variables
EOF
```

**Text Editor:**
1. Open: `c:\Users\USER\sentinel-site\.env`
2. Paste: All variables from template above
3. Replace: `AKIA...` and `wJal...` with actual values
4. Save

### 3. Verify .env File

**Check file exists:**
```bash
ls -la .env      # macOS/Linux
dir .env         # Windows
```

**Check content:**
```bash
cat .env         # macOS/Linux
type .env        # Windows PowerShell
```

**Verify important values are present:**
```bash
# Should show your access key
grep AWS_ACCESS_KEY_ID .env

# Should show your secret key (first 10 chars)
grep AWS_SECRET_ACCESS_KEY .env

# Should show table names
grep DDB_ .env
```

### 4. Add to .gitignore

**File:** `.gitignore`

```
# At top of file, add:
.env
.env.local
.env.*.local
```

**Verify:**
```bash
git status .env
# Should show: not in working tree (means it's ignored ✓)
```

---

## Validation Checklist

### ✅ AWS Credentials

```bash
# Test 1: File exists
test -f .env && echo "✓ .env file exists" || echo "✗ .env NOT found"

# Test 2: Credentials are set
grep AWS_ACCESS_KEY_ID .env | grep -v "AKIA" && echo "✗ Access key not replaced" || echo "✓ Access key looks valid"

# Test 3: Can reach AWS
aws sts get-caller-identity
# Expected: Returns JSON with UserId, Account, Arn

# Test 4: Can list DynamoDB tables
aws dynamodb list-tables --region eu-north-1
# Expected: Returns { "TableNames": ["sentinel-employees", ...] }
```

### ✅ Backend Configuration

```bash
# Test 5: Backend starts
npm run backend:dev &
# Expected: "Sentinel backend listening on http://localhost:4000"

# Test 6: Backend can connect to DynamoDB
curl http://localhost:4000/health
# Expected: { "status": "ok", "dynamodb": "connected" }

# Test 7: Backend can query DynamoDB
curl "http://localhost:4000/api/bootstrap?employeeId=EMP001"
# Expected: { "workers": [...], "alerts": [...], ... }
```

### ✅ Frontend Configuration

```bash
# Test 8: Frontend starts
npm run dev &
# Expected: "Local: http://localhost:8080"

# Test 9: Frontend can reach backend
# Open browser: http://localhost:8080
# Open DevTools → Network tab
# Look for: GET request to /api/bootstrap
# Expected: Status 200 (not 404 or CORS error)

# Test 10: Can login
# Email: admin@safeguard.io
# Password: Admin@123
# Expected: Dashboard loads with data
```

---

## Common Issues & Fixes

### Issue 1: "AWS_REGION not found"

**Problem:**
```
Error: AWS_REGION environment variable not set
```

**Fix:**
```bash
# Check .env has the line
grep AWS_REGION .env

# If missing, add it
echo "AWS_REGION=eu-north-1" >> .env

# Restart backend
npm run backend:dev
```

### Issue 2: "AWS_ACCESS_KEY_ID not set"

**Problem:**
```
Error: The AWS Access Key ID you provided does not exist
```

**Fix:**
```bash
# Check value in .env
grep AWS_ACCESS_KEY_ID .env

# Should NOT show: AKIA... (literal value!)
# Should show your actual key starting with AKIA

# If wrong, update .env with actual key from AWS Console
```

### Issue 3: "DynamoDB table does not exist"

**Problem:**
```
ResourceNotFoundException: Requested resource not found
```

**Fix:**
```bash
# Check DynamoDB tables created
aws dynamodb list-tables --region eu-north-1

# Should list all 3 tables:
# - sentinel-employees
# - sentinel-telemetry
# - sentinel-settings

# If missing, create them:
aws dynamodb create-table \
  --table-name sentinel-employees \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1
```

### Issue 4: "Table names don't match"

**Problem:**
```
Table: sentinel-emp (in .env)
Table in AWS: sentinel-employees
```

**Fix:**
```bash
# Check DynamoDB table names
aws dynamodb list-tables --region eu-north-1

# Update .env to match AWS table names exactly:
DDB_EMPLOYEE_TABLE=sentinel-employees
DDB_TELEMETRY_TABLE=sentinel-telemetry
DDB_SETTINGS_TABLE=sentinel-settings

# Restart backend
npm run backend:dev
```

### Issue 5: "VITE_BACKEND_API_URL not correct"

**Problem:**
```
Frontend shows 404 or connection refused
```

**Fix:**
```bash
# For development, use:
VITE_BACKEND_API_URL=http://localhost:8080/api
# (Frontend dev server will proxy to backend)

# For production, use:
VITE_BACKEND_API_URL=https://your-domain.com/api
# (Must point to production backend)
```

---

## Environment Variable Usage

### In Backend (Node.js)

```typescript
// Access via process.env
const port = process.env.BACKEND_PORT;
const region = process.env.AWS_REGION;
const employeeTable = process.env.DDB_EMPLOYEE_TABLE;

// Example in backend/src/config.ts
export const config = {
  port: Number(process.env.BACKEND_PORT) || 4000,
  region: process.env.AWS_REGION || "eu-north-1",
  employeeTable: process.env.DDB_EMPLOYEE_TABLE || "sentinel-employees",
};
```

### In Frontend (React/Vite)

```typescript
// Access via import.meta.env
const apiUrl = import.meta.env.VITE_BACKEND_API_URL;
const employeeId = import.meta.env.VITE_EMPLOYEE_ID;

// Example in src/lib/api.ts
const BASE_URL = import.meta.env.VITE_BACKEND_API_URL ?? "http://localhost:4000";

// Only variables starting with VITE_ are exposed to frontend!
```

### Important: Frontend Variable Naming

```
❌ Frontend CANNOT see:
AWS_ACCESS_KEY_ID (private!)
AWS_SECRET_ACCESS_KEY (private!)
AWS_REGION
BACKEND_PORT

✅ Frontend CAN see:
VITE_BACKEND_API_URL
VITE_EMPLOYEE_ID
(Only variables prefixed with VITE_)
```

---

## Security Best Practices

### ✅ DO
- ✅ Keep `.env` in `.gitignore`
- ✅ Use unique access keys per environment
- ✅ Rotate keys every 90 days
- ✅ Store in secure password manager
- ✅ Use IAM roles in production (not keys)
- ✅ Restrict IAM user to specific tables

### ❌ DON'T
- ❌ Commit `.env` to Git
- ❌ Share credentials in Slack/Email
- ❌ Use same key for dev and production
- ❌ Store credentials in comments
- ❌ Use root AWS account keys
- ❌ Push credentials to public repositories

---

## Deployment Scenarios

### Development (Local Machine)

```env
# .env (local only)
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIA_DEV_KEY_12345
AWS_SECRET_ACCESS_KEY=wJal_dev_secret_abcde
DDB_EMPLOYEE_TABLE=sentinel-employees
DDB_TELEMETRY_TABLE=sentinel-telemetry
DDB_SETTINGS_TABLE=sentinel-settings
BACKEND_PORT=4000
VITE_BACKEND_API_URL=http://localhost:8080/api
VITE_EMPLOYEE_ID=EMP001
```

### Staging (AWS EC2/App Server)

```env
# .env (staging)
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIA_STAGING_KEY_67890
AWS_SECRET_ACCESS_KEY=wJal_staging_secret_fghij
DDB_EMPLOYEE_TABLE=sentinel-employees-staging
DDB_TELEMETRY_TABLE=sentinel-telemetry-staging
DDB_SETTINGS_TABLE=sentinel-settings-staging
BACKEND_PORT=4000
VITE_BACKEND_API_URL=https://staging.mycompany.com/api
VITE_EMPLOYEE_ID=EMP001
```

### Production (AWS EC2/App Server)

```env
# .env (production - use IAM role instead!)
AWS_REGION=eu-north-1
# NO AWS_ACCESS_KEY_ID (use IAM role!)
# NO AWS_SECRET_ACCESS_KEY (use IAM role!)
DDB_EMPLOYEE_TABLE=sentinel-employees
DDB_TELEMETRY_TABLE=sentinel-telemetry
DDB_SETTINGS_TABLE=sentinel-settings
BACKEND_PORT=4000
VITE_BACKEND_API_URL=https://api.mycompany.com/api
VITE_EMPLOYEE_ID=EMP001
```

---

## Environment File Examples

### Example 1: Complete Development Setup

```env
# AWS Configuration
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPL
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY

# DynamoDB Table Names
DDB_EMPLOYEE_TABLE=sentinel-employees
DDB_TELEMETRY_TABLE=sentinel-telemetry
DDB_SETTINGS_TABLE=sentinel-settings

# Backend
BACKEND_PORT=4000
TELEMETRY_API_URL=https://76ezf3ssob.execute-api.eu-north-1.amazonaws.com/apistage/data

# Frontend
VITE_BACKEND_API_URL=http://localhost:8080/api
VITE_EMPLOYEE_ID=EMP001
```

### Example 2: Minimal Required (with Defaults)

```env
# REQUIRED: AWS Credentials
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPL
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY

# Optional: These have sensible defaults
# AWS_REGION=eu-north-1 (default)
# BACKEND_PORT=4000 (default)
# VITE_BACKEND_API_URL=http://localhost:4000 (default)
```

---

## Verification Commands

```bash
# Complete verification script
echo "=== Environment Variables ===" && \
grep -E "^AWS_|^DDB_|^VITE_|^BACKEND_" .env && \
echo "" && \
echo "=== AWS Credentials ===" && \
aws sts get-caller-identity && \
echo "" && \
echo "=== DynamoDB Tables ===" && \
aws dynamodb list-tables --region eu-north-1 && \
echo "" && \
echo "✓ All configurations valid!"
```

---

## Summary

**Essential Variables:**
1. `AWS_REGION` - Must be `eu-north-1`
2. `AWS_ACCESS_KEY_ID` - From AWS IAM user
3. `AWS_SECRET_ACCESS_KEY` - From AWS IAM user (keep secret!)
4. `DDB_*_TABLE` - Match your DynamoDB table names

**How to verify:**
1. Check `.env` file exists
2. Run `aws sts get-caller-identity` (should work)
3. Run `aws dynamodb list-tables --region eu-north-1` (should list 3 tables)
4. Start backend: `npm run backend:dev` (should connect)
5. Test health: `curl http://localhost:4000/health` (should return ok)

**If something fails:**
1. Check the error message carefully
2. Find the matching issue in "Common Issues" section above
3. Follow the fix instructions
4. Restart the service

✅ **You're ready when:**
- `aws sts get-caller-identity` returns your account info
- `aws dynamodb list-tables` shows 3 tables
- `npm run backend:dev` starts without errors
- `curl http://localhost:4000/health` returns 200 OK
- Frontend can login and see data
