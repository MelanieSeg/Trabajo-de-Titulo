import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface PublicRouteProps {
  children: React.ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  // Si está autenticado, redirige al dashboard
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Si NO está autenticado, muestra la página pública
  return <>{children}</>;
}
