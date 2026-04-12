import { Building2, Globe, Users, Zap, Database, Building } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

export default function Empresa() {
  const { data, isLoading, isError } = useOperationsOverview();
  const company = data?.company;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Empresa</h2>
          <p className="text-sm text-muted-foreground">Información y configuración de la organización</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando información de empresa...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudo cargar la información de empresa.</Card>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos Generales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Nombre</p>
                  <p className="text-sm">{company?.name ?? "N/D"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Sector</p>
                  <p className="text-sm">{company?.industry ?? "N/D"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Usuarios activos</p>
                  <p className="text-sm">{company?.employees ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Instalaciones</p>
                  <p className="text-sm">{company?.facilities ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Database className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Almacenamiento</p>
                  <p className="text-sm">{company?.storage ?? "N/D"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Sitio Web</p>
                  <p className="text-sm">{company?.website ?? "No configurado"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plan y Licencia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm font-bold text-primary">Plan {company?.plan ?? "Enterprise"}</p>
                <p className="text-xs text-muted-foreground mt-1">Licencia activa hasta {company?.license_until ?? "N/D"}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usuarios activos</span>
                  <span>{company?.employees ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Instalaciones</span>
                  <span>{company?.facilities ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Almacenamiento</span>
                  <span>{company?.storage ?? "N/D"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modelos ML</span>
                  <span>Activo</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
