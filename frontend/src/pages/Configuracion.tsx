import { Settings, Bell, Globe, Palette, Database, Shield } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const settings = [
  { icon: Bell, title: "Notificaciones por email", desc: "Recibir alertas críticas por correo", enabled: true },
  { icon: Bell, title: "Notificaciones push", desc: "Alertas en tiempo real en el navegador", enabled: false },
  { icon: Globe, title: "Idioma", desc: "Español (México)", enabled: true },
  { icon: Palette, title: "Modo oscuro", desc: "Activar tema oscuro en la interfaz", enabled: false },
  { icon: Database, title: "Backup automático", desc: "Respaldo diario de la base de datos", enabled: true },
  { icon: Shield, title: "Autenticación 2FA", desc: "Verificación en dos pasos", enabled: false },
];

export default function Configuracion() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Configuración</h2>
          <p className="text-sm text-muted-foreground">Preferencias generales del sistema</p>
        </div>
        <Card>
          <CardContent className="p-0 divide-y">
            {settings.map((s) => (
              <div key={s.title} className="flex items-center gap-4 p-4">
                <s.icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
                <Switch defaultChecked={s.enabled} />
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="flex justify-end"><Button>Guardar Cambios</Button></div>
      </div>
    </DashboardLayout>
  );
}