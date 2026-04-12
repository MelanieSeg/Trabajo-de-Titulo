import { HelpCircle, Book, MessageCircle, Mail, FileText } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOperationsOverview } from "@/hooks/useOperationsOverview";

export default function Ayuda() {
  const { data } = useOperationsOverview();

  const faqs = [
    {
      q: "¿Cómo subir datos de consumo?",
      a: "Ve a Gestión de Datos > Subir Datos y carga un CSV; el ETL procesa y actualiza dashboard automáticamente.",
    },
    {
      q: "¿Cómo se generan las predicciones ML?",
      a: "Desde Predicciones ML puedes reentrenar el modelo con los últimos registros cargados.",
    },
    {
      q: "¿Puedo exportar datos?",
      a: "Sí. Usa la vista Exportar Datos y descarga consumo, predicciones o alertas en CSV/JSON.",
    },
    {
      q: "¿Cómo configuro alertas?",
      a: "En Configuración puedes cambiar umbrales de electricidad/agua y políticas de notificación.",
    },
  ];

  const resources = [
    { title: "Documentación", desc: "Guía funcional del sistema", icon: Book },
    { title: "Soporte Técnico", desc: "Historial y trazas en Seguridad", icon: MessageCircle },
    { title: "Contacto", desc: data?.company.website ?? "soporte@ecoenergy.com", icon: Mail },
    { title: "Resumen de Plataforma", desc: `${data?.company.name ?? "EcoEnergy"} · ${data?.company.plan ?? "Enterprise"}`, icon: FileText },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Centro de Ayuda</h2>
          <p className="text-sm text-muted-foreground">Documentación, preguntas frecuentes y soporte</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {resources.map((resource) => (
            <Card key={resource.title} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <resource.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">{resource.title}</p>
                <p className="text-xs text-muted-foreground">{resource.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preguntas Frecuentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                  {faq.q}
                </p>
                <p className="text-xs text-muted-foreground mt-1 ml-6">{faq.a}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
