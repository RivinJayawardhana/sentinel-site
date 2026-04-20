# AWS DynamoDB Complete Configuration Guide

## Prerequisites
- AWS Account (with billing enabled)
- AWS CLI installed locally
- Node.js and npm installed
- Text editor for configuration files

---

## STEP 1: AWS Account Setup

### 1.1 Create AWS Account (if needed)
```
Visit: https://aws.amazon.com
Click: Create an AWS Account
Follow: Email verification and payment setup
Region: Select eu-north-1 (Stockholm)
```

### 1.2 Navigate to AWS Console
```
URL: https://console.aws.amazon.com
Login: Your AWS account credentials
Region Selector (top right): Change to eu-north-1
```

---

## STEP 2: Create IAM User for DynamoDB Access

### 2.1 Create IAM User via Console

**Path:**
```
AWS Console → IAM (Identity and Access Management)
  → Users
  → Create user
```

**Configuration:**
```
User name: sentinel-dynamodb-user
Access type: Programmatic access (✓)
Click: Next: Permissions
```

### 2.2 Attach DynamoDB Permissions

**Option A: Use Managed Policy (Recommended for Development)**
```
Click: Attach existing policies directly
Search: DynamoDBFullAccess
Select: ✓ AmazonDynamoDBFullAccess
Click: Next: Tags
Click: Next: Review
Click: Create user
```

**Option B: Create Custom Policy (Recommended for Production)**
```
Click: Create policy
Choose: JSON tab
Paste: (see below)
Review and create with name: sentinel-dynamodb-policy
Attach to user
```

**Custom Policy JSON:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-north-1:*:table/sentinel-employees",
        "arn:aws:dynamodb:eu-north-1:*:table/sentinel-telemetry",
        "arn:aws:dynamodb:eu-north-1:*:table/sentinel-settings"
      ]
    }
  ]
}
```

### 2.3 Save Access Keys

**After user creation, you'll see:**
```
✓ User successfully created
├─ User name: sentinel-dynamodb-user
├─ Access key ID: AKIAIOSFODNN7EXAMPLE
└─ Secret access key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

⚠️ IMPORTANT: Save these immediately!
   This is the only time you can see the secret key
```

**Store safely:**
```
1. Copy both keys to a secure text file
2. Add to .env file (see Step 5)
3. DO NOT commit to Git
4. DO NOT share publicly
```

---

## STEP 3: Configure AWS CLI Locally

### 3.1 Install AWS CLI

**Windows (PowerShell):**
```powershell
# Check if installed
aws --version

# If not installed:
choco install awscli -y
# OR download: https://aws.amazon.com/cli/
```

**macOS:**
```bash
brew install awscli
```

**Linux:**
```bash
sudo apt-get install awscli
```

### 3.2 Configure AWS Credentials

**Run configuration:**
```bash
aws configure
```

**Enter when prompted:**
```
AWS Access Key ID: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region: eu-north-1
Default output format: json
```

**Verify configuration:**
```bash
cat ~/.aws/credentials
cat ~/.aws/config
```

**Expected output:**
```
~/.aws/credentials:
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

~/.aws/config:
[default]
region = eu-north-1
output = json
```

### 3.3 Verify AWS CLI Works

```bash
aws sts get-caller-identity
```

**Expected response:**
```json
{
  "UserId": "AIDACKCEVSQ6C2EXAMPLE",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/sentinel-dynamodb-user"
}
```

---

## STEP 4: Create DynamoDB Tables

### 4.1 Table 1: sentinel-employees

**Create table:**
```bash
aws dynamodb create-table \
  --table-name sentinel-employees \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1
```

**Verify creation:**
```bash
aws dynamodb describe-table \
  --table-name sentinel-employees \
  --region eu-north-1
```

**Expected response:**
```json
{
  "Table": {
    "TableName": "sentinel-employees",
    "TableStatus": "ACTIVE",
    "TableArn": "arn:aws:dynamodb:eu-north-1:123456789012:table/sentinel-employees",
    "BillingModeSummary": {
      "BillingMode": "PAY_PER_REQUEST"
    },
    "KeySchema": [
      {
        "AttributeName": "id",
        "KeyType": "HASH"
      }
    ],
    "AttributeDefinitions": [
      {
        "AttributeName": "id",
        "AttributeType": "S"
      }
    ]
  }
}
```

### 4.2 Table 2: sentinel-telemetry

**Create table:**
```bash
aws dynamodb create-table \
  --table-name sentinel-telemetry \
  --attribute-definitions \
    AttributeName=employeeId,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=employeeId,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1
```

**Verify creation:**
```bash
aws dynamodb describe-table \
  --table-name sentinel-telemetry \
  --region eu-north-1
```

### 4.3 Table 3: sentinel-settings

**Create table:**
```bash
aws dynamodb create-table \
  --table-name sentinel-settings \
  --attribute-definitions \
    AttributeName=employeeId,AttributeType=S \
  --key-schema \
    AttributeName=employeeId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1
```

**Verify creation:**
```bash
aws dynamodb describe-table \
  --table-name sentinel-settings \
  --region eu-north-1
```

### 4.4 List All Tables

```bash
aws dynamodb list-tables --region eu-north-1
```

**Expected response:**
```json
{
  "TableNames": [
    "sentinel-employees",
    "sentinel-settings",
    "sentinel-telemetry"
  ]
}
```

---

## STEP 5: Configure Environment Variables

### 5.1 Update .env File

**Navigate to project root:**
```bash
cd c:\Users\USER\sentinel-site
```

**Open or create `.env` file:**
```bash
# Windows
notepad .env

# macOS/Linux
nano .env
```

**Add AWS credentials:**
```env
# Frontend Configuration
VITE_BACKEND_API_URL=http://localhost:8080/api
VITE_EMPLOYEE_ID=EMP001

# Backend Configuration
BACKEND_PORT=4000

# AWS Configuration
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# DynamoDB Table Names
DDB_EMPLOYEE_TABLE=sentinel-employees
DDB_TELEMETRY_TABLE=sentinel-telemetry
DDB_SETTINGS_TABLE=sentinel-settings

# Telemetry Source
TELEMETRY_API_URL=https://76ezf3ssob.execute-api.eu-north-1.amazonaws.com/apistage/data
```

### 5.2 Update .env.example (for documentation)

```bash
notepad .env.example
```

**Content:**
```env
# Frontend Configuration
VITE_BACKEND_API_URL=http://localhost:8080/api
VITE_EMPLOYEE_ID=EMP001

# Backend Configuration
BACKEND_PORT=4000

# AWS Configuration
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key

# DynamoDB Table Names
DDB_EMPLOYEE_TABLE=sentinel-employees
DDB_TELEMETRY_TABLE=sentinel-telemetry
DDB_SETTINGS_TABLE=sentinel-settings

# Telemetry Source
TELEMETRY_API_URL=https://76ezf3ssob.execute-api.eu-north-1.amazonaws.com/apistage/data
```

### 5.3 Verify .env is in .gitignore

```bash
# Check .gitignore
cat .gitignore
```

**Should contain:**
```
.env
.env.local
.env.*.local
```

---

## STEP 6: Test DynamoDB Connection

### 6.1 Test from CLI

```bash
# List tables (verify connectivity)
aws dynamodb list-tables --region eu-north-1

# Get table status
aws dynamodb describe-table \
  --table-name sentinel-employees \
  --region eu-north-1 \
  --query 'Table.TableStatus'
```

**Expected output:**
```
ACTIVE
```

### 6.2 Test from Backend

**Start backend with debug:**
```bash
cd c:\Users\USER\sentinel-site
npm run backend:dev
```

**Expected output:**
```
Sentinel backend listening on http://localhost:4000
Database connection: OK
Tables verified: ✓
```

**Test health endpoint:**
```bash
curl http://localhost:4000/health
```

**Expected response:**
```json
{
  "status": "ok",
  "dynamodb": "connected",
  "tables": ["sentinel-employees", "sentinel-telemetry", "sentinel-settings"]
}
```

---

## STEP 7: Populate Sample Data

### 7.1 Create Employee Record

```bash
aws dynamodb put-item \
  --table-name sentinel-employees \
  --item '{
    "id": {"S": "EMP001"},
    "name": {"S": "John Smith"},
    "email": {"S": "john.smith@safeguard.io"},
    "role": {"S": "Factory Worker"},
    "shift": {"S": "Morning"},
    "zone": {"S": "Zone A"},
    "deviceId": {"S": "DEV-EMP001"},
    "status": {"S": "active"},
    "createdAt": {"N": "1713607200"}
  }' \
  --region eu-north-1
```

### 7.2 Create Settings Record

```bash
aws dynamodb put-item \
  --table-name sentinel-settings \
  --item '{
    "employeeId": {"S": "EMP001"},
    "thresholds": {"M": {
      "heartRate": {"M": {
        "min": {"N": "60"},
        "max": {"N": "100"},
        "criticalMax": {"N": "120"}
      }},
      "temperature": {"M": {
        "min": {"N": "35.5"},
        "max": {"N": "37.5"},
        "criticalMax": {"N": "38.0"}
      }},
      "humidity": {"M": {
        "min": {"N": "30"},
        "max": {"N": "70"},
        "criticalMax": {"N": "85"}
      }},
      "airQuality": {"M": {
        "min": {"N": "70"},
        "criticalMin": {"N": "50"}
      }}
    }},
    "updatedAt": {"N": "1713607200"}
  }' \
  --region eu-north-1
```

### 7.3 Create Telemetry Records

```bash
# Record 1
aws dynamodb put-item \
  --table-name sentinel-telemetry \
  --item '{
    "employeeId": {"S": "EMP001"},
    "sk": {"S": "2026-04-20#15:30:45#001"},
    "temperature": {"N": "36.5"},
    "humidity": {"N": "65"},
    "airQuality": {"N": "45"},
    "latitude": {"N": "59.3293"},
    "longitude": {"N": "18.0686"},
    "heartRate": {"N": "72"},
    "timestamp": {"N": "1713607845"},
    "status": {"S": "normal"}
  }' \
  --region eu-north-1

# Record 2
aws dynamodb put-item \
  --table-name sentinel-telemetry \
  --item '{
    "employeeId": {"S": "EMP001"},
    "sk": {"S": "2026-04-20#15:30:55#002"},
    "temperature": {"N": "36.4"},
    "humidity": {"N": "64"},
    "airQuality": {"N": "46"},
    "latitude": {"N": "59.3294"},
    "longitude": {"N": "18.0687"},
    "heartRate": {"N": "71"},
    "timestamp": {"N": "1713607855"},
    "status": {"S": "normal"}
  }' \
  --region eu-north-1
```

### 7.4 Verify Sample Data

```bash
# Get employee
aws dynamodb get-item \
  --table-name sentinel-employees \
  --key '{"id": {"S": "EMP001"}}' \
  --region eu-north-1

# Query telemetry
aws dynamodb query \
  --table-name sentinel-telemetry \
  --key-condition-expression "employeeId = :id" \
  --expression-attribute-values '{":id": {"S": "EMP001"}}' \
  --scan-index-forward false \
  --limit 5 \
  --region eu-north-1

# Get settings
aws dynamodb get-item \
  --table-name sentinel-settings \
  --key '{"employeeId": {"S": "EMP001"}}' \
  --region eu-north-1
```

---

## STEP 8: Backend Environment Configuration

### 8.1 Review Backend Config

**File:** `backend/src/config.ts`

```typescript
import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.BACKEND_PORT) || 4000,
  region: process.env.AWS_REGION || "eu-north-1",
  employeeTable: process.env.DDB_EMPLOYEE_TABLE || "sentinel-employees",
  telemetryTable: process.env.DDB_TELEMETRY_TABLE || "sentinel-telemetry",
  settingsTable: process.env.DDB_SETTINGS_TABLE || "sentinel-settings",
  telemetryApiUrl: process.env.TELEMETRY_API_URL || "https://76ezf3ssob.execute-api.eu-north-1.amazonaws.com/apistage/data",
};
```

### 8.2 Verify Configuration Loaded

**Start backend:**
```bash
npm run backend:dev
```

**Check logs:**
```
✓ Config loaded successfully
✓ Region: eu-north-1
✓ Employee table: sentinel-employees
✓ Telemetry table: sentinel-telemetry
✓ Settings table: sentinel-settings
```

---

## STEP 9: Start Application

### 9.1 Terminal 1 - Backend

```bash
cd c:\Users\USER\sentinel-site
npm run backend:dev
```

**Expected output:**
```
Sentinel backend listening on http://localhost:4000
✓ DynamoDB tables verified
✓ Ready to accept requests
```

### 9.2 Terminal 2 - Frontend

```bash
cd c:\Users\USER\sentinel-site
npm run dev
```

**Expected output:**
```
VITE v5.4.19
  ➜  Local:   http://localhost:8080/
  ➜  press h to show help
```

### 9.3 Test End-to-End

**Visit in browser:**
```
http://localhost:8080
```

**Steps:**
1. Login page appears
2. Enter credentials:
   - Email: `admin@safeguard.io`
   - Password: `Admin@123`
   - Role: `Admin`
3. Click "Sign In"
4. Dashboard should load with employee data

---

## STEP 10: Monitoring & Scaling

### 10.1 Monitor DynamoDB Usage

```bash
# Get table metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedWriteCapacityUnits \
  --dimensions Name=TableName,Value=sentinel-telemetry \
  --statistics Average \
  --start-time 2026-04-20T00:00:00Z \
  --end-time 2026-04-21T00:00:00Z \
  --period 3600 \
  --region eu-north-1
```

### 10.2 View Table Metrics in Console

```
AWS Console
  → DynamoDB
  → Tables
  → Select: sentinel-telemetry
  → Metrics tab
  → View: Read/Write capacity, Item count, Size
```

### 10.3 Scaling Strategy

**Current:** PAY_PER_REQUEST (Serverless)
```
- No provisioning needed
- Auto-scales
- Cost: $0.25 per million read/write units
- Good for: Variable workloads
```

**Alternative:** Provisioned Capacity (if needed)
```
aws dynamodb update-billing-mode \
  --table-name sentinel-telemetry \
  --billing-mode PROVISIONED \
  --provisioned-throughput ReadCapacityUnits=100,WriteCapacityUnits=100 \
  --region eu-north-1
```

---

## STEP 11: Backup & Security

### 11.1 Enable Point-in-Time Recovery (PITR)

```bash
aws dynamodb update-continuous-backups \
  --table-name sentinel-employees \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region eu-north-1
```

### 11.2 Create Manual Backup

```bash
aws dynamodb create-backup \
  --table-name sentinel-employees \
  --backup-name sentinel-employees-backup-$(date +%Y%m%d) \
  --region eu-north-1
```

### 11.3 Enable Encryption at Rest

```bash
aws dynamodb update-table \
  --table-name sentinel-employees \
  --sse-specification Enabled=true,SSEType=KMS \
  --region eu-north-1
```

### 11.4 View Backups

```bash
aws dynamodb list-backups --region eu-north-1
```

---

## STEP 12: Production Deployment Checklist

### 12.1 Security Checklist

- [ ] Use IAM role instead of access keys (EC2, Lambda)
- [ ] Rotate access keys every 90 days
- [ ] Enable MFA on AWS account
- [ ] Use VPC endpoints for DynamoDB (production)
- [ ] Enable encryption at rest with KMS
- [ ] Enable point-in-time recovery (PITR)
- [ ] Set up CloudTrail logging
- [ ] Restrict table access with IAM policies

### 12.2 Performance Checklist

- [ ] Enable DynamoDB Streams for real-time updates
- [ ] Add Global Secondary Indexes if needed
- [ ] Monitor CloudWatch metrics
- [ ] Set up auto-scaling alarms
- [ ] Review query patterns (avoid scans)
- [ ] Use batch operations where possible

### 12.3 Operational Checklist

- [ ] Set up automated backups
- [ ] Document table schemas
- [ ] Create runbooks for common operations
- [ ] Set up monitoring/alerting
- [ ] Test disaster recovery
- [ ] Plan capacity for growth

---

## STEP 13: Troubleshooting

### Issue 1: "Credentials not found"

**Solution:**
```bash
# Check AWS credentials
aws sts get-caller-identity

# If error, reconfigure
aws configure

# Verify .env file exists
cat .env
```

### Issue 2: "Access Denied" Errors

**Solution:**
```bash
# Check IAM permissions
aws iam get-user-policy \
  --user-name sentinel-dynamodb-user \
  --policy-name sentinel-dynamodb-policy

# Attach policy if missing
aws iam attach-user-policy \
  --user-name sentinel-dynamodb-user \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
```

### Issue 3: "Table does not exist"

**Solution:**
```bash
# Check table exists
aws dynamodb list-tables --region eu-north-1

# Create missing table
aws dynamodb create-table \
  --table-name sentinel-employees \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1
```

### Issue 4: Backend can't connect to DynamoDB

**Solution:**
```bash
# Test AWS CLI first
aws dynamodb list-tables --region eu-north-1

# Check backend logs
npm run backend:dev 2>&1 | grep -i error

# Verify environment variables loaded
node -e "console.log(process.env.AWS_REGION)"

# Check network connectivity
curl https://dynamodb.eu-north-1.amazonaws.com
```

### Issue 5: Data not appearing in UI

**Solution:**
```bash
# Verify data in DynamoDB
aws dynamodb query \
  --table-name sentinel-telemetry \
  --key-condition-expression "employeeId = :id" \
  --expression-attribute-values '{":id": {"S": "EMP001"}}' \
  --region eu-north-1

# Check backend is polling AWS API
curl http://localhost:4000/api/ingest?employeeId=EMP001 -X POST

# Check frontend is polling backend
Browser DevTools → Network → Filter "bootstrap"
```

---

## STEP 14: Useful Commands Reference

### Query Operations

```bash
# Get single item
aws dynamodb get-item \
  --table-name sentinel-employees \
  --key '{"id": {"S": "EMP001"}}' \
  --region eu-north-1

# Query telemetry by employee (sorted by timestamp desc)
aws dynamodb query \
  --table-name sentinel-telemetry \
  --key-condition-expression "employeeId = :id" \
  --expression-attribute-values '{":id": {"S": "EMP001"}}' \
  --scan-index-forward false \
  --limit 10 \
  --region eu-north-1

# Scan all records (use sparingly)
aws dynamodb scan \
  --table-name sentinel-employees \
  --region eu-north-1

# Count items in table
aws dynamodb scan \
  --table-name sentinel-employees \
  --select COUNT \
  --region eu-north-1
```

### Modification Operations

```bash
# Update item
aws dynamodb update-item \
  --table-name sentinel-employees \
  --key '{"id": {"S": "EMP001"}}' \
  --update-expression "SET #name = :name" \
  --expression-attribute-names '{"#name": "name"}' \
  --expression-attribute-values '{":name": {"S": "John Doe"}}' \
  --region eu-north-1

# Delete item
aws dynamodb delete-item \
  --table-name sentinel-employees \
  --key '{"id": {"S": "EMP001"}}' \
  --region eu-north-1

# Delete table
aws dynamodb delete-table \
  --table-name sentinel-employees \
  --region eu-north-1
```

### Monitoring Operations

```bash
# Get table description
aws dynamodb describe-table \
  --table-name sentinel-employees \
  --region eu-north-1

# List all tables
aws dynamodb list-tables --region eu-north-1

# Get table size
aws dynamodb describe-table \
  --table-name sentinel-telemetry \
  --region eu-north-1 \
  --query 'Table.TableSizeBytes'
```

---

## Summary

### Configuration Checklist

✅ AWS account created  
✅ IAM user with DynamoDB permissions  
✅ AWS CLI configured  
✅ Three DynamoDB tables created  
✅ Environment variables set in .env  
✅ Sample data populated  
✅ Backend verified (health check)  
✅ Frontend and backend running  
✅ End-to-end testing passed  
✅ Backups enabled  

### Cost Estimation (Monthly)

```
DynamoDB (PAY_PER_REQUEST):
├─ sentinel-employees: ~$0.50 (few writes)
├─ sentinel-telemetry: ~$50-100 (high volume)
├─ sentinel-settings: ~$1 (few writes)
└─ Total: $50-150/month

Alternative (PROVISIONED):
├─ Read capacity: 100 units × $0.00013 × 730h = ~$10
├─ Write capacity: 100 units × $0.00065 × 730h = ~$47
└─ Total: ~$60/month
```

### Next Steps

1. Verify all tables are **ACTIVE**
2. Confirm backend connects successfully
3. Test frontend login and data loading
4. Monitor DynamoDB metrics
5. Set up CloudWatch alarms
6. Plan backup strategy
7. Document for team
