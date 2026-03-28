import { HelpCircle, Book, MessageCircle, Mail, ExternalLink, FileText } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const faqs = [
  { q: "¿Cómo subir datos de consumo?", a: "Ve a Gestión de Datos > Subir Datos y arrastra un archivo CSV, Excel o JSON." },
  { q: "¿Cómo se generan las predicciones ML?", a: "El sistema entrena modelos con datos históricos y genera pronósticos automáticos." },
  { q: "¿Puedo exportar reportes en PDF?", a: "Sí, ve a Reportes y selecciona el formato PDF para descargar." },
  { q: "¿Cómo configuro alertas personalizadas?", a: "En Administración > Alertas puedes definir umbrales y notificaciones." },
];

const resources = [
  { title: "Documentación", desc: "Guía completa del sistema", icon: Book },
  { title: "Soporte Técnico", desc: "Contacta al equipo de soporte", icon: MessageCircle },
  { title: "Contacto", desc: "soporte@ecoenergy.com", icon: Mail },
  { title: "Términos de Uso", desc: "Políticas y condiciones", icon: FileText },
];

export default function Ayuda() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Centro de Ayuda</h2>
          <p className="text-sm text-muted-foreground">Documentación, preguntas frecuentes y soporte</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {resources.map((r) => (
            <Card key={r.title} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <r.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Preguntas Frecuentes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium flex items-center gap-2"><HelpCircle className="h-4 w-4 text-primary shrink-0" />{f.q}</p>
                <p className="text-xs text-muted-foreground mt-1 ml-6">{f.a}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}