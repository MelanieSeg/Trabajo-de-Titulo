import { AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const anomalies = [
  { id: 1, date: "2025-09-15", type: "Pico de consumo eléctrico", area: "Planta Principal", severity: "critical", value: "+45% vs promedio", status: "Abierta" },
  { id: 2, date: "2025-09-12", type: "Fuga de agua detectada", area: "Sanitarios Bloque B", severity: "critical", value: "+200% flujo nocturno", status: "En revisión" },
  { id: 3, date: "2025-09-10", type: "Consumo inusual en fin de semana", area: "Oficinas Centrales", severity: "warning", value: "+60% vs patrón", status: "Abierta" },
  { id: 4, date: "2025-09-05", type: "Variación estacional anormal", area: "Climatización", severity: "warning", value: "+25% vs predicción", status: "Resuelta" },
  { id: 5, date: "2025-08-28", type: "Caída de eficiencia en compresor", area: "Producción", severity: "info", value: "-15% eficiencia", status: "Resuelta" },
];

const severityConfig: Record<string, { icon: typeof AlertTriangle; color: string; badge: string }> = {
  critical: { icon: XCircle, color: "text-red-500", badge: "bg-red-100 text-red-800" },
  warning: { icon: AlertTriangle, color: "text-yellow-500", badge: "bg-yellow-100 text-yellow-800" },
  info: { icon: CheckCircle, color: "text-blue-500", badge: "bg-blue-100 text-blue-800" },
};

export default function Anomalias() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Detección de Anomalías</h2>
          <p className="text-sm text-muted-foreground">Alertas automáticas por patrones inusuales de consumo</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="p-4 text-center">
            <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
            <p className="text-2xl font-bold">2</p><p className="text-xs text-muted-foreground">Críticas</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <p className="text-2xl font-bold">2</p><p className="text-xs text-muted-foreground">Advertencias</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold">2</p><p className="text-xs text-muted-foreground">Resueltas</p>
          </CardContent></Card>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Anomalías Detectadas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {anomalies.map((a) => {
              const cfg = severityConfig[a.severity];
              return (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <cfg.icon className={`h-5 w-5 shrink-0 mt-0.5 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.type}</p>
                    <p className="text-xs text-muted-foreground">{a.area} — {a.date}</p>
                    <p className="text-xs font-mono mt-1">{a.value}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary" className={cfg.badge}>{a.severity === "critical" ? "Crítico" : a.severity === "warning" ? "Alerta" : "Info"}</Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{a.status}</span>
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