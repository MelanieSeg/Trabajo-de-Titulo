import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "./components/theme-provider";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";

const Register = lazy(() => import("./pages/Register.tsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.tsx"));
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
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>}>
              <Routes>
                {/* Public routes - redirige al dashboard si ya está autenticado */}
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <PublicRoute>
                      <Register />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/forgot-password"
                  element={
                    <PublicRoute>
                      <ForgotPassword />
                    </PublicRoute>
                  }
                />

                {/* Protected routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/electricidad"
                  element={
                    <ProtectedRoute>
                      <Electricidad />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agua"
                  element={
                    <ProtectedRoute>
                      <Agua />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/metricas"
                  element={
                    <ProtectedRoute>
                      <Metricas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/kpis"
                  element={
                    <ProtectedRoute>
                      <KPIs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/mapa"
                  element={
                    <ProtectedRoute>
                      <Mapa />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/predicciones"
                  element={
                    <ProtectedRoute>
                      <Predicciones />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tendencias"
                  element={
                    <ProtectedRoute>
                      <Tendencias />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/anomalias"
                  element={
                    <ProtectedRoute>
                      <Anomalias />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/comparativas"
                  element={
                    <ProtectedRoute>
                      <Comparativas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/objetivos"
                  element={
                    <ProtectedRoute>
                      <Objetivos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/subir-datos"
                  element={
                    <ProtectedRoute>
                      <SubirDatos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reportes"
                  element={
                    <ProtectedRoute>
                      <Reportes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/exportar"
                  element={
                    <ProtectedRoute>
                      <Exportar />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/base-datos"
                  element={
                    <ProtectedRoute>
                      <BaseDatos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/calendario"
                  element={
                    <ProtectedRoute>
                      <CalendarioPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/alertas"
                  element={
                    <ProtectedRoute>
                      <AlertasPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/usuarios"
                  element={
                    <ProtectedRoute>
                      <UsuariosPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/empresa"
                  element={
                    <ProtectedRoute>
                      <Empresa />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/configuracion"
                  element={
                    <ProtectedRoute>
                      <Configuracion />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/seguridad"
                  element={
                    <ProtectedRoute>
                      <Seguridad />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ayuda"
                  element={
                    <ProtectedRoute>
                      <Ayuda />
                    </ProtectedRoute>
                  }
                />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
