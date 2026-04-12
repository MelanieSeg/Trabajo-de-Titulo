import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Upload, FileText, Brain, Download, BarChart3, Bell, Target, Calendar, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";
import {
  createCustomMetric,
  defineTarget,
  exportConsumptionCsv,
  generateMonthlyReport,
  runMlTraining,
  runSampleEtl,
  updateAlertConfig,
  updateEtlSchedule,
  uploadConsumptionCsv,
} from "@/lib/api";

type ActionId =
  | "upload"
  | "report"
  | "ml"
  | "export"
  | "metric"
  | "alert-config"
  | "target"
  | "etl-schedule";

type EtlFrequency = "daily" | "weekly" | "monthly";

type UnitOption = {
  value: string;
  label: string;
};

const actions = [
  { id: "upload" as const, icon: Upload, label: "Subir Datos", variant: "default" as const },
  { id: "report" as const, icon: FileText, label: "Generar Reporte", variant: "secondary" as const },
  { id: "ml" as const, icon: Brain, label: "Ejecutar ML", variant: "secondary" as const },
  { id: "export" as const, icon: Download, label: "Exportar CSV", variant: "secondary" as const },
  { id: "metric" as const, icon: BarChart3, label: "Nueva Métrica", variant: "secondary" as const },
  { id: "alert-config" as const, icon: Bell, label: "Config. Alertas", variant: "secondary" as const },
  { id: "target" as const, icon: Target, label: "Definir Meta", variant: "secondary" as const },
  { id: "etl-schedule" as const, icon: Calendar, label: "Programar ETL", variant: "secondary" as const },
];

const DEFAULT_UNIT_OPTIONS: UnitOption[] = [
  { value: "kWh", label: "kWh" },
  { value: "m3", label: "m³" },
  { value: "USD", label: "USD" },
  { value: "Ton", label: "Ton" },
  { value: "kWh/persona", label: "kWh/persona" },
  { value: "m3/persona", label: "m³/persona" },
  { value: "%", label: "%" },
];

const minuteOptions = Array.from({ length: 12 }, (_, index) => {
  const minute = index * 5;
  return { value: String(minute), label: String(minute).padStart(2, "0") };
});

const hourOptions = Array.from({ length: 24 }, (_, index) => ({
  value: String(index),
  label: String(index).padStart(2, "0"),
}));

const dayOfMonthOptions = Array.from({ length: 31 }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}));

const dayOfWeekOptions = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sábado" },
];

function toUnitValue(rawUnit: string): string {
  const normalized = rawUnit.trim();
  if (normalized === "m³") return "m3";
  if (normalized === "m³/persona") return "m3/persona";
  return normalized;
}

function toUnitLabel(unitValue: string): string {
  if (unitValue === "m3") return "m³";
  if (unitValue === "m3/persona") return "m³/persona";
  return unitValue;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function ModalContent({
  action,
  setAction,
  children,
}: {
  action: ActionId | null;
  setAction: (value: ActionId | null) => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={action !== null} onOpenChange={(open) => (open ? undefined : setAction(null))}>
      <DialogContent className="sm:max-w-xl">{children}</DialogContent>
    </Dialog>
  );
}

export function QuickActions() {
  const queryClient = useQueryClient();
  const { data: overview } = useOperationsOverview();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loadingAction, setLoadingAction] = useState<ActionId | null>(null);
  const [modalAction, setModalAction] = useState<ActionId | null>(null);

  const [metricName, setMetricName] = useState(`consumo_personalizado_${new Date().toISOString().slice(0, 10)}`);
  const [metricDescription, setMetricDescription] = useState("Indicador personalizado de consumo");
  const [metricUnit, setMetricUnit] = useState("kWh");
  const [metricTarget, setMetricTarget] = useState("120");

  const [electricityThreshold, setElectricityThreshold] = useState("18");
  const [waterThreshold, setWaterThreshold] = useState("16");
  const [volatilityThreshold, setVolatilityThreshold] = useState("14");

  const [targetMetric, setTargetMetric] = useState("electricity_kwh");
  const [targetValue, setTargetValue] = useState("5000");
  const [targetUnit, setTargetUnit] = useState("kWh");

  const [etlEnabled, setEtlEnabled] = useState(true);
  const [etlFrequency, setEtlFrequency] = useState<EtlFrequency>("monthly");
  const [etlMinute, setEtlMinute] = useState("0");
  const [etlHour, setEtlHour] = useState("6");
  const [etlDayOfMonth, setEtlDayOfMonth] = useState("1");
  const [etlDayOfWeek, setEtlDayOfWeek] = useState("1");

  const unitOptions = useMemo(() => {
    const map = new Map<string, UnitOption>();

    DEFAULT_UNIT_OPTIONS.forEach((option) => map.set(option.value, option));

    (overview?.summary.metrics ?? []).forEach((metric) => {
      const value = toUnitValue(metric.unit);
      if (!map.has(value)) {
        map.set(value, { value, label: toUnitLabel(value) });
      }
    });

    (overview?.goals ?? []).forEach((goal) => {
      const value = toUnitValue(goal.unit);
      if (!map.has(value)) {
        map.set(value, { value, label: toUnitLabel(value) });
      }
    });

    return Array.from(map.values());
  }, [overview]);

  const currentValuesByUnit = useMemo(() => {
    const result: Record<string, number> = {
      kWh: 0,
      m3: 0,
      USD: 0,
      Ton: 0,
      "kWh/persona": 0,
      "m3/persona": 0,
      "%": 0,
    };

    const summaryMetrics = overview?.summary.metrics ?? [];
    const electricity = summaryMetrics.find((metric) => metric.title === "Electricidad")?.value ?? 0;
    const water = summaryMetrics.find((metric) => metric.title === "Agua")?.value ?? 0;
    const cost = summaryMetrics.find((metric) => metric.title === "Costo Total")?.value ?? 0;
    const co2 = summaryMetrics.find((metric) => metric.title === "CO₂ Evitado")?.value ?? 0;
    const employees = overview?.company?.employees ?? 0;

    result.kWh = electricity;
    result.m3 = water;
    result.USD = cost;
    result.Ton = co2;
    result["%"] = overview?.efficiency.score ?? 0;

    if (employees > 0) {
      result["kWh/persona"] = electricity / employees;
      result["m3/persona"] = water / employees;
    }

    return result;
  }, [overview]);

  const currentMetricValue = currentValuesByUnit[metricUnit] ?? 0;

  useEffect(() => {
    if (!overview?.settings) {
      return;
    }

    setElectricityThreshold(String(overview.settings.electricity_threshold_pct));
    setWaterThreshold(String(overview.settings.water_threshold_pct));
    setVolatilityThreshold(String(overview.settings.volatility_threshold_pct));
    setEtlEnabled(overview.settings.etl_enabled);

    const parts = overview.settings.etl_cron_expression.trim().split(/\s+/);
    if (parts.length !== 5) {
      return;
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (/^\d+$/.test(minute)) {
      const safeMinute = Math.min(59, Math.max(0, Number(minute)));
      setEtlMinute(String(safeMinute));
    }
    if (/^\d+$/.test(hour)) {
      const safeHour = Math.min(23, Math.max(0, Number(hour)));
      setEtlHour(String(safeHour));
    }

    if (dayOfMonth !== "*" && month === "*" && dayOfWeek === "*") {
      setEtlFrequency("monthly");
      if (/^\d+$/.test(dayOfMonth)) {
        const safeDay = Math.min(31, Math.max(1, Number(dayOfMonth)));
        setEtlDayOfMonth(String(safeDay));
      }
      return;
    }

    if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
      setEtlFrequency("weekly");
      if (/^\d+$/.test(dayOfWeek)) {
        const safeWeekday = Math.min(6, Math.max(0, Number(dayOfWeek)));
        setEtlDayOfWeek(String(safeWeekday));
      }
      return;
    }

    setEtlFrequency("daily");
  }, [overview?.settings]);

  const cronExpression = useMemo(() => {
    if (etlFrequency === "daily") {
      return `${etlMinute} ${etlHour} * * *`;
    }

    if (etlFrequency === "weekly") {
      return `${etlMinute} ${etlHour} * * ${etlDayOfWeek}`;
    }

    return `${etlMinute} ${etlHour} ${etlDayOfMonth} * *`;
  }, [etlDayOfMonth, etlDayOfWeek, etlFrequency, etlHour, etlMinute]);

  const invalidateDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
    queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
  };

  const runAction = async (id: ActionId, task: () => Promise<void>, closeModal = false) => {
    setLoadingAction(id);
    try {
      await task();
      invalidateDashboard();
      if (closeModal) {
        setModalAction(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      toast.error(message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await runAction("upload", async () => {
      const result = await uploadConsumptionCsv(file);
      toast.success(`ETL completado: ${result.rows_processed} filas procesadas`);
    });

    event.target.value = "";
  };

  const handleAction = (id: ActionId) => {
    if (id === "upload") {
      inputRef.current?.click();
      return;
    }

    if (id === "report") {
      void runAction("report", async () => {
        const report = await generateMonthlyReport();
        toast.success(`Reporte ${report.month_label}: costo total USD ${report.total_cost_usd.toLocaleString()}`);
      });
      return;
    }

    if (id === "ml") {
      void runAction("ml", async () => {
        const result = await runMlTraining(3);
        toast.success(`ML entrenado (MAE E:${result.validation_mae.electricity}, A:${result.validation_mae.water})`);
      });
      return;
    }

    if (id === "export") {
      void runAction("export", async () => {
        const blob = await exportConsumptionCsv();
        triggerBlobDownload(blob, "consumption_export.csv");
        toast.success("CSV exportado correctamente");
      });
      return;
    }

    if (["metric", "alert-config", "target", "etl-schedule"].includes(id)) {
      setModalAction(id);
    }
  };

  const saveMetric = () =>
    runAction(
      "metric",
      async () => {
        if (!metricName.trim()) {
          throw new Error("Debes ingresar el nombre de la métrica.");
        }

        if (Number(metricTarget) <= 0) {
          throw new Error("La meta debe ser mayor que 0.");
        }

        const metric = await createCustomMetric({
          name: metricName.trim(),
          description: metricDescription.trim() || `Métrica personalizada en ${toUnitLabel(metricUnit)}`,
          unit: metricUnit,
          target_value: Number(metricTarget),
          current_value: Number(currentMetricValue.toFixed(2)),
        });
        toast.success(`Métrica personalizada actualizada: ${metric.name}`);
      },
      true
    );

  const saveAlertConfig = () =>
    runAction(
      "alert-config",
      async () => {
        await updateAlertConfig({
          electricity_threshold_pct: Number(electricityThreshold),
          water_threshold_pct: Number(waterThreshold),
          volatility_threshold_pct: Number(volatilityThreshold),
        });
        toast.success("Umbrales de alertas actualizados");
      },
      true
    );

  const saveTarget = () =>
    runAction(
      "target",
      async () => {
        if (!targetMetric.trim()) {
          throw new Error("Debes ingresar el nombre de la métrica objetivo.");
        }

        if (Number(targetValue) <= 0) {
          throw new Error("El valor objetivo debe ser mayor que 0.");
        }

        await defineTarget({
          metric_name: targetMetric.trim(),
          target_value: Number(targetValue),
          unit: targetUnit,
        });
        toast.success("Meta energética definida");
      },
      true
    );

  const saveEtlSchedule = () =>
    runAction(
      "etl-schedule",
      async () => {
        await updateEtlSchedule({
          cron_expression: cronExpression,
          enabled: etlEnabled,
        });
        toast.success("Programación ETL guardada");
      },
      true
    );

  const runImmediateEtl = () =>
    runAction("etl-schedule", async () => {
      const result = await runSampleEtl();
      toast.success(`ETL ejecutado: ${result.rows_processed} filas procesadas`);
    });

  const renderModal = () => {
    if (modalAction === "metric") {
      return (
        <ModalContent action={modalAction} setAction={setModalAction}>
          <DialogHeader>
            <DialogTitle>Nueva Métrica</DialogTitle>
            <DialogDescription>Selecciona la unidad, define la meta y guarda. El valor actual se calcula automáticamente.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              <Label htmlFor="metric-name">Nombre</Label>
              <Input id="metric-name" value={metricName} onChange={(event) => setMetricName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metric-description">Descripción</Label>
              <Textarea
                id="metric-description"
                value={metricDescription}
                onChange={(event) => setMetricDescription(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="metric-unit">Unidad</Label>
                <Select value={metricUnit} onValueChange={setMetricUnit}>
                  <SelectTrigger id="metric-unit">
                    <SelectValue placeholder="Selecciona unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitOptions.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metric-target">Meta (manual)</Label>
                <Input id="metric-target" type="number" value={metricTarget} onChange={(event) => setMetricTarget(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metric-current">Valor actual</Label>
                <Input id="metric-current" type="number" value={currentMetricValue.toFixed(2)} disabled />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Valor actual calculado en base a los datos actuales del dashboard para la unidad seleccionada.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAction(null)}>
              Cancelar
            </Button>
            <Button onClick={saveMetric} disabled={loadingAction === "metric"}>
              {loadingAction === "metric" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Métrica"}
            </Button>
          </DialogFooter>
        </ModalContent>
      );
    }

    if (modalAction === "alert-config") {
      return (
        <ModalContent action={modalAction} setAction={setModalAction}>
          <DialogHeader>
            <DialogTitle>Configuración de Alertas</DialogTitle>
            <DialogDescription>Ajusta umbrales para detección de consumos y variaciones anómalas.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="electricity-threshold">Electricidad (%)</Label>
              <Input
                id="electricity-threshold"
                type="number"
                value={electricityThreshold}
                onChange={(event) => setElectricityThreshold(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="water-threshold">Agua (%)</Label>
              <Input id="water-threshold" type="number" value={waterThreshold} onChange={(event) => setWaterThreshold(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="volatility-threshold">Volatilidad (%)</Label>
              <Input
                id="volatility-threshold"
                type="number"
                value={volatilityThreshold}
                onChange={(event) => setVolatilityThreshold(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAction(null)}>
              Cancelar
            </Button>
            <Button onClick={saveAlertConfig} disabled={loadingAction === "alert-config"}>
              {loadingAction === "alert-config" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Configuración"}
            </Button>
          </DialogFooter>
        </ModalContent>
      );
    }

    if (modalAction === "target") {
      return (
        <ModalContent action={modalAction} setAction={setModalAction}>
          <DialogHeader>
            <DialogTitle>Definir Meta</DialogTitle>
            <DialogDescription>Configura objetivo, unidad y alcance para una métrica del sistema.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              <Label htmlFor="target-metric">Nombre de métrica</Label>
              <Input id="target-metric" value={targetMetric} onChange={(event) => setTargetMetric(event.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="target-value">Valor objetivo</Label>
                <Input id="target-value" type="number" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-unit">Unidad</Label>
                <Select value={targetUnit} onValueChange={setTargetUnit}>
                  <SelectTrigger id="target-unit">
                    <SelectValue placeholder="Selecciona unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitOptions.map((unit) => (
                      <SelectItem key={`target-${unit.value}`} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAction(null)}>
              Cancelar
            </Button>
            <Button onClick={saveTarget} disabled={loadingAction === "target"}>
              {loadingAction === "target" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Meta"}
            </Button>
          </DialogFooter>
        </ModalContent>
      );
    }

    if (modalAction === "etl-schedule") {
      return (
        <ModalContent action={modalAction} setAction={setModalAction}>
          <DialogHeader>
            <DialogTitle>Programar ETL</DialogTitle>
            <DialogDescription>
              Configura el horario con selectores intuitivos y guarda la programación sin editar expresiones CRON.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">ETL automático habilitado</p>
                <p className="text-xs text-muted-foreground">Si está activo, el sistema ejecutará cargas según el horario configurado.</p>
              </div>
              <Switch checked={etlEnabled} onCheckedChange={setEtlEnabled} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Frecuencia</Label>
                <Select value={etlFrequency} onValueChange={(value) => setEtlFrequency(value as EtlFrequency)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diaria</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Hora</Label>
                <Select value={etlHour} onValueChange={setEtlHour}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hourOptions.map((hour) => (
                      <SelectItem key={hour.value} value={hour.value}>
                        {hour.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Minuto</Label>
                <Select value={etlMinute} onValueChange={setEtlMinute}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {minuteOptions.map((minute) => (
                      <SelectItem key={minute.value} value={minute.value}>
                        {minute.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {etlFrequency === "monthly" && (
              <div className="space-y-2">
                <Label>Día del mes</Label>
                <Select value={etlDayOfMonth} onValueChange={setEtlDayOfMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOfMonthOptions.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {etlFrequency === "weekly" && (
              <div className="space-y-2">
                <Label>Día de la semana</Label>
                <Select value={etlDayOfWeek} onValueChange={setEtlDayOfWeek}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOfWeekOptions.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                Programación generada automáticamente: <span className="font-mono text-foreground">{cronExpression}</span>
              </p>
            </div>
          </div>

          <DialogFooter className="sm:justify-between w-full">
            <Button variant="outline" onClick={() => setModalAction(null)}>
              Cancelar
            </Button>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={runImmediateEtl} disabled={loadingAction === "etl-schedule"}>
                {loadingAction === "etl-schedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Ejecutar Ahora
              </Button>
              <Button onClick={saveEtlSchedule} disabled={loadingAction === "etl-schedule"}>
                {loadingAction === "etl-schedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Programación"}
              </Button>
            </div>
          </DialogFooter>
        </ModalContent>
      );
    }

    return null;
  };

  return (
    <Card className="glass-card p-5">
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
      <h3 className="text-sm font-semibold text-foreground mb-4">Acciones Rápidas</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {actions.map((action) => {
          const isLoading = loadingAction === action.id;
          return (
            <Button
              key={action.label}
              variant={action.variant}
              className="h-auto py-3 flex-col gap-2 text-xs"
              size="sm"
              disabled={Boolean(loadingAction) && modalAction === null}
              onClick={() => handleAction(action.id)}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <action.icon className="h-4 w-4" />}
              {isLoading ? "Procesando..." : action.label}
            </Button>
          );
        })}
      </div>

      {renderModal()}
    </Card>
  );
}
