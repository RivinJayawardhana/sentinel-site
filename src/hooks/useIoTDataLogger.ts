import { useEffect, useMemo } from "react";
import { useIoTData, useAllIoTData } from "./useMonitoringData";
import type { IoTReading } from "@/types/monitoring";

const LOG_KEY = "sentinel_iot_log";
const MAX_ENTRIES = 12000; // ~7 days at 1 reading/min

interface LoggedReading extends IoTReading {
  loggedAt: number; // unix ms
}

function readLog(): LoggedReading[] {
  try {
    const v = localStorage.getItem(LOG_KEY);
    return v ? (JSON.parse(v) as LoggedReading[]) : [];
  } catch {
    return [];
  }
}

function writeLog(entries: LoggedReading[]): void {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(entries));
  } catch {
    // If storage is full, drop oldest 20% and retry
    try {
      const trimmed = entries.slice(Math.floor(entries.length * 0.2));
      localStorage.setItem(LOG_KEY, JSON.stringify(trimmed));
    } catch { /* ignore */ }
  }
}

function appendToLog(reading: IoTReading): void {
  const existing = readLog();
  if (existing.some(r => r.id === reading.id)) return; // deduplicate by ID
  const entry: LoggedReading = { ...reading, loggedAt: Date.now() };
  const updated = [...existing, entry].slice(-MAX_ENTRIES);
  writeLog(updated);
}

export interface DatasetStats {
  totalSamples: number;
  vitalSamples: number;  // records with temperature > 0 or heart_rate > 0
  gpsSamples: number;    // records with real GPS
  oldestDate: Date | null;
  newestDate: Date | null;
  daysCollected: number;
  targetDays: number;
  progressPct: number;
}

export function useIoTDataLogger() {
  const { data: latestReading } = useIoTData();
  const { data: apiReadings } = useAllIoTData();

  // Append latest live reading to the log whenever it changes
  useEffect(() => {
    if (latestReading) appendToLog(latestReading);
  }, [latestReading?.id]);

  // Append all API readings to the log on first load (backfill)
  useEffect(() => {
    if (!apiReadings) return;
    apiReadings.forEach(appendToLog);
  }, [apiReadings?.length]);

  // Merge log + API readings, deduplicate, sort by timestamp
  const allData = useMemo<IoTReading[]>(() => {
    const log = readLog();
    const apiIds = new Set(apiReadings?.map(r => r.id) ?? []);
    // Start with API data, then add logged entries not already in API
    const combined: IoTReading[] = [
      ...(apiReadings ?? []),
      ...log.filter(r => !apiIds.has(r.id)),
    ];
    // Deduplicate by id and sort ascending by id (timestamp)
    const seen = new Set<string>();
    return combined
      .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
      .sort((a, b) => Number(a.id) - Number(b.id));
  }, [latestReading?.id, apiReadings?.length]);

  const stats = useMemo<DatasetStats>(() => {
    const TARGET_DAYS = 7;
    const log = readLog();
    const timestamps = log.map(r => r.loggedAt).filter(Boolean).sort((a, b) => a - b);
    const oldestDate = timestamps.length ? new Date(timestamps[0]) : null;
    const newestDate = timestamps.length ? new Date(timestamps[timestamps.length - 1]) : null;
    const daysCollected = oldestDate && newestDate
      ? Math.max(1, (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const vitalSamples = allData.filter(r => r.temperature > 0 || r.heart_rate > 0).length;
    const gpsSamples   = allData.filter(r => r.latitude !== 0 || r.longitude !== 0).length;

    return {
      totalSamples: allData.length,
      vitalSamples,
      gpsSamples,
      oldestDate,
      newestDate,
      daysCollected,
      targetDays: TARGET_DAYS,
      progressPct: Math.min(100, (daysCollected / TARGET_DAYS) * 100),
    };
  }, [allData.length]);

  return { allData, stats };
}
