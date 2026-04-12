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

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  email_verified: boolean;
  status: string;
  role: string;
  last_login_at: string | null;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  id: number;
  email: string;
  full_name: string;
  status: string;
  created_at: string;
  verification_token: string;
  message: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
const TOKEN_KEY = "eco_energy_token";
const USER_KEY = "eco_energy_user";

// Token management
function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function setUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getUser(): User | null {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers ?? {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized
  if (response.status === 401) {
    clearToken();
    window.location.href = "/login";
  }

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

// Auth functions
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

  setToken(response.access_token);
  setUser(response.user);

  return response;
}

export async function register(payload: RegisterRequest): Promise<RegisterResponse> {
  const response = await request<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response;
}

export async function verifyEmail(token: string): Promise<{ message: string; user_id: number; email: string; status: string }> {
  const response = await request<{ message: string; user_id: number; email: string; status: string }>(
    `/auth/verify-email/${token}`,
    {
      method: "GET",
    }
  );

  return response;
}

export function logout(): void {
  clearToken();
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

export function getCurrentUser(): User | null {
  return getUser();
}

// Dashboard functions
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
  return exportBlob("/export/consumption.csv");
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

export function runSampleEtl(): Promise<ETLUploadResult> {
  return request<ETLUploadResult>("/etl/run-sample", {
    method: "POST",
  });
}

export interface OperationsUser {
  id: number;
  name: string | null;
  email: string;
  role: string;
  status: string;
  email_verified: boolean;
  initials: string;
  last_login_at: string | null;
  created_at: string | null;
}

export interface OperationsOverview {
  generated_at: string;
  summary: DashboardSummary;
  timeseries: TimeseriesPoint[];
  distribution: DistributionItem[];
  efficiency: EfficiencyData;
  electricity: {
    cards: Array<{ label: string; value: number; unit: string; change_pct: number }>;
    monthly: Array<{ mes: string; consumo: number; costo: number }>;
    areas: Array<{ area: string; consumo: number; percentage: number }>;
  };
  water: {
    cards: Array<{ label: string; value: number; unit: string; change_pct: number }>;
    monthly: Array<{ mes: string; consumo: number; costo: number }>;
    areas: Array<{ area: string; consumo: number; percentage: number }>;
  };
  metrics: Array<{ label: string; value: number; target: number; status: "good" | "warning" | "critical" }>;
  kpis: Array<{
    name: string;
    value: number;
    target: number;
    unit: string;
    progress: number;
    status: "good" | "warning" | "critical";
    trend: "up" | "down" | "stable";
  }>;
  map: Array<{
    id: number;
    name: string;
    region: string | null;
    electricity: number;
    water: number;
    status: string;
    color: "default" | "secondary" | "destructive";
  }>;
  predictions: {
    accuracy_pct: number;
    projected_savings_usd: number;
    anomaly_count: number;
    series: Array<{
      mes: string;
      electricidad_real: number | null;
      agua_real: number | null;
      electricidad_pred: number | null;
      agua_pred: number | null;
    }>;
    recommendations: Array<{ text: string; type: "high" | "medium" | "low" }>;
  };
  trends: {
    series: Array<{ mes: string; electricidad: number; agua: number }>;
    electricity_change_pct: number;
    water_change_pct: number;
    insights: string[];
  };
  anomalies: {
    critical: number;
    warning: number;
    resolved: number;
    items: Array<{
      id: number;
      date: string | null;
      type: string;
      area: string;
      severity: AlertSeverity;
      value: string;
      status: string;
      description: string;
    }>;
  };
  comparisons: Array<{ periodo: string; electricidad: number; agua: number }>;
  goals: Array<{
    id: number | string;
    name: string;
    target: number;
    current: number;
    unit: string;
    progress: number;
    deadline: string | null;
    status: string;
  }>;
  uploads: Array<{
    id: number;
    name: string;
    date: string | null;
    rows_processed: number;
    rows_rejected: number;
    status: string;
  }>;
  reports: Array<{
    id: number;
    name: string;
    type: string;
    date: string;
    size: string;
    month_label: string;
    total_cost_usd: number;
  }>;
  exports: Array<{
    id: "consumption" | "predictions" | "alerts";
    title: string;
    desc: string;
    formats: string[];
  }>;
  database: {
    storage_mb: number;
    tables_active: number;
    uptime_pct: number;
    tables: Array<{ name: string; rows: number; size: string; status: string }>;
  };
  calendar: Array<{ id: string; date: string; title: string; type: string }>;
  alerts_center: {
    unread_count: number;
    items: Array<{
      id: number;
      title: string;
      desc: string;
      severity: AlertSeverity;
      date: string | null;
      read: boolean;
      utility: string | null;
    }>;
  };
  users: OperationsUser[];
  company: {
    name: string;
    industry: string | null;
    employees: number;
    facilities: number;
    website: string | null;
    plan: string;
    license_until: string;
    storage: string;
  };
  settings: {
    notify_email: boolean;
    notify_in_app: boolean;
    electricity_threshold_pct: number;
    water_threshold_pct: number;
    volatility_threshold_pct: number;
    etl_enabled: boolean;
    etl_cron_expression: string;
  };
  security: {
    sessions: Array<{ device: string; ip: string; date: string | null; current: boolean }>;
    audit: Array<{ action: string; user: string; date: string | null }>;
  };
}

export interface CreateOperationsUserPayload {
  full_name: string;
  email: string;
  password?: string;
  role: string;
  status: string;
  email_verified?: boolean;
}

export interface UpdateOperationsSettingsPayload {
  notify_email?: boolean;
  notify_in_app?: boolean;
  electricity_threshold_pct?: number;
  water_threshold_pct?: number;
  volatility_threshold_pct?: number;
  etl_enabled?: boolean;
  etl_cron_expression?: string;
}

export function fetchOperationsOverview(): Promise<OperationsOverview> {
  return request<OperationsOverview>("/operations/overview");
}

export function resolveAlert(alertId: number): Promise<{ id: number; resolved: boolean; title: string }> {
  return request<{ id: number; resolved: boolean; title: string }>(`/operations/alerts/${alertId}/resolve`, {
    method: "POST",
  });
}

export function resolveAllAlerts(): Promise<{ resolved: number }> {
  return request<{ resolved: number }>("/operations/alerts/resolve-all", {
    method: "POST",
  });
}

export function createOperationsUser(payload: CreateOperationsUserPayload): Promise<{
  id: number;
  email: string;
  full_name: string;
  role: string;
  status: string;
  email_verified: boolean;
  temporary_password: string | null;
  created_at: string;
}> {
  return request("/operations/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateOperationsSettings(
  payload: UpdateOperationsSettingsPayload
): Promise<OperationsOverview["settings"]> {
  return request<OperationsOverview["settings"]>("/operations/settings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function exportBlob(path: string): Promise<Blob> {
  const token = getToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!response.ok) {
    throw new Error("No se pudo exportar el archivo.");
  }
  return response.blob();
}

export async function exportPredictionsCsv(): Promise<Blob> {
  const overview = await fetchOperationsOverview();
  const rows = overview.predictions.series.map((item) => ({
    mes: item.mes,
    electricidad_real: item.electricidad_real ?? "",
    agua_real: item.agua_real ?? "",
    electricidad_pred: item.electricidad_pred ?? "",
    agua_pred: item.agua_pred ?? "",
  }));
  const header = ["mes", "electricidad_real", "agua_real", "electricidad_pred", "agua_pred"];
  const csvBody = [
    header.join(","),
    ...rows.map((row) => header.map((col) => String(row[col as keyof typeof row])).join(",")),
  ].join("\n");
  return new Blob([csvBody], { type: "text/csv;charset=utf-8;" });
}

export async function exportAlertsCsv(): Promise<Blob> {
  const overview = await fetchOperationsOverview();
  const header = ["id", "titulo", "severidad", "estado", "fecha", "descripcion"];
  const lines = overview.alerts_center.items.map((item) =>
    [item.id, item.title, item.severity, item.read ? "resuelta" : "abierta", item.date ?? "", item.desc.replaceAll(",", " ")].join(",")
  );
  return new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
}

export async function exportConsumptionJson(): Promise<Blob> {
  const overview = await fetchOperationsOverview();
  return new Blob([JSON.stringify(overview.timeseries, null, 2)], { type: "application/json" });
}

export async function exportPredictionsJson(): Promise<Blob> {
  const overview = await fetchOperationsOverview();
  return new Blob([JSON.stringify(overview.predictions.series, null, 2)], { type: "application/json" });
}
