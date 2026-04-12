import { Map, Building2, Zap, Droplets } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

export default function MapaConsumo() {
  const { data, isLoading, isError } = useOperationsOverview();
  const zones = data?.map ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Mapa de Consumo</h2>
          <p className="text-sm text-muted-foreground">Distribución del consumo por instalación</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando mapa de consumo...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudo cargar el mapa.</Card>}

        <Card>
          <CardContent className="p-6">
            <div className="h-[260px] rounded-lg bg-muted/50 border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Map className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">Vista de instalaciones conectadas</p>
                <p className="text-xs">Total de zonas monitoreadas: {zones.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => (
            <Card key={zone.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {zone.name}
                  </CardTitle>
                  <Badge variant={zone.color}>{zone.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-3 w-3 text-yellow-500" />
                  <span>{zone.electricity.toLocaleString("es-CL")} kWh</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Droplets className="h-3 w-3 text-blue-500" />
                  <span>{zone.water.toLocaleString("es-CL")} m³</span>
                </div>
                {zone.region && <p className="text-xs text-muted-foreground">Región: {zone.region}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
