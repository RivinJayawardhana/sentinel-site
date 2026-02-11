

# IoT Industrial Worker Safety Monitoring System

## Overview
A professional, enterprise-grade dashboard for monitoring industrial worker safety with IoT sensor data. Built with a construction/industrial theme using Safety Orange, Dark Slate, and Light Grey. All screens use realistic mock data.

---

## Design System & Theme
- Custom color palette: Safety Orange (#F57C00), Dark Slate (#1E1E2F), Success Green, Warning Amber, Critical Red
- 8px grid spacing, rounded card corners, subtle shadows
- Large readable typography with clear hierarchy
- Desktop-first responsive layout

## Shared Layout
- **Fixed left sidebar** (dark slate background) with navigation: Dashboard, Live Monitoring, Workers, Alerts, Analytics, Settings
- **Top header bar** with system name, connection status indicator, and user info
- Collapsible sidebar with icon-only mini mode

---

## Screen 1 — Login
- Centered login card with company logo and system title
- Email & Password fields with a Role dropdown (Safety Officer / Manager)
- Safety Orange login button
- Subtle industrial pattern background
- Clear error states and validation

## Screen 2 — Dashboard Overview
- KPI summary cards (Active Workers, Normal, Warning, Critical, Active Alerts) with traffic-light colors
- Critical Alert banner (red, conditionally shown)
- Live Worker Status table with sorting and filtering
- Quick filter dropdowns (Zone, Status, Shift)
- "Last updated" timestamp indicator

## Screen 3 — Live Monitoring
- Left panel: searchable worker list with status badges
- Center panel: selected worker's live data cards (Heart Rate gauge, Temperature, Air Quality)
- Right panel: real-time line chart (simulated last 10 minutes) using Recharts
- Auto-refresh toggle
- Control-room monitoring aesthetic

## Screen 4 — Worker Details
- Worker profile card (ID, role, shift, device ID) with status badge
- Four metric cards: Heart Rate, Temperature, Air Quality, Location
- Trend charts (HR, Temp, AQ over time) using Recharts
- Alert timeline section
- Action buttons: Acknowledge Alert, Add Note, Escalate

## Screen 5 — Location & Zones
- Central illustrated SVG site map with color-coded zones (Safe, Restricted, Emergency)
- Worker markers on the map with status-colored dots
- Zone legend
- Right panel listing zone breach alerts
- Worker search function

## Screen 6 — Alerts Center
- Alert table with columns: Worker ID, Type, Severity, Time, Status
- Filters: Date, Severity, Worker, Zone
- Color-coded severity indicators
- Slide-out alert detail drawer on row click
- Action buttons: Acknowledge, Resolve, Escalate

## Screen 7 — Analytics & Reports
- Top filter bar (Date range, Worker, Zone)
- Line chart: Heart rate trends
- Bar chart: Alerts per day
- Pie chart: Risk distribution
- Scatter/correlation chart: Temperature vs Heart Rate
- Export button (CSV download)

## Screen 8 — Settings
- Threshold configuration section (Heart Rate, Temperature, Air Quality limits)
- Zone management (add/edit zones)
- Device management list
- Notification settings (toggles)
- User role management table
- Confirmation dialogs for destructive actions

