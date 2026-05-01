# Visual Analytics Dashboard - Quick Viva Reference

## Project Overview
**Sentinel Site**: Industrial worker safety monitoring dashboard using React + Vite + shadcn/ui with real-time IoT data, ML anomaly detection, and interactive visualizations.

---

## 11 Key Visualizations & Why Each Exists

| # | Chart | Purpose | Why Chosen |
|---|-------|---------|-----------|
| 1 | **KPI Cards** | System health snapshot | Pre-attentive color coding → instant perception (<100ms) |
| 2 | **Alerts Over Time (stacked bars)** | Temporal patterns + source attribution | Stacking shows total while breaking down composition |
| 3 | **Alert Type Breakdown (horizontal bars)** | Problem category distribution | Long text needs horizontal space |
| 4 | **Heart Rate Comparison (bars)** | Worker peer benchmarking | Easy height comparison + threshold reference lines |
| 5 | **Vital Signs Trends (3 line charts)** | Individual worker history | Continuous lines show smooth trends over 2-hour window |
| 6 | **Temperature vs Heart Rate (scatter)** | Bivariate correlation discovery | Reveals heat stress pattern (both rising together) |
| 7 | **Severity Distribution (donut pie)** | Alert severity composition | Size + color instantly show if critical alert heavy |
| 8 | **Risk Distribution (pie)** | Worker status proportion | Shows % workforce in danger |
| 9 | **Interactive Map** | Geographic context | Spatial reasoning essential for zone-based safety |
| 10 | **Worker Leaderboard (table)** | Detailed record access | Charts show patterns; tables show facts |
| 11 | **Alert Log (table)** | Incident audit trail | Workflow tracking: active → acknowledged → resolved |

---

## Core Interactive Feature: Brushing & Linking

**Definition**: Click in one chart → other charts filter + table highlights matching data

### 4 Linking Flows:

**Flow 1: Time Bucket → Leaderboard**
```
User clicks "2pm" bar in Alerts Over Time
→ Yellow highlight on workers with 2pm alerts
→ Chip shows "Period: 2pm"
→ Enables: "Why did alerts spike at 2pm?"
```

**Flow 2: Alert Type → Severity Chart + Leaderboard**
```
User clicks "Heart Rate" bar
→ Severity pie filters to HR-only alerts
→ Orange highlight on affected workers
→ Enables: "Are HR alerts mostly critical?"
```

**Flow 3: Severity → Alert Type + Leaderboard**
```
User clicks "Critical" slice
→ Type bar filters to critical-only
→ Red highlight on critical-alert workers
→ Enables: "What types are critical?"
```

**Flow 4: Scatter Dot → Vital Trends + Leaderboard**
```
User clicks a worker dot
→ Vital signs chart switches to that worker's 2-hour history
→ Leaderboard scrolls to highlight row
→ Enables: "What is this worker's detailed history?"
```

**Analytical Value**: Hypothesis testing without dashboard switching

---

## Color Theory Applied

### Semantic Color Encoding:
```
Status:     Normal (green) | Warning (amber) | Critical (red)
Severity:   Low (blue) → Medium (amber) → High (orange) → Critical (red)
Source:     Backend (blue) | Threshold (amber) | ML (orange)
```

**Why**: 
- Universal understanding (red=danger globally recognized)
- Traffic light metaphor (ingrained in human cognition)
- Consistent across ALL visualizations (dashboards, maps, badges)

### Color-Blind Accessibility:
```
Scatter plot uses BOTH:
├── Color (red/amber/green)
└── Shape (triangle/diamond/circle) ← second encoding for protanopia users
```

---

## Gestalt Principles Used

| Principle | Application |
|-----------|-------------|
| **Proximity** | Charts grouped by theme in card sections |
| **Similarity** | All status badges same color = same safety level |
| **Continuity** | Line charts show continuous motion through time |
| **Enclosure** | Card borders contain each visualization |
| **Common Fate** | When brushing active, all linked elements highlight simultaneously |
| **Figure/Ground** | Selected rows full opacity; unselected rows 25% opacity |

---

## 3 User Personas & Their Features

### Safety Officer
- **Pages**: Analytics, LiveMonitoring, LocationZones, AlertsCenter
- **Need**: Real-time anomaly detection + drill-down investigation
- **Feature**: Brushing & linking across charts
- **Example**: "Investigate why Zone A had 8 alerts at 2pm"

### Manager  
- **Pages**: Dashboard, Analytics (filtered views)
- **Need**: Team performance trends + reporting
- **Feature**: CSV export, KPI overview, time-range filtering
- **Example**: "Generate weekly safety report for board meeting"

### Administrator
- **Pages**: Settings, LocationZones (zone editing), Workers (device management)
- **Need**: System configuration and policy enforcement
- **Feature**: Define danger zones, manage worker devices, threshold settings
- **Example**: "Create 50m exclusion zone around chemical storage"

---

## Data-Ink Ratio Optimizations

**What Was Removed** (decoration):
- Chart borders ❌ (don't encode data)
- 3D effects ❌ (reduce clarity)
- Unnecessary gridlines ❌ (faint instead)
- Redundant legends ❌ (integrated instead)

**What Was Kept** (data-encoding):
- Color ✓ (encodes status/severity/source)
- Icons ✓ (reinforce meaning in KPIs)
- Reference lines ✓ (show thresholds)
- Labels ✓ (identify variables)

**Result**: Minimal whitespace, maximal clarity

---

## Analytical Reasoning Flow

### Scenario: Safety Officer Investigates Anomaly

```
1. OBSERVATION
   Dashboard shows: 2 critical alerts (red badge)
   
2. AWARENESS  
   Navigates to Analytics page
   
3. PATTERN SEARCH
   Scans "Alerts Over Time" chart
   Notices: Spike at 2pm
   
4. HYPOTHESIS TESTING
   Clicks "2pm" bar (brushing)
   → 3 workers highlighted with yellow border
   Question: "Which types of alerts?"
   
5. ROOT CAUSE NARROWING
   Looks at "Alert Type Breakdown"
   Observes: Mostly temperature alerts
   Clicks "Temperature" bar
   → Severity pie filters to "High" (orange slices)
   
6. INDIVIDUAL INVESTIGATION
   Clicks worker row in leaderboard
   → Vital trends appear
   → Temperature chart: Steady rise from 2pm → spike 2:45pm
   → HR chart: Stable (not medical emergency)
   Interpretation: Heat exposure
   
7. GEOGRAPHIC CONTEXT
   Navigates to Location & Zones
   → Sees: Worker in outdoor Zone A at 2pm
   → Map shows: 3 other workers nearby
   
8. DECISION & ACTION
   Determines: Zone A reached 38°C at 2pm (heat wave)
   Action: Recommend moving 2pm shifts to early morning
   Navigates to AlertsCenter
   → Marks alerts as "Resolved (environmental)"
```

**Key Point**: Data visualization enabled this analysis chain without technical database queries.

---

## Filter & Control Architecture

### 7 Independent Filter Dimensions:

```
Main Filters (at top):
├── Time Range: 24h / 7d / 30d
├── Worker: All / Individual names
├── Zone: All / Zone A / Zone B / etc.
└── Status: All / Normal / Warning / Critical

Linking Filters (via chart interactions):
├── Alert Type: (selected in bar chart)
├── Severity: (selected in pie chart)
└── Time Bucket: (selected in time chart)
```

### Example Combination:
```
User sets: Time=24h, Zone=Zone C, Status=Critical
System shows: Only Zone C's critical alerts from last 24 hours
All charts update to this subset
```

---

## Real-Time Architecture

```
Worker Devices (every 2s)
  ↓ Heart Rate, Temperature, Air Quality
Backend API
  ↓
React useIoTData() hook
  ↓ Rolling buffer of 120+ readings
Charts (LineChart, ScatterChart components)
  ↓ Smooth animations on update
Dashboard updates every 5 seconds
```

### ML Integration:
```
New sensor reading arrives
  ↓
ML Engine runs (Isolation Forest, IQR, K-Means, Linear Regression)
  ↓
If anomaly detected → useMLAlertContext updated
  ↓
AlertContext propagates to all charts
  ↓
UI updates (new alert badge, leaderboard highlighting, KPI refresh)
```

---

## Design Decisions with Rationale

| Decision | Rationale |
|----------|-----------|
| Stacked bars vs grouped bars | Reduces width; easier to see total + composition |
| Donut vs pie chart | Inner space for title; easier to read slices |
| Horizontal bars for types | Long text names need horizontal space |
| Map instead of table for zones | Geographic context essential; visual is intuitive |
| Color + shape in scatter | Accessibility—color-blind users see shapes |
| Row dimming when linking active | 25% opacity still visible; clear distinction from active |
| Leaderboard at bottom | Provides detail backup; charts → table hierarchy |
| Active links shown as chips | Clear selection status; easy to clear individually |

---

## Accessibility Features

✓ **Color-Blind Safe**: Added shape redundancy to scatter (triangle/diamond/circle)
✓ **High Contrast**: Black text on white = 21:1 ratio (AAA standard)
✓ **Large Fonts**: KPI values 72px (visible from standing 2m away)
✓ **Hit Targets**: Buttons 44px minimum (mobile accessible)
✓ **ARIA Labels**: Interactive elements labeled for screen readers

---

## 5 Most Common Viva Questions & Answers

**Q1: Why NOT use a single integrated dashboard view?**
A: Page density would overwhelm users (8+ charts visible at once causes cognitive overload). Filtered views enable focus on one analytical question at a time.

**Q2: How does brushing & linking help analysis?**
A: It enables hypothesis testing without navigating away. "Show me all workers affected by this alert type" = one click instead of manual filtering across pages.

**Q3: Why stacked bars instead of small multiples?**
A: Stacking shows total alert count while breakdown visible (space efficient). Small multiples would need 3x width for same data.

**Q4: What makes the scatter plot valuable vs just a leaderboard table?**
A: Scatter reveals PATTERNS (correlation between temp & HR) invisible in tables. One glance shows if heat stress is systemic or individual.

**Q5: Why is real-time refresh every 5 seconds not every 1 second?**
A: Trade-off between responsiveness and network load. 5-second granularity captures anomalies while keeping API requests reasonable.

---

## Technical Stack

```
Frontend:     React 18 + TypeScript + Vite
Charts:       Recharts (SVG-based, composable)
Map:          Leaflet + react-leaflet
UI Components: shadcn/ui (Radix primitives + Tailwind)
State:        React Query (server) + Context API (derived data)
Real-Time:    WebSocket / polling for IoT data
ML:           Python backend (Isolation Forest, K-Means, Linear Regression)
```

---

## Key Statistics (Demonstrate Completeness)

- **11 visualization types** across 7 pages
- **7 independent filter dimensions**
- **4 interactive linking flows**
- **3 user roles** with tailored features
- **120+ real-time data points** per worker
- **ML alert engine** with 6 detection algorithms
- **7 alert type categories** monitored
- **4 severity levels** for categorization
- **5 KPI metrics** on main dashboard

---

## One-Sentence Pitches for Each Viz

1. **KPI Cards**: "See system status in <3 seconds without reading charts"
2. **Alerts Over Time**: "Identify when problems cluster; then investigate"
3. **Type Breakdown**: "Understand which sensors/algorithms are noisy"
4. **HR Comparison**: "Benchmark workers against peers with threshold lines"
5. **Vital Trends**: "Watch individual worker recovery across metrics"
6. **Scatter**: "Spot heat stress pattern (temp + HR rising together)"
7. **Severity Pie**: "What proportion of alerts are critical vs informational?"
8. **Risk Pie**: "What % of workforce is at risk right now?"
9. **Map**: "Spatial awareness—where are the hazards?"
10. **Leaderboard**: "Drill down from charts to detailed fact-checking"
11. **Alert Log**: "Audit trail for compliance—who took what action when"

---

**For Your Viva**: Lead with the ANALYTICAL VALUE of each choice. Examiners are asking "Why this vis?" not "Can you build a vis?" Show you understand visualization theory, not just implementation.

*Last Updated: 2025-05-01*
