import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Download, Fuel } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";
import { uploadConsumptionCsv, uploadFuelTransactionsCsv } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function downloadFuelTemplate() {
  const header = "vehicle_id,vehicle_cat,fuel_type,fecha,dist_km,precio_litro_clp,fuel_liters_real,km_per_liter,notas";
  const example = "VAN-001,Van,D,2026-01-15,120.5,1549,12.3,9.8,Ruta norte";
  const blob = new Blob([[header, example].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla_combustible.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function SubirDatos() {
  const { data, isLoading, isError } = useOperationsOverview();
  const [uploading, setUploading] = useState(false);
  const [uploadingFuel, setUploadingFuel] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fuelInputRef = useRef<HTMLInputElement | null>(null);
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

  const onFuelFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingFuel(true);
      const result = await uploadFuelTransactionsCsv(file);
      toast.success(`Combustible: ${result.rows_processed} transacciones importadas`);
      await queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["fuel-transacciones"] });
      await queryClient.invalidateQueries({ queryKey: ["analisis-flota"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al importar transacciones de combustible");
    } finally {
      setUploadingFuel(false);
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

        {/* Consumo general (energía / agua) */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Datos de Consumo</CardTitle>
              <Badge variant="secondary" className="text-xs">Electricidad / Agua</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onFileSelected} />
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-10 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Arrastra archivos aquí o haz clic para seleccionar</p>
              <p className="text-xs text-muted-foreground mb-4">CSV — Máx. 50MB</p>
              <Button disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {uploading ? "Subiendo..." : "Seleccionar Archivo"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transacciones de combustible */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Transacciones de Combustible</CardTitle>
                <Badge variant="secondary" className="text-xs">Diésel / Gas Oil</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={downloadFuelTemplate}>
                <Download className="h-4 w-4 mr-1.5" />
                Descargar plantilla
              </Button>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Columnas requeridas: <span className="font-mono">vehicle_id, vehicle_cat, fuel_type, fecha, dist_km, precio_litro_clp</span>
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <input ref={fuelInputRef} type="file" accept=".csv" className="hidden" onChange={onFuelFileSelected} />
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-10 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fuelInputRef.current?.click()}
            >
              <Fuel className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Arrastra el CSV de flota aquí o haz clic para seleccionar</p>
              <p className="text-xs text-muted-foreground mb-4">
                vehicle_cat: Van / Truck / Bus / Car — fuel_type: D (Diésel) / G (Gas Oil)
              </p>
              <Button disabled={uploadingFuel}>
                {uploadingFuel ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {uploadingFuel ? "Importando..." : "Seleccionar CSV"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cargas Recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentUploads.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin cargas registradas.</p>
            )}
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
