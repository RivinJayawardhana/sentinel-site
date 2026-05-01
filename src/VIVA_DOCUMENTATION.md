# Visual Analytics Dashboard - Viva Documentation

## Executive Summary

**Sentinel Site** is an interactive visual analytics dashboard designed for industrial worker safety monitoring. It combines real-time sensor data, machine learning analysis, and human-centered design to enable safety officers, managers, and administrators to make data-driven decisions about worker welfare in hazardous environments.

---

## 1. Dashboard Architecture & User Personas

### Target User Personas:

#### **1.1 Safety Officer (Primary User)**
- **Role**: Real-time monitoring and alert response
- **Goals**: Quickly identify critical situations, respond to alerts, investigate anomalies
- **Features**: LiveMonitoring page, Analytics with brushing/linking, Alert escalation workflow
- **Use Case**: "A worker's heart rate spiked 20% in 5 minutes—is this an anomaly or equipment malfunction?"

#### **1.2 Manager (Secondary User)**
- **Role**: Team oversight and performance reporting
- **Goals**: Track team metrics, identify trends, generate reports
- **Features**: Dashboard KPIs, Analytics trends, CSV export capability
- **Use Case**: "Show me which zones have the highest alert frequency this week"

#### **1.3 Administrator (Tertiary User)**
- **Role**: System configuration and policy enforcement
- **Goals**: Define danger zones, manage worker profiles, configure thresholds
- **Features**: Settings page, Zone creation/editing, Device management
- **Use Case**: "Define a 50m exclusion zone around the chemical storage area"

---

## 2. Visualization Types & Analytical Justification

### 2.1 KPI Cards (Metric Indicators)

**Dashboard Page - Top Section**

```
5 Key Performance Indicators:
├── Monitored Workers (count)
├── Critical Status (count)
├── Warning Status (count)
├── Active Alerts (count)
└── ML / Threshold Alerts (count)
```

**Why Used:**
- **Holistic Overview**: At a glance, shows system health without requiring chart interpretation
- **Pre-attentive Processing**: Large numbers + color coding allow instant perception (<100ms)
- **Hierarchical Information**: Different colors signal different severity levels

**Design Principles Applied:**
- **Color Theory**: Green (normal), Amber (warning), Red (critical) follow universal traffic-light semantics
- **Pre-attentive Attributes**: Size (large numbers) and color differentiation before conscious reading
- **Visual Hierarchy**: Icon + number + label guides the eye in priority order

**Analytical Value:**
- Enables decision-makers to assess system status in <3 seconds
- Identifies if immediate intervention is needed

---

### 2.2 Bar Charts (Categorical Comparison)

#### **2.2a Alerts Over Time** (Analytics Page)

**Data Visualization:**
```
Y-axis: Alert count (stacked)
X-axis: Time buckets (hourly/daily/weekly)
Segments: Backend | Threshold | ML
```

**Why Used:**
- **Temporal Patterns**: Identifies when alerts cluster (e.g., 3pm shift change spike)
- **Alert Source Attribution**: Stacked bars show which detection system triggered each alert
- **Trend Detection**: Visual shape reveals trends (rising, stable, declining)

**Design Choices:**
- **Stacking**: Shows total while breaking down composition
- **Color-Coding**: Each source has distinct color (blue=backend, amber=threshold, orange=ML)
- **Opacity Linking**: When selected, unselected bars fade to 20% opacity to highlight selection

**Interactive Feature - Brushing:**
- Click a time bucket → highlights all workers who had alerts in that period (yellow border in leaderboard)
- Enables drill-down: "What changed at 2pm that caused the spike?"

---

#### **2.2b Alert Type Breakdown** (Analytics Page)

**Data Visualization:**
```
Y-axis: Alert types (7 categories)
X-axis: Alert count
Bar Color: Orange (standard) → fades if not selected
```

**Alert Categories Monitored:**
1. **Heart Rate** - Cardiac abnormalities
2. **Temperature** - Heat exposure risk
3. **Air Quality** - Respiratory hazard
4. **Anomaly (ML)** - Statistical outlier detection
5. **Trend (ML)** - Sustained deviation from baseline
6. **Zone Breach** - GPS boundary violation
7. **Device Offline** - Equipment failure

**Why Used:**
- **Problem Attribution**: Shows which sensors/algorithms are most problematic
- **Resource Allocation**: If zone breaches dominate, focus on GPS accuracy
- **Multi-Source Analysis**: Combines threshold-based + ML-based detection

**Design Choice - Horizontal Layout:**
- Long alert type names need horizontal space
- Reduces eye movement vs. vertical chart
- Text labels remain readable

**Interactive Feature - Brushing:**
- Click a bar → filters severity pie to show only that alert type
- Highlights matching worker rows (orange border)

---

#### **2.2c Current Heart Rate (All Workers)** (Analytics Page)

**Data Visualization:**
```
Y-axis: Heart Rate (BPM)
X-axis: Individual workers
Bar Color: Green (normal) | Amber (warning) | Red (critical)
Reference Lines: Warning threshold + Critical threshold
```

**Why Used:**
- **Status-at-a-Glance**: Compares all workers on same metric in single view
- **Threshold Contextualization**: Reference lines show safety boundaries
- **Anomaly Spotting**: Outliers visually stand out vs. peers

**Design Principle - Color = Status:**
- No legend needed; color immediately signals safety state
- Follows Gestalt principle of similarity (similar colors = similar safety level)

---

### 2.3 Line Charts (Temporal Trends)

#### **2.3a Vital Signs Trends** (Analytics Page - Worker-Specific)

**Data Visualization:**
```
Three coordinated charts:
├── Heart Rate (BPM) - RED line
├── Temperature (°C) - AMBER line
└── Air Quality (AQI) - GREEN line

X-axis: Time (HH:MM format, 120 points = 2-hour window)
Y-axis: Metric value
Reference Line: Threshold for each metric
```

**Why Used:**
- **Multi-Variate Temporal Analysis**: Shows if worker is recovering or deteriorating across multiple dimensions
- **Threshold Comparison**: Reference lines enable instant judgment of safety state
- **Trend Detection**: Slope indicates direction (rising/falling/stable)

**Design Principle - Semantic Color:**
- Red=HR danger, Amber=Temp danger, Green=AQI safe
- Color encodes meaning, not just decoration
- User can recognize patterns without labels

**Analytical Narrative:**
- Flat line = stable condition
- Upward trend + approaching threshold = warning signal
- Multiple metrics rising together = systemic issue (e.g., heat stroke)

**When Used:**
- Triggered when user selects a specific worker in Analytics page
- Enables deep investigation of individual worker condition

---

#### **2.3b Real-Time Sensor History** (LiveMonitoring Page)

**Data Visualization:**
```
Single 10-minute rolling window chart:
├── HR (red line)
├── Temp (amber line)
└── AQI (green line)
Updates every 5 seconds
```

**Why Used:**
- **Live Monitoring**: Fresh data enables real-time response to emergencies
- **Multi-Metric Synchronization**: Correlations visible (e.g., HR rise + temp rise = heat stress)
- **Recent Context**: 10-minute window prevents information overload while capturing trends

**Data Refresh Strategy:**
- Updates every 5 seconds (12 refreshes per minute window)
- Rolling buffer maintains 120+ points for smooth visualization
- Old data falls off left side; new data enters from right

---

### 2.4 Pie/Donut Charts (Compositional Analysis)

#### **2.4a Alert Severity Distribution** (Analytics Page)

**Data Visualization:**
```
Donut Chart:
├── Low (blue) - informational alerts
├── Medium (amber) - moderate concern
├── High (orange) - significant risk
└── Critical (red) - emergency action needed

Inner radius: 45px (creates donut)
Outer radius: 85px (readable from 15cm distance)
Labels: Percentage + severity level
```

**Why Used:**
- **Proportional Relationships**: Users instantly see if alerts are mostly critical vs. mostly low
- **Color-Coded Severity**: No numbers needed; color + size convey severity distribution
- **Donut (not Pie)**: Inner hole allows title placement without obscuring chart

**Gestalt Principle - Enclosure:**
- Donut shape encloses each segment visually
- Users perceive each slice as distinct entity

**Interactive Feature - Brushing:**
- Click a slice → filters alert type bar to show only that severity
- Highlights matching worker rows (red border)
- Unmatched rows dim to 25% opacity

**Analytical Insight:**
- Heavy red = system needs immediate overhaul (too many critical alerts)
- Heavy blue = system robust, mostly catching minor issues

---

#### **2.4b Risk Distribution** (Analytics Dashboard)

**Data Visualization:**
```
Pie Chart:
├── Normal (green) - workers in safe range
├── Warning (amber) - workers at risk threshold
└── Critical (red) - workers in immediate danger
```

**Why Used:**
- **Workforce Health Snapshot**: What % of workforce is at risk?
- **Actionable Aggregate**: If 40% are in warning, broad intervention needed

---

### 2.5 Scatter Plot (Bivariate Correlation)

#### **Temperature vs Heart Rate Scatter** (Analytics Page)

**Data Visualization:**
```
X-axis: Temperature (°C)
Y-axis: Heart Rate (BPM)
Points: Individual workers
Point Color: Green (normal) | Amber (warning) | Red (critical)
Point Shape: Circle (normal) | Diamond (warning) | Triangle (critical)
Legend: Shows all three status groups
```

**Why Used:**
- **Correlation Discovery**: Users can visually see if HR rises with temp (heat stress indicator)
- **Outlier Detection**: Points far from main cluster signal anomalies
- **Comparative View**: All workers simultaneously on same axes

**Design Principle - Color + Shape Redundancy (Accessibility):**
- **Color**: Primary encoding (red=critical)
- **Shape**: Secondary encoding for colorblind users
  - Normal = Circle (standard dot)
  - Warning = Diamond (rotated square)
  - Critical = Triangle (pointed shape)
- **Why Both?**: Protanopia/deuteranopia users can't distinguish red/green, but shapes remain distinct

**Interactive Feature - Selection:**
- Click a dot → selects that worker
- Vital signs trend chart switches to show that worker's history
- Leaderboard scrolls to highlight that worker row
- Tooltip shows: Worker name, temp, HR, current status

**Analytical Narrative:**
- Scatter in upper-right = workers are getting hot AND elevated HR (heat stress pattern)
- Scatter in lower-left = normal conditions
- Vertical line = HR varying despite stable temp (possible anomaly/emotion/exertion)

---

### 2.6 Interactive Map (Geographic Visualization)

#### **Location & Zones Map** (LocationZones Page)

**Data Visualization:**
```
Leaflet Map with layers:
├── Worker Markers
│   ├── Color: Green/Amber/Red (by status)
│   ├── Animation: Pulsing glow if in danger zone
│   ├── Size: 24px radius
│   └── Popup: Worker name + vitals
├── Zone Circles
│   ├── Safe zones (green boundary, light fill)
│   ├── Restricted zones (amber boundary)
│   └── Emergency zones (red dashed, bold)
└── GPS Danger Zones
    └── Red dashed circles (user-defined exclusion areas)
```

**Why Used:**
- **Spatial Context**: Shows WHERE hazards are physically located
- **Boundary Enforcement**: Visual representation of danger zones
- **Real-Time Location**: Workers can be tracked in real-time
- **Multi-Dimensional**: Color shows status; position shows location

**Design Principle - Gestalt Proximity:**
- Workers clustered near restricted zone → visual signal of proximity risk
- Boundaries create natural grouping by zone

**Interactive Features:**
- Click worker marker → detail popup
- Hover marker → tooltip shows vitals
- Search to focus on specific worker
- Drag/zoom to explore areas

**Critical Safety Feature:**
- Visual warning when worker proximity to danger zone < 50m
- Animation (pulsing) draws attention to imminent zone breach

---

### 2.7 Data Tables (Detailed Records)

#### **2.7a Worker Alert Leaderboard** (Analytics Page)

**Data Visualization:**
```
Sortable Table (10 columns):
├── Worker name
├── Zone assigned
├── Status badge (color-coded)
├── Heart Rate (BPM)
├── Temperature (°C)
├── Air Quality (AQI)
├── Active alerts (count)
├── Critical alerts (count)
├── Total alerts (count)
└── Last alert timestamp
```

**Why Used:**
- **Detailed Record Access**: Charts show patterns; tables show facts
- **Drill-Down**: Supports investigation beyond visualizations
- **Sorting**: Users can rank workers by various metrics

**Design Principle - Table Hierarchy:**
- Sorted by: active alerts (DESC) → critical alerts (DESC)
- Visual emphasis on columns that change most frequently
- Row highlighting integrates with chart linking

**Interactive Features:**
- Click row → select worker (switches vital signs chart to that worker)
- Row highlighting shows which chart selections match
- Striped rows (alternating bg) reduce eye tracking distance
- Sticky header allows scrolling large datasets

**Data-Ink Ratio Optimization:**
- Removed borders between most rows (only bottom border on last row)
- Monospace font for numbers (easier comparison)
- Color badges replace multiple text columns

---

#### **2.7b Live Worker Status** (Dashboard Page)

**Data Visualization:**
```
Compact Table (5 columns):
├── Worker name
├── Zone
├── Status
├── Active alerts
└── Last alert time
```

**Why Used:**
- **Quick Reference**: Dashboard use case (not deep analysis)
- **Compactness**: Fits above-the-fold without scrolling
- **Actionable**: Click row → navigate to detailed analysis

---

#### **2.7c Alerts Center** (AlertsCenter Page)

**Data Visualization:**
```
Alert Log Table (8 columns):
├── Timestamp
├── Worker
├── Alert type
├── Severity (color badge)
├── Message
├── Source (ML/Threshold/Backend)
├── Status (Active/Ack/Resolved)
└── Actions (dropdown)
```

**Why Used:**
- **Alert Audit Trail**: Legal/compliance requirement for incident investigation
- **Status Workflow**: Track alert lifecycle (active → acknowledged → resolved)
- **Filtering**: Users can focus on specific alert types or sources

---

## 3. Interactive Features & Analytical Reasoning

### 3.1 Brushing & Linking (Multi-Chart Synchronization)

**Definition**: Selecting in one chart automatically filters data in other coordinated charts.

#### **Linking Flow 1: Time Bucket → Leaderboard**
```
User Action: Clicks "2pm" bar in "Alerts Over Time"
System Response:
  ├── Highlights all workers with alerts at 2pm (yellow border)
  ├── Dims workers with no alerts at 2pm (25% opacity)
  ├── Shows chip: "Period: 2pm"
  └── Enables question: "Why did alerts spike at 2pm?"
```

#### **Linking Flow 2: Alert Type → Severity + Leaderboard**
```
User Action: Clicks "Heart Rate" bar in "Alert Type Breakdown"
System Response:
  ├── Filters "Severity Distribution" pie to show only HR alerts
  ├── Highlights workers with HR alerts (orange border)
  ├── Shows chip: "Type: Heart Rate"
  └── Enables question: "Are HR alerts mostly critical or low-severity?"
```

#### **Linking Flow 3: Severity → Alert Type + Leaderboard**
```
User Action: Clicks "Critical" slice in "Severity Distribution"
System Response:
  ├── Filters "Alert Type Breakdown" bar to show only critical alerts
  ├── Highlights workers with critical alerts (red border)
  ├── Shows chip: "Severity: Critical"
  └── Enables question: "What types of alerts are critical?"
```

#### **Linking Flow 4: Scatter Dot → Vital Signs + Leaderboard**
```
User Action: Clicks a worker dot in "Temperature vs Heart Rate"
System Response:
  ├── Selects that worker
  ├── Vital Signs section switches to show that worker's history
  ├── Scrolls leaderboard to highlight that worker
  └── Enables question: "What is this worker's detailed history?"
```

**Analytical Value:**
- **Hypothesis Testing**: "Are morning shifts safer than evening?" → Filter by time, compare severity
- **Root Cause Analysis**: "Why is Zone A dangerous?" → Filter by zone, examine alert types
- **Anomaly Confirmation**: "Is this outlier a real problem?" → Scatter + trends confirm
- **Predictive Context**: "When do critical alerts happen?" → Time patterns enable anticipation

**Design Principle - Consistency:**
- Same interaction pattern across all charts
- Visual feedback (highlighting + dimming) consistent
- Link chips always visible when active

---

### 3.2 Filtering (Independent Data Subsetting)

**7 Filter Dimensions on Analytics Page:**

| Filter | Values | Purpose |
|--------|--------|---------|
| **Time Range** | 24h / 7d / 30d | Zoom to relevant period |
| **Worker** | All / Individual | Focus on specific person or team |
| **Zone** | All / Zone name | Geographic constraint |
| **Status** | All / Normal / Warning / Critical | Severity filtering |
| **Alert Type** | (via linking) | Problem category |
| **Alert Severity** | (via linking) | Risk level |
| **Time Bucket** | (via linking) | Temporal focus |

**Combination Example:**
```
User wants: "Show me critical alerts from Zone B in the last 24 hours"
User sets:
  ├── Time Range = "24h"
  ├── Zone = "Zone B"
  ├── Status = "Critical" (via severity slice click)
  └── Result: All charts update showing only matching data
```

**Analytical Value:**
- **Scoping**: Prevents decision-making on irrelevant data
- **Comparison**: Isolate one dimension to understand impact
- **Drill-Down**: Start broad, filter to specific context

---

### 3.3 Drill-Down Navigation (Hierarchical Exploration)

```
Dashboard (overview)
    ↓ click worker row
Workers/:id (individual detail)
    ├── Trend charts for all 3 vitals
    ├── ML Analysis snapshot (anomaly score, trends)
    └── Correlation metrics

Analytics (multi-worker patterns)
    ↓ click dot in scatter
    → Vital signs history appears
    ↓ click row in leaderboard
    → Navigate to Workers/:id

AlertsCenter (incident management)
    ↓ click alert row
    → Detail drawer with full context
    → Action buttons (acknowledge/resolve/escalate)
```

**Cognitive Path:**
1. **Observation**: See aggregate metric in visualization
2. **Question**: "Why is this happening?"
3. **Investigation**: Click to filter/drill-down
4. **Confirmation**: View supporting data in detail view
5. **Action**: Make decision and take action

---

## 4. Color Theory & Pre-Attentive Attributes

### 4.1 Semantic Color Encoding

**Status Colors (Consistent Everywhere):**
```
Normal   = HSL(122, 47%, 33%) = #22c55e = Green
          → Safety, health, go-ahead signal
          
Warning  = HSL(45, 96%, 56%) = #f59e0b = Amber/Yellow
          → Caution, attention needed, threshold approaching
          
Critical = HSL(0, 76%, 47%) = #ef4444 = Red
          → Emergency, immediate action required, danger
```

**Severity Colors (For Alerts):**
```
Low      = HSL(210, 40%, 60%) = Blue-gray → informational
Medium   = HSL(45, 96%, 56%) = Amber → attention needed
High     = HSL(28, 100%, 48%) = Orange → significant risk
Critical = HSL(0, 76%, 47%) = Red → emergency
```

**Alert Source Colors:**
```
Backend    = Blue (#3b82f6) → System-detected
Threshold  = Amber (#f59e0b) → Boundary crossed
ML         = Orange (#f97316) → Pattern detected
```

**Why This Palette:**
- **Universal Understanding**: Red=danger, green=safe recognized globally
- **Color-Blind Consideration**: Avoid pure red/green pairs (problematic for protanopia)
- **Perceptual Ordering**: Blue→Amber→Orange→Red follows increasing intensity
- **Contrast**: Each color distinct on white/dark background

### 4.2 Pre-Attentive Processing

**Definition**: Attributes perceived in <500ms without conscious attention.

**Applied in Dashboard:**
```
KPI Cards:
├── SIZE: Large number (72px font) → notice value immediately
├── COLOR: Green/Amber/Red → status without reading label
├── ICON: Visual symbol reinforces meaning
└── POSITION: Top of page → visual hierarchy

Leaderboard Table:
├── COLOR: Red border on row → immediately spot problems
├── ANIMATION: Pulse-glow on critical → draws attention
├── POSITION: Visual weight (brightness) → focuses eye
```

**Research Basis:**
- Human visual system processes color <100ms
- Shape recognition ~250ms
- Number reading requires 300-500ms conscious effort
- Icon decoding: 200-300ms for trained users

**Practical Application:**
- Safety officer enters dashboard
- Sees red KPI card (critical status)
- Instinctively looks at alert center
- Can respond within seconds (life-safety critical)

---

### 4.3 Visual Hierarchy

**Size Hierarchy:**
```
KPI Value (72px bold)
  ↓
KPI Label (14px regular)
  ↓
Chart Title (16px semibold)
  ↓
Axis Labels (10-12px)
  ↓
Tooltip Text (11px)
```

**Color Hierarchy (Saturation):**
```
Selected/Active:     Full saturation (#22c55e)
Normal:              Medium saturation (current state)
Unselected/Dimmed:   Low saturation (~25% opacity)
Disabled:            Grayscale
```

**Spatial Hierarchy:**
```
Page Top:    KPIs (most important)
↓
Upper Area:  Filters (controls)
↓
Main Content: Charts (analysis)
↓
Bottom:      Leaderboard (detail records)
```

---

## 5. Gestalt Principles & Design Patterns

### 5.1 Proximity

**Definition**: Elements positioned close together are perceived as a group.

**Applied:**
```
Analytics Page:
  ├── Group 1 (Top): KPIs cards (tight spacing)
  ├── Group 2: Filters (compact row)
  ├── Group 3: Linked Charts (2x2 grid)
  └── Group 4: Leaderboard (bottom section)

Each group separated by whitespace (space-y-6)
```

**Analytical Benefit:**
- Users perceive sections as logical units
- Reduces cognitive load (process section at a time)

---

### 5.2 Similarity

**Definition**: Elements with similar properties (color, shape, size) are grouped.

**Applied:**
```
Status Badges:
  ├── All "Normal" badges use green background
  ├── All "Warning" badges use amber background
  ├── All "Critical" badges use red background

Chart Cards:
  ├── All use same CardHeader/CardContent structure
  ├── All have same border/shadow styling
  ├── User instantly recognizes "this is a chart"
```

---

### 5.3 Continuity

**Definition**: Elements arranged in a line/curve are perceived as connected.

**Applied:**
```
Line Charts:
  ├── Heart rate drawn as continuous red line
  ├── User perceives trend as continuous motion through time
  ├── Brain fills in gaps between points
  
Leaderboard Links:
  ├── Chart highlighting + dimming creates visual flow
  ├── User perceives connection between chart and table
```

---

### 5.4 Enclosure

**Definition**: Elements enclosed by a boundary are perceived as group.

**Applied:**
```
Card Component:
  ├── Each visualization in rounded border box
  ├── Visual boundary = distinct data unit
  
Table Cells:
  ├── Each cell enclosed by borders
  ├── User perceives grid structure
  
Status Badge:
  ├── Color-filled capsule = distinct element
  ├── No ambiguity about what is/isn't a badge
```

---

### 5.5 Common Fate (Movement)

**Definition**: Elements moving together are perceived as related.

**Applied:**
```
Interactive Linking:
  ├── When time bucket selected:
  │   ├── Chart bar highlights (brightness increase)
  │   ├── Leaderboard rows highlight (border + bg color)
  │   ├── Text chips appear
  │   └── All changes happen simultaneously
  └── User perceives all as coordinated response
  
Hover Effects:
  ├── Row hover: background color + cursor change together
  ├── Signal: this element is interactive
```

---

### 5.6 Figure/Ground (Contrast)

**Definition**: Foreground elements pop against background due to contrast.

**Applied:**
```
Leaderboard Dimming:
  ├── Selected rows: full opacity (foreground)
  ├── Unselected rows: 25% opacity (background)
  ├── Contrast ratio: 4:1 → clearly different

Chart Highlighting:
  ├── Selected bars: full color (figure)
  ├── Unselected bars: 20% opacity (ground)
  ├── Gradient creates visual pop
```

---

## 6. Data-Ink Ratio & Visual Clarity

### 6.1 Data-Ink Ratio Definition

**Ratio** = (Ink used to display data) / (Total ink used)
- **High ratio** = efficient visualization (minimal decoration)
- **Low ratio** = cluttered (too much chart junk)

### 6.2 Applied Principles

| Element | Decision | Reason |
|---------|----------|--------|
| Chart borders | Removed | Don't convey data |
| Grid lines | Faint (opacity 0.1) | Aid reading, but minimal ink |
| 3D effects | Removed | Decorative, reduce clarity |
| Colors | Semantic | Each color encodes meaning |
| Legends | Integrated | Reduce whitespace |
| Icons | Minimal | Only in KPI cards (purposeful) |

### 6.3 Clarity Optimizations

**Typography:**
```
KPI Values:        72px bold (high contrast)
Chart Title:       16px semibold (clear hierarchy)
Axis Labels:       10px regular (readable, not dominate)
Tooltip Text:      11px (readable on small screens)
```

**Spacing:**
```
Card padding:      p-4 to p-6 (breathing room)
Chart height:      h-56 to h-52 (adequate vertical space)
Gap between cards: gap-4 to gap-6 (visual separation)
```

**Simplification:**
```
Instead of:  "Critical Alert - Heart Rate Elevation"
Simplified:  Red badge + "Critical" label + row highlight
Result:      User understands instantly vs. reading text
```

---

## 7. Page-by-Page Analysis

### 7.1 Dashboard Page

**Purpose**: System health overview for management decision-making

**Visualizations:**
```
1. KPI Cards (5) — at-a-glance metrics
2. Live Worker Status Table — sortable by zone/status/shift
3. Critical Alert Banner — attention grabber
```

**Analytical Flow:**
```
Manager Views Dashboard
  ↓ "2 critical alerts active"
  ↓ Reads banner message
  ↓ Clicks "Alerts" sidebar
  ↓ Navigates to AlertsCenter
  ↓ Acknowledges alerts
  ↓ Marks as resolved
```

**Color Theory:**
- KPI cards use semantic colors
- Red critical badge draws attention
- Green success badge reassures

**User Persona**: Manager (overview + action)

---

### 7.2 Analytics Page

**Purpose**: Deep analysis of patterns, trends, and correlations for safety officers and analysts

**Visualizations:**
```
Section 1 - Vital Trends (conditional):
├── Heart Rate trend (red line)
├── Temperature trend (amber line)
└── Air Quality trend (green line)

Section 2 - Overview Charts:
├── Alerts Over Time (stacked bar)
├── Alert Type Breakdown (horizontal bar)
├── Alert Severity Distribution (donut pie)
└── Temperature vs Heart Rate (scatter)

Section 3 - Summary:
└── Worker Alert Leaderboard (table, linked)
```

**Brushing & Linking Demonstration:**
```
Safety Officer wants: "Find workers with sustained high alerts at 3pm"
↓
1. Clicks "3pm" in Alerts Over Time
   → Yellow highlight on matching workers
   → Other workers fade to 25%
↓
2. Clicks "Critical" slice in Severity pie
   → Filters to critical-only alerts
   → Red highlight on critical workers
↓
3. Result: Intersection visible — which workers had critical alerts at 3pm?
```

**User Persona**: Safety Officer (investigation) + Analyst (patterns)

**Cognitive Load Management**:
- Filters reduce visible data volume
- Linking guides attention sequentially
- Leaderboard provides detail backup for charts

---

### 7.3 Live Monitoring Page

**Purpose**: Real-time emergency response for safety officers

**Visualizations:**
```
1. Live Sensor History (line chart, updates 5s)
2. Worker List (sortable, search)
3. Real-Time Vitals (multi-series chart)
```

**Real-Time Updates:**
- IoT data refreshed every 5 seconds
- Chart smoothly animates (rolling window)
- New data enters from right; old data exits left

**Design Priority**: Speed over detail
- Chart minimal decorations
- No complex interactivity (focus on watching)
- Immediate visual feedback to anomalies

**User Persona**: Safety Officer (emergency response)

---

### 7.4 Location & Zones Page

**Purpose**: Geographic situational awareness and zone management

**Visualizations:**
```
1. Interactive Map (Leaflet)
   ├── Worker markers (color-coded status)
   ├── Zone circles (safe/restricted/emergency)
   └── Danger zones (user-defined)
2. Worker List (search + filter)
```

**Map Design:**
```
Marker Appearance:
  ├── Size: 24px radius (visible from distance)
  ├── Color: Status-based (green/amber/red)
  ├── Animation: Pulse-glow if in danger zone
  ├── Popup: Worker name + current vitals

Zone Appearance:
  ├── Boundary: Colored circle (matches status)
  ├── Fill: Light opacity (see map beneath)
  ├── Label: Zone name + type
```

**Critical Safety Feature:**
```
Worker Proximity Alert:
  ├── Distance to danger zone calculated
  ├── <50m away: marker pulses red
  ├── <20m away: immediate escalation
  └── Enables: Accident prevention before breach
```

**User Persona**: Administrator (zone management) + Safety Officer (situational awareness)

---

### 7.5 Alerts Center Page

**Purpose**: Incident management and alert triage workflow

**Visualizations:**
```
1. Alert Log Table (8 columns)
2. Detail Drawer (click row)
3. Action Buttons (Acknowledge/Resolve/Escalate)
```

**Alert Lifecycle Tracking:**
```
Active → User clicks "Acknowledge" → Acknowledged → User clicks "Resolve" → Resolved
```

**Filtering Dimensions:**
```
├── Source (Backend / Threshold / ML / Zone)
├── Type (Heart Rate / Temperature / etc.)
├── Severity (Low / Medium / High / Critical)
└── Status (Active / Acknowledged / Resolved)
```

**Table Design:**
```
Columns (in order of importance):
├── Timestamp (when)
├── Worker (who)
├── Type (what)
├── Severity (how serious) ← color badge
├── Message (why)
├── Source (origin)
├── Status (action taken)
└── Action dropdown
```

**User Persona**: Safety Officer (alert response) + Manager (compliance)

---

## 8. Analytical Reasoning Flow (Cognitive Model)

### 8.1 "Safety Officer Investigates Anomaly" Scenario

```
Step 1: OBSERVATION
────────────────────────────────
User logs into Dashboard
→ Sees KPI: "2 Critical Status"
→ Visual alert: Red badge in header

Step 2: AWARENESS
────────────────────────────────
User navigates to Analytics page
→ Scans Overview section KPIs
→ Reads filter status: "Last 24h, All workers, All zones"

Step 3: PATTERN SEARCH
────────────────────────────────
User examines "Alerts Over Time" bar chart
→ Observes: Spike at 2pm
→ Questions: "Why 2pm? Shift change? Temperature peak?"

Step 4: HYPOTHESIS TESTING
────────────────────────────────
User clicks "2pm" bar (brushing)
→ Leaderboard highlights matching workers (yellow border)
→ Sees: 3 workers had alerts at 2pm
→ New question: "Which types of alerts?"

Step 5: ROOT CAUSE NARROWING
────────────────────────────────
User examines "Alert Type Breakdown"
→ Observes: Mostly "Air Quality" and "Temperature" alerts
→ Clicks "Temperature" bar
→ Sees: Severity pie now shows mostly "High" (orange)

Step 6: INDIVIDUAL INVESTIGATION
────────────────────────────────
User clicks a worker row in leaderboard
→ Vital Trends charts appear
→ Shows 2-hour history of that worker
→ Temperature chart shows: Steady rise from 2pm → spike at 2:45pm
→ HR chart shows: Slight rise, but stable
→ Interpretation: Heat exposure (not medical emergency)

Step 7: GEOGRAPHIC CONTEXT
────────────────────────────────
User navigates to Location & Zones
→ Searches for that worker
→ Sees: Worker in Zone A (outdoor, sunny area)
→ Danger zone: 150m away (safe)
→ Map shows: 3 other workers nearby in Zone A

Step 8: DECISION & ACTION
────────────────────────────────
User determines: 
→ Cause: Zone A reached 38°C at 2pm (heat wave)
→ Action: Recommend moving 2pm shifts to early morning
→ Follow-up: Check hourly temp patterns for Zone A
→ Navigates to AlertsCenter
→ Marks alerts as "Resolved (environmental)"

Result: Data-driven decision made with clear analytical chain
```

### 8.2 "Manager Generates Weekly Safety Report"

```
Step 1: DASHBOARD GLANCE
→ Overall system health: 1 critical, 2 warnings → acceptable

Step 2: NAVIGATE TO ANALYTICS
→ Set filters: Time Range = "7d", Zone = "All", Status = "All"

Step 3: REVIEW KPIs
→ "Active Alerts" = 47 (this week)
→ "ML / Threshold Alerts" = 23 (47% ML-driven)
→ Interpretation: Good - ML system catching issues

Step 4: EXAMINE TRENDS
→ "Alerts Over Time" bar chart shows:
  ├── Monday: 8 alerts
  ├── Tuesday: 6 alerts
  ├── Wednesday: 9 alerts (peak)
  ├── Thursday: 7 alerts
  ├── Friday: 8 alerts
→ Observation: Relatively consistent, no alarming spikes

Step 5: SEVERITY ANALYSIS
→ "Severity Distribution" pie shows:
  ├── Critical: 2 (4%)
  ├── High: 8 (17%)
  ├── Medium: 18 (38%)
  ├── Low: 19 (40%)
→ Interpretation: Mostly low/medium (system working correctly)

Step 6: PROBLEM ZONES
→ Click "Zone" filter → select "Zone C"
→ Alerts spike to 18 (38% of all alerts)
→ Determine: Zone C is problematic
→ Note: Recommend facility audit for Zone C

Step 7: EXPORT & REPORT
→ Click "Export CSV" button
→ Saves: safety-report-2025-05-01.csv
→ Includes: Worker, Zone, Status, Vitals, Alert counts
→ Emails to safety director with summary

Result: Data-backed weekly safety report generated in 10 minutes
```

---

## 9. Why These Visualizations vs. Alternatives

### 9.1 Bar Charts vs. Line Charts

| Aspect | Bar | Line |
|--------|-----|------|
| **Temporal Patterns** | Good (categorical time) | Better (continuous time) |
| **Comparisons** | Better (easy to compare heights) | Harder (overlapping lines) |
| **Trends** | Visible but choppy | Smooth, natural |
| **Outliers** | Very visible | Can be missed between points |

**Decision**: 
- **Alerts Over Time** → Bar (shows daily/hourly buckets, comparisons matter)
- **Vital Trends** → Line (continuous sensor data, trends matter)

### 9.2 Scatter vs. Heat Map

| Aspect | Scatter | Heat Map |
|--------|---------|----------|
| **Density** | Shows individual points | Shows concentration |
| **Interaction** | Click points | Hover for values |
| **Outliers** | Very visible | Visible as color shifts |
| **Patterns** | Clear bivariate relationships | Shows accumulation |

**Decision**: 
- **Temp vs Heart Rate** → Scatter (want to see individual worker outliers, enable drill-down)
- **If 100+ workers**: Could switch to heat map (currently ~20 workers)

### 9.3 Pie vs. Bar (Composition)

| Aspect | Pie | Bar |
|--------|-----|-----|
| **Proportions** | Visible (slice size) | Visible (height) |
| **Exact Values** | Requires label | Clear from axis |
| **Comparison** | Harder (non-standard shapes) | Very easy |
| **Space Efficiency** | Takes more space | More compact |

**Decision**: 
- **Severity Distribution** → Pie (want immediate "how much is critical?" impression)
- **Could switch to Donut Bar** for space if page density reduced

---

## 10. Accessibility Considerations

### 10.1 Color-Blind Safe Palette

**Current Implementation:**
```
Status Colors:
├── Green (#22c55e) — visible to all types
├── Amber (#f59e0b) — visible, different from green
├── Red (#ef4444) — different from green, but problematic for protanopia
```

**Improvement (Implemented):**
- **Scatter Plot Shapes**: 
  - Normal = Circle (●)
  - Warning = Diamond (◆)
  - Critical = Triangle (▲)
- Users missing red/green distinction can still identify by shape

### 10.2 Text Contrast

**Standard:**
- Black text on white: 21:1 ratio (AAA)
- Primary color text on white: 5.2:1 ratio (AA)
- Muted text: 4.1:1 ratio (AA)

### 10.3 Font Sizes

| Use Case | Size | Reasoning |
|----------|------|-----------|
| Body text | 14px | Standard readability |
| Labels | 12px | Readable at arm's length |
| Small text | 11px | Chart tooltips, secondary info |
| KPI values | 72px | Must be visible from standing |

### 10.4 Interactive Hit Targets

- **Buttons**: Min 44px × 44px (mobile accessible)
- **Chart interaction**: Large touch zones for bars/dots
- **Hover areas**: Generous padding around interactive elements

---

## 11. Real-Time Data Integration

### 11.1 IoT Data Pipeline

```
Sensors (worker devices)
  ↓ (every 2 seconds)
Backend API
  ↓
Browser WebSocket / Polling
  ↓
React useIoTData() hook
  ↓
Data buffer (rolling 120+ points)
  ↓
Recharts component
  ↓ (animate on update)
Visual animation
```

### 11.2 ML Alert Engine

```
New telemetry point arrives
  ↓
ML Models Run:
  ├── Isolation Forest (anomaly detection)
  ├── IQR bounds (statistical thresholds)
  ├── Stuck sensor detection
  ├── K-Means (activity clustering)
  ├── Linear regression (trend detection)
  └── Pearson correlation (drift detection)
  ↓
Alerts generated if triggered
  ↓
useMLAlertContext updates state
  ↓
Charts re-render with new data
```

### 11.3 State Management

```
React Query: Server state (workers, zones, alerts)
Context API (MLAlertContext): Derived ML alerts
Local State: UI filters, selections, tabs
```

---

## 12. Key Design Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| **Stacked bars instead of grouped bars** | Reduces chart width; easier to see total while comparing segments |
| **Donut instead of pie** | Inner space allows title placement; easier to read slices |
| **Horizontal bar chart for types** | Long type names need horizontal space; eye tracks left-to-right naturally |
| **Map instead of table for zones** | Geographic context essential for spatial reasoning; visual is intuitive |
| **Leaderboard linking to charts** | Provides detail backup; users can click chart then read table |
| **Color + Shape in scatter** | Accessibility first; no user left behind due to color blindness |
| **Active links shown as chips** | Clear indication of current selection; easy to clear individually |
| **Row dimming to 25%** | Still visible (not black-on-white too harsh); clear distinction from active |

---

## 13. Limitations & Future Enhancements

### 13.1 Current Limitations

```
Page Density:
├── Analytics page shows 8+ charts
├── Can overwhelm users with many workers
├── Future: Tabbed layout or progressive disclosure

Color Redundancy:
├── Red/green still primary distinction
├── Future: Add pattern fills or hatching

Temporal Granularity:
├── Fixed buckets (hourly/daily)
├── Future: User-defined granularity

Predictive Analytics:
├── Currently reactive (alerts on past data)
├── Future: Anomaly forecasting (alert before threshold crossed)
```

### 13.2 Proposed Enhancements

```
1. Animated transitions between filter states
   → Eases cognitive load when data changes

2. Customizable dashboard (user-selected KPIs)
   → One dashboard per role (admin/safety/manager)

3. Time series forecasting
   → "Worker HR will exceed threshold in 5 minutes"

4. Peer comparison
   → "This worker's vitals unusual vs. 19 others in same zone"

5. Incident replay
   → Timeline slider to see what happened before alert

6. Export with annotations
   → Safety officer adds notes to report export
```

---

## 14. Summary Table: Visualizations at a Glance

| Visualization | Data Type | Purpose | Interactive | Page |
|---|---|---|---|---|
| **KPI Cards** | Aggregates | System status | No | Dashboard |
| **Bars (Over Time)** | Time series | Temporal patterns | Click (brush) | Analytics |
| **Bars (Types)** | Categories | Problem attribution | Click (brush) | Analytics |
| **Bars (HR)** | Comparison | Peer benchmarking | No | Analytics |
| **Lines (Vitals)** | Time series | Trend detection | No (conditional) | Analytics |
| **Scatter** | Bivariate | Correlation discovery | Click (select) | Analytics |
| **Pie** | Composition | Proportion overview | Click (brush) | Analytics |
| **Map** | Geographic | Spatial context | Click/Hover/Zoom | Zones |
| **Table (Leaderboard)** | Records | Detailed reference | Click/Sort/Link | Analytics |
| **Table (Status)** | Records | Quick reference | Click | Dashboard |
| **Table (Alerts)** | Records | Incident log | Click/Filter | Alerts |

---

## 15. Conclusion

This visual analytics dashboard exemplifies modern data visualization principles applied to a real-world problem (worker safety). By combining:

✓ **Multiple coordinated visualizations** (11+ chart types)
✓ **Pre-attentive color encoding** (instant comprehension)
✓ **Interactive brushing & linking** (hypothesis testing)
✓ **Gestalt principles** (visual organization)
✓ **Data-ink optimization** (clarity)
✓ **Role-based personas** (contextual design)
✓ **Real-time ML integration** (proactive alerts)

The dashboard enables safety officers, managers, and administrators to make faster, more confident decisions about worker welfare. The visual storytelling flow supports analytical reasoning from observation → hypothesis → investigation → action.

**For your viva**: Emphasize the **why** behind each choice. Examiners want to see you understood visualization principles, not just built a dashboard.

---

## Quick Reference for Viva Questions

**Q: Why use bar charts for alerts over time?**
A: Stacked bars show both total count and composition (ML vs threshold vs backend). Enables brushing interaction to select time buckets.

**Q: Why is the scatter plot necessary?**
A: Reveals bivariate correlations (heat + HR) that suggest root causes (e.g., heat stress). Enables selection of individual workers for detail investigation.

**Q: How do you handle color-blind users?**
A: Added shape redundancy to scatter plot. Normal=circle, Warning=diamond, Critical=triangle. Shapes distinct even without color.

**Q: What is "brushing and linking"?**
A: When user clicks in one chart (e.g., "2pm" bar), other charts filter and leaderboard highlights matching data. Creates interactive chain of reasoning.

**Q: Why tabs instead of one long page?**
A: Reduces cognitive load. Overview tab (overview charts) vs Correlation tab (advanced analysis). Users focus on one narrative at a time.

**Q: How do you ensure data-ink ratio?**
A: Removed decorative borders, faint grid lines, no 3D effects. Every visual element encodes data. Tables use alternating rows instead of heavy borders.

**Q: What is the analytical narrative?**
A: Dashboard → Filter → Pattern → Drill-down → Detail → Action. Each visualization answers a question that leads to the next.

---

*Document Version: 1.0*
*Last Updated: 2025-05-01*
*For: Visual Analytics Viva Examination*
