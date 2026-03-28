import { Database, Table, HardDrive, Activity } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const tables = [
  { name: "consumo_electrico", rows: "145,230", size: "28 MB", status: "active" },
  { name: "consumo_agua", rows: "98,450", size: "18 MB", status: "active" },
  { name: "predicciones_ml", rows: "12,340", size: "5 MB", status: "active" },
  { name: "alertas", rows: "2,156", size: "1.2 MB", status: "active" },
  { name: "usuarios", rows: "45", size: "0.1 MB", status: "active" },
  { name: "configuracion", rows: "128", size: "0.05 MB", status: "active" },
];

export default function BaseDatos() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Base de Datos</h2>
          <p className="text-sm text-muted-foreground">Estado y administración de PostgreSQL</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="p-4 text-center">
            <HardDrive className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">52.35 MB</p><p className="text-xs text-muted-foreground">Espacio Usado</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Table className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">6</p><p className="text-xs text-muted-foreground">Tablas Activas</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Activity className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold">99.9%</p><p className="text-xs text-muted-foreground">Uptime</p>
          </CardContent></Card>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Tablas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {tables.map((t) => (
              <div key={t.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Database className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-mono font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.rows} filas — {t.size}</p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">Activa</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}