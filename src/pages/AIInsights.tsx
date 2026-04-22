import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAllIoTData } from "@/hooks/useMonitoringData";
import { useMemo, useState } from "react";
import {
  LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from "recharts";
import {
  Brain, TrendingUp, AlertCircle, GitBranch,
  ArrowUp, ArrowDown, Minus, Cpu,
} from "lucide-react";
import {
  trainLinearRegression,
  trainAnomalyDetector,
  trainKMeans,
  pearsonCorrelation,
} from "@/lib/ml";

const CLUSTER_COLORS = [
  "hsl(122, 47%, 38%)",
  "hsl(45, 96%, 45%)",
  "hsl(0, 76%, 47%)",
];

const SENSOR_KEYS = ["heart_rate", "temperature", "air_quality"] as const;
type SensorKey = (typeof SENSOR_KEYS)[number];

const SENSOR_META: Record<SensorKey, { label: string; unit: string; color: string }> = {
  heart_rate:  { label: "Heart Rate",   unit: "BPM", color: "hsl(0, 76%, 47%)" },
  temperature: { label: "Temperature",  unit: "°C",  color: "hsl(45, 96%, 56%)" },
  air_quality: { label: "Air Quality",  unit: "AQI", color: "hsl(210, 80%, 55%)" },
};

function corrLabel(r: number) {
  const a = Math.abs(r);
  if (a >= 0.7) return r > 0 ? "Strong +" : "Strong −";
  if (a >= 0.4) return r > 0 ? "Moderate +" : "Moderate −";
  if (a >= 0.2) return r > 0 ? "Weak +" : "Weak −";
  return "Negligible";
}

function corrBg(r: number): string {
  const a = Math.abs(r);
  if (r === 1) return "bg-gray-100 text-gray-500";
  if (r >= 0.7) return "bg-green-600 text-white";
  if (r >= 0.4) return "bg-green-300 text-green-900";
  if (r >= 0.1) return "bg-green-100 text-green-800";
  if (r >= -0.1) return "bg-gray-100 text-gray-600";
  if (r >= -0.4) return "bg-orange-100 text-orange-800";
  if (r >= -0.7) return "bg-red-300 text-red-900";
  return "bg-red-600 text-white";
}

const FORECAST_STEPS = 5;

const AIInsights = () => {
  const { data: readings, isLoading, error } = useAllIoTData();
  const [trendMetric, setTrendMetric] = useState<SensorKey>("heart_rate");
  const [anomalyMetric, setAnomalyMetric] = useState<SensorKey>("heart_rate");

  const ml = useMemo(() => {
    if (!readings || readings.length < 3) return null;

    // Only use records that have valid vitals for ML — GPS-only records (heart_rate=0, temp=0) would skew models
    const vitalReadings = readings.filter(r => r.temperature > 0 || r.heart_rate > 0);
    if (vitalReadings.length < 3) return null;

    const hrVals  = vitalReadings.map(r => r.heart_rate);
    const tmpVals = vitalReadings.map(r => r.temperature);
    const aqVals  = vitalReadings.map(r => r.air_quality);
    const times   = vitalReadings.map((r, i) => {
      const ts = Number(r.id);
      return isNaN(ts) ? `T${i}` : new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    });

    // 1. Regression models — trained on historical time series
    const regression = {
      heart_rate:  trainLinearRegression(hrVals),
      temperature: trainLinearRegression(tmpVals),
      air_quality: trainLinearRegression(aqVals),
    };

    // 2. Anomaly detectors — Z-score trained on each sensor distribution
    const anomaly = {
      heart_rate:  trainAnomalyDetector(hrVals,  2.0),
      temperature: trainAnomalyDetector(tmpVals, 2.0),
      air_quality: trainAnomalyDetector(aqVals,  2.0),
    };

    // 3. Correlation matrix — Pearson r learned from feature pairs
    const corrMatrix = {
      hr_tmp: pearsonCorrelation(hrVals, tmpVals),
      hr_aq:  pearsonCorrelation(hrVals, aqVals),
      tmp_aq: pearsonCorrelation(tmpVals, aqVals),
    };

    // 4. K-means clustering (k=3) on [heart_rate, temperature] feature space
    const kmeans = trainKMeans(vitalReadings.map(r => [r.heart_rate, r.temperature]), 3);

    // Pre-build chart datasets
    const buildTrendChart = (key: SensorKey) => {
      const vals = key === "heart_rate" ? hrVals : key === "temperature" ? tmpVals : aqVals;
      const model = regression[key];
      const n = vals.length;
      return [
        ...vals.map((v, i) => ({
          label: times[i],
          actual: Number(v.toFixed(2)),
          trend: Number(model.predict(i).toFixed(2)),
          forecast: null as number | null,
        })),
        ...Array.from({ length: FORECAST_STEPS }, (_, j) => ({
          label: `+${j + 1}`,
          actual: null as number | null,
          trend: null as number | null,
          forecast: Number(model.predict(n + j).toFixed(2)),
        })),
      ];
    };

    const buildAnomalyChart = (key: SensorKey) => {
      const vals = key === "heart_rate" ? hrVals : key === "temperature" ? tmpVals : aqVals;
      const model = anomaly[key];
      return vals.map((v, i) => ({
        label: times[i],
        value: Number(v.toFixed(2)),
        anomaly: model.isAnomaly[i] ? Number(v.toFixed(2)) : null,
        upper: Number(model.dynamicHigh.toFixed(2)),
        lower: Number(model.dynamicLow.toFixed(2)),
      }));
    };

    const scatterPoints = vitalReadings.map((r, i) => ({
      x: Number(r.heart_rate.toFixed(1)),
      y: Number(r.temperature.toFixed(2)),
      cluster: kmeans.assignments[i],
    }));

    const totalAnomalies =
      anomaly.heart_rate.anomalyCount +
      anomaly.temperature.anomalyCount +
      anomaly.air_quality.anomalyCount;

    const bestR2 = Math.max(regression.heart_rate.r2, regression.temperature.r2, regression.air_quality.r2);
    const dominantCluster = kmeans.clusterLabels[
      kmeans.clusterSizes.indexOf(Math.max(...kmeans.clusterSizes))
    ];

    return {
      regression, anomaly, corrMatrix, kmeans,
      buildTrendChart, buildAnomalyChart,
      scatterPoints, totalAnomalies, bestR2, dominantCluster,
      n: vitalReadings.length, times,
    };
  }, [readings]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center gap-3 p-6 text-muted-foreground text-sm">
          <Cpu className="h-4 w-4 animate-pulse" /> Training ML models on live sensor data…
        </div>
      </AppLayout>
    );
  }

  if (error || !readings) {
    return (
      <AppLayout>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          Failed to load IoT data for analysis.
        </div>
      </AppLayout>
    );
  }

  if (!ml) {
    return (
      <AppLayout>
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Insufficient data — need at least 3 sensor readings to train models. Collecting data…
        </div>
      </AppLayout>
    );
  }

  const trendChart   = ml.buildTrendChart(trendMetric);
  const anomalyChart = ml.buildAnomalyChart(anomalyMetric);
  const trendModel   = ml.regression[trendMetric];
  const anomalyModel = ml.anomaly[anomalyMetric];
  const meta         = SENSOR_META[trendMetric];
  const aMeta        = SENSOR_META[anomalyMetric];

  const trendDir =
    trendModel.slope > 0.05 ? "Rising" :
    trendModel.slope < -0.05 ? "Falling" : "Stable";
  const TrendIcon = trendModel.slope > 0.05 ? ArrowUp : trendModel.slope < -0.05 ? ArrowDown : Minus;
  const trendColor = trendModel.slope > 0.05 ? "text-critical" : trendModel.slope < -0.05 ? "text-success" : "text-muted-foreground";

  const corrRows = [
    { label: "Heart Rate", key: "heart_rate" as SensorKey },
    { label: "Temperature", key: "temperature" as SensorKey },
    { label: "Air Quality", key: "air_quality" as SensorKey },
  ];

  function corrVal(a: SensorKey, b: SensorKey): number {
    if (a === b) return 1;
    if ((a === "heart_rate" && b === "temperature") || (a === "temperature" && b === "heart_rate"))
      return ml.corrMatrix.hr_tmp;
    if ((a === "heart_rate" && b === "air_quality") || (a === "air_quality" && b === "heart_rate"))
      return ml.corrMatrix.hr_aq;
    return ml.corrMatrix.tmp_aq;
  }

  const clusterByGroup = [0, 1, 2].map(ki =>
    ml.scatterPoints.filter(p => p.cluster === ki)
  );

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">AI-Powered Safety Insights</h1>
            <Badge className="bg-primary/10 text-primary border-primary/20">ML Model</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Machine learning models trained on {ml.n} IoT sensor readings — linear regression, Z-score anomaly detection, k-means clustering, and Pearson correlation analysis.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Cpu className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{ml.n}</p>
              <p className="text-xs text-muted-foreground">Training Samples</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-critical/10 p-2.5">
              <AlertCircle className="h-5 w-5 text-critical" />
            </div>
            <div>
              <p className="text-2xl font-bold">{ml.totalAnomalies}</p>
              <p className="text-xs text-muted-foreground">Anomalies Detected</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-success/10 p-2.5">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{(ml.bestR2 * 100).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Best Model R²</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-warning/10 p-2.5">
              <GitBranch className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">{ml.dominantCluster}</p>
              <p className="text-xs text-muted-foreground">Dominant Pattern</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ML Analysis Tabs */}
      <Tabs defaultValue="trend">
        <TabsList className="mb-4">
          <TabsTrigger value="trend">Trend Forecasting</TabsTrigger>
          <TabsTrigger value="anomaly">Anomaly Detection</TabsTrigger>
          <TabsTrigger value="correlation">Sensor Correlation</TabsTrigger>
          <TabsTrigger value="patterns">Behavior Patterns</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Temporal Trend Analysis ── */}
        <TabsContent value="trend">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Temporal Trend Analysis</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Linear regression model trained on historical readings · predicts next {FORECAST_STEPS} time steps
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {SENSOR_KEYS.map(k => (
                    <button
                      key={k}
                      onClick={() => setTrendMetric(k)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        trendMetric === k
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {SENSOR_META[k].label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Line type="monotone" dataKey="actual" stroke={meta.color} strokeWidth={2} dot={false} name={`${meta.label} (actual)`} connectNulls={false} />
                    <Line type="monotone" dataKey="trend" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="Regression trend" connectNulls={false} />
                    <Line type="monotone" dataKey="forecast" stroke={meta.color} strokeWidth={2} strokeDasharray="3 3" dot={{ r: 4, fill: meta.color }} name={`Forecast (next ${FORECAST_STEPS})`} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Model Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Model R²</p>
                  <p className="text-lg font-bold">{(trendModel.r2 * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Fit quality</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Slope</p>
                  <p className="text-lg font-bold">{trendModel.slope.toFixed(3)}</p>
                  <p className="text-xs text-muted-foreground">{meta.unit} / step</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Trend Direction</p>
                  <p className={`text-lg font-bold flex items-center gap-1 ${trendColor}`}>
                    <TrendIcon className="h-4 w-4" /> {trendDir}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">RMSE</p>
                  <p className="text-lg font-bold">{trendModel.rmse.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Prediction error</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: Anomaly Detection ── */}
        <TabsContent value="anomaly">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Z-Score Anomaly Detection</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Statistical model learns normal distribution from data · flags readings beyond {anomalyModel.zThreshold}σ as anomalies
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {SENSOR_KEYS.map(k => (
                    <button
                      key={k}
                      onClick={() => setAnomalyMetric(k)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        anomalyMetric === k
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {SENSOR_META[k].label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={anomalyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <ReferenceLine y={anomalyModel.dynamicHigh} stroke="hsl(0, 76%, 47%)" strokeDasharray="5 3" label={{ value: "Dynamic Upper", position: "insideTopRight", fontSize: 10, fill: "hsl(0, 76%, 47%)" }} />
                    <ReferenceLine y={anomalyModel.dynamicLow} stroke="hsl(45, 96%, 45%)" strokeDasharray="5 3" label={{ value: "Dynamic Lower", position: "insideBottomRight", fontSize: 10, fill: "hsl(45, 96%, 45%)" }} />
                    <Line type="monotone" dataKey="value" stroke={aMeta.color} strokeWidth={2} dot={false} name={aMeta.label} />
                    <Line type="monotone" dataKey="anomaly" stroke="hsl(0, 76%, 47%)" strokeWidth={0} dot={{ r: 7, fill: "hsl(0, 76%, 47%)", strokeWidth: 2, stroke: "white" }} name="Anomaly" connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg bg-critical/10 p-3 border border-critical/20">
                  <p className="text-xs text-muted-foreground mb-1">Anomalies Found</p>
                  <p className="text-lg font-bold text-critical">{anomalyModel.anomalyCount}</p>
                  <p className="text-xs text-muted-foreground">of {ml.n} readings</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Learned Mean</p>
                  <p className="text-lg font-bold">{anomalyModel.mean.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{aMeta.unit}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Learned Std Dev</p>
                  <p className="text-lg font-bold">±{anomalyModel.std.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{aMeta.unit}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Dynamic Threshold</p>
                  <p className="text-sm font-bold">{anomalyModel.dynamicLow.toFixed(1)} – {anomalyModel.dynamicHigh.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">Learned safe range</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 3: Sensor Correlation ── */}
        <TabsContent value="correlation">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sensor Correlation Matrix</CardTitle>
              <p className="text-xs text-muted-foreground">
                Pearson correlation coefficients reveal learned linear relationships between sensor features
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-8 items-start">
                {/* Heatmap */}
                <div className="flex-1">
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="p-3 text-left text-xs font-medium text-muted-foreground" />
                          {corrRows.map(r => (
                            <th key={r.key} className="p-3 text-center text-xs font-medium text-muted-foreground">{r.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {corrRows.map(row => (
                          <tr key={row.key}>
                            <td className="p-3 text-xs font-medium text-muted-foreground bg-muted/30">{row.label}</td>
                            {corrRows.map(col => {
                              const r = corrVal(row.key, col.key);
                              return (
                                <td key={col.key} className={`p-3 text-center font-bold text-sm rounded-none ${corrBg(r)}`}>
                                  <div>{r.toFixed(2)}</div>
                                  <div className="text-[10px] font-normal opacity-80">{corrLabel(r)}</div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Color Scale Legend */}
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>−1 (Strong negative)</span>
                    <div className="flex-1 h-3 rounded-full" style={{ background: "linear-gradient(to right, hsl(0,76%,47%), hsl(45,50%,90%), hsl(122,47%,38%))" }} />
                    <span>+1 (Strong positive)</span>
                  </div>
                </div>

                {/* Key Insights */}
                <div className="w-64 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Insights</p>

                  {[
                    { label: "HR ↔ Temperature", value: ml.corrMatrix.hr_tmp },
                    { label: "HR ↔ Air Quality", value: ml.corrMatrix.hr_aq },
                    { label: "Temp ↔ Air Quality", value: ml.corrMatrix.tmp_aq },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-muted/50 p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="text-sm font-bold">{value.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.abs(value) * 100}%`,
                            backgroundColor: value >= 0 ? "hsl(122, 47%, 38%)" : "hsl(0, 76%, 47%)",
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{corrLabel(value)}</p>
                    </div>
                  ))}

                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
                    Correlations learned from {ml.n} real IoT samples. Values close to ±1 indicate strong learned feature coupling useful for predictive modelling.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 4: Behavior Patterns (K-means) ── */}
        <TabsContent value="patterns">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Behavior Pattern Analysis — K-Means (k=3)</CardTitle>
              <p className="text-xs text-muted-foreground">
                Unsupervised k-means++ model trained on heart rate × temperature feature space · discovers usage patterns without labeled data
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                {/* Scatter Chart */}
                <div className="col-span-2 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="x"
                        name="Heart Rate"
                        unit=" BPM"
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                        label={{ value: "Heart Rate (BPM)", position: "insideBottom", offset: -5, fontSize: 11 }}
                      />
                      <YAxis
                        dataKey="y"
                        name="Temperature"
                        unit="°C"
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                        label={{ value: "Temp (°C)", angle: -90, position: "insideLeft", fontSize: 11 }}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                        formatter={(val: number, name: string) => [val, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      {ml.kmeans.clusterLabels.map((label, ki) => (
                        <Scatter
                          key={ki}
                          name={label}
                          data={clusterByGroup[ki]}
                          fill={CLUSTER_COLORS[ki]}
                          opacity={0.85}
                        />
                      ))}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>

                {/* Cluster Summary */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cluster Centroids</p>
                  {ml.kmeans.clusterLabels.map((label, ki) => {
                    const c = ml.kmeans.centroids[ki];
                    const size = ml.kmeans.clusterSizes[ki];
                    return (
                      <div key={ki} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[ki] }} />
                          <span className="text-sm font-semibold">{label}</span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Avg HR</span>
                            <span className="font-medium text-foreground">{c[0]?.toFixed(1)} BPM</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Avg Temp</span>
                            <span className="font-medium text-foreground">{c[1]?.toFixed(2)} °C</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Samples</span>
                            <span className="font-medium text-foreground">{size} / {ml.n}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                            <div className="h-full rounded-full" style={{ width: `${(size / ml.n) * 100}%`, backgroundColor: CLUSTER_COLORS[ki] }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                    K-means++ trained over 150 iterations on normalized features. Cluster labels assigned by ascending heart rate centroid value.
                  </div>
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
