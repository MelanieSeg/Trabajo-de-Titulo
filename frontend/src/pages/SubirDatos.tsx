import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";
import { uploadConsumptionCsv } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function SubirDatos() {
  const { data, isLoading, isError } = useOperationsOverview();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const recentUploads = data?.uploads ?? [];

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const result = await uploadConsumptionCsv(file);
      toast.success(`Carga completada: ${result.rows_processed} filas procesadas`);
      await queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al subir datos");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Subir Datos</h2>
          <p className="text-sm text-muted-foreground">Carga de archivos CSV con datos de consumo</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando historial de cargas...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudo cargar el historial de cargas.</Card>}

        <Card>
          <CardContent className="p-8">
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onFileSelected} />
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Arrastra archivos aquí o haz clic para seleccionar</p>
              <p className="text-xs text-muted-foreground mb-4">CSV — Máx. 50MB</p>
              <Button disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {uploading ? "Subiendo..." : "Seleccionar Archivo"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cargas Recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentUploads.map((upload) => (
              <div key={upload.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{upload.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {upload.date} — {upload.rows_processed} registros ({upload.rows_rejected} rechazados)
                  </p>
                </div>
                {upload.status === "completed" ? (
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
