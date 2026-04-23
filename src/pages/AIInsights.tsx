import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIoTDataLogger } from "@/hooks/useIoTDataLogger";
import { usePretrainedModels, useIsolationForestModel, classifyWithKMeans } from "@/hooks/usePretrainedModels";
import { useMemo } from "react";
import {
  LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine,
} from "recharts";
import {
  Brain, TrendingUp, AlertCircle, GitBranch, Cpu,
  ArrowUp, ArrowDown, Minus, Database, CheckCircle, Server,
} from "lucide-react";
import { pearsonCorrelation } from "@/lib/ml";

// ─── Types ─────────────────────────────────────────────────────────────────────
const SENSOR_KEYS = ["heart_rate", "temperature", "air_quality"] as const;
type SensorKey = (typeof SENSOR_KEYS)[number];

const SENSOR_META: Record<SensorKey, { label: string; unit: string; color: string }> = {
  heart_rate:  { label: "Heart Rate",  unit: "BPM", color: "hsl(0, 76%, 47%)"   },
  temperature: { label: "Temperature", unit: "°C",  color: "hsl(45, 96%, 56%)"  },
  air_quality: { label: "Air Quality", unit: "AQI", color: "hsl(210, 80%, 55%)" },
};

const CLUSTER_COLORS = ["hsl(122,47%,38%)", "hsl(45,96%,45%)", "hsl(0,76%,47%)"];
const FORECAST_STEPS = 5;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function corrLabel(r: number) {
  const a = Math.abs(r);
  if (a >= 0.7) return r > 0 ? "Strong +" : "Strong −";
  if (a >= 0.4) return r > 0 ? "Moderate +" : "Moderate −";
  if (a >= 0.2) return r > 0 ? "Weak +" : "Weak −";
  return "Negligible";
}

function corrBg(r: number) {
  if (r === 1)   return "bg-gray-100 text-gray-500";
  if (r >= 0.7)  return "bg-green-600 text-white";
  if (r >= 0.4)  return "bg-green-300 text-green-900";
  if (r >= 0.1)  return "bg-green-100 text-green-800";
  if (r >= -0.1) return "bg-gray-100 text-gray-600";
  if (r >= -0.4) return "bg-orange-100 text-orange-800";
  if (r >= -0.7) return "bg-red-300 text-red-900";
  return "bg-red-600 text-white";
}

function fmtDate(d: Date | null) {
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

// ─── Component ─────────────────────────────────────────────────────────────────
const AIInsights = () => {
  const { allData, stats } = useIoTDataLogger();
  const { data: models, isLoading: modelsLoading } = usePretrainedModels();
  const isoModel = useIsolationForestModel(models);

  // Live readings with valid vitals
  const liveReadings = useMemo(
    () => allData.filter(r => r.temperature > 0 || r.heart_rate > 0),
    [allData]
  );

  // ── 1. Trend Forecasting — apply pre-trained regression to live data ──
  const trendData = useMemo(() => {
    if (!models || liveReadings.length === 0) return null;
    return (Object.keys(SENSOR_META) as SensorKey[]).reduce((acc, key) => {
      const reg  = models.regression[key];
      const vals = liveReadings.map(r => r[key]);
      const n    = vals.length;
      const chart = [
        ...vals.map((v, i) => ({
          label: new Date(Number(liveReadings[i].id)).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          actual:   Number(v.toFixed(2)),
          trend:    Number((reg.slope * i + reg.intercept).toFixed(2)),
          forecast: null as number | null,
        })),
        ...Array.from({ length: FORECAST_STEPS }, (_, j) => ({
          label:    `+${j + 1}`,
          actual:   null as number | null,
          trend:    null as number | null,
          forecast: Number((reg.slope * (n + j) + reg.intercept).toFixed(2)),
        })),
      ];
      acc[key] = chart;
      return acc;
    }, {} as Record<string, Array<{ label: string; actual: number | null; trend: number | null; forecast: number | null }>>);
  }, [models, liveReadings]);

  // ── 2. Anomaly Detection — score live readings with pre-trained IF ──
  const anomalyData = useMemo(() => {
    if (!models || !isoModel || liveReadings.length === 0) return null;
    const featureVectors = liveReadings.map(r => [r.heart_rate, r.temperature, r.air_quality]);
    const { scores, isAnomaly } = isoModel.predict(featureVectors);
    const alerts = liveReadings
      .map((r, i) => ({ r, score: scores[i], isAnomaly: isAnomaly[i] }))
      .filter(d => d.isAnomaly);
    return {
      scores,
      isAnomaly,
      anomalyCount: isAnomaly.filter(Boolean).length,
      chartData: liveReadings.map((r, i) => ({
        label: new Date(Number(r.id)).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        heart_rate:  Number(r.heart_rate.toFixed(1)),
        temperature: Number(r.temperature.toFixed(1)),
        air_quality: Number(r.air_quality.toFixed(0)),
        score:       Number(scores[i].toFixed(3)),
        anomalyHR:   isAnomaly[i] ? Number(r.heart_rate.toFixed(1))  : null,
        anomalyT:    isAnomaly[i] ? Number(r.temperature.toFixed(1)) : null,
        anomalyAQ:   isAnomaly[i] ? Number(r.air_quality.toFixed(0)) : null,
        threshold:   Number(isoModel.threshold.toFixed(3)),
      })),
      alerts,
    };
  }, [models, isoModel, liveReadings]);

  // ── 3. Correlations — pre-trained values from CSV (10K samples) ──
  const corrRows: { label: string; key: SensorKey }[] = [
    { label: "Heart Rate",   key: "heart_rate"  },
    { label: "Temperature",  key: "temperature" },
    { label: "Air Quality",  key: "air_quality" },
  ];
  const corrVal = (a: SensorKey, b: SensorKey): number => {
    if (!models) return 0;
    if (a === b) return 1;
    const m = models.correlations.matrix;
    return m[a]?.[b] ?? 0;
  };

  // Live correlation (for comparison)
  const liveCorrData = useMemo(() => {
    if (liveReadings.length < 3) return null;
    const hrs  = liveReadings.map(r => r.heart_rate);
    const tmps = liveReadings.map(r => r.temperature);
    const aqs  = liveReadings.map(r => r.air_quality);
    return {
      hr_temp: pearsonCorrelation(hrs, tmps),
      hr_aq:   pearsonCorrelation(hrs, aqs),
      temp_aq: pearsonCorrelation(tmps, aqs),
    };
  }, [liveReadings]);

  // ── 4. K-Means — classify live readings using pre-trained centroids ──
  const clusterData = useMemo(() => {
    if (!models || liveReadings.length === 0) return null;
    const featureData = liveReadings.map(r => [r.heart_rate, r.temperature, r.air_quality]);
    const assignments = featureData.map(p => classifyWithKMeans(p, models.kmeans, featureData));
    const scatterPoints = liveReadings.map((r, i) => ({
      x: Number(r.heart_rate.toFixed(1)),
      y: Number(r.temperature.toFixed(2)),
      cluster: assignments[i],
    }));
    const clusterSizes = [0, 1, 2].map(k => assignments.filter(a => a === k).length);
    const dominant = models.kmeans.clusterLabels[clusterSizes.indexOf(Math.max(...clusterSizes))];
    return { scatterPoints, clusterSizes, dominant, assignments };
  }, [models, liveReadings]);

  // ─── Loading / error states ─────────────────────────────────────────────────
  if (modelsLoading) {
    return (
      <AppLayout>
        <div className="rounded-lg border bg-card p-8 text-center space-y-3">
          <Cpu className="h-8 w-8 text-muted-foreground mx-auto animate-pulse" />
          <p className="font-medium">Loading pre-trained models…</p>
        </div>
      </AppLayout>
    );
  }

  if (!models) {
    return (
      <AppLayout>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-8 text-center">
          <p className="text-sm text-destructive">Could not load trained_models.json. Run <code>node ml-models/train.cjs</code> first.</p>
        </div>
      </AppLayout>
    );
  }

  const liveCount = liveReadings.length;
  const hasLive   = liveCount > 0;

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">AI-Powered Safety Insights</h1>
            <Badge className="bg-primary/10 text-primary border-primary/20">Pre-Trained Models</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Models trained on <strong>{models.datasetInfo.totalRows.toLocaleString()}</strong> samples
            ({models.datasetInfo.dateRange.start.slice(0, 10)} → {models.datasetInfo.dateRange.end.slice(0, 10)}).
            {hasLive && ` Scoring ${liveCount} live readings in real-time.`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Server className="h-4 w-4" />
          <span>Trained: {new Date(models.trainedAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Data Collection + Model Info */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" /> Training Dataset
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                { label: "Training Samples",    value: models.datasetInfo.totalRows.toLocaleString() },
                { label: "Sensor",              value: models.datasetInfo.sensor },
                { label: "Train Start",         value: models.datasetInfo.dateRange.start.slice(0, 10) },
                { label: "Train End",           value: models.datasetInfo.dateRange.end.slice(0, 10) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  <p className="text-sm font-bold">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-success" /> Live Data Collection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                { label: "Live Samples",     value: stats.totalSamples },
                { label: "Vital Readings",   value: stats.vitalSamples },
                { label: "Collection Start", value: fmtDate(stats.oldestDate) },
                { label: "Latest Reading",   value: fmtDate(stats.newestDate) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  <p className="text-sm font-bold">{value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress toward 7-day target</span>
                <span>{stats.daysCollected.toFixed(1)} / 7 days</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-success transition-all" style={{ width: `${stats.progressPct}%` }} />
              </div>
              {stats.progressPct >= 100 && (
                <div className="flex items-center gap-1 text-xs text-success mt-1">
                  <CheckCircle className="h-3 w-3" /> 7-day target met
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2.5"><Cpu className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{models.datasetInfo.totalRows.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Training Samples</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-critical/10 p-2.5"><AlertCircle className="h-5 w-5 text-critical" /></div>
            <div>
              <p className="text-2xl font-bold">{anomalyData?.anomalyCount ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Live Anomalies (Isolation Forest)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-success/10 p-2.5"><TrendingUp className="h-5 w-5 text-success" /></div>
            <div>
              <p className="text-2xl font-bold">{(models.isolationForest.threshold).toFixed(3)}</p>
              <p className="text-xs text-muted-foreground">Learned IF Threshold</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-warning/10 p-2.5"><GitBranch className="h-5 w-5 text-warning" /></div>
            <div>
              <p className="text-lg font-bold leading-tight">{clusterData?.dominant ?? models.kmeans.clusterLabels[1]}</p>
              <p className="text-xs text-muted-foreground">Dominant Cluster</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trend">
        <TabsList className="mb-4">
          <TabsTrigger value="trend">Trend Forecasting</TabsTrigger>
          <TabsTrigger value="anomaly">Anomaly Detection</TabsTrigger>
          <TabsTrigger value="correlation">Sensor Correlation</TabsTrigger>
          <TabsTrigger value="patterns">Behavior Patterns</TabsTrigger>
        </TabsList>

        {/* ── Trend Forecasting ── */}
        <TabsContent value="trend">
          <div className="space-y-4">
            {(Object.keys(SENSOR_META) as SensorKey[]).map(key => {
              const reg   = models.regression[key];
              const meta  = SENSOR_META[key];
              const chart = trendData?.[key] ?? [];
              const slope = reg.slope;
              const trendDir   = slope > 0.001 ? "Rising" : slope < -0.001 ? "Falling" : "Stable";
              const TrendIcon  = slope > 0.001 ? ArrowUp : slope < -0.001 ? ArrowDown : Minus;
              const trendColor = slope > 0.001 ? "text-critical" : slope < -0.001 ? "text-success" : "text-muted-foreground";
              const thr = models.thresholds[key];

              return (
                <Card key={key}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{meta.label} — Linear Regression Trend</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Trained on {reg.trainSamples.toLocaleString()} samples · 80/20 chronological split ·
                          slope={reg.slope.toFixed(6)} · intercept={reg.intercept.toFixed(3)}
                        </p>
                      </div>
                      <Badge className={`text-xs ${trendDir === "Rising" ? "bg-critical/10 text-critical" : trendDir === "Falling" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        <TrendIcon className="h-3 w-3 mr-1" />{trendDir}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {hasLive && chart.length > 0 ? (
                      <div className="h-52 mb-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chart}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                            <Legend wrapperStyle={{ fontSize: "11px" }} />
                            <ReferenceLine y={thr.upperBound} stroke="hsl(0,76%,47%)" strokeDasharray="4 2" label={{ value: "Upper bound", fontSize: 10 }} />
                            <ReferenceLine y={thr.lowerBound} stroke="hsl(45,96%,56%)" strokeDasharray="4 2" label={{ value: "Lower bound", fontSize: 10 }} />
                            <Line type="monotone" dataKey="actual"   stroke={meta.color} strokeWidth={2} dot={false} name={`Live ${meta.label}`} connectNulls={false} />
                            <Line type="monotone" dataKey="trend"    stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="Regression trend" connectNulls={false} />
                            <Line type="monotone" dataKey="forecast" stroke={meta.color} strokeWidth={2} strokeDasharray="3 3" dot={{ r: 4 }} name={`Forecast (+${FORECAST_STEPS})`} connectNulls={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-52 flex items-center justify-center text-sm text-muted-foreground mb-4 border rounded-lg bg-muted/20">
                        No live data yet — model parameters below are from pre-training
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-3">
                      <div className="rounded-lg bg-muted/40 p-3 border">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Train Metrics</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-muted-foreground">R²</span><span className="font-bold">{(reg.trainR2 * 100).toFixed(2)}%</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">RMSE</span><span className="font-bold">{reg.trainRmse.toFixed(3)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Samples</span><span className="font-bold">{reg.trainSamples.toLocaleString()}</span></div>
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3 border">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Test Metrics (20%)</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-muted-foreground">Test R²</span><span className="font-bold">{(reg.testR2 * 100).toFixed(2)}%</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Test RMSE</span><span className="font-bold">{reg.testRmse.toFixed(3)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Samples</span><span className="font-bold">{reg.testSamples.toLocaleString()}</span></div>
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3 border">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Model Weights</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-muted-foreground">Slope</span><span className="font-bold font-mono">{reg.slope.toFixed(6)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Intercept</span><span className="font-bold font-mono">{reg.intercept.toFixed(3)}</span></div>
                          <div className={`flex items-center gap-1 font-bold ${trendColor}`}><TrendIcon className="h-3 w-3" />{trendDir}</div>
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3 border">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Learned Bounds (IQR)</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-muted-foreground">Lower</span><span className="font-bold">{thr.lowerBound.toFixed(1)} {meta.unit}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Upper</span><span className="font-bold">{thr.upperBound.toFixed(1)} {meta.unit}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Anomaly %</span><span className="font-bold">{(thr.anomalyRate * 100).toFixed(1)}%</span></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Anomaly Detection ── */}
        <TabsContent value="anomaly">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Isolation Forest — Anomaly Detection</CardTitle>
              <p className="text-xs text-muted-foreground">
                Trained on {models.isolationForest.trainSamples.toLocaleString()} samples with {models.isolationForest.fullNTrees ?? models.isolationForest.nTrees} trees ·
                threshold {models.isolationForest.threshold.toFixed(4)} learned from 95th-percentile of training scores ·
                compact {models.isolationForest.nTrees}-tree forest exported for real-time scoring
              </p>
            </CardHeader>
            <CardContent>
              {/* Score distribution stats */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Learned Threshold</p>
                  <p className="text-xl font-bold">{models.isolationForest.threshold.toFixed(4)}</p>
                  <p className="text-xs text-muted-foreground">95th pct (training)</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Training Anomaly Rate</p>
                  <p className="text-xl font-bold">{((models.isolationForest.anomalyRate ?? 0) * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">of {models.isolationForest.trainSamples.toLocaleString()} samples</p>
                </div>
                <div className="rounded-lg bg-critical/10 border border-critical/20 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Live Anomalies</p>
                  <p className="text-xl font-bold text-critical">{anomalyData?.anomalyCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">of {liveCount} live readings</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Score Mean (train)</p>
                  <p className="text-xl font-bold">{models.isolationForest.scoreStats?.mean.toFixed(4)}</p>
                  <p className="text-xs text-muted-foreground">P95: {models.isolationForest.scoreStats?.p95.toFixed(4)}</p>
                </div>
              </div>

              {hasLive && anomalyData ? (
                <>
                  <div className="h-56 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={anomalyData.chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis yAxisId="score" orientation="right" tick={{ fontSize: 10 }} domain={[0, 1]} />
                        <YAxis yAxisId="sensor" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <ReferenceLine yAxisId="score" y={models.isolationForest.threshold} stroke="hsl(0,76%,47%)" strokeDasharray="4 2" label={{ value: "Anomaly threshold", fontSize: 10 }} />
                        <Line yAxisId="sensor" type="monotone" dataKey="heart_rate"  stroke="hsl(0,76%,47%)"   strokeWidth={1.5} dot={false} name="Heart Rate" />
                        <Line yAxisId="sensor" type="monotone" dataKey="temperature" stroke="hsl(45,96%,56%)"  strokeWidth={1.5} dot={false} name="Temperature" />
                        <Line yAxisId="sensor" type="monotone" dataKey="air_quality" stroke="hsl(210,80%,55%)" strokeWidth={1.5} dot={false} name="AQI" />
                        <Line yAxisId="score"  type="monotone" dataKey="score" stroke="hsl(280,70%,55%)" strokeWidth={2} dot={false} name="Anomaly Score" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {anomalyData.alerts.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-critical uppercase tracking-wide">Flagged Anomalous Readings</p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {anomalyData.alerts.slice(-10).map(({ r, score }, i) => (
                          <div key={i} className="flex items-center justify-between text-xs rounded bg-critical/10 border border-critical/20 px-3 py-1.5">
                            <span className="text-muted-foreground">{new Date(Number(r.id)).toLocaleTimeString()}</span>
                            <span>HR: {r.heart_rate.toFixed(0)} BPM · {r.temperature.toFixed(1)}°C · AQI: {r.air_quality.toFixed(0)}</span>
                            <span className="font-bold text-critical">score {score.toFixed(3)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground border rounded-lg bg-muted/20">
                  No live data yet — pre-trained forest ready to score incoming readings
                </div>
              )}

              <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2 mt-3">
                Isolation Forest partitions the feature space [HR, Temp, AQI] with random splits across {models.isolationForest.nTrees} trees.
                Anomalous readings isolate in fewer splits → higher score. Threshold {models.isolationForest.threshold.toFixed(4)} was <strong>learned</strong> from the 95th percentile of {models.isolationForest.trainSamples.toLocaleString()} training scores — not hardcoded.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Sensor Correlation ── */}
        <TabsContent value="correlation">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pearson Correlation — Sensor Feature Relationships</CardTitle>
              <p className="text-xs text-muted-foreground">
                Learned from {models.datasetInfo.totalRows.toLocaleString()} samples in training CSV ·
                {liveReadings.length >= 3 && " live correlation computed from current readings for comparison"}
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-8 items-start">
                <div className="flex-1 overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="p-3 text-left text-xs text-muted-foreground">Sensor</th>
                        {corrRows.map(r => <th key={r.key} className="p-3 text-center text-xs text-muted-foreground">{r.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {corrRows.map(row => (
                        <tr key={row.key}>
                          <td className="p-3 text-xs font-medium text-muted-foreground bg-muted/30">{row.label}</td>
                          {corrRows.map(col => {
                            const r = corrVal(row.key, col.key);
                            return (
                              <td key={col.key} className={`p-3 text-center font-bold text-sm ${corrBg(r)}`}>
                                <div>{r.toFixed(3)}</div>
                                <div className="text-[10px] font-normal opacity-80">{corrLabel(r)}</div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-2 flex items-center gap-2 text-xs text-muted-foreground border-t">
                    <span>−1</span>
                    <div className="flex-1 h-2 rounded" style={{ background: "linear-gradient(to right,hsl(0,76%,47%),hsl(45,50%,90%),hsl(122,47%,38%))" }} />
                    <span>+1</span>
                    <span className="ml-2 text-[10px]">Trained on {models.datasetInfo.totalRows.toLocaleString()} CSV samples</span>
                  </div>
                </div>

                <div className="w-64 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pre-Trained (CSV)</p>
                  {[
                    { label: "HR ↔ Temperature", pretrained: models.correlations.hr_temp, live: liveCorrData?.hr_temp },
                    { label: "HR ↔ Air Quality",  pretrained: models.correlations.hr_aq,   live: liveCorrData?.hr_aq },
                    { label: "Temp ↔ Air Quality", pretrained: models.correlations.temp_aq, live: liveCorrData?.temp_aq },
                  ].map(({ label, pretrained, live }) => (
                    <div key={label} className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="text-base font-bold">{pretrained.toFixed(3)}</span>
                        {live !== undefined && (
                          <span className="text-xs text-muted-foreground">live: {live.toFixed(3)}</span>
                        )}
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.abs(pretrained) * 100}%`, backgroundColor: pretrained >= 0 ? "hsl(122,47%,38%)" : "hsl(0,76%,47%)" }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{corrLabel(pretrained)}</p>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                    All three sensors are <strong>independent</strong> (near-zero correlation), confirming each provides unique safety signal.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Behavior Patterns ── */}
        <TabsContent value="patterns">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">K-Means++ Clustering (k=3) — Behavior Pattern Analysis</CardTitle>
              <p className="text-xs text-muted-foreground">
                Trained on {models.kmeans.trainSamples.toLocaleString()} samples ·
                silhouette score {models.kmeans.silhouette.toFixed(4)} ·
                features: {models.kmeans.featureNames.join(", ")} ·
                live readings classified using pre-trained centroids
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2 h-72">
                  {hasLive && clusterData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="x" name="Heart Rate" unit=" BPM" tick={{ fontSize: 10 }} label={{ value: "Heart Rate (BPM)", position: "insideBottom", offset: -5, fontSize: 11 }} />
                        <YAxis dataKey="y" name="Temperature" unit="°C" tick={{ fontSize: 10 }} label={{ value: "Temp (°C)", angle: -90, position: "insideLeft", fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        {models.kmeans.clusterLabels.map((label, ki) => (
                          <Scatter key={ki} name={label}
                            data={clusterData.scatterPoints.filter(p => p.cluster === ki)}
                            fill={CLUSTER_COLORS[ki]} opacity={0.85} />
                        ))}
                        {/* Plot pre-trained centroids as stars */}
                        <Scatter name="Centroids (trained)"
                          data={models.kmeans.centroids.map((c, ki) => ({ x: c[0], y: c[1], cluster: ki }))}
                          fill="white" stroke="black" strokeWidth={1.5} shape="star" opacity={1} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground border rounded-lg bg-muted/20">
                      No live data — pre-trained centroids ready for classification
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg bg-muted/40 p-3 border">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Model Quality</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Silhouette</span><span className="font-bold">{models.kmeans.silhouette.toFixed(4)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Train Samples</span><span className="font-bold">{models.kmeans.trainSamples.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Algorithm</span><span className="font-bold">K-Means++</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">k</span><span className="font-bold">3</span></div>
                    </div>
                  </div>

                  {models.kmeans.clusterLabels.map((label, ki) => {
                    const c         = models.kmeans.centroids[ki];
                    const trainSize = models.kmeans.clusterSizes[ki];
                    const liveSize  = clusterData?.clusterSizes[ki] ?? 0;
                    return (
                      <div key={ki} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[ki] }} />
                          <span className="text-sm font-semibold">{label}</span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex justify-between"><span>Centroid HR</span><span className="font-medium text-foreground">{c[0]?.toFixed(1)} BPM</span></div>
                          <div className="flex justify-between"><span>Centroid Temp</span><span className="font-medium text-foreground">{c[1]?.toFixed(1)} °C</span></div>
                          <div className="flex justify-between"><span>Centroid AQI</span><span className="font-medium text-foreground">{c[2]?.toFixed(0)}</span></div>
                          <div className="flex justify-between"><span>Train size</span><span className="font-medium text-foreground">{trainSize.toLocaleString()}</span></div>
                          {hasLive && <div className="flex justify-between"><span>Live readings</span><span className="font-medium text-foreground">{liveSize}</span></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default AIInsights;
