import { FileText, Download, Calendar, Filter } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const reports = [
  { name: "Reporte Mensual — Septiembre 2025", type: "PDF", date: "2025-09-30", size: "2.4 MB" },
  { name: "Análisis Trimestral Q3 2025", type: "PDF", date: "2025-09-30", size: "5.1 MB" },
  { name: "Consumo por Área — Agosto 2025", type: "Excel", date: "2025-08-31", size: "1.8 MB" },
  { name: "Comparativa Interanual 2024-2025", type: "PDF", date: "2025-08-15", size: "3.2 MB" },
  { name: "Informe de Anomalías Q2 2025", type: "PDF", date: "2025-06-30", size: "1.5 MB" },
];

export default function Reportes() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Reportes</h2>
            <p className="text-sm text-muted-foreground">Generación y descarga de informes</p>
          </div>
          <Button><FileText className="h-4 w-4 mr-2" />Generar Nuevo Reporte</Button>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Reportes Disponibles</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {reports.map((r) => (
              <div key={r.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.date} — {r.size}</p>
                </div>
                <Badge variant="secondary">{r.type}</Badge>
                <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}