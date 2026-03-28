import { Download, FileText, Table, BarChart3 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const exportOptions = [
  { title: "Datos de Electricidad", desc: "Exportar historial completo de consumo eléctrico", icon: BarChart3, formats: ["CSV", "Excel", "JSON"] },
  { title: "Datos de Agua", desc: "Exportar historial completo de consumo hídrico", icon: Table, formats: ["CSV", "Excel", "JSON"] },
  { title: "Reportes PDF", desc: "Descargar reportes generados en formato PDF", icon: FileText, formats: ["PDF"] },
  { title: "Datos de Predicciones", desc: "Exportar resultados de modelos ML", icon: BarChart3, formats: ["CSV", "JSON"] },
];

export default function Exportar() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Exportar Datos</h2>
          <p className="text-sm text-muted-foreground">Descarga datos en múltiples formatos</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {exportOptions.map((o) => (
            <Card key={o.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <o.icon className="h-4 w-4 text-primary" />{o.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">{o.desc}</p>
                <div className="flex gap-2">
                  {o.formats.map((f) => (
                    <Button key={f} variant="outline" size="sm"><Download className="h-3 w-3 mr-1" />{f}</Button>
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