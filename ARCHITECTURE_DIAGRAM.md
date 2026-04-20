# Device-Employee Connection Architecture Diagram

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         IOT DEVICE LAYER                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Device: DEV-EMP001                                                   │  │
│  │ ├─ Temperature Sensor      → reads body temp (36.5°C)                │  │
│  │ ├─ Humidity Sensor         → reads moisture (65%)                    │  │
│  │ ├─ Air Quality Sensor      → reads AQI (45)                         │  │
│  │ ├─ GPS                     → reads location (59.33°N, 18.07°E)      │  │
│  │ └─ Transmission            → sends every 30 seconds                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬─────────────────────────────────────────────────┘
                           │ HTTP POST (every 30s)
                           ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    AWS API GATEWAY ENDPOINT                                │
│  URL: https://76ezf3ssob.execute-api.eu-north-1.amazonaws.com/apistage   │
│                                                                            │
│  Stores raw telemetry:                                                    │
│  [                                                                        │
│    {                                                                      │
│      "id": "DEV-EMP001",                                                 │
│      "payload": {                                                        │
│        "temperature": 36.5,                                              │
│        "humidity": 65,                                                   │
│        "air_quality": 45,                                                │
│        "latitude": 59.3293,                                              │
│        "longitude": 18.0686                                              │
│      }                                                                    │
│    }                                                                      │
│  ]                                                                        │
└──────────────────────────┬─────────────────────────────────────────────────┘
                           │ Backend polls every 10s
                           ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Express.js)                                  │
│  Running on: http://localhost:4000                                        │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 1: Fetch Raw Data                                               │  │
│  │ ├─ GET https://76ezf3ssob.execute-api.eu-north-1.amazonaws.com/api  │  │
│  │ └─ Response: Array of device telemetry                               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                           ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 2: Normalize Data                                               │  │
│  │ ├─ Parse device ID: "DEV-EMP001"                                     │  │
│  │ ├─ Look up employee: "EMP001"                                        │  │
│  │ ├─ Validate sensor values with Zod schema                            │  │
│  │ └─ Output: TelemetryPoint[]                                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                           ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 3: Calculate Derived Metrics                                    │  │
│  │ ├─ Heart Rate = f(temperature, humidity)                             │  │
│  │ │  └─ baseline 72 + (temp-30)*3.2 + (humidity-65)*0.7               │  │
│  │ ├─ Status = derive(airQuality, temperature, thresholds)             │  │
│  │ │  └─ "normal" / "warning" / "critical"                             │  │
│  │ └─ Output: Enhanced TelemetryPoint with HR, Status                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                           ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 4: Check Thresholds & Generate Alerts                           │  │
│  │ ├─ Fetch thresholds for EMP001 from sentinel-settings               │  │
│  │ ├─ Compare each metric:                                              │  │
│  │ │  ├─ Temperature 36.5 < max(37.5)? YES → normal                    │  │
│  │ │  ├─ HR 72 within [60, 100]? YES → normal                          │  │
│  │ │  └─ Air Quality 45 > critical(50)? NO → ALERT                     │  │
│  │ └─ Output: Alert[]                                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                           ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 5: Persist to DynamoDB                                          │  │
│  │ ├─ INSERT sentinel-telemetry record                                  │  │
│  │ ├─ INSERT sentinel-alerts records (if any)                           │  │
│  │ └─ UPDATE sentinel-employees with latest status                     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬─────────────────────────────────────────────────┘
                           │ HTTP GET /api/bootstrap
                           ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                   DYNAMODB (AWS Cloud)                                     │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ sentinel-employees                                                 │   │
│  │ ┌──────────────────────────────────────────────────────────────┐  │   │
│  │ │ id: EMP001                                                   │  │   │
│  │ ├─ name: "John Smith"                                          │  │   │
│  │ ├─ deviceId: "DEV-EMP001"      ← Key connection               │  │   │
│  │ ├─ zone: "Zone A"                                              │  │   │
│  │ ├─ shift: "Morning"                                            │  │   │
│  │ └─ status: "active"                                            │  │   │
│  │ └──────────────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ sentinel-telemetry (Recent data for EMP001)                        │   │
│  │ ┌──────────────────────────────────────────────────────────────┐  │   │
│  │ │ [T-0s] sk: "2026-04-20#15:30:45#1"                          │  │   │
│  │ │        temperature: 36.5, humidity: 65, airQuality: 45     │  │   │
│  │ │        heartRate: 72, status: "normal"                     │  │   │
│  │ ├──────────────────────────────────────────────────────────────┤  │   │
│  │ │ [T-10s] sk: "2026-04-20#15:30:35#2"                         │  │   │
│  │ │         temperature: 36.4, humidity: 64, airQuality: 46    │  │   │
│  │ │         heartRate: 71, status: "normal"                    │  │   │
│  │ ├──────────────────────────────────────────────────────────────┤  │   │
│  │ │ [T-20s] sk: "2026-04-20#15:30:25#3"                         │  │   │
│  │ │         ... (last 180 points stored)                        │  │   │
│  │ └──────────────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ sentinel-settings (Thresholds for EMP001)                          │   │
│  │ ┌──────────────────────────────────────────────────────────────┐  │   │
│  │ │ employeeId: "EMP001"                                         │  │   │
│  │ ├─ thresholds.heartRate.min: 60                                │  │   │
│  │ ├─ thresholds.heartRate.max: 100                               │  │   │
│  │ ├─ thresholds.temperature.max: 37.5                            │  │   │
│  │ ├─ thresholds.temperature.criticalMax: 38.0                    │  │   │
│  │ ├─ thresholds.humidity.max: 70                                 │  │   │
│  │ └─ thresholds.airQuality.criticalMin: 50                       │  │   │
│  │ └──────────────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬─────────────────────────────────────────────────┘
                           │ GET /api/bootstrap?employeeId=EMP001
                           │ Response: BootstrapResponse
                           ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                                 │
│  Running on: http://localhost:8080                                        │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ React Query Hook: useMonitoringData("EMP001")                        │  │
│  │                                                                      │  │
│  │ ┌─────────────────────────────────────────────────────────────┐    │  │
│  │ │ Configuration:                                              │    │  │
│  │ │ ├─ refetchInterval: 10000ms  (poll every 10s)              │    │  │
│  │ │ ├─ staleTime: 5000ms         (cache for 5s)                │    │  │
│  │ │ └─ queryKey: ["monitoring-bootstrap", "EMP001"]            │    │  │
│  │ └─────────────────────────────────────────────────────────────┘    │  │
│  │                                                                      │  │
│  │ ┌─────────────────────────────────────────────────────────────┐    │  │
│  │ │ Response Data (BootstrapResponse):                          │    │  │
│  │ │ {                                                           │    │  │
│  │ │   workers: [                                                │    │  │
│  │ │     {                                                       │    │  │
│  │ │       id: "EMP001",                                         │    │  │
│  │ │       name: "John Smith",                                   │    │  │
│  │ │       zone: "Zone A",                                       │    │  │
│  │ │       status: "normal",                                    │    │  │
│  │ │       temperature: 36.5,                                   │    │  │
│  │ │       humidity: 65,                                         │    │  │
│  │ │       airQuality: 45,                                      │    │  │
│  │ │       heartRate: 72,                                        │    │  │
│  │ │       location: { lat: 59.3293, lng: 18.0686 }             │    │  │
│  │ │     }                                                       │    │  │
│  │ │   ],                                                        │    │  │
│  │ │   alerts: [                                                 │    │  │
│  │ │     {                                                       │    │  │
│  │ │       id: "ALT-AQ-001",                                     │    │  │
│  │ │       workerId: "EMP001",                                   │    │  │
│  │ │       type: "air_quality",                                  │    │  │
│  │ │       severity: "critical",                                │    │  │
│  │ │       message: "Critical air quality",                     │    │  │
│  │ │       status: "active"                                     │    │  │
│  │ │     }                                                       │    │  │
│  │ │   ],                                                        │    │  │
│  │ │   timeSeries: [ ... ],  (last 180 data points)             │    │  │
│  │ │   thresholds: { ... }                                       │    │  │
│  │ │ }                                                           │    │  │
│  │ └─────────────────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                           ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Page Components (Auto-update every 10 seconds)                       │  │
│  │                                                                      │  │
│  │ ┌─────────────────────────────────────────────────────────────┐    │  │
│  │ │ Dashboard.tsx                                               │    │  │
│  │ │ ├─ Worker KPI Cards       (Status: Normal ✓)               │    │  │
│  │ │ ├─ Vitals Summary         (HR: 72, Temp: 36.5)            │    │  │
│  │ │ ├─ Alerts Table           (0 active alerts)                │    │  │
│  │ │ └─ Health Status Chart    (trending normal)                │    │  │
│  │ └─────────────────────────────────────────────────────────────┘    │  │
│  │                                                                      │  │
│  │ ┌─────────────────────────────────────────────────────────────┐    │  │
│  │ │ LiveMonitoring.tsx                                          │    │  │
│  │ │ ├─ Selected Worker       (John Smith - EMP001)              │    │  │
│  │ │ ├─ Real-time Vitals      (HR graph, Temp gauge)             │    │  │
│  │ │ ├─ Location Map          (GPS: 59.33°N, 18.07°E)           │    │  │
│  │ │ └─ Threshold Indicators  (All OK ✓)                         │    │  │
│  │ └─────────────────────────────────────────────────────────────┘    │  │
│  │                                                                      │  │
│  │ ┌─────────────────────────────────────────────────────────────┐    │  │
│  │ │ AlertsCenter.tsx                                            │    │  │
│  │ │ ├─ Active Alerts         (0 critical, 0 high)               │    │  │
│  │ │ ├─ Alert History         (last 24 hours)                    │    │  │
│  │ │ └─ Acknowledge Button    (mark as resolved)                │    │  │
│  │ └─────────────────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬─────────────────────────────────────────────────┘
                           │ User Sees Real-Time Updates
                           ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                                     │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Dashboard View                                                       │  │
│  │                                                                      │  │
│  │  John Smith (EMP001)          Status: ✓ NORMAL                      │  │
│  │  ┌────────────────────────────────────────────────────────────────┐ │  │
│  │  │ Heart Rate: 72 bpm    ✓  │ Temperature: 36.5°C     ✓          │ │  │
│  │  │ Humidity: 65%         ✓  │ Air Quality: 45 (Good)  ✓          │ │  │
│  │  │ Location: Zone A      ✓  │ Shift: Morning          ✓          │ │  │
│  │  └────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                      │  │
│  │  Real-Time Health Trend                                             │  │
│  │  ┌────────────────────────────────────────────────────────────────┐ │  │
│  │  │ ╱╲╱╲╱╲     Heart Rate                                         │ │  │
│  │  │ 72│  └─┘╱╲  72 bpm (normal)                                   │ │  │
│  │  │   └──────────────→ Last 30 minutes                            │ │  │
│  │  └────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                      │  │
│  │  Alerts: None (Connected • Syncing every 10s)                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Timeline

```
T=0s      Device starts reading sensors
          ├─ Temp sensor: 36.5°C
          ├─ Humidity sensor: 65%
          ├─ Air quality: 45
          └─ GPS: 59.33°N, 18.07°E

T=30s     Device sends to AWS API
          POST /data {id: "DEV-EMP001", payload: {...}}

T=30-60s  Data available in AWS API

T=60s     Backend polls AWS API
          └─ GET https://76ezf3ssob.execute-api.eu-north-1.amazonaws.com/apistage/data
          └─ Response: [{id: "DEV-EMP001", payload: {...}}]

T=62s     Backend processes data
          ├─ Map device → employee: DEV-EMP001 → EMP001
          ├─ Validate data
          ├─ Calculate heart rate: 72 bpm
          ├─ Determine status: "normal"
          ├─ Check thresholds: All OK
          └─ Store in DynamoDB

T=65s     Frontend polls API (via React Query)
          └─ GET /api/bootstrap?employeeId=EMP001
          └─ Response: {workers: [{status: "normal", heartRate: 72, ...}], alerts: []}

T=66s     UI updates automatically
          ├─ Dashboard shows: Status NORMAL ✓
          ├─ Heart rate card: 72 bpm
          ├─ Temperature card: 36.5°C
          ├─ Chart adds new data point
          └─ User sees real-time data

T=70s     Backend polls again
          └─ (Cycle repeats every 10s)

Total Latency: 36 seconds from device read to UI display
(30s for device to AWS + 6s for backend to process + 0.5s for frontend)
```

---

## Connection States

### 1. **Initializing** (First Connection)
```
Employee Record Created
    ↓
Device Powered On with deviceId
    ↓
First Telemetry Sent
    ↓
Backend Detects New Device
    ↓
Create Default Employee Record
    ↓
Status: INITIALIZING (show loading spinner)
```

### 2. **Connected & Monitoring** (Normal Operation)
```
Device Sending Data Every 30s
    ↓
Backend Polling Every 10s
    ↓
Frontend Polling Every 10s
    ↓
UI Updating in Real-Time
    ↓
Status: CONNECTED (show green indicator)
```

### 3. **Alert Generated** (Threshold Exceeded)
```
Telemetry Exceeds Threshold
    ↓
Alert Created in DynamoDB
    ↓
Alert Returned in Bootstrap Response
    ↓
Frontend Displays Alert
    ↓
UI Shows Warning/Critical Color
    ↓
Status: ALERT (show red indicator + notification)
```

### 4. **Disconnected** (Device Offline)
```
No Telemetry for > 5 minutes
    ↓
Backend Marks as OFFLINE
    ↓
Frontend Shows Disconnected State
    ↓
Status: OFFLINE (show gray indicator)
```

---

## Complete Setup Checklist

- [ ] Employee record created in DynamoDB
  ```bash
  aws dynamodb put-item --table-name sentinel-employees \
    --item '{
      "id": {"S": "EMP001"},
      "name": {"S": "John Smith"},
      "deviceId": {"S": "DEV-EMP001"},
      "zone": {"S": "Zone A"},
      "shift": {"S": "Morning"},
      "status": {"S": "active"}
    }'
  ```

- [ ] IoT Device configured with correct ID
  ```bash
  DEVICE_ID=DEV-EMP001
  POLL_INTERVAL=30s
  ```

- [ ] Backend running and can reach AWS API
  ```bash
  npm run backend:dev
  curl http://localhost:4000/health
  ```

- [ ] Frontend running
  ```bash
  npm run dev
  ```

- [ ] Test end-to-end
  ```bash
  curl http://localhost:8080  # See dashboard
  ```

---

## Quick Reference: API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/ingest?employeeId=EMP001` | Fetch telemetry, process, store |
| GET | `/api/bootstrap?employeeId=EMP001` | Get complete snapshot for UI |
| GET | `/api/employee/:id/latest` | Get latest telemetry point |
| GET | `/api/employee/:id/history` | Get historical telemetry |
| GET | `/api/settings/:id` | Get thresholds |
| PUT | `/api/settings/:id` | Update thresholds |
| GET | `/health` | Backend health check |
