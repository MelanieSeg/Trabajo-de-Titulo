import { Building2, MapPin, Phone, Globe, Users, Zap } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Empresa() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Empresa</h2>
          <p className="text-sm text-muted-foreground">Información y configuración de la organización</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Datos Generales</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { icon: Building2, label: "Nombre", value: "Empresa Industrial S.A. de C.V." },
                { icon: MapPin, label: "Dirección", value: "Av. Industrial #1234, Ciudad de México" },
                { icon: Phone, label: "Teléfono", value: "+52 55 1234 5678" },
                { icon: Globe, label: "Sitio Web", value: "www.empresa-industrial.com" },
                { icon: Users, label: "Empleados", value: "450" },
                { icon: Zap, label: "Sector", value: "Manufactura Industrial" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm">{item.value}</p>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full mt-2">Editar Información</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Plan y Licencia</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm font-bold text-primary">Plan Enterprise</p>
                <p className="text-xs text-muted-foreground mt-1">Licencia activa hasta Diciembre 2026</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Usuarios permitidos</span><span>50</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Usuarios activos</span><span>4</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Almacenamiento</span><span>52 MB / 10 GB</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Modelos ML</span><span>Ilimitados</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}