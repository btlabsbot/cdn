import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "username is required"),
  password: z.string().min(1, "password is required"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "username must be at least 3 characters").max(32, "username must be at most 32 characters"),
  password: z.string().min(4, "password must be at least 4 characters"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "currentPassword is required"),
  newPassword: z.string().min(4, "newPassword must be at least 4 characters"),
});

export type LoginSchema = z.infer<typeof loginSchema>;
export type RegisterSchema = z.infer<typeof registerSchema>;
export type ChangePasswordSchema = z.infer<typeof changePasswordSchema>;
