import { Download } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";
import {
  exportAlertsCsv,
  exportConsumptionCsv,
  exportConsumptionJson,
  exportPredictionsJson,
  exportPredictionsCsv,
} from "@/lib/api";
import { toast } from "sonner";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Exportar() {
  const { data, isLoading, isError } = useOperationsOverview();
  const options = data?.exports ?? [];

  const handleExport = async (exportId: string, format: string) => {
    try {
      let blob: Blob;
      if (exportId === "consumption" && format === "CSV") blob = await exportConsumptionCsv();
      else if (exportId === "consumption" && format === "JSON") blob = await exportConsumptionJson();
      else if (exportId === "predictions" && format === "CSV") blob = await exportPredictionsCsv();
      else if (exportId === "alerts" && format === "CSV") blob = await exportAlertsCsv();
      else if (exportId === "predictions" && format === "JSON") blob = await exportPredictionsJson();
      else throw new Error("Formato no soportado");

      const filename = `${exportId}_${new Date().toISOString().slice(0, 10)}.${format.toLowerCase()}`;
      triggerBlobDownload(blob, filename);
      toast.success(`Exportación ${format} completada`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Exportar Datos</h2>
          <p className="text-sm text-muted-foreground">Descarga datos en múltiples formatos</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando opciones de exportación...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudo cargar el módulo de exportación.</Card>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {options.map((option) => (
            <Card key={option.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{option.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">{option.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {option.formats.map((format) => (
                    <Button key={format} variant="outline" size="sm" onClick={() => handleExport(option.id, format)}>
                      <Download className="h-3 w-3 mr-1" />
                      {format}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
