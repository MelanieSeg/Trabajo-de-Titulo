import { Shield, Key, Lock, Eye, History, AlertTriangle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const sessions = [
  { device: "Chrome — macOS", ip: "192.168.1.45", date: "Hace 5 min", current: true },
  { device: "Firefox — Windows", ip: "192.168.1.102", date: "Hace 2h", current: false },
  { device: "Safari — iPhone", ip: "10.0.0.15", date: "Hace 1d", current: false },
];

const logs = [
  { action: "Inicio de sesión", user: "carlos@empresa.com", date: "2025-09-28 14:30" },
  { action: "Exportación de datos", user: "ana@empresa.com", date: "2025-09-28 11:15" },
  { action: "Cambio de configuración", user: "carlos@empresa.com", date: "2025-09-27 16:45" },
  { action: "Nuevo usuario creado", user: "carlos@empresa.com", date: "2025-09-27 10:00" },
];

export default function Seguridad() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Seguridad</h2>
          <p className="text-sm text-muted-foreground">Gestión de acceso, sesiones y registros de auditoría</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Sesiones Activas</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {sessions.map((s) => (
                <div key={s.device} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.device}</p>
                    <p className="text-xs text-muted-foreground">IP: {s.ip} — {s.date}</p>
                  </div>
                  {s.current ? <Badge>Actual</Badge> : <Button variant="ghost" size="sm">Cerrar</Button>}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Registro de Auditoría</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {logs.map((l, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{l.action}</p>
                    <p className="text-xs text-muted-foreground">{l.user} — {l.date}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Acciones de Seguridad</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline"><Key className="h-4 w-4 mr-2" />Cambiar Contraseña</Button>
            <Button variant="outline"><Lock className="h-4 w-4 mr-2" />Activar 2FA</Button>
            <Button variant="outline"><Shield className="h-4 w-4 mr-2" />Políticas de Acceso</Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}