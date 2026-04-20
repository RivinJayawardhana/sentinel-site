# Employee-Device Connection & Real-Time Monitoring Architecture

## System Overview

```
IoT Devices → AWS API → Backend (Express) → DynamoDB → Frontend (React Query) → UI
   (Sensors)    (Telemetry)   (Process)     (Store)     (Real-time polling)
```

---

## 1. Device-to-Employee Assignment

### How Employees Connect to Devices

Each **employee** is connected to a **device** via the `deviceId` field in the employee record:

```
Employee Record:
{
  id: "EMP001",                    // Unique employee ID
  name: "John Smith",
  email: "john.smith@safeguard.io",
  role: "Factory Worker",
  shift: "Morning",
  zone: "Zone A",
  deviceId: "DEV-EMP001",          // ← Device association
  status: "active"
}
```

### Assignment Flow

1. **Create Employee** - Admin creates employee with device assignment
2. **Employee Registered** - Backend stores in DynamoDB `sentinel-employees` table
3. **Device Paired** - IoT device registers with the `deviceId`
4. **Telemetry Linked** - All telemetry with that `deviceId` goes to that employee

### Database Schema

**sentinel-employees table:**
```
PK: id (Employee ID)
├─ name: string
├─ deviceId: string ← Links to IoT device
├─ zone: string
├─ shift: string
├─ role: string
├─ status: string
└─ createdAt: timestamp
```

---

## 2. Real-Time Data Flow

### Step-by-Step Process

```
┌─────────────────────────────────────────────────────────────────────┐
│                        IoT DEVICE LAYER                             │
│  Temperature, Humidity, Air Quality, GPS Location Sensors           │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Sends data every 30 seconds
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    AWS API GATEWAY ENDPOINT                         │
│  https://76ezf3ssob.execute-api.eu-north-1.amazonaws.com/apistage  │
│  Returns: [{id: "DEV-EMP001", payload: {...}}]                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Backend polls every 10 seconds
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND PROCESSING                             │
│  1. Fetch raw telemetry from AWS API                                │
│  2. Normalize data (temperature, humidity, air quality, location)   │
│  3. Calculate derived metrics (heart rate, status)                  │
│  4. Check against thresholds                                        │
│  5. Generate alerts if thresholds exceeded                          │
│  6. Store in DynamoDB                                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP Response
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   DYNAMODB STORAGE LAYER                            │
│                                                                      │
│  sentinel-telemetry:                                                │
│  ├─ PK: employeeId ("EMP001")                                       │
│  ├─ SK: timestamp ("2026-04-20#15:30:45")                          │
│  ├─ temperature: 36.5                                               │
│  ├─ humidity: 65                                                    │
│  ├─ airQuality: 45                                                  │
│  ├─ latitude: 59.3293                                               │
│  ├─ longitude: 18.0686                                              │
│  ├─ heartRate: 72 (derived)                                         │
│  └─ status: "normal"                                                │
│                                                                      │
│  sentinel-alerts:                                                   │
│  ├─ workerId: "EMP001"                                              │
│  ├─ type: "temperature"                                             │
│  ├─ severity: "warning"                                             │
│  ├─ timestamp: "2026-04-20T15:30:45Z"                              │
│  └─ status: "active"                                                │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP GET /api/bootstrap
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React Query)                          │
│                                                                      │
│  useMonitoringData(employeeId):                                     │
│  ├─ Polls backend every 10 seconds                                 │
│  ├─ Caches data for 5 seconds                                       │
│  └─ Automatically refetches on focus/stale                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Real-time UI Updates
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                            │
│                                                                      │
│  ├─ Dashboard: Worker status overview                               │
│  ├─ Live Monitoring: Real-time vital signs                         │
│  ├─ Worker Details: Historical trends                              │
│  ├─ Alerts Center: Critical alerts                                 │
│  ├─ Analytics: Charts and trends                                   │
│  └─ Location Map: GPS positions                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend Telemetry Processing

### API Endpoint: POST /api/ingest

**Flow:**
```typescript
// 1. Fetch raw data from AWS telemetry endpoint
const response = await fetch("https://76ezf3ssob.execute-api.eu-north-1.amazonaws.com/apistage/data");
const rawData = await response.json();

// 2. Normalize and validate
const telemetryPoints = normalizeSourceRecords(rawData, employeeId);

// 3. Calculate derived metrics
for (const point of telemetryPoints) {
  point.heartRate = estimateHeartRate(point.temperature, point.humidity);
  point.status = deriveStatus(point.airQuality, point.temperature, thresholds);
}

// 4. Check thresholds and create alerts
const alerts = makeAlertFromPoint(point, worker, thresholds);

// 5. Store in DynamoDB
await upsertTelemetry(telemetryPoints);
```

### Key Transformations

**Raw Data (AWS API):**
```json
[
  {
    "id": "DEV-EMP001",
    "payload": {
      "temperature": 36.5,
      "humidity": 65,
      "air_quality": 45,
      "latitude": 59.3293,
      "longitude": 18.0686
    }
  }
]
```

**Processed Data (DynamoDB):**
```json
{
  "employeeId": "EMP001",
  "sk": "2026-04-20#15:30:45#12345",
  "temperature": 36.5,
  "humidity": 65,
  "airQuality": 45,
  "latitude": 59.3293,
  "longitude": 18.0686,
  "heartRate": 72,          ← Derived
  "status": "normal",        ← Derived
  "timestamp": 1713607845
}
```

---

## 4. Real-Time Monitoring on Frontend

### React Query Hook: useMonitoringData

```typescript
// Hook automatically polls every 10 seconds
export function useMonitoringData(employeeId = "EMP001") {
  return useQuery({
    queryKey: ["monitoring-bootstrap", employeeId],
    queryFn: () => fetchBootstrap(employeeId),  // GET /api/bootstrap?employeeId=EMP001
    refetchInterval: 10000,                     // Poll every 10 seconds
    staleTime: 5000,                            // Cache for 5 seconds
  });
}
```

### Polling Frequencies

| Component | Poll Interval | Cache Duration | Purpose |
|-----------|--------------|-----------------|---------|
| Dashboard | 10s | 5s | Worker overview |
| Live Monitoring | 10s | 5s | Real-time vitals |
| Alerts Center | 10s | 5s | Alert updates |
| Analytics | 30s | 10s | Trend data |

### Usage in Components

```typescript
// In Dashboard.tsx
function Dashboard() {
  const { data, isLoading, error } = useMonitoringData("EMP001");

  // data contains:
  // {
  //   workers: [],              // Employee objects
  //   alerts: [],               // Active alerts
  //   zones: [],                // Zone definitions
  //   timeSeries: [],           // Last 180 points
  //   thresholds: {}            // Threshold settings
  // }

  return (
    <>
      {isLoading && <LoadingState />}
      {error && <ErrorState />}
      {data && (
        <>
          <WorkerCards workers={data.workers} />
          <AlertsTable alerts={data.alerts} />
          <HealthChart timeSeries={data.timeSeries} />
        </>
      )}
    </>
  );
}
```

---

## 5. Setting Up Device-Employee Connection

### Step 1: Create Employee Record

```bash
# Via API
POST http://localhost:4000/api/employee
{
  "id": "EMP001",
  "name": "John Smith",
  "role": "Factory Worker",
  "shift": "Morning",
  "zone": "Zone A",
  "deviceId": "DEV-EMP001"   ← Must match device ID
}
```

### Step 2: Configure Device

```bash
# On IoT device / device firmware
DEVICE_ID = "DEV-EMP001"
POLL_INTERVAL = 30 seconds    # Send data every 30s
ENDPOINT = "https://76ezf3ssob.execute-api.eu-north-1.amazonaws.com/apistage/data"

# Device sensors read:
- Temperature sensor → temperature
- Humidity sensor → humidity
- Air quality sensor → air_quality
- GPS → latitude, longitude
```

### Step 3: Backend Auto-Sync

```bash
# Backend automatically syncs every 10 seconds
curl http://localhost:4000/api/ingest?employeeId=EMP001 -X POST

# Response:
{
  "employeeId": "EMP001",
  "inserted": 5,
  "scanned": 12,
  "alerts": [
    {
      "id": "ALT-TEMP-001",
      "type": "temperature",
      "severity": "warning",
      "message": "Temperature warning for EMP001"
    }
  ]
}
```

### Step 4: Frontend Displays Data

Frontend polls `/api/bootstrap?employeeId=EMP001` every 10 seconds:

```json
{
  "workers": [
    {
      "id": "EMP001",
      "name": "John Smith",
      "zone": "Zone A",
      "status": "normal",
      "temperature": 36.5,
      "humidity": 65,
      "airQuality": 45,
      "heartRate": 72,
      "location": { "lat": 59.3293, "lng": 18.0686 }
    }
  ],
  "alerts": [
    {
      "id": "ALT-AQ-001",
      "workerId": "EMP001",
      "type": "air_quality",
      "severity": "high",
      "message": "Air quality warning for John Smith",
      "status": "active"
    }
  ],
  "timeSeries": [
    { "timestamp": "15:30:00", "temperature": 36.4, "humidity": 64 },
    { "timestamp": "15:30:10", "temperature": 36.5, "humidity": 65 }
  ]
}
```

---

## 6. Threshold-Based Alerts

### Default Thresholds

```typescript
{
  heartRate: {
    min: 60,           // Normal minimum
    max: 100,          // Normal maximum
    criticalMax: 120   // Dangerous level
  },
  temperature: {
    min: 35.5,
    max: 37.5,         // Warning threshold
    criticalMax: 38.0  // Critical threshold
  },
  humidity: {
    min: 30,
    max: 70,           // Warning threshold
    criticalMax: 85    // Critical threshold
  },
  airQuality: {
    min: 70,           // Warning threshold
    criticalMin: 50    // Critical threshold
  }
}
```

### Alert Generation

```typescript
// When telemetry comes in:
if (temperature >= thresholds.temperature.criticalMax) {
  // Create CRITICAL alert
  alerts.push({
    severity: "critical",
    message: "Temperature critical: 38.5°C"
  });
} else if (temperature >= thresholds.temperature.max) {
  // Create WARNING alert
  alerts.push({
    severity: "high",
    message: "Temperature warning: 37.8°C"
  });
}
```

---

## 7. Complete Request Flow Example

### Scenario: Employee John Smith (EMP001) wears device DEV-EMP001

**T = 0s:** Admin creates employee record
```
POST /api/employee
{
  "id": "EMP001",
  "name": "John Smith",
  "deviceId": "DEV-EMP001"
}
```

**T = 5s:** Employee shifts to factory floor
- IoT device (DEV-EMP001) starts reading sensors

**T = 10s:** Backend polls AWS API
```
GET https://76ezf3ssob.execute-api.eu-north-1.amazonaws.com/apistage/data
Response: [
  {
    "id": "DEV-EMP001",
    "payload": { "temperature": 36.5, "humidity": 65, ... }
  }
]
```

**T = 11s:** Backend processes and stores
```
1. Identify employee: id = "DEV-EMP001" → "EMP001"
2. Fetch thresholds for EMP001
3. Calculate: heartRate = 72, status = "normal"
4. Compare with thresholds: All OK
5. Store in sentinel-telemetry
```

**T = 12s:** Frontend polls for updates
```
GET /api/bootstrap?employeeId=EMP001
Response: {
  "workers": [{
    "id": "EMP001",
    "name": "John Smith",
    "status": "normal",
    "temperature": 36.5,
    "heartRate": 72
  }],
  "alerts": []
}
```

**T = 13s:** UI updates in real-time
- Dashboard shows John as "Normal"
- Heart rate: 72 bpm
- Temperature: 36.5°C
- Chart updates with new data point

**T = 22s:** Next poll cycle (10s later)
- New sensor readings available
- UI automatically updates

---

## 8. Optimizations for Real-Time Performance

### Current Implementation
- ✅ 10-second polling interval (near real-time)
- ✅ React Query caching (5 seconds)
- ✅ Automatic refetch on window focus
- ✅ Lazy loading of components

### Future Enhancements

**WebSocket Connection** (for true real-time):
```typescript
// Instead of polling every 10s, use WebSocket
const socket = io('http://localhost:4000');

socket.on('telemetry-update', (data) => {
  // Update UI instantly (< 100ms)
  setWorkerData(data);
});
```

**Server-Sent Events (SSE)**:
```typescript
const eventSource = new EventSource('/api/stream/telemetry');

eventSource.addEventListener('update', (event) => {
  const data = JSON.parse(event.data);
  updateDashboard(data);
});
```

**GraphQL Subscriptions**:
```typescript
subscription OnTelemetryUpdate {
  telemetryUpdated(employeeId: "EMP001") {
    temperature
    humidity
    timestamp
  }
}
```

---

## 9. Monitoring Latency

```
Device Reading  →  AWS API  →  Backend  →  Frontend  →  UI Update
    (5ms)         (200ms)      (50ms)      (500ms)      (100ms)
    ─────────────────────────────────────────────────────────
           Total Latency: ~855ms (< 1 second)
```

---

## 10. Debugging Device-Employee Connection

### Check Device Registered
```bash
# Query employee record
aws dynamodb get-item \
  --table-name sentinel-employees \
  --key '{"id": {"S": "EMP001"}}' \
  --region eu-north-1
```

### Check Telemetry Flowing
```bash
# Query recent telemetry
aws dynamodb query \
  --table-name sentinel-telemetry \
  --key-condition-expression "employeeId = :id" \
  --expression-attribute-values '{":id": {"S": "EMP001"}}' \
  --scan-index-forward false \
  --limit 10 \
  --region eu-north-1
```

### Check Backend Logs
```bash
# Run backend with debug
DEBUG=* npm run backend:dev
```

### Check Frontend Network Tab
```
Browser DevTools → Network → Filter "bootstrap"
Shows: Request every 10s, response time < 200ms
```

---

## Summary

| Component | Responsibility | Update Frequency |
|-----------|---|---|
| IoT Device | Collects sensor data | Every 30s |
| AWS API | Stores raw telemetry | Devices push every 30s |
| Backend | Processes & alerts | Polls every 10s |
| DynamoDB | Stores normalized data | As backend writes |
| Frontend | Displays real-time UI | Polls every 10s |

**Overall Latency: < 1 second from sensor read to UI update**
