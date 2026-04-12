import { useMemo } from "react";
import { Map, Building2, Zap, Droplets, Leaf, DollarSign } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

const MAP_NODE_LAYOUT = [
  { x: 16, y: 24 },
  { x: 44, y: 72 },
  { x: 74, y: 38 },
  { x: 26, y: 84 },
  { x: 62, y: 18 },
  { x: 86, y: 70 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function MapaConsumo() {
  const { data, isLoading, isError } = useOperationsOverview();
  const zones = data?.map ?? [];

  const zoneStats = useMemo(() => {
    if (!zones.length) {
      return [] as Array<{
        id: number;
        name: string;
        region: string | null;
        electricity: number;
        water: number;
        status: string;
        color: "default" | "secondary" | "destructive";
        point: { x: number; y: number };
        efficiencyPct: number;
        spendSharePct: number;
      }>;
    }

    const totalElectricity = zones.reduce((sum, zone) => sum + zone.electricity, 0);
    const totalWater = zones.reduce((sum, zone) => sum + zone.water, 0);

    const combinedValues = zones.map((zone) => zone.electricity + zone.water * 2.1);
    const minCombined = Math.min(...combinedValues);
    const maxCombined = Math.max(...combinedValues);
    const spread = maxCombined - minCombined;

    return zones.map((zone, index) => {
      const point = MAP_NODE_LAYOUT[index % MAP_NODE_LAYOUT.length];

      const electricityShare = totalElectricity > 0 ? (zone.electricity / totalElectricity) * 100 : 0;
      const waterShare = totalWater > 0 ? (zone.water / totalWater) * 100 : 0;
      const spendSharePct = electricityShare * 0.7 + waterShare * 0.3;

      const combined = zone.electricity + zone.water * 2.1;
      const efficiencyRaw = spread <= 0 ? 85 : 100 - ((combined - minCombined) / spread) * 35;
      const efficiencyPct = clamp(efficiencyRaw, 55, 100);

      return {
        ...zone,
        point,
        efficiencyPct,
        spendSharePct,
      };
    });
  }, [zones]);

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
            <div className="relative h-[300px] rounded-lg bg-muted/45 border-2 border-dashed border-muted-foreground/20 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,hsl(var(--energy-green)/0.12),transparent_40%),radial-gradient(circle_at_80%_70%,hsl(var(--energy-blue)/0.12),transparent_45%)]" />

              {zoneStats.length > 0 && (
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                  {zoneStats.slice(0, -1).map((zone, index) => {
                    const nextZone = zoneStats[index + 1];
                    return (
                      <line
                        key={`line-${zone.id}-${nextZone.id}`}
                        x1={zone.point.x}
                        y1={zone.point.y}
                        x2={nextZone.point.x}
                        y2={nextZone.point.y}
                        stroke="hsl(var(--energy-green))"
                        strokeOpacity="0.7"
                        strokeWidth="1.6"
                      />
                    );
                  })}

                  {zoneStats.map((zone) => (
                    <g key={`node-${zone.id}`}>
                      <circle cx={zone.point.x} cy={zone.point.y} r="2.6" fill="hsl(var(--energy-green))" fillOpacity="0.2" />
                      <circle cx={zone.point.x} cy={zone.point.y} r="1.2" fill="hsl(var(--energy-green))" />
                    </g>
                  ))}
                </svg>
              )}

              {zoneStats.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground">
                  <div>
                    <Map className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">Vista de instalaciones conectadas</p>
                    <p className="text-xs">Total de zonas monitoreadas: {zones.length}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="absolute top-3 left-3 rounded-md bg-background/80 border px-2 py-1 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Vista de instalaciones conectadas</p>
                    <p>Total de zonas monitoreadas: {zones.length}</p>
                  </div>

                  {zoneStats.map((zone) => {
                    const horizontalClass = zone.point.x >= 70 ? "-translate-x-[104%]" : "translate-x-2";
                    const verticalClass = zone.point.y >= 72 ? "-translate-y-full" : "-translate-y-1/2";

                    return (
                      <div
                        key={`label-${zone.id}`}
                        className={`absolute z-10 rounded-md border bg-background/90 shadow-sm px-2.5 py-2 min-w-[150px] ${horizontalClass} ${verticalClass}`}
                        style={{ left: `${zone.point.x}%`, top: `${zone.point.y}%` }}
                      >
                        <p className="text-xs font-semibold text-foreground truncate">{zone.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{zone.region ?? "Sin región"}</p>
                        <div className="mt-1 space-y-0.5">
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Leaf className="h-3 w-3 text-green-500" />
                            Eficiencia: <span className="text-foreground font-medium">{zone.efficiencyPct.toFixed(1)}%</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-yellow-500" />
                            Gasto est.: <span className="text-foreground font-medium">{zone.spendSharePct.toFixed(1)}%</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {zoneStats.map((zone) => (
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
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted-foreground">Eficiencia</span>
                  <span className="font-medium text-foreground">{zone.efficiencyPct.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Gasto estimado</span>
                  <span className="font-medium text-foreground">{zone.spendSharePct.toFixed(1)}%</span>
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
