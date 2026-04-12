import { FileText, Download, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";
import { exportConsumptionCsv, generateMonthlyReport } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Reportes() {
  const { data, isLoading, isError } = useOperationsOverview();
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();

  const reports = data?.reports ?? [];

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      const report = await generateMonthlyReport();
      toast.success(`Reporte generado: ${report.month_label}`);
      await queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el reporte");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadReport = async (reportName: string) => {
    try {
      const blob = await exportConsumptionCsv();
      const filename = `${reportName.replaceAll(" ", "_").toLowerCase()}.csv`;
      triggerBlobDownload(blob, filename);
      toast.success("Reporte descargado en CSV");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo descargar el reporte");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Reportes</h2>
            <p className="text-sm text-muted-foreground">Generación y descarga de informes</p>
          </div>
          <Button onClick={handleGenerateReport} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            {generating ? "Generando..." : "Generar Nuevo Reporte"}
          </Button>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando reportes...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudieron cargar reportes.</Card>}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reportes Disponibles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{report.name}</p>
                  <p className="text-xs text-muted-foreground">{report.date} — {report.size}</p>
                </div>
                <Badge variant="secondary">{report.type}</Badge>
                <Button variant="ghost" size="sm" onClick={() => handleDownloadReport(report.name)}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
