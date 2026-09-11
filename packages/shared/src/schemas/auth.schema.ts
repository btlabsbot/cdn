import { z } from "zod";

export const USERNAME_RE = /^[a-zA-Z0-9_-]+$/;

export const loginSchema = z.object({
  username: z.string().min(1, "username is required").max(32),
  password: z.string().min(1, "password is required").max(128),
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "username must be at least 3 characters")
    .max(32, "username must be at most 32 characters")
    .regex(USERNAME_RE, "username may only contain letters, numbers, _ and -"),
  password: z
    .string()
    .min(8, "password must be at least 8 characters")
    .max(128, "password must be at most 128 characters"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "currentPassword is required").max(128),
  newPassword: z
    .string()
    .min(8, "newPassword must be at least 8 characters")
    .max(128, "newPassword must be at most 128 characters"),
});

export type LoginSchema = z.infer<typeof loginSchema>;
export type RegisterSchema = z.infer<typeof registerSchema>;
export type ChangePasswordSchema = z.infer<typeof changePasswordSchema>;
