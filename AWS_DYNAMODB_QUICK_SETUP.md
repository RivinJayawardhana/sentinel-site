# AWS DynamoDB Quick Setup (5 Minutes)

## For those in a hurry

### Step 1: Get AWS Credentials (1 min)

```
AWS Console → IAM → Users → Create user
├─ Name: sentinel-db-user
├─ Access: Programmatic access ✓
├─ Permissions: Attach AmazonDynamoDBFullAccess
└─ Copy: Access Key ID & Secret Access Key
```

### Step 2: Configure AWS CLI (1 min)

```bash
aws configure
# Enter credentials from Step 1
# Region: eu-north-1
# Output: json
```

### Step 3: Create Tables (1 min)

```bash
# Run all three:
aws dynamodb create-table --table-name sentinel-employees --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST --region eu-north-1

aws dynamodb create-table --table-name sentinel-telemetry --attribute-definitions AttributeName=employeeId,AttributeType=S AttributeName=sk,AttributeType=S --key-schema AttributeName=employeeId,KeyType=HASH AttributeName=sk,KeyType=RANGE --billing-mode PAY_PER_REQUEST --region eu-north-1

aws dynamodb create-table --table-name sentinel-settings --attribute-definitions AttributeName=employeeId,AttributeType=S --key-schema AttributeName=employeeId,KeyType=HASH --billing-mode PAY_PER_REQUEST --region eu-north-1
```

### Step 4: Set Environment (1 min)

**Create/edit `.env`:**
```env
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJal...
DDB_EMPLOYEE_TABLE=sentinel-employees
DDB_TELEMETRY_TABLE=sentinel-telemetry
DDB_SETTINGS_TABLE=sentinel-settings
VITE_BACKEND_API_URL=http://localhost:8080/api
BACKEND_PORT=4000
```

### Step 5: Run Application (1 min)

**Terminal 1:**
```bash
npm run backend:dev
```

**Terminal 2:**
```bash
npm run dev
```

**Browser:**
```
http://localhost:8080
Login: admin@safeguard.io / Admin@123
```

---

## Verify Everything Works

```bash
# Test 1: AWS CLI connection
aws sts get-caller-identity

# Test 2: Tables exist
aws dynamodb list-tables --region eu-north-1

# Test 3: Backend health
curl http://localhost:4000/health

# Test 4: Backend can query
curl "http://localhost:4000/api/bootstrap?employeeId=EMP001"
```

---

## Common Issues

| Issue | Fix |
|-------|-----|
| "Credentials not found" | Run `aws configure` again |
| "Table does not exist" | Re-run the create-table commands above |
| "Access Denied" | Check IAM user has DynamoDBFullAccess policy |
| "Connection timeout" | Verify internet, check AWS region is eu-north-1 |

---

Done! ✓
