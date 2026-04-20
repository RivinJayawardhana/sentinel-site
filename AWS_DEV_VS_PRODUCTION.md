# AWS DynamoDB Reference: Development vs Production

## Comparison Matrix

| Aspect | Development | Production |
|--------|------------|-----------|
| **Billing Mode** | PAY_PER_REQUEST | PROVISIONED |
| **Cost** | $0-10/month | $50-500/month |
| **Scalability** | Auto-scale unlimited | Pre-provisioned capacity |
| **Setup Time** | 5 minutes | 30 minutes |
| **Backup** | Manual | Automated + PITR |
| **Encryption** | No | Yes (KMS) |
| **VPC** | Default | VPC Endpoint |
| **IAM** | Root/User keys | IAM roles |
| **Monitoring** | Basic | CloudWatch + Alarms |
| **RPO/RTO** | High | Low |

---

## Development Setup

### When to Use
- Local testing
- Development/staging
- Demo/POC
- Learning purposes

### Quick Setup Commands

```bash
# 1. AWS CLI configure
aws configure
# Key, Secret, Region: eu-north-1, Format: json

# 2. Create tables (PAY_PER_REQUEST)
aws dynamodb create-table \
  --table-name sentinel-employees \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1

# 3. Set environment
echo "AWS_REGION=eu-north-1" >> .env
echo "AWS_ACCESS_KEY_ID=AKIA..." >> .env
echo "AWS_SECRET_ACCESS_KEY=wJal..." >> .env

# 4. Run backend
npm run backend:dev

# 5. Run frontend
npm run dev

# 6. Access
# http://localhost:8080
```

### Cost (Development)
```
sentinel-employees:    ~$0.50/month (low volume)
sentinel-telemetry:    ~$5/month (medium volume)
sentinel-settings:     ~$0.10/month (low volume)
────────────────────────────────────────
Total:                 ~$5-10/month
```

### Backup Strategy (Development)
```bash
# Manual backup before making changes
aws dynamodb create-backup \
  --table-name sentinel-telemetry \
  --backup-name sentinel-telemetry-backup-$(date +%Y%m%d) \
  --region eu-north-1

# No PITR needed in dev
```

---

## Production Setup

### When to Use
- Live monitoring
- Multiple employees/devices
- SLA requirements
- Data protection requirements

### Enhanced Setup

#### 1. Use IAM Roles (Not User Keys)

**For EC2 Instance:**
```bash
# Create IAM role
aws iam create-role \
  --role-name sentinel-dynamodb-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach policy
aws iam attach-role-policy \
  --role-name sentinel-dynamodb-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

# Attach to EC2 instance
aws ec2 associate-iam-instance-profile \
  --iam-instance-profile Name=sentinel-dynamodb-role \
  --instance-id i-1234567890abcdef0
```

#### 2. Convert to Provisioned Capacity

```bash
# Update each table
aws dynamodb update-billing-mode \
  --table-name sentinel-employees \
  --billing-mode PROVISIONED \
  --provisioned-throughput ReadCapacityUnits=100,WriteCapacityUnits=50 \
  --region eu-north-1

# For high-volume telemetry table
aws dynamodb update-billing-mode \
  --table-name sentinel-telemetry \
  --billing-mode PROVISIONED \
  --provisioned-throughput ReadCapacityUnits=500,WriteCapacityUnits=500 \
  --region eu-north-1
```

#### 3. Enable Encryption at Rest

```bash
# Enable KMS encryption
aws dynamodb update-table \
  --table-name sentinel-employees \
  --sse-specification Enabled=true,SSEType=KMS \
  --region eu-north-1
```

#### 4. Enable Point-in-Time Recovery

```bash
# For each table
aws dynamodb update-continuous-backups \
  --table-name sentinel-employees \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region eu-north-1

aws dynamodb update-continuous-backups \
  --table-name sentinel-telemetry \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region eu-north-1

aws dynamodb update-continuous-backups \
  --table-name sentinel-settings \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region eu-north-1
```

#### 5. Setup CloudWatch Monitoring

```bash
# Create alarm for write capacity
aws cloudwatch put-metric-alarm \
  --alarm-name sentinel-write-capacity-high \
  --alarm-description "Alert when write capacity exceeds 80%" \
  --metric-name ConsumedWriteCapacityUnits \
  --namespace AWS/DynamoDB \
  --statistic Average \
  --period 300 \
  --threshold 400 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=TableName,Value=sentinel-telemetry \
  --alarm-actions arn:aws:sns:eu-north-1:123456789012:alerts

# Create alarm for read capacity
aws cloudwatch put-metric-alarm \
  --alarm-name sentinel-read-capacity-high \
  --alarm-description "Alert when read capacity exceeds 80%" \
  --metric-name ConsumedReadCapacityUnits \
  --namespace AWS/DynamoDB \
  --statistic Average \
  --period 300 \
  --threshold 400 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=TableName,Value=sentinel-telemetry \
  --alarm-actions arn:aws:sns:eu-north-1:123456789012:alerts
```

#### 6. Setup Auto-Scaling

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id table/sentinel-telemetry \
  --scalable-dimension dynamodb:table:WriteCapacityUnits \
  --min-capacity 100 \
  --max-capacity 2000 \
  --region eu-north-1

# Create scaling policy
aws application-autoscaling put-scaling-policy \
  --policy-name sentinel-write-scaling \
  --policy-type TargetTrackingScaling \
  --service-namespace dynamodb \
  --resource-id table/sentinel-telemetry \
  --scalable-dimension dynamodb:table:WriteCapacityUnits \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "DynamoDBWriteCapacityUtilization"
    },
    "ScaleOutCooldown": 60,
    "ScaleInCooldown": 300
  }' \
  --region eu-north-1
```

#### 7. VPC Endpoint (Optional, for extra security)

```bash
# Create VPC endpoint for DynamoDB
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-12345678 \
  --service-name com.amazonaws.eu-north-1.dynamodb \
  --route-table-ids rtb-12345678 \
  --region eu-north-1
```

#### 8. Setup Automated Backups

```bash
# Enable on-demand backup
aws dynamodb update-continuous-backups \
  --table-name sentinel-telemetry \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region eu-north-1

# Create backup plan with AWS Backup (console)
# AWS Console → Backup → Create backup plan
# ├─ Resources: sentinel-telemetry
# ├─ Frequency: Daily
# ├─ Retention: 30 days
# └─ Save backup plan
```

### Cost Estimation (Production)

```
Provisioned Capacity Model:

sentinel-employees:
├─ Read: 100 units × 0.00013 × 730 = $9.49
├─ Write: 50 units × 0.00065 × 730 = $23.73
└─ Subtotal: $33.22

sentinel-telemetry (High Volume):
├─ Read: 500 units × 0.00013 × 730 = $47.45
├─ Write: 500 units × 0.00065 × 730 = $237.25
└─ Subtotal: $284.70

sentinel-settings:
├─ Read: 50 units × 0.00013 × 730 = $4.75
├─ Write: 25 units × 0.00065 × 730 = $11.87
└─ Subtotal: $16.62

Storage (avg 100GB):
└─ $0.25 × 100 = $25.00

Backups:
└─ Snapshots: $10-20/month

────────────────────────────────────────
Total Monthly: ~$370-380
Total Annual: ~$4,400-4,600
```

---

## Migration Path: Dev → Production

### Step 1: Export Data (Dev)
```bash
# Backup dev tables
aws dynamodb create-backup \
  --table-name sentinel-employees \
  --backup-name sentinel-employees-prod-$(date +%Y%m%d) \
  --region eu-north-1

aws dynamodb create-backup \
  --table-name sentinel-telemetry \
  --backup-name sentinel-telemetry-prod-$(date +%Y%m%d) \
  --region eu-north-1

aws dynamodb create-backup \
  --table-name sentinel-settings \
  --backup-name sentinel-settings-prod-$(date +%Y%m%d) \
  --region eu-north-1
```

### Step 2: Restore to Production Env
```bash
# In production AWS account, restore from backup
aws dynamodb restore-table-from-backup \
  --target-table-name sentinel-employees \
  --backup-arn arn:aws:dynamodb:eu-north-1:123456789012:table/sentinel-employees/backup/01234567890123-abcdef01 \
  --region eu-north-1
```

### Step 3: Update Configuration
```bash
# Update .env in production
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=<PROD_IAM_ROLE> (no user key!)
DDB_EMPLOYEE_TABLE=sentinel-employees
# ... etc
```

### Step 4: Enable Production Features
```bash
# Enable PITR, encryption, monitoring (see above)
```

### Step 5: Test & Validate
```bash
# Test health endpoint
curl https://api.mycompany.com:4000/health

# Test bootstrap endpoint
curl "https://api.mycompany.com:4000/api/bootstrap?employeeId=EMP001"

# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedWriteCapacityUnits \
  --dimensions Name=TableName,Value=sentinel-telemetry \
  --start-time 2026-04-20T00:00:00Z \
  --end-time 2026-04-21T00:00:00Z \
  --period 3600 \
  --statistics Average
```

---

## Common Production Scenarios

### Scenario 1: Spike in Telemetry (High Load)

**Problem:** Suddenly thousands of devices sending telemetry

**Solution:**
```bash
# Auto-scaling handles it automatically if enabled
# Check metrics:
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=sentinel-telemetry \
  --start-time 2026-04-20T10:00:00Z \
  --end-time 2026-04-20T11:00:00Z \
  --period 60 \
  --statistics Sum

# If errors, increase provisioned capacity
aws dynamodb update-table \
  --table-name sentinel-telemetry \
  --provisioned-throughput ReadCapacityUnits=2000,WriteCapacityUnits=2000 \
  --region eu-north-1
```

### Scenario 2: Data Corruption

**Problem:** Bad data written to table

**Solution:**
```bash
# Use PITR to restore
aws dynamodb restore-table-to-point-in-time \
  --source-table-name sentinel-telemetry \
  --target-table-name sentinel-telemetry-restore \
  --use-latest-restorable-time \
  --region eu-north-1

# Verify data, then:
# 1. Rename tables
# 2. Update applications to use restored table
# 3. Delete old table
```

### Scenario 3: Compliance Audit

**Problem:** Need to prove data security & backups

**Solution:**
```bash
# Show encryption status
aws dynamodb describe-table \
  --table-name sentinel-employees \
  --query 'Table.SSEDescription' \
  --region eu-north-1

# Show backup status
aws dynamodb describe-continuous-backups \
  --table-name sentinel-employees \
  --region eu-north-1

# Show access logs
aws s3 ls s3://my-dynamodb-logs/
```

---

## Quick Decision Tree

```
Starting New Project?
├─ For Local Development
│  └─ Use: Development Setup (above)
│     ├─ PAY_PER_REQUEST billing
│     ├─ Local AWS CLI
│     └─ No backup needed
│
├─ For Staging/Demo
│  └─ Use: Development + Backups
│     ├─ PAY_PER_REQUEST billing
│     ├─ Enable manual backups
│     └─ Monitor metrics
│
└─ For Production
   └─ Use: Production Setup (above)
      ├─ Provisioned capacity
      ├─ Auto-scaling + monitoring
      ├─ Encryption + PITR
      ├─ IAM roles (no keys!)
      └─ Backup automation
```

---

## Summary Table

```
╔════════════════════╦═════════════════╦═════════════════╗
║ Feature            ║ Development     ║ Production      ║
╠════════════════════╬═════════════════╬═════════════════╣
║ Billing            ║ PAY_PER_REQUEST ║ PROVISIONED     ║
║ Cost/mo            ║ $5-10           ║ $300-400        ║
║ Setup Time         ║ 5 min           ║ 30 min          ║
║ Scaling            ║ Auto            ║ Auto            ║
║ Backup             ║ Manual          ║ Automated       ║
║ Encryption         ║ No              ║ Yes (KMS)       ║
║ PITR               ║ No              ║ Yes             ║
║ Monitoring         ║ Basic           ║ CloudWatch      ║
║ Alerts             ║ No              ║ Yes             ║
║ VPC Endpoint       ║ No              ║ Optional        ║
║ IAM Roles          ║ No              ║ Yes             ║
║ Multi-Region       ║ No              ║ Optional        ║
╚════════════════════╩═════════════════╩═════════════════╝
```
