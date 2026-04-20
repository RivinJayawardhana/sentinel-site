# AWS DynamoDB Configuration Flow

## Complete Configuration Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STEP 1: AWS ACCOUNT SETUP                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1.1 Create AWS Account                                                      │
│      Website: https://aws.amazon.com                                        │
│      ├─ Click: Create AWS Account                                           │
│      ├─ Enter: Email address                                                │
│      ├─ Verify: Email confirmation                                          │
│      ├─ Enter: Payment method                                               │
│      └─ Select: Region eu-north-1 (Stockholm)                              │
│                                                                              │
│  1.2 Verify Account                                                          │
│      ├─ Check email for verification                                        │
│      ├─ Create password                                                     │
│      ├─ Add payment method                                                  │
│      └─ Account active ✓                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 2: CREATE IAM USER & CREDENTIALS                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  AWS Console → IAM → Users → Create user                                    │
│                                                                              │
│  2.1 User Configuration                                                      │
│      └─ User name: sentinel-dynamodb-user                                   │
│      └─ Access type: ✓ Programmatic access                                  │
│                                                                              │
│  2.2 Permissions                                                             │
│      ├─ Option A (Dev): Attach AmazonDynamoDBFullAccess                     │
│      └─ Option B (Prod): Create custom policy (see main guide)             │
│                                                                              │
│  2.3 Review & Create                                                         │
│      └─ Click: Create user                                                  │
│                                                                              │
│  2.4 Save Credentials ⚠️ (ONLY TIME VISIBLE)                               │
│      ├─ Access Key ID: AKIA... (copy immediately)                          │
│      ├─ Secret Key: wJal... (copy immediately)                             │
│      └─ Store: Safe location (NOT in Git!)                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 3: INSTALL & CONFIGURE AWS CLI                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  3.1 Install AWS CLI                                                         │
│      Windows:  choco install awscli -y                                      │
│      macOS:    brew install awscli                                          │
│      Linux:    sudo apt-get install awscli                                  │
│                                                                              │
│  3.2 Configure Credentials                                                   │
│      Terminal: $ aws configure                                              │
│      Prompt 1: AWS Access Key ID: AKIA...                                   │
│      Prompt 2: AWS Secret Access Key: wJal...                               │
│      Prompt 3: Default region: eu-north-1                                   │
│      Prompt 4: Default output format: json                                  │
│                                                                              │
│  3.3 Verify Installation                                                     │
│      Terminal: $ aws sts get-caller-identity                                │
│      Response: {UserId: "...", Account: "...", Arn: "..."}  ✓              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      STEP 4: CREATE DYNAMODB TABLES                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  4.1 Table: sentinel-employees                                               │
│      ├─ Type: Employee/Worker records                                       │
│      ├─ Primary Key: id (String)                                            │
│      ├─ Billing: PAY_PER_REQUEST (serverless)                              │
│      └─ Status: ACTIVE ✓                                                    │
│                                                                              │
│      $ aws dynamodb create-table \                                           │
│        --table-name sentinel-employees \                                    │
│        --attribute-definitions AttributeName=id,AttributeType=S \          │
│        --key-schema AttributeName=id,KeyType=HASH \                        │
│        --billing-mode PAY_PER_REQUEST --region eu-north-1                  │
│                                                                              │
│  4.2 Table: sentinel-telemetry                                               │
│      ├─ Type: Time-series sensor data                                       │
│      ├─ Primary Key: employeeId (HASH) + sk (RANGE)                        │
│      ├─ Billing: PAY_PER_REQUEST                                           │
│      └─ Status: ACTIVE ✓                                                    │
│                                                                              │
│      $ aws dynamodb create-table \                                           │
│        --table-name sentinel-telemetry \                                    │
│        --attribute-definitions \                                            │
│          AttributeName=employeeId,AttributeType=S \                        │
│          AttributeName=sk,AttributeType=S \                                │
│        --key-schema \                                                       │
│          AttributeName=employeeId,KeyType=HASH \                           │
│          AttributeName=sk,KeyType=RANGE \                                  │
│        --billing-mode PAY_PER_REQUEST --region eu-north-1                  │
│                                                                              │
│  4.3 Table: sentinel-settings                                                │
│      ├─ Type: Threshold configurations                                      │
│      ├─ Primary Key: employeeId (String)                                    │
│      ├─ Billing: PAY_PER_REQUEST                                           │
│      └─ Status: ACTIVE ✓                                                    │
│                                                                              │
│      $ aws dynamodb create-table \                                           │
│        --table-name sentinel-settings \                                     │
│        --attribute-definitions AttributeName=employeeId,AttributeType=S \  │
│        --key-schema AttributeName=employeeId,KeyType=HASH \                │
│        --billing-mode PAY_PER_REQUEST --region eu-north-1                  │
│                                                                              │
│  4.4 Verify Tables Created                                                   │
│      $ aws dynamodb list-tables --region eu-north-1                         │
│                                                                              │
│      Response: ["sentinel-employees", "sentinel-settings",                  │
│                 "sentinel-telemetry"]  ✓                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  STEP 5: CONFIGURE ENVIRONMENT VARIABLES                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  5.1 Create/Edit .env File                                                   │
│      Location: c:\Users\USER\sentinel-site\.env                             │
│                                                                              │
│      ┌──────────────────────────────────────────────────────────────┐      │
│      │ # AWS Configuration                                          │      │
│      │ AWS_REGION=eu-north-1                                       │      │
│      │ AWS_ACCESS_KEY_ID=AKIA...                                   │      │
│      │ AWS_SECRET_ACCESS_KEY=wJal...                               │      │
│      │                                                              │      │
│      │ # DynamoDB Tables                                           │      │
│      │ DDB_EMPLOYEE_TABLE=sentinel-employees                       │      │
│      │ DDB_TELEMETRY_TABLE=sentinel-telemetry                      │      │
│      │ DDB_SETTINGS_TABLE=sentinel-settings                        │      │
│      │                                                              │      │
│      │ # Backend                                                   │      │
│      │ BACKEND_PORT=4000                                           │      │
│      │ TELEMETRY_API_URL=https://76ezf3ssob...                    │      │
│      │                                                              │      │
│      │ # Frontend                                                  │      │
│      │ VITE_BACKEND_API_URL=http://localhost:8080/api             │      │
│      │ VITE_EMPLOYEE_ID=EMP001                                     │      │
│      └──────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  5.2 Update .env.example (Documentation)                                     │
│      Replace real credentials with placeholder text                         │
│      Commit to Git for team reference                                       │
│                                                                              │
│  5.3 Ensure .gitignore Includes .env                                         │
│      File: .gitignore                                                       │
│      Content: .env (NO credentials in version control!)                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 6: POPULATE SAMPLE DATA (Optional)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  6.1 Add Employee Record                                                     │
│      $ aws dynamodb put-item --table-name sentinel-employees \              │
│        --item '{"id": {"S": "EMP001"}, ...}' --region eu-north-1            │
│                                                                              │
│  6.2 Add Settings Record                                                     │
│      $ aws dynamodb put-item --table-name sentinel-settings \               │
│        --item '{"employeeId": {"S": "EMP001"}, ...}' --region eu-north-1    │
│                                                                              │
│  6.3 Add Telemetry Records                                                   │
│      $ aws dynamodb put-item --table-name sentinel-telemetry \              │
│        --item '{"employeeId": {"S": "EMP001"}, ...}' --region eu-north-1    │
│                                                                              │
│  6.4 Verify Data                                                             │
│      $ aws dynamodb get-item --table-name sentinel-employees \              │
│        --key '{"id": {"S": "EMP001"}}' --region eu-north-1                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 7: VERIFY BACKEND CONNECTION                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  7.1 Start Backend Server                                                    │
│      Terminal: $ npm run backend:dev                                         │
│      Output: Sentinel backend listening on http://localhost:4000             │
│              ✓ DynamoDB connected                                            │
│                                                                              │
│  7.2 Test Health Endpoint                                                    │
│      $ curl http://localhost:4000/health                                     │
│      Response: {"status": "ok", "dynamodb": "connected", ...}  ✓            │
│                                                                              │
│  7.3 Test Bootstrap Endpoint                                                 │
│      $ curl "http://localhost:4000/api/bootstrap?employeeId=EMP001"        │
│      Response: {workers: [...], alerts: [...], ...}  ✓                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   STEP 8: START FRONTEND & TEST END-TO-END                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  8.1 Terminal 1 (Backend) - Already Running                                  │
│      $ npm run backend:dev                                                   │
│      Listening on: http://localhost:4000                                     │
│                                                                              │
│  8.2 Terminal 2 (Frontend) - Start Dev Server                                │
│      $ npm run dev                                                           │
│      Output: Local: http://localhost:8080                                    │
│               ✓ Proxy to backend configured                                 │
│                                                                              │
│  8.3 Browser Test                                                            │
│      URL: http://localhost:8080                                              │
│      ├─ See: Login page                                                     │
│      ├─ Enter: admin@safeguard.io / Admin@123                              │
│      ├─ Click: Sign In                                                      │
│      └─ See: Dashboard with employee data ✓                                 │
│                                                                              │
│  8.4 Verify Data Flow                                                        │
│      ├─ Dashboard shows employees from sentinel-employees table             │
│      ├─ Charts show data from sentinel-telemetry table                      │
│      ├─ Settings show thresholds from sentinel-settings table               │
│      └─ All data refreshes every 10 seconds ✓                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      STEP 9: CONFIGURE MONITORING & BACKUPS                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  9.1 Enable Point-in-Time Recovery (PITR)                                    │
│      $ aws dynamodb update-continuous-backups \                              │
│        --table-name sentinel-telemetry \                                    │
│        --point-in-time-recovery-specification \                             │
│          PointInTimeRecoveryEnabled=true --region eu-north-1                │
│                                                                              │
│  9.2 Create Manual Backup                                                    │
│      $ aws dynamodb create-backup \                                          │
│        --table-name sentinel-employees \                                    │
│        --backup-name sentinel-employees-backup-20260420                     │
│        --region eu-north-1                                                  │
│                                                                              │
│  9.3 Set CloudWatch Alarms                                                   │
│      AWS Console → CloudWatch → Alarms                                      │
│      ├─ Monitor: ConsumedWriteCapacityUnits                                 │
│      ├─ Threshold: Alert if > expected usage                               │
│      └─ Action: Send SNS notification to admin email                        │
│                                                                              │
│  9.4 View Metrics                                                            │
│      AWS Console → DynamoDB → Tables                                        │
│      ├─ Table: sentinel-telemetry                                           │
│      ├─ Metrics tab                                                         │
│      └─ View: Read/Write units, Item count, Size                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                         🎉 CONFIGURATION COMPLETE 🎉
```

---

## Environment Variables Flow

```
┌────────────────────────────┐
│  .env File                 │
├────────────────────────────┤
│ AWS_REGION                 │
│ AWS_ACCESS_KEY_ID          │
│ AWS_SECRET_ACCESS_KEY      │
│ DDB_EMPLOYEE_TABLE         │
│ DDB_TELEMETRY_TABLE        │
│ DDB_SETTINGS_TABLE         │
│ BACKEND_PORT               │
│ VITE_BACKEND_API_URL       │
└────────────────────────────┘
            │
            ▼
┌────────────────────────────┐        ┌────────────────────────────┐
│  Backend Config            │        │  Frontend Config           │
├────────────────────────────┤        ├────────────────────────────┤
│ config.ts                  │        │ api.ts                     │
├────────────────────────────┤        ├────────────────────────────┤
│ - port: 4000               │        │ - BASE_URL: 8080/api       │
│ - region: eu-north-1       │        │ - EMPLOYEE_ID: EMP001      │
│ - tables: 3x               │        │                            │
│ - telemetryApiUrl: ...     │        │                            │
└────────────────────────────┘        └────────────────────────────┘
            │                                      │
            ▼                                      ▼
┌────────────────────────────────┐    ┌────────────────────────────┐
│ Node.js Process                │    │ React/TypeScript           │
├────────────────────────────────┤    ├────────────────────────────┤
│ process.env.AWS_REGION         │    │ import.meta.env.*          │
│ process.env.AWS_ACCESS_KEY_ID  │    │ environment variables      │
└────────────────────────────────┘    └────────────────────────────┘
            │                                      │
            ▼                                      ▼
┌────────────────────────────────────────────────────────────────────┐
│                    AWS DynamoDB                                    │
├────────────────────────────────────────────────────────────────────┤
│ ├─ sentinel-employees (PK: id)                                    │
│ ├─ sentinel-telemetry (PK: employeeId, SK: sk)                   │
│ └─ sentinel-settings (PK: employeeId)                            │
└────────────────────────────────────────────────────────────────────┘
```

---

## IAM Permissions Flow

```
┌──────────────────────────────┐
│   AWS Account (123456789012) │
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │
│  │ IAM User               │  │
│  ├────────────────────────┤  │
│  │ sentinel-dynamodb-user │  │
│  └────────────────────────┘  │
│          │                   │
│          ▼                   │
│  ┌────────────────────────┐  │
│  │ Attached Policies      │  │
│  ├────────────────────────┤  │
│  │ Permission 1:          │  │
│  │ dynamodb:GetItem       │  │
│  │ dynamodb:PutItem       │  │
│  │ dynamodb:UpdateItem    │  │
│  │ dynamodb:Query         │  │
│  │ ...                    │  │
│  └────────────────────────┘  │
│          │                   │
│          ▼                   │
│  ┌────────────────────────┐  │
│  │ Resource Restrictions  │  │
│  ├────────────────────────┤  │
│  │ Table: sentinel-*      │  │
│  │ Region: eu-north-1     │  │
│  │ Action: Full access    │  │
│  └────────────────────────┘  │
│                              │
└──────────────────────────────┘
```

---

## Table Structure Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ sentinel-employees                                              │
├─────────────────────────────────────────────────────────────────┤
│ PK: id (String) = "EMP001"                                      │
│                                                                 │
│ Attributes:                                                     │
│ ├─ name: String = "John Smith"                                 │
│ ├─ email: String = "john@safeguard.io"                         │
│ ├─ role: String = "Factory Worker"                             │
│ ├─ shift: String = "Morning"                                   │
│ ├─ zone: String = "Zone A"                                     │
│ ├─ deviceId: String = "DEV-EMP001"  ← Links to device         │
│ ├─ status: String = "active"                                   │
│ └─ createdAt: Number = 1713607200                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ sentinel-telemetry                                              │
├─────────────────────────────────────────────────────────────────┤
│ PK: employeeId (String) = "EMP001"                              │
│ SK: sk (String) = "2026-04-20#15:30:45#001"                   │
│                                                                 │
│ Attributes:                                                     │
│ ├─ temperature: Number = 36.5                                  │
│ ├─ humidity: Number = 65                                       │
│ ├─ airQuality: Number = 45                                     │
│ ├─ latitude: Number = 59.3293                                  │
│ ├─ longitude: Number = 18.0686                                 │
│ ├─ heartRate: Number = 72                                      │
│ ├─ status: String = "normal"                                   │
│ └─ timestamp: Number = 1713607845                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ sentinel-settings                                               │
├─────────────────────────────────────────────────────────────────┤
│ PK: employeeId (String) = "EMP001"                              │
│                                                                 │
│ Attributes:                                                     │
│ └─ thresholds: Map                                              │
│    ├─ heartRate: Map                                            │
│    │  ├─ min: Number = 60                                       │
│    │  ├─ max: Number = 100                                      │
│    │  └─ criticalMax: Number = 120                              │
│    ├─ temperature: Map                                          │
│    │  ├─ min: Number = 35.5                                     │
│    │  ├─ max: Number = 37.5                                     │
│    │  └─ criticalMax: Number = 38.0                             │
│    ├─ humidity: Map                                             │
│    │  ├─ min: Number = 30                                       │
│    │  ├─ max: Number = 70                                       │
│    │  └─ criticalMax: Number = 85                               │
│    └─ airQuality: Map                                           │
│       ├─ min: Number = 70                                       │
│       └─ criticalMin: Number = 50                               │
│ └─ updatedAt: Number = 1713607200                               │
└─────────────────────────────────────────────────────────────────┘
```
