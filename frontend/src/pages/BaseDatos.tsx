import { Database, Table, HardDrive, Activity } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

export default function BaseDatos() {
  const { data, isLoading, isError } = useOperationsOverview();
  const dbInfo = data?.database;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Base de Datos</h2>
          <p className="text-sm text-muted-foreground">Estado y administración de PostgreSQL</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando estado de base de datos...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudo cargar el estado de base de datos.</Card>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <HardDrive className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{dbInfo?.storage_mb.toFixed(2) ?? "0.00"} MB</p>
              <p className="text-xs text-muted-foreground">Espacio Usado</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Table className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{dbInfo?.tables_active ?? 0}</p>
              <p className="text-xs text-muted-foreground">Tablas Activas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Activity className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{dbInfo?.uptime_pct.toFixed(1) ?? "99.9"}%</p>
              <p className="text-xs text-muted-foreground">Uptime</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tablas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(dbInfo?.tables ?? []).map((table) => (
              <div key={table.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Database className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-mono font-medium">{table.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {table.rows.toLocaleString("es-CL")} filas — {table.size}
                  </p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Activa
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
