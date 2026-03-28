import { useRef, useState } from "react";
import { Upload, FileText, Brain, Download, BarChart3, Bell, Target, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  createCustomMetric,
  defineTarget,
  exportConsumptionCsv,
  generateMonthlyReport,
  runMlTraining,
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

export function QuickActions() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loadingAction, setLoadingAction] = useState<ActionId | null>(null);

  const invalidateDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
  };

  const runAction = async (id: ActionId, task: () => Promise<void>) => {
    setLoadingAction(id);
    try {
      await task();
      invalidateDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      toast.error(message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

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

    if (id === "metric") {
      void runAction("metric", async () => {
        const suffix = new Date().toISOString().slice(0, 10);
        const metric = await createCustomMetric({
          name: `consumo_por_colaborador_${suffix}`,
          description: "kWh consumidos por colaborador activo por mes",
          unit: "kWh/persona",
          target_value: 120,
          current_value: 134,
        });
        toast.success(`Métrica personalizada actualizada: ${metric.name}`);
      });
      return;
    }

    if (id === "alert-config") {
      void runAction("alert-config", async () => {
        await updateAlertConfig({
          electricity_threshold_pct: 18,
          water_threshold_pct: 16,
          volatility_threshold_pct: 14,
        });
        toast.success("Umbrales de alertas actualizados");
      });
      return;
    }

    if (id === "target") {
      void runAction("target", async () => {
        await defineTarget({
          metric_name: "electricity_kwh",
          target_value: 5000,
          unit: "kWh",
        });
        toast.success("Meta energética definida");
      });
      return;
    }

    if (id === "etl-schedule") {
      void runAction("etl-schedule", async () => {
        await updateEtlSchedule({
          cron_expression: "0 6 1 * *",
          enabled: true,
        });
        toast.success("Programación ETL guardada: 1er día de cada mes 06:00");
      });
    }
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
              disabled={Boolean(loadingAction)}
              onClick={() => handleAction(action.id)}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <action.icon className="h-4 w-4" />}
              {isLoading ? "Procesando..." : action.label}
            </Button>
          );
        })}
      </div>
    </Card>
  );
}
