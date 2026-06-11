import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Zap, Droplets, Leaf, Lock, ArrowLeft, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation";
import { resetPassword } from "@/lib/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setGeneralError("Token inválido. Por favor, solicita un nuevo enlace de recuperación.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);
    setIsLoading(true);

    try {
      // Check if passwords match
      if (password !== confirmPassword) {
        setErrors({ confirmPassword: "Las contraseñas no coinciden" });
        setIsLoading(false);
        return;
      }

      const formData: ResetPasswordInput = { password };
      const result = resetPasswordSchema.safeParse(formData);

      if (!result.success) {
        const newErrors: Record<string, string> = {};
        result.error.errors.forEach((error) => {
          const path = error.path[0] as string;
          newErrors[path] = error.message;
        });
        setErrors(newErrors);
        return;
      }

      if (!token) {
        throw new Error("Token inválido");
      }

      // Call API to reset password
      await resetPassword(token, password);
      setIsSubmitted(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ocurrió un error al restablecer la contraseña";
      setGeneralError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Invalid token
  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md space-y-6">
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
            <CardHeader className="space-y-2 text-center pb-6">
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                Enlace inválido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-600 font-medium">Token expirado o inválido</p>
                  <p className="text-xs text-red-600/80 mt-1">
                    El enlace de recuperación puede haber expirado. Por favor, solicita uno nuevo.
                  </p>
                </div>
              </div>

              <Button
                onClick={() => navigate("/recuperar-contraseña")}
                className="w-full"
              >
                Solicitar nuevo enlace
              </Button>

              <div className="text-center text-sm text-muted-foreground">
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

        {/* Card de Restablecer Contraseña */}
        <Card className="border-border/50 shadow-lg backdrop-blur-sm bg-background/95">
          <CardHeader className="space-y-2 text-center pb-6">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Restablecer contraseña
            </CardTitle>
            <CardDescription className="text-sm">
              Ingresa tu nueva contraseña
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

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Nueva contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Ingresa tu nueva contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`pl-9 pr-10 transition-colors focus-visible:ring-1 ${
                        errors.password ? "border-red-500" : ""
                      }`}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-500 flex items-start gap-1">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{errors.password}</span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Mínimo 8 caracteres, incluir mayúscula, minúscula, número y carácter especial
                  </p>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirmar contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirma tu contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`pl-9 pr-10 transition-colors focus-visible:ring-1 ${
                        errors.confirmPassword ? "border-red-500" : ""
                      }`}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {errors.confirmPassword}
                    </p>
                  )}
                </div>

                {/* Submit button */}
                <Button
                  type="submit"
                  className="w-full mt-2 font-medium shadow-sm transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? "Restableciendo..." : "Restablecer contraseña"}
                </Button>
              </form>
            ) : (
              <div className="text-center space-y-4 py-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 mb-4">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-foreground">¡Contraseña restablecida!</p>
                  <p className="text-sm text-muted-foreground">
                    Tu contraseña ha sido actualizada exitosamente.
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/login")}
                  className="w-full mt-4"
                >
                  Ir a Iniciar sesión
                </Button>
              </div>
            )}

            {/* Back to login link */}
            {!isSubmitted && (
              <div className="mt-6 text-center text-sm text-muted-foreground">
                <a href="/login" className="inline-flex items-center font-semibold text-primary hover:underline transition-colors">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver a Iniciar sesión
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
