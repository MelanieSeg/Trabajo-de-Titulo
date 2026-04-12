import { Bell, AlertTriangle, Info, XCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";
import { resolveAlert, resolveAllAlerts } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const icons: Record<string, typeof Bell> = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
};
const colors: Record<string, string> = {
  critical: "text-red-500",
  warning: "text-yellow-500",
  info: "text-blue-500",
};

function relativeTime(input: string | null): string {
  if (!input) return "N/D";
  const date = new Date(input);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 60) return `Hace ${Math.max(minutes, 1)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}

export default function AlertasPage() {
  const { data, isLoading, isError } = useOperationsOverview();
  const queryClient = useQueryClient();

  const alerts = data?.alerts_center.items ?? [];

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
  };

  const resolveSingle = async (id: number) => {
    try {
      await resolveAlert(id);
      await refresh();
      toast.success("Alerta marcada como resuelta");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo resolver la alerta");
    }
  };

  const resolveAll = async () => {
    try {
      const result = await resolveAllAlerts();
      await refresh();
      toast.success(`${result.resolved} alertas marcadas como resueltas`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron resolver las alertas");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Alertas</h2>
            <p className="text-sm text-muted-foreground">Centro de notificaciones y alertas del sistema</p>
          </div>
          <Button variant="outline" size="sm" onClick={resolveAll}>
            Marcar todas como resueltas ({data?.alerts_center.unread_count ?? 0})
          </Button>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando alertas...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar alertas.</Card>}

        <Card>
          <CardContent className="p-0 divide-y">
            {alerts.map((alert) => {
              const Icon = icons[alert.severity] ?? Info;
              return (
                <div key={alert.id} className={`flex items-start gap-3 p-4 ${!alert.read ? "bg-primary/5" : ""}`}>
                  <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${colors[alert.severity] ?? colors.info}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.desc}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{relativeTime(alert.date)}</span>
                    {!alert.read && (
                      <Button size="sm" variant="ghost" onClick={() => resolveSingle(alert.id)}>
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
