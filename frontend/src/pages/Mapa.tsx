import { Map, Building2, Zap, Droplets } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const zones = [
  { name: "Planta Principal", electricity: "2,800 kWh", water: "1,200 m³", status: "Alto consumo", color: "destructive" as const },
  { name: "Oficinas Centrales", electricity: "900 kWh", water: "400 m³", status: "Normal", color: "secondary" as const },
  { name: "Almacén Norte", electricity: "600 kWh", water: "300 m³", status: "Bajo consumo", color: "default" as const },
  { name: "Área de Producción B", electricity: "1,500 kWh", water: "800 m³", status: "Alto consumo", color: "destructive" as const },
  { name: "Estacionamiento", electricity: "200 kWh", water: "100 m³", status: "Bajo consumo", color: "default" as const },
  { name: "Comedor y Servicios", electricity: "500 kWh", water: "600 m³", status: "Normal", color: "secondary" as const },
];

export default function MapaConsumo() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Mapa de Consumo</h2>
          <p className="text-sm text-muted-foreground">Distribución geográfica del consumo por zona</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="h-[300px] rounded-lg bg-muted/50 border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Map className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">Mapa interactivo de la planta</p>
                <p className="text-xs">Integración con planos CAD pendiente</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => (
            <Card key={zone.name}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />{zone.name}
                  </CardTitle>
                  <Badge variant={zone.color}>{zone.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-3 w-3 text-yellow-500" /><span>{zone.electricity}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Droplets className="h-3 w-3 text-blue-500" /><span>{zone.water}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}