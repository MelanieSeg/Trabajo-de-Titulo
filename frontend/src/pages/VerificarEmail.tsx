import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Zap, Droplets, Leaf, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { verifyEmail as apiVerifyEmail } from "@/lib/api";

export default function VerificarEmail() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setErrorMessage("Token no proporcionado");
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiVerifyEmail(token);
        setIsSuccess(true);
        setEmail(response.email);
        toast({
          title: "Éxito",
          description: "Email verificado correctamente. Redirigiendo...",
        });
        setTimeout(() => navigate("/login"), 2000);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Token inválido o expirado";
        setErrorMessage(errorMsg);
        setIsSuccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    verify();
  }, [token, navigate, toast]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header con iconos */}
        <div className="flex justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-500/10 border border-yellow-500/20 shadow-sm">
            <Zap className="w-6 h-6 text-yellow-600" />
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 shadow-sm">
            <Droplets className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 border border-green-500/20 shadow-sm">
            <Leaf className="w-6 h-6 text-green-600" />
          </div>
        </div>

        <Card className="border-border/50 shadow-lg backdrop-blur-sm bg-background/95">
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                <p className="text-foreground font-medium">Verificando email...</p>
              </div>
            ) : isSuccess ? (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  Verificado
                </h2>
                <p className="text-sm text-muted-foreground">
                  Tu email <span className="font-medium text-foreground">{email}</span> ha sido verificado correctamente.
                </p>
                <p className="text-xs text-muted-foreground">
                  Redirigiendo al inicio de sesión en unos momentos...
                </p>
                <Button
                  className="w-full mt-4"
                  onClick={() => navigate("/login")}
                >
                  Ir a iniciar sesión
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  Error al verificar
                </h2>
                <p className="text-sm text-muted-foreground">
                  {errorMessage}
                </p>
                <div className="mt-6 space-y-2">
                  <Button
                    className="w-full"
                    onClick={() => navigate("/registro")}
                  >
                    Intentar registro nuevamente
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/login")}
                  >
                    Volver a inicio de sesión
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
