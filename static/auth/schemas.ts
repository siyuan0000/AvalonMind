/**
 * Authentication Schemas for AvalonMind
 * Zod-based validation schemas for enterprise-grade input validation
 */

import { z } from 'zod';

// ============== Environment Validation ==============

export const EnvironmentSchema = z.object({
  // Supabase Configuration
  VITE_SUPABASE_URL: z.string().url().min(1, 'Supabase URL is required'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  
  // Application URLs
  VITE_SITE_URL: z.string().url().default('http://localhost:5000'),
  VITE_EMAIL_REDIRECT_TO: z.string().url().default('http://localhost:5000/auth/callback'),
  
  // Feature Flags
  VITE_ENABLE_EMAIL_CONFIRMATION: z.enum(['true', 'false']).default('true'),
  VITE_ENABLE_PKCE_FLOW: z.enum(['true', 'false']).default('true'),
  
  // Security Settings
  VITE_PASSWORD_MIN_LENGTH: z.string().regex(/^\d+$/).transform(Number).default('8'),
  VITE_REQUIRE_EMAIL_CONFIRMATION: z.enum(['true', 'false']).default('true'),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

// ============== Email Validation ==============

export const EmailSchema = z.string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .transform(email => email.trim().toLowerCase());

// ============== Password Validation ==============

export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
  .transform(password => password.trim());

// ============== Authentication Form Schemas ==============

export const LoginFormSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  rememberMe: z.boolean().default(false),
});

export type LoginFormData = z.infer<typeof LoginFormSchema>;

export const RegisterFormSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type RegisterFormData = z.infer<typeof RegisterFormSchema>;

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});

export type ForgotPasswordData = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  password: PasswordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ResetPasswordData = z.infer<typeof ResetPasswordSchema>;

export const ResendConfirmationSchema = z.object({
  email: EmailSchema,
});

export type ResendConfirmationData = z.infer<typeof ResendConfirmationSchema>;

// ============== API Request Schemas ==============

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  remember_me: z.boolean().default(false),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const UpdateProfileRequestSchema = z.object({
  is_vip: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

// ============== Validation Utilities ==============

/**
 * Sanitize email input
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Sanitize password input (trim only, keep case sensitivity)
 */
export function sanitizePassword(password: string): string {
  return password.trim();
}

/**
 * Validate email format with detailed error messages
 */
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  try {
    EmailSchema.parse(email);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.errors[0].message };
    }
    return { isValid: false, error: 'Invalid email format' };
  }
}

/**
 * Validate password with detailed error messages
 */
export function validatePassword(password: string): { isValid: boolean; errors?: string[] } {
  try {
    PasswordSchema.parse(password);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => err.message);
      return { isValid: false, errors };
    }
    return { isValid: false, errors: ['Invalid password format'] };
  }
}

/**
 * Validate registration form with detailed feedback
 */
export function validateRegistration(
  email: string,
  password: string,
  confirmPassword: string
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  
  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid && emailValidation.error) {
    errors.email = emailValidation.error;
  }
  
  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid && passwordValidation.errors) {
    errors.password = passwordValidation.errors.join(', ');
  }
  
  // Validate password confirmation
  if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate login form
 */
export function validateLogin(
  email: string,
  password: string
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  
  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid && emailValidation.error) {
    errors.email = emailValidation.error;
  }
  
  // Validate password (basic check for login)
  if (!password || password.trim().length === 0) {
    errors.password = 'Password is required';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// ============== Schema Export ==============

export const AuthSchemas = {
  // Environment
  Environment: EnvironmentSchema,
  
  // Forms
  LoginForm: LoginFormSchema,
  RegisterForm: RegisterFormSchema,
  ForgotPassword: ForgotPasswordSchema,
  ResetPassword: ResetPasswordSchema,
  ResendConfirmation: ResendConfirmationSchema,
  
  // API Requests
  LoginRequest: LoginRequestSchema,
  RegisterRequest: RegisterRequestSchema,
  UpdateProfileRequest: UpdateProfileRequestSchema,
  
  // Utilities
  validateEmail,
  validatePassword,
  validateRegistration,
  validateLogin,
  sanitizeEmail,
  sanitizePassword,
} as const;