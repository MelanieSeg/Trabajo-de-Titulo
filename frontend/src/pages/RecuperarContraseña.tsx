import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Zap, Droplets, Leaf, Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation";
import { forgotPassword } from "@/lib/api";

export default function RecuperarContraseña() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);
    setIsLoading(true);

    try {
      const formData: ForgotPasswordInput = { email };
      const result = forgotPasswordSchema.safeParse(formData);

      if (!result.success) {
        const newErrors: Record<string, string> = {};
        result.error.errors.forEach((error) => {
          const path = error.path[0] as string;
          newErrors[path] = error.message;
        });
        setErrors(newErrors);
        return;
      }

      // Call API to send reset email
      await forgotPassword(email);
      setIsSubmitted(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ocurrió un error al enviar el correo";
      setGeneralError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header con iconos (Logo) */}
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

        {/* Card de Recuperar Contraseña */}
        <Card className="border-border/50 shadow-lg backdrop-blur-sm bg-background/95">
          <CardHeader className="space-y-2 text-center pb-6">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Recuperar contraseña
            </CardTitle>
            <CardDescription className="text-sm">
              Ingresa tu correo y te enviaremos instrucciones para restablecerla
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* General Error */}
                {generalError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600">{generalError}</p>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Correo electrónico
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`pl-9 transition-colors focus-visible:ring-1 ${
                        errors.email ? "border-red-500" : ""
                      }`}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {errors.email}
                    </p>
                  )}
                </div>

                {/* Submit button */}
                <Button
                  type="submit"
                  className="w-full mt-2 font-medium shadow-sm transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? "Enviando..." : "Enviar instrucciones"}
                </Button>
              </form>
            ) : (
              <div className="text-center space-y-4 py-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 mb-4">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-sm text-muted-foreground">
                  Hemos enviado un enlace de recuperación a <br/>
                  <span className="font-medium text-foreground">{email}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Revisa tu bandeja de entrada (y carpeta de spam). El enlace expirará en 1 hora.
                </p>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => {
                    setIsSubmitted(false);
                    setEmail("");
                  }}
                >
                  Intentar con otro correo
                </Button>
              </div>
            )}

            {/* Back to login link */}
            <div className="mt-6 text-center text-sm text-muted-foreground">
              <a href="/login" className="inline-flex items-center font-semibold text-primary hover:underline transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Iniciar sesión
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
