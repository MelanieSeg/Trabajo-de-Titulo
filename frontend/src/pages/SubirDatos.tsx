import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const recentUploads = [
  { name: "consumo_electrico_sep2025.csv", date: "2025-09-20", rows: "1,245", status: "success" },
  { name: "agua_planta_principal.xlsx", date: "2025-09-18", rows: "890", status: "success" },
  { name: "facturas_agosto.csv", date: "2025-09-15", rows: "56", status: "warning" },
  { name: "sensores_iot_raw.json", date: "2025-09-10", rows: "15,678", status: "success" },
];

export default function SubirDatos() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Subir Datos</h2>
          <p className="text-sm text-muted-foreground">Carga de archivos CSV, Excel o JSON con datos de consumo</p>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Arrastra archivos aquí o haz clic para seleccionar</p>
              <p className="text-xs text-muted-foreground mb-4">CSV, XLSX, JSON — Máx. 50MB</p>
              <Button><Upload className="h-4 w-4 mr-2" />Seleccionar Archivos</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Cargas Recientes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recentUploads.map((u) => (
              <div key={u.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.date} — {u.rows} registros</p>
                </div>
                {u.status === "success" ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}