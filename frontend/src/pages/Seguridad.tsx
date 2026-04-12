import { Eye, History } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

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

export default function Seguridad() {
  const { data, isLoading, isError } = useOperationsOverview();
  const sessions = data?.security.sessions ?? [];
  const logs = data?.security.audit ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Seguridad</h2>
          <p className="text-sm text-muted-foreground">Gestión de acceso, sesiones y registros de auditoría</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando eventos de seguridad...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar eventos de seguridad.</Card>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sesiones Activas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sessions.map((session) => (
                <div key={`${session.device}-${session.date}`} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{session.device}</p>
                    <p className="text-xs text-muted-foreground">IP: {session.ip} — {relativeTime(session.date)}</p>
                  </div>
                  {session.current && <Badge>Actual</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registro de Auditoría</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {logs.map((log, index) => (
                <div key={`${log.action}-${index}`} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{log.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.user} — {relativeTime(log.date)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
