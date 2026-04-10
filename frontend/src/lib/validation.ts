import { z } from "zod";

// Esquema de validación para login
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El correo es requerido")
    .email("Ingresa un correo válido")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, "La contraseña es requerida")
    .min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Esquema de validación para registro
const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(100, "Máximo 100 caracteres")
  .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
  .regex(/[a-z]/, "Debe contener al menos una minúscula")
  .regex(/[0-9]/, "Debe contener al menos un número")
  .regex(
    /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/,
    "Debe contener al menos un carácter especial: !@#$%^&*()_+-=[]{}|;:,.<>?"
  );

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(1, "El nombre es requerido")
      .min(3, "El nombre debe tener al menos 3 caracteres")
      .max(100, "El nombre no puede exceder 100 caracteres")
      .trim(),
    email: z
      .string()
      .min(1, "El correo es requerido")
      .email("Ingresa un correo válido")
      .toLowerCase()
      .trim(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

// Esquema para recuperar contraseña
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "El correo es requerido")
    .email("Ingresa un correo válido")
    .toLowerCase()
    .trim(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
