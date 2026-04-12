import { type ReactNode, useRef, useState } from "react";
import { Upload, FileText, Brain, Download, BarChart3, Bell, Target, Calendar, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loadingAction, setLoadingAction] = useState<ActionId | null>(null);
  const [modalAction, setModalAction] = useState<ActionId | null>(null);

  const [metricName, setMetricName] = useState(`consumo_por_colaborador_${new Date().toISOString().slice(0, 10)}`);
  const [metricDescription, setMetricDescription] = useState("kWh consumidos por colaborador activo por mes");
  const [metricUnit, setMetricUnit] = useState("kWh/persona");
  const [metricTarget, setMetricTarget] = useState("120");
  const [metricCurrent, setMetricCurrent] = useState("134");

  const [electricityThreshold, setElectricityThreshold] = useState("18");
  const [waterThreshold, setWaterThreshold] = useState("16");
  const [volatilityThreshold, setVolatilityThreshold] = useState("14");

  const [targetMetric, setTargetMetric] = useState("electricity_kwh");
  const [targetValue, setTargetValue] = useState("5000");
  const [targetUnit, setTargetUnit] = useState("kWh");

  const [etlCronExpression, setEtlCronExpression] = useState("0 6 1 * *");
  const [etlEnabled, setEtlEnabled] = useState(true);

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
        const metric = await createCustomMetric({
          name: metricName.trim(),
          description: metricDescription.trim(),
          unit: metricUnit.trim(),
          target_value: Number(metricTarget),
          current_value: Number(metricCurrent),
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
        await defineTarget({
          metric_name: targetMetric.trim(),
          target_value: Number(targetValue),
          unit: targetUnit.trim(),
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
          cron_expression: etlCronExpression.trim(),
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
            <DialogDescription>Define una métrica personalizada para seguimiento en el dashboard.</DialogDescription>
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
                <Input id="metric-unit" value={metricUnit} onChange={(event) => setMetricUnit(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metric-target">Meta</Label>
                <Input id="metric-target" type="number" value={metricTarget} onChange={(event) => setMetricTarget(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metric-current">Valor actual</Label>
                <Input id="metric-current" type="number" value={metricCurrent} onChange={(event) => setMetricCurrent(event.target.value)} />
              </div>
            </div>
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
                <Input id="target-unit" value={targetUnit} onChange={(event) => setTargetUnit(event.target.value)} />
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
            <DialogDescription>Define la periodicidad de cargas ETL y ejecuta una acción inmediata.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="etl-cron">Expresión CRON</Label>
              <Input id="etl-cron" value={etlCronExpression} onChange={(event) => setEtlCronExpression(event.target.value)} />
              <p className="text-xs text-muted-foreground">Formato: minuto hora día-del-mes mes día-semana (ej. `0 6 1 * *`).</p>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">ETL automático habilitado</p>
                <p className="text-xs text-muted-foreground">Si está activo, el sistema ejecutará cargas según CRON.</p>
              </div>
              <Switch checked={etlEnabled} onCheckedChange={setEtlEnabled} />
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
