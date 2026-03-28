import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const Electricidad = lazy(() => import("./pages/Electricidad.tsx"));
const Agua = lazy(() => import("./pages/Agua.tsx"));
const Metricas = lazy(() => import("./pages/Metricas.tsx"));
const KPIs = lazy(() => import("./pages/KPIs.tsx"));
const Mapa = lazy(() => import("./pages/Mapa.tsx"));
const Predicciones = lazy(() => import("./pages/Predicciones.tsx"));
const Tendencias = lazy(() => import("./pages/Tendencias.tsx"));
const Anomalias = lazy(() => import("./pages/Anomalias.tsx"));
const Comparativas = lazy(() => import("./pages/Comparativas.tsx"));
const Objetivos = lazy(() => import("./pages/Objetivos.tsx"));
const SubirDatos = lazy(() => import("./pages/SubirDatos.tsx"));
const Reportes = lazy(() => import("./pages/Reportes.tsx"));
const Exportar = lazy(() => import("./pages/Exportar.tsx"));
const BaseDatos = lazy(() => import("./pages/BaseDatos.tsx"));
const CalendarioPage = lazy(() => import("./pages/Calendario.tsx"));
const AlertasPage = lazy(() => import("./pages/Alertas.tsx"));
const UsuariosPage = lazy(() => import("./pages/Usuarios.tsx"));
const Empresa = lazy(() => import("./pages/Empresa.tsx"));
const Configuracion = lazy(() => import("./pages/Configuracion.tsx"));
const Seguridad = lazy(() => import("./pages/Seguridad.tsx"));
const Ayuda = lazy(() => import("./pages/Ayuda.tsx"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/electricidad" element={<Electricidad />} />
            <Route path="/agua" element={<Agua />} />
            <Route path="/metricas" element={<Metricas />} />
            <Route path="/kpis" element={<KPIs />} />
            <Route path="/mapa" element={<Mapa />} />
            <Route path="/predicciones" element={<Predicciones />} />
            <Route path="/tendencias" element={<Tendencias />} />
            <Route path="/anomalias" element={<Anomalias />} />
            <Route path="/comparativas" element={<Comparativas />} />
            <Route path="/objetivos" element={<Objetivos />} />
            <Route path="/subir-datos" element={<SubirDatos />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/exportar" element={<Exportar />} />
            <Route path="/base-datos" element={<BaseDatos />} />
            <Route path="/calendario" element={<CalendarioPage />} />
            <Route path="/alertas" element={<AlertasPage />} />
            <Route path="/usuarios" element={<UsuariosPage />} />
            <Route path="/empresa" element={<Empresa />} />
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="/seguridad" element={<Seguridad />} />
            <Route path="/ayuda" element={<Ayuda />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
