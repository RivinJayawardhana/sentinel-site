# Employee Device Reassignment Guide

## Overview

Employees can change their assigned IoT device without losing historical data or thresholds. This is useful for:
- Device replacement (battery dead, hardware failure)
- Device swapping between employees
- Troubleshooting (trying a different device)
- Maintenance operations

---

## How It Works

### Device-Employee Relationship

```
Employee (EMP001)
└─ Assigned Device: DEV-EMP001 (current device)
   └─ All telemetry with deviceId=DEV-EMP001 → associated with EMP001

Change Device:
Employee (EMP001)
└─ Assigned Device: DEV-EMP002 (new device)
   └─ New telemetry with deviceId=DEV-EMP002 → associated with EMP001
   └─ Old telemetry with deviceId=DEV-EMP001 → still associated with EMP001 (history preserved)
```

---

## Device Change Process

### Step 1: Navigate to Settings
```
Dashboard → Click "Settings" in sidebar
```

### Step 2: Find Device Management Section
```
Settings Page
├─ Alert Thresholds
├─ Zone Management
├─ Device Management ← You are here
└─ Notification Settings
```

### Step 3: Click "Change Device" Button
```
Device Management Table
┌─────────────────────────────────────────────────┐
│ Device ID  │ Worker      │ Status    │ Actions   │
├─────────────────────────────────────────────────┤
│ DEV-EMP001 │ John Smith  │ connected │ [Change]  │
└─────────────────────────────────────────────────┘
```

### Step 4: Enter New Device ID
```
Change IoT Device Dialog
├─ Current device: DEV-EMP001
├─ New Device ID input: [_____________]
│  (e.g., "DEV-EMP002" or "DEV001" or "DEVICE-45")
└─ Buttons: [Cancel] [Change Device]
```

### Step 5: Confirm Change
```
Click "Change Device" button
↓
Backend validates:
  ✓ Device ID is not empty
  ✓ Device ID is different from current
  ✓ Employee exists
↓
Device updated in DynamoDB
↓
UI refreshes with new device
↓
Toast notification: "Device changed from DEV-EMP001 to DEV-EMP002"
```

---

## Backend API

### Endpoint: PUT /api/employee/:employeeId/device

**Request:**
```bash
curl -X PUT http://localhost:4000/api/employee/EMP001/device \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "DEV-EMP002"}'
```

**Request Body:**
```json
{
  "deviceId": "DEV-EMP002"
}
```

**Response (Success):**
```json
{
  "message": "Device changed from DEV-EMP001 to DEV-EMP002",
  "employee": {
    "id": "EMP001",
    "name": "John Smith",
    "deviceId": "DEV-EMP002",  ← Updated
    "zone": "Zone A",
    "shift": "Morning",
    "role": "Factory Worker",
    "updatedAt": 1713607845     ← Timestamp of change
  }
}
```

**Error Responses:**

```json
// Device ID missing
{
  "message": "deviceId is required and must be a string"
}

// Device ID empty
{
  "message": "deviceId cannot be empty"
}

// Employee not found
{
  "message": "Failed to update device",
  "error": "Employee EMP001 not found"
}

// Server error
{
  "message": "Failed to update device",
  "error": "Connection timeout to DynamoDB"
}
```

---

## Frontend Hook

### useUpdateDevice Hook

```typescript
import { useUpdateDevice } from "@/hooks/useMonitoringData";

// In component:
const updateDevice = useUpdateDevice("EMP001");

// Call to change device:
await updateDevice.mutateAsync("DEV-EMP002");

// Hook automatically:
// 1. Sends PUT request to backend
// 2. Shows loading state (button disabled)
// 3. On success: invalidates React Query cache (UI refreshes)
// 4. On error: throws error (caught and shown in toast)
```

---

## API Client Function

### updateEmployeeDevice()

```typescript
// src/lib/api.ts

export function updateEmployeeDevice(employeeId: string, deviceId: string) {
  return requestJson<{ message: string; employee: any }>(
    `/api/employee/${encodeURIComponent(employeeId)}/device`,
    {
      method: "PUT",
      body: JSON.stringify({ deviceId }),
    }
  );
}
```

---

## Data Flow

```
1. USER CLICKS "Change Device"
   └─ DeviceChangeDialog opens
   └─ Current device shown
   └─ Input field for new device

2. USER ENTERS NEW DEVICE ID
   └─ Updates local state

3. USER CLICKS "CHANGE DEVICE"
   └─ Validates device ID not empty
   └─ Validates device ID != current device
   └─ Calls useUpdateDevice.mutateAsync(newDeviceId)

4. REACT QUERY SENDS REQUEST
   └─ POST PUT /api/employee/EMP001/device
   └─ Body: {"deviceId": "DEV-EMP002"}

5. BACKEND PROCESSES
   └─ Receive employeeId=EMP001, deviceId=DEV-EMP002
   └─ Fetch employee from sentinel-employees
   └─ Verify employee exists
   └─ Update employee.deviceId = DEV-EMP002
   └─ Update employee.updatedAt = now()
   └─ Save to DynamoDB
   └─ Return updated employee object

6. FRONTEND RECEIVES RESPONSE
   └─ On success: invalidate React Query cache
   └─ React Query refetches useMonitoringData
   └─ Bootstrap response includes updated workers list
   └─ UI re-renders with new device ID

7. USER SEES CONFIRMATION
   └─ Dialog closes
   └─ Toast message: "Device changed from DEV-EMP001 to DEV-EMP002"
   └─ Device Management table updates
   └─ New device ID displayed
```

---

## Database Changes

### Before Device Change
```
DynamoDB: sentinel-employees

id: EMP001
├─ name: "John Smith"
├─ deviceId: "DEV-EMP001"  ← Old device
├─ zone: "Zone A"
├─ updatedAt: 1713607800
```

### After Device Change
```
DynamoDB: sentinel-employees

id: EMP001
├─ name: "John Smith"
├─ deviceId: "DEV-EMP002"  ← New device (UPDATED)
├─ zone: "Zone A"
├─ updatedAt: 1713607845   ← Timestamp updated
```

### Historical Telemetry (UNCHANGED)
```
DynamoDB: sentinel-telemetry

OLD RECORDS (still valid):
├─ employeeId: EMP001
├─ sk: "2026-04-20#15:30:45#1"
├─ deviceId: "DEV-EMP001"  ← Old device ID
├─ temperature: 36.5
└─ timestamp: 1713607845

NEW RECORDS (after change):
├─ employeeId: EMP001
├─ sk: "2026-04-20#15:35:20#2"
├─ deviceId: "DEV-EMP002"  ← New device ID
├─ temperature: 36.3
└─ timestamp: 1713607920
```

---

## Edge Cases & Validation

### Case 1: Changing to Same Device ID
```
Current: DEV-EMP001
New: DEV-EMP001 (same)
↓
Toast Error: "New device ID is the same as current device"
Action: No change made
```

### Case 2: Empty Device ID
```
New: "" (empty)
↓
Toast Error: "Please enter a device ID"
Action: No change made
```

### Case 3: Whitespace Only
```
New: "   " (spaces)
↓
Backend: Strips whitespace automatically
Result: Treated as empty
Action: Error message shown
```

### Case 4: Device ID Not Found (New Device Offline)
```
Old: DEV-EMP001 (online)
New: DEV-EMP999 (doesn't exist)
↓
Device Changed Successfully ✓
(Backend doesn't validate device existence, only employee existence)
↓
Telemetry updates stop until new device connects
Status: Changes to "offline" after 5 min no data
```

### Case 5: Employee Not Found
```
employeeId: EMP999 (doesn't exist)
↓
Toast Error: "Failed to update device: Employee EMP999 not found"
Action: No change made
```

---

## Monitoring After Device Change

### What Happens to Old Telemetry?
✓ **Preserved** - All historical data remains
✓ **Still associated** with employee
✓ **Used for analytics** - trends, charts still show old data
✓ **Not visible in real-time** - old device no longer sends data

### What About Real-Time Monitoring?
After device change:
1. Old device (DEV-EMP001):
   - May still send data
   - New data won't be associated with employee
   - Can be reassigned to different employee

2. New device (DEV-EMP002):
   - First connection within 30 seconds
   - Data appears in live monitoring
   - Status becomes "normal"
   - Charts update with new data points

### Transition Period (Typical Flow)
```
T-0:00    Click "Change Device"
          Old device: DEV-EMP001 (monitoring active)
          
T+0:10    Device change confirmed
          Old device: DEV-EMP001 (still might send data)
          New device: DEV-EMP002 (not yet sending)
          Status: Loading (no new data)
          
T+0:30    New device connects and sends first data
          New device: DEV-EMP002 ✓ (online)
          Real-time data resumes
          Charts update
          Status: Normal
          
T+1:00    Backend detects old device offline
          Old device: DEV-EMP001 (marked offline)
          No more data from old device shown
```

---

## CLI Examples

### Change Device Using curl

```bash
# Change employee EMP001 to new device
curl -X PUT http://localhost:4000/api/employee/EMP001/device \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "DEV-EMP002"}'
```

### Check Current Device in DynamoDB

```bash
# Get employee record
aws dynamodb get-item \
  --table-name sentinel-employees \
  --key '{"id": {"S": "EMP001"}}' \
  --region eu-north-1 \
  --query 'Item.deviceId'

# Output: { "S": "DEV-EMP002" }
```

### View Update Timestamp

```bash
# Get last update time
aws dynamodb get-item \
  --table-name sentinel-employees \
  --key '{"id": {"S": "EMP001"}}' \
  --region eu-north-1 \
  --query 'Item.{deviceId, updatedAt}'
```

---

## UI Components

### DeviceChangeDialog Component

Located: `src/components/DeviceChangeDialog.tsx`

**Props:**
```typescript
interface DeviceChangeDialogProps {
  employeeId: string;        // EMP001
  currentDeviceId: string;   // DEV-EMP001
  employeeName: string;      // "John Smith"
}
```

**Features:**
- Shows current device in alert box
- Text input for new device ID
- Validation before submit
- Loading state during request
- Toast notifications (success/error)
- Dialog closes on success

**Usage:**
```tsx
<DeviceChangeDialog
  employeeId="EMP001"
  currentDeviceId="DEV-EMP001"
  employeeName="John Smith"
/>
```

---

## Troubleshooting

### "Device changed but no data appearing"
```
Reason: New device hasn't connected yet
Fix: Wait 30-60 seconds for device to send first data
   Or restart device to force reconnection
```

### "Change failed: Employee not found"
```
Reason: Employee ID is incorrect or not yet created
Fix: Verify employee exists in DynamoDB
   Create employee via API if missing
```

### "Old device still showing in monitoring"
```
Reason: Backend still receiving data from old device
Fix: Power off old device or deactivate it
   Backend will mark as offline after 5 min no data
```

### "New device shows "offline" after change"
```
Reason: New device hasn't connected yet
Fix: Ensure new device is powered on and configured
   Verify device can reach AWS API endpoint
   Check network connectivity on device
```

---

## Summary

✅ **Device Reassignment:** Simple one-click change in Settings  
✅ **Data Preservation:** All historical data and thresholds kept  
✅ **Real-Time Update:** New device data appears within 30 seconds  
✅ **Validation:** Backend prevents invalid changes  
✅ **Toast Feedback:** User sees clear success/error messages  
✅ **Automatic Refresh:** UI updates without page reload  

**Typical Time to Switch Devices:**
1. Open Settings: 1s
2. Enter new device ID: 10s
3. Click confirm: 1s
4. Backend processes: 100ms
5. UI updates: 500ms
6. New device connects: 30s
**Total: ~43 seconds to resume monitoring**
