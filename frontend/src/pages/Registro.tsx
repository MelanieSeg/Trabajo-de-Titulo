import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Zap, Droplets, Leaf, Mail, Lock, User, AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { registerSchema, type RegisterInput } from "@/lib/validation";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { register as apiRegister } from "@/lib/api";

export default function Registro() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  // Validar requisitos de contraseña en tiempo real
  const getPasswordValidation = () => {
    return {
      hasLength: password.length >= 8 && password.length <= 100,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password),
    };
  };

  const validation = getPasswordValidation();
  const isPasswordValid = Object.values(validation).every((v) => v);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const formData: RegisterInput = {
        fullName,
        email,
        password,
        confirmPassword,
      };

      const result = registerSchema.safeParse(formData);

      if (!result.success) {
        const newErrors: Record<string, string> = {};
        result.error.errors.forEach((error) => {
          const path = error.path[0] as string;
          newErrors[path] = error.message;
        });
        setErrors(newErrors);
        return;
      }

      // Register via API
      const response = await apiRegister({
        full_name: result.data.fullName,
        email: result.data.email,
        password: result.data.password,
      });

      // Store token for verification step
      setVerificationToken(response.verification_token);

      toast({
        title: "Éxito",
        description: "Cuenta creada. Por favor, verifica tu email.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error al crear la cuenta";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (verificationToken) {
      navigator.clipboard.writeText(verificationToken);
      toast({
        title: "Copiado",
        description: "Token copiado al portapapeles",
      });
    }
  };

  const handleVerifyClick = () => {
    if (verificationToken) {
      navigate(`/verificar-email/${verificationToken}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4 py-8">
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

        {!verificationToken ? (
          /* Formulario de Registro */
          <Card className="border-border/50 shadow-lg backdrop-blur-sm bg-background/95">
            <CardHeader className="space-y-2 text-center pb-6">
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                Crear una cuenta
              </CardTitle>
              <CardDescription className="text-sm">
                Únete a EcoEnergy y comienza a optimizar tu consumo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nombre completo */}
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium">
                    Nombre completo
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Tu nombre completo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={`pl-9 transition-colors focus-visible:ring-1 ${
                        errors.fullName ? "border-red-500" : ""
                      }`}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {errors.fullName}
                    </p>
                  )}
                </div>

                {/* Correo electrónico */}
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

                {/* Contraseña */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`pl-9 transition-colors focus-visible:ring-1 ${
                        errors.password ? "border-red-500" : ""
                      }`}
                      disabled={isLoading}
                    />
                  </div>

                  {/* Requisitos de contraseña */}
                  {password && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2 mt-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Requisitos de contraseña:
                      </p>
                      <div className="space-y-1 text-xs">
                        <div
                          className={`flex items-center gap-2 ${
                            validation.hasLength
                              ? "text-green-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {validation.hasLength ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertCircle className="w-3 h-3" />
                          )}
                          8-100 caracteres
                        </div>
                        <div
                          className={`flex items-center gap-2 ${
                            validation.hasUppercase
                              ? "text-green-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {validation.hasUppercase ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertCircle className="w-3 h-3" />
                          )}
                          Una mayúscula (A-Z)
                        </div>
                        <div
                          className={`flex items-center gap-2 ${
                            validation.hasLowercase
                              ? "text-green-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {validation.hasLowercase ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertCircle className="w-3 h-3" />
                          )}
                          Una minúscula (a-z)
                        </div>
                        <div
                          className={`flex items-center gap-2 ${
                            validation.hasNumber
                              ? "text-green-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {validation.hasNumber ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertCircle className="w-3 h-3" />
                          )}
                          Un número (0-9)
                        </div>
                        <div
                          className={`flex items-center gap-2 ${
                            validation.hasSpecial
                              ? "text-green-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {validation.hasSpecial ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertCircle className="w-3 h-3" />
                          )}
                          Carácter especial (!@#$%^&*)
                        </div>
                      </div>
                    </div>
                  )}

                  {errors.password && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {errors.password}
                    </p>
                  )}
                </div>

                {/* Confirmar contraseña */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirmar contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`pl-9 transition-colors focus-visible:ring-1 ${
                        confirmPassword && !passwordsMatch ? "border-red-500" : ""
                      }`}
                      disabled={isLoading}
                    />
                  </div>
                  {confirmPassword &&
                    !passwordsMatch && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> Las contraseñas no coinciden
                      </p>
                    )}
                  {confirmPassword &&
                    passwordsMatch && (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Las contraseñas coinciden
                      </p>
                    )}
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {errors.confirmPassword}
                    </p>
                  )}
                </div>

                {/* Botón de envío */}
                <Button
                  type="submit"
                  className="w-full mt-4 font-medium shadow-sm transition-all"
                  disabled={
                    isLoading || !isPasswordValid || (confirmPassword ? !passwordsMatch : true)
                  }
                >
                  {isLoading ? "Creando cuenta..." : "Registrarse"}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative mt-6 mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
              </div>

              {/* Enlace de inicio de sesión */}
              <div className="text-center text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{" "}
                <a
                  href="/login"
                  className="font-semibold text-primary hover:underline transition-colors"
                >
                  Inicia sesión aquí
                </a>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Pantalla de Verificación */
          <Card className="border-border/50 shadow-lg backdrop-blur-sm bg-background/95">
            <CardHeader className="space-y-2 text-center pb-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 mb-4">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                Verifica tu email
              </CardTitle>
              <CardDescription className="text-sm">
                Hemos enviado un enlace de verificación a {email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Token de verificación:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verificationToken || ""}
                    readOnly
                    className="flex-1 px-3 py-2 bg-background border border-border rounded text-xs font-mono truncate"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyToken}
                    className="flex-shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Button
                type="button"
                className="w-full font-medium shadow-sm transition-all"
                onClick={handleVerifyClick}
              >
                Verificar email
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                <p>¿No recibiste el email?</p>
                <Button
                  variant="link"
                  className="text-primary p-0 h-auto"
                  onClick={() => setVerificationToken(null)}
                >
                  Intentar de nuevo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
