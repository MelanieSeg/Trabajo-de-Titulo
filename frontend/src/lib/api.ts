export interface SummaryMetric {
  title: string;
  value: number;
  unit: string;
  change_pct: number;
}

export interface DashboardSummary {
  latest_month_label: string;
  metrics: SummaryMetric[];
  open_alerts: number;
}

export interface TimeseriesPoint {
  year: number;
  month: number;
  label: string;
  electricity_kwh: number | null;
  water_m3: number | null;
  predicted_electricity_kwh: number | null;
  predicted_water_m3: number | null;
}

export interface DistributionItem {
  name: string;
  value: number;
}

export type AlertSeverity = "critical" | "warning" | "info";

export interface AlertItem {
  id: number;
  severity: AlertSeverity;
  title: string;
  description: string;
  utility: string | null;
  year: number | null;
  month: number | null;
  created_at: string;
}

export interface ActivityItem {
  id: number;
  activity_type: string;
  message: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface EfficiencyItem {
  label: string;
  value: number;
  target: number;
}

export interface EfficiencyData {
  score: number;
  items: EfficiencyItem[];
}

export interface DashboardData {
  summary: DashboardSummary;
  timeseries: TimeseriesPoint[];
  distribution: DistributionItem[];
  alerts: AlertItem[];
  activity: ActivityItem[];
  efficiency: EfficiencyData;
}

export interface ETLUploadResult {
  filename: string;
  rows_processed: number;
  rows_rejected: number;
  status: string;
  notes: string;
}

export interface ReportResult {
  month_label: string;
  total_electricity_kwh: number;
  total_water_m3: number;
  total_cost_usd: number;
  highlights: string[];
}

export interface MLTrainResult {
  model: string;
  trained_records: number;
  validation_mae: {
    electricity: number;
    water: number;
  };
  predictions: Array<{
    utility: string;
    year: number;
    month: number;
    value: number;
  }>;
}

export interface AlertConfigPayload {
  electricity_threshold_pct: number;
  water_threshold_pct: number;
  volatility_threshold_pct: number;
}

export interface TargetPayload {
  metric_name: string;
  target_value: number;
  unit: string;
}

export interface CustomMetricPayload {
  name: string;
  description: string;
  unit: string;
  target_value: number;
  current_value: number;
}

export interface ETLSchedulePayload {
  cron_expression: string;
  enabled: boolean;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const errorPayload = await response.json();
      message = errorPayload?.detail ?? message;
    } catch {
      // Keep default message if response is not JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function fetchDashboardData(months = 12): Promise<DashboardData> {
  return request<DashboardData>(`/dashboard/data?months=${months}&alert_limit=4&activity_limit=5`);
}

export async function uploadConsumptionCsv(file: File): Promise<ETLUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  return request<ETLUploadResult>("/etl/upload", { method: "POST", body: formData });
}

export function generateMonthlyReport(): Promise<ReportResult> {
  return request<ReportResult>("/reports/monthly");
}

export function runMlTraining(horizonMonths = 3): Promise<MLTrainResult> {
  return request<MLTrainResult>("/ml/train", {
    method: "POST",
    body: JSON.stringify({ horizon_months: horizonMonths }),
  });
}

export async function exportConsumptionCsv(): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/export/consumption.csv`);
  if (!response.ok) {
    throw new Error("No se pudo exportar el CSV.");
  }
  return response.blob();
}

export function createCustomMetric(payload: CustomMetricPayload): Promise<{ id: number; name: string }> {
  return request<{ id: number; name: string }>("/metrics/custom", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAlertConfig(payload: AlertConfigPayload): Promise<AlertConfigPayload & { updated_at: string }> {
  return request<AlertConfigPayload & { updated_at: string }>("/alerts/config", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function defineTarget(payload: TargetPayload): Promise<{ id: number; metric_name: string }> {
  return request<{ id: number; metric_name: string }>("/targets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateEtlSchedule(payload: ETLSchedulePayload): Promise<{ cron_expression: string; enabled: boolean }> {
  return request<{ cron_expression: string; enabled: boolean }>("/etl/schedule", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
