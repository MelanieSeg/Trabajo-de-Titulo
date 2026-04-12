import { useEffect, useState } from "react";
import { Bell, Database, Calendar, BarChart3 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";
import { updateOperationsSettings } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Configuracion() {
  const { data, isLoading, isError } = useOperationsOverview();
  const queryClient = useQueryClient();

  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [etlEnabled, setEtlEnabled] = useState(true);
  const [cron, setCron] = useState("0 6 1 * *");
  const [electricityThreshold, setElectricityThreshold] = useState(20);
  const [waterThreshold, setWaterThreshold] = useState(18);
  const [volatilityThreshold, setVolatilityThreshold] = useState(15);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.settings) return;
    setNotifyEmail(data.settings.notify_email);
    setNotifyInApp(data.settings.notify_in_app);
    setEtlEnabled(data.settings.etl_enabled);
    setCron(data.settings.etl_cron_expression);
    setElectricityThreshold(data.settings.electricity_threshold_pct);
    setWaterThreshold(data.settings.water_threshold_pct);
    setVolatilityThreshold(data.settings.volatility_threshold_pct);
  }, [data?.settings]);

  const saveSettings = async () => {
    try {
      setSaving(true);
      await updateOperationsSettings({
        notify_email: notifyEmail,
        notify_in_app: notifyInApp,
        etl_enabled: etlEnabled,
        etl_cron_expression: cron,
        electricity_threshold_pct: electricityThreshold,
        water_threshold_pct: waterThreshold,
        volatility_threshold_pct: volatilityThreshold,
      });
      await queryClient.invalidateQueries({ queryKey: ["operations-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      toast.success("Configuración guardada correctamente");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Configuración</h2>
          <p className="text-sm text-muted-foreground">Preferencias generales del sistema</p>
        </div>

        {isLoading && <Card className="p-4 text-sm text-muted-foreground">Cargando configuración...</Card>}
        {isError && <Card className="p-4 text-sm text-destructive">No se pudo cargar configuración.</Card>}

        <Card>
          <CardContent className="p-0 divide-y">
            <div className="flex items-center gap-4 p-4">
              <Bell className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Notificaciones por email</p>
                <p className="text-xs text-muted-foreground">Recibir alertas críticas por correo</p>
              </div>
              <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
            </div>

            <div className="flex items-center gap-4 p-4">
              <Bell className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Notificaciones in-app</p>
                <p className="text-xs text-muted-foreground">Alertas en tiempo real dentro del sistema</p>
              </div>
              <Switch checked={notifyInApp} onCheckedChange={setNotifyInApp} />
            </div>

            <div className="flex items-center gap-4 p-4">
              <Database className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">ETL automático</p>
                <p className="text-xs text-muted-foreground">Ejecución periódica de ingesta de datos</p>
              </div>
              <Switch checked={etlEnabled} onCheckedChange={setEtlEnabled} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Cron ETL
              </Label>
              <Input value={cron} onChange={(event) => setCron(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Umbral electricidad (%)
              </Label>
              <Input
                type="number"
                value={electricityThreshold}
                onChange={(event) => setElectricityThreshold(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Umbral agua (%)</Label>
              <Input type="number" value={waterThreshold} onChange={(event) => setWaterThreshold(Number(event.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Umbral volatilidad (%)</Label>
              <Input
                type="number"
                value={volatilityThreshold}
                onChange={(event) => setVolatilityThreshold(Number(event.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
