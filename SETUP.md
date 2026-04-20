# Sentinel Monitoring App - Setup Guide

## Prerequisites
- Node.js/Bun installed
- AWS credentials configured (for DynamoDB access)
- Environment variables set up

## Environment Setup

Create a `.env` file in the root directory:

```
VITE_BACKEND_API_URL=http://localhost:8080/api
VITE_EMPLOYEE_ID=EMP001
BACKEND_PORT=4000
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
DDB_EMPLOYEE_TABLE=sentinel-employees
DDB_TELEMETRY_TABLE=sentinel-telemetry
DDB_SETTINGS_TABLE=sentinel-settings
```

## Running the App

### Option 1: Run Both in Separate Terminals (Recommended)

**Terminal 1 - Backend:**
```bash
npm run backend:dev
```
The backend will start on `http://localhost:4000`

**Terminal 2 - Frontend (Dev Server):**
```bash
npm run dev
```
The frontend will start on `http://localhost:8080` with auto-proxy to backend

### Option 2: Run Production Build

```bash
npm run build
npm run backend:dev   # in one terminal
# serve dist/ on another server
```

## How It Works

- **Frontend (port 8080):** React app with Vite dev server
- **Backend (port 4000):** Express.js with DynamoDB integration
- **Dev Proxy:** All `/api/*` requests from frontend automatically route to backend (no CORS needed during dev)

## Key Routes

### Frontend
- `/` → Redirects to login
- `/login` → Login page
- `/dashboard` → Worker status overview
- `/monitoring` → Live real-time monitoring
- `/workers` → Redirects to `/workers/EMP001` (or use VITE_EMPLOYEE_ID)
- `/workers/:id` → Individual worker details
- `/zones` → Location zone map
- `/alerts` → Alert management
- `/analytics` → Dashboard analytics
- `/settings` → Threshold configuration

### Backend API
- `GET /health` → Health check
- `GET /api/bootstrap?employeeId=EMP001` → Complete monitoring snapshot
- `POST /api/ingest` → Fetch and store telemetry
- `GET /api/employee/:id/latest` → Latest worker telemetry
- `GET /api/employee/:id/history` → Historical telemetry
- `GET /api/settings/:id` → Worker thresholds
- `PUT /api/settings/:id` → Update thresholds
- `PUT /api/employee` → Assign worker

## Troubleshooting

### Backend Not Starting
```bash
# Check if port 4000 is in use
netstat -ano | findstr :4000  # Windows
# Kill the process or change BACKEND_PORT
```

### CORS Errors (Production)
- Backend CORS is already configured with `app.use(cors())`
- For production, update `VITE_BACKEND_API_URL` to production backend URL

### Frontend Can't Reach Backend
1. Ensure backend is running: `npm run backend:dev`
2. Check port 4000 is accessible
3. Verify AWS credentials are set
4. Check DynamoDB tables exist in AWS

### "Failed to fetch" on Network Tab
- Check backend process is alive
- Review backend logs for errors
- Verify AWS_REGION and table names match your setup
