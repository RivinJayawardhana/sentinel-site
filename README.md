# Sentinel Monitoring Platform

This project now includes:

1. React frontend (Vite + TypeScript + shadcn)
2. Cloud-ready backend (Express + DynamoDB)
3. Real telemetry ingestion from AWS API endpoint
4. Single-employee assignment workflow for live monitoring

## Architecture

1. Backend ingests telemetry from:
	`https://76ezf3ssob.execute-api.eu-north-1.amazonaws.com/apistage/data`
2. Backend stores normalized records in DynamoDB.
3. Frontend reads monitoring snapshot from backend via React Query.
4. Threshold settings are persisted to DynamoDB.

## DynamoDB Tables

Create these tables in `eu-north-1` (or your selected region):

1. `sentinel-employees`
	- Partition key: `id` (String)

2. `sentinel-telemetry`
	- Partition key: `employeeId` (String)
	- Sort key: `sk` (String)

3. `sentinel-settings`
	- Partition key: `employeeId` (String)

## Environment Variables

Copy `.env.example` to `.env` and update values.

Key values:

1. `VITE_BACKEND_API_URL` (frontend -> backend URL)
2. `VITE_EMPLOYEE_ID` (assigned employee)
3. `AWS_REGION`
4. `DDB_EMPLOYEE_TABLE`
5. `DDB_TELEMETRY_TABLE`
6. `DDB_SETTINGS_TABLE`
7. `DEFAULT_EMPLOYEE_ID`

Set AWS credentials using one of:

1. `aws configure`
2. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
3. IAM role (recommended in deployed environment)

## Run Locally

Install dependencies:

```sh
npm i
```

Start backend:

```sh
npm run backend:dev
```

Start frontend (new terminal):

```sh
npm run dev
```

## Core Endpoints

1. `GET /health`
2. `POST /api/ingest?employeeId=EMP001`
3. `GET /api/bootstrap?employeeId=EMP001&sync=true`
4. `PUT /api/employee`
5. `GET /api/settings?employeeId=EMP001`
6. `PUT /api/settings?employeeId=EMP001`
7. `GET /api/employee/:id/latest`
8. `GET /api/employee/:id/history?limit=120`
9. `GET /api/employee/:id/alerts`

## Cloud Deployment Notes

For global access:

1. Deploy backend to AWS Lambda + API Gateway or ECS/Fargate.
2. Keep DynamoDB tables in cloud region.
3. Enable CORS on backend/API Gateway for your frontend domain.
4. Use Cognito/JWT auth before production rollout.

