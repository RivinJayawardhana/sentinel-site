# AWS DynamoDB Table Creation Queries

These queries create the three required DynamoDB tables for the Sentinel monitoring system.

## Prerequisites

Set your AWS region (default: eu-north-1):
```bash
export AWS_REGION=eu-north-1
```

Or use the `--region` flag with each command.

---

## Table 1: sentinel-employees

**Purpose:** Store employee/worker data

**CLI Command:**
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

**Table Schema:**
- **Primary Key:** `id` (String) - Employee ID (e.g., "EMP001")
- **Attributes:**
  - `name` (String) - Employee name
  - `email` (String) - Email address
  - `role` (String) - Job role
  - `shift` (String) - Shift (Morning, Afternoon, Night)
  - `zone` (String) - Assigned zone (Zone A-E)
  - `deviceId` (String) - IoT device ID
  - `status` (String) - Current status (active, inactive, on-leave)
  - `createdAt` (Number) - Timestamp

---

## Table 2: sentinel-telemetry

**Purpose:** Store sensor telemetry data (temperature, humidity, air quality, location)

**CLI Command:**
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

**Table Schema:**
- **Partition Key:** `employeeId` (String) - Employee ID
- **Sort Key:** `sk` (String) - Timestamp or unique identifier (e.g., "2026-04-20#15:30:45#12345")
- **Attributes:**
  - `temperature` (Number) - In Celsius
  - `humidity` (Number) - Percentage
  - `airQuality` (Number) - AQI index
  - `latitude` (Number) - GPS latitude
  - `longitude` (Number) - GPS longitude
  - `heartRate` (Number) - Derived from telemetry
  - `timestamp` (Number) - Unix timestamp
  - `status` (String) - normal/warning/critical

---

## Table 3: sentinel-settings

**Purpose:** Store per-employee threshold configurations

**CLI Command:**
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

**Table Schema:**
- **Primary Key:** `employeeId` (String) - Employee ID
- **Attributes:**
  - `thresholds` (Map) - Contains:
    - `heartRate.min` (Number)
    - `heartRate.max` (Number)
    - `heartRate.criticalMax` (Number)
    - `temperature.min` (Number)
    - `temperature.max` (Number)
    - `temperature.criticalMax` (Number)
    - `humidity.min` (Number)
    - `humidity.max` (Number)
    - `humidity.criticalMax` (Number)
    - `airQuality.max` (Number)
    - `airQuality.criticalMax` (Number)
  - `updatedAt` (Number) - Last update timestamp

---

## Create All Tables at Once

```bash
#!/bin/bash
set -e

echo "Creating DynamoDB tables for Sentinel..."

# Table 1: sentinel-employees
echo "Creating sentinel-employees table..."
aws dynamodb create-table \
  --table-name sentinel-employees \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1

# Table 2: sentinel-telemetry
echo "Creating sentinel-telemetry table..."
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

# Table 3: sentinel-settings
echo "Creating sentinel-settings table..."
aws dynamodb create-table \
  --table-name sentinel-settings \
  --attribute-definitions AttributeName=employeeId,AttributeType=S \
  --key-schema AttributeName=employeeId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1

echo "Waiting for tables to become active..."
aws dynamodb wait table-exists --table-name sentinel-employees --region eu-north-1
aws dynamodb wait table-exists --table-name sentinel-telemetry --region eu-north-1
aws dynamodb wait table-exists --table-name sentinel-settings --region eu-north-1

echo "✓ All tables created successfully!"
```

---

## Verify Tables Created

```bash
aws dynamodb list-tables --region eu-north-1
```

Expected output:
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

## Sample Data Insertion

### Add sample employee
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
    "deviceId": {"S": "DEV001"},
    "status": {"S": "active"},
    "createdAt": {"N": "1713607200"}
  }' \
  --region eu-north-1
```

### Add sample telemetry
```bash
aws dynamodb put-item \
  --table-name sentinel-telemetry \
  --item '{
    "employeeId": {"S": "EMP001"},
    "sk": {"S": "2026-04-20#15:30:45#12345"},
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
```

### Add sample settings
```bash
aws dynamodb put-item \
  --table-name sentinel-settings \
  --item '{
    "employeeId": {"S": "EMP001"},
    "thresholds": {
      "M": {
        "heartRate": {"M": {"min": {"N": "60"}, "max": {"N": "100"}, "criticalMax": {"N": "120"}}},
        "temperature": {"M": {"min": {"N": "35"}, "max": {"N": "37.5"}, "criticalMax": {"N": "38.5"}}},
        "humidity": {"M": {"min": {"N": "30"}, "max": {"N": "70"}, "criticalMax": {"N": "85"}}},
        "airQuality": {"M": {"max": {"N": "100"}, "criticalMax": {"N": "150"}}}
      }
    },
    "updatedAt": {"N": "1713607200"}
  }' \
  --region eu-north-1
```

---

## Cleanup (Delete Tables)

```bash
aws dynamodb delete-table --table-name sentinel-employees --region eu-north-1
aws dynamodb delete-table --table-name sentinel-telemetry --region eu-north-1
aws dynamodb delete-table --table-name sentinel-settings --region eu-north-1
```

---

## CloudFormation Template (Alternative)

Save as `dynamodb-tables.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Sentinel Monitoring System DynamoDB Tables'

Resources:
  EmployeesTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: sentinel-employees
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH

  TelemetryTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: sentinel-telemetry
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: employeeId
          AttributeType: S
        - AttributeName: sk
          AttributeType: S
      KeySchema:
        - AttributeName: employeeId
          KeyType: HASH
        - AttributeName: sk
          KeyType: RANGE

  SettingsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: sentinel-settings
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: employeeId
          AttributeType: S
      KeySchema:
        - AttributeName: employeeId
          KeyType: HASH

Outputs:
  EmployeesTableName:
    Value: !Ref EmployeesTable
  TelemetryTableName:
    Value: !Ref TelemetryTable
  SettingsTableName:
    Value: !Ref SettingsTable
```

Deploy with:
```bash
aws cloudformation create-stack \
  --stack-name sentinel-dynamodb \
  --template-body file://dynamodb-tables.yaml \
  --region eu-north-1
```
