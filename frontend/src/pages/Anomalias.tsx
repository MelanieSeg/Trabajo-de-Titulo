import { AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";
import { resolveAlert } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const severityConfig: Record<string, { icon: typeof AlertTriangle; color: string; badge: string }> = {
  critical: { icon: XCircle, color: "text-red-500", badge: "bg-red-100 text-red-800" },
  warning: { icon: AlertTriangle, color: "text-yellow-500", badge: "bg-yellow-100 text-yellow-800" },
  info: { icon: CheckCircle, color: "text-blue-500", badge: "bg-blue-100 text-blue-800" },
};

export default function Anomalias() {
  const { data, isLoading, isError } = useOperationsOverview();
  const queryClient = useQueryClient();

  const anomalies = data?.anomalies.items ?? [];

  const handleResolve = async (id: number) => {
    try {
      await resolveAlert(id);
      await queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      toast.success("Anomalía marcada como resuelta");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo resolver la anomalía");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Detección de Anomalías</h2>
          <p className="text-sm text-muted-foreground">Alertas automáticas por patrones inusuales de consumo</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando anomalías...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar anomalías.</Card>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
              <p className="text-2xl font-bold">{data?.anomalies.critical ?? 0}</p>
              <p className="text-xs text-muted-foreground">Críticas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold">{data?.anomalies.warning ?? 0}</p>
              <p className="text-xs text-muted-foreground">Advertencias</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{data?.anomalies.resolved ?? 0}</p>
              <p className="text-xs text-muted-foreground">Resueltas</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anomalías Detectadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {anomalies.map((anomaly) => {
              const cfg = severityConfig[anomaly.severity] ?? severityConfig.info;
              return (
                <div key={anomaly.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <cfg.icon className={`h-5 w-5 shrink-0 mt-0.5 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{anomaly.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {anomaly.area} — {anomaly.date}
                    </p>
                    <p className="text-xs font-mono mt-1">{anomaly.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{anomaly.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary" className={cfg.badge}>
                      {anomaly.severity === "critical" ? "Crítico" : anomaly.severity === "warning" ? "Alerta" : "Info"}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {anomaly.status}
                    </span>
                    {anomaly.status !== "Resuelta" && (
                      <Button size="sm" variant="outline" onClick={() => handleResolve(anomaly.id)}>
                        Resolver
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
