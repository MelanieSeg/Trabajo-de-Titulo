import { Bell, AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const alerts = [
  { id: 1, title: "Consumo eléctrico excede límite", desc: "Planta Principal superó 6,000 kWh", severity: "critical", date: "Hace 2h", read: false },
  { id: 2, title: "Fuga de agua potencial", desc: "Flujo anormal en Bloque B nocturno", severity: "critical", date: "Hace 5h", read: false },
  { id: 3, title: "Meta mensual en riesgo", desc: "Consumo al 85% del límite con 10 días restantes", severity: "warning", date: "Hace 1d", read: true },
  { id: 4, title: "Modelo ML actualizado", desc: "Nuevo modelo entrenado con datos de Sep 2025", severity: "info", date: "Hace 2d", read: true },
  { id: 5, title: "Mantenimiento programado", desc: "HVAC Bloque A — 5 Oct 2025", severity: "info", date: "Hace 3d", read: true },
];

const icons: Record<string, typeof Bell> = { critical: XCircle, warning: AlertTriangle, info: Info };
const colors: Record<string, string> = { critical: "text-red-500", warning: "text-yellow-500", info: "text-blue-500" };

export default function AlertasPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Alertas</h2>
            <p className="text-sm text-muted-foreground">Centro de notificaciones y alertas del sistema</p>
          </div>
          <Button variant="outline" size="sm">Marcar todas como leídas</Button>
        </div>
        <Card>
          <CardContent className="p-0 divide-y">
            {alerts.map((a) => {
              const Icon = icons[a.severity];
              return (
                <div key={a.id} className={`flex items-start gap-3 p-4 ${!a.read ? "bg-primary/5" : ""}`}>
                  <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${colors[a.severity]}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.desc}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{a.date}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}