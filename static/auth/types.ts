/**
 * Authentication Types for AvalonMind
 * Enterprise-grade type definitions for Supabase authentication
 */

// ============== User Types ==============

export interface User {
  id: string;
  email: string;
  email_confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  user_id: string;
  email: string;
  is_vip: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

// ============== Authentication State Types ==============

export type AuthState = 
  | 'idle'
  | 'loading'
  | 'submitting'
  | 'awaiting_verification'
  | 'success'
  | 'error';

export interface AuthFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// ============== Supabase Error Types ==============

export interface SupabaseAuthError {
  name: string;
  message: string;
  status?: number;
  code?: string;
}

export enum SupabaseErrorCode {
  // Email confirmation errors
  EMAIL_NOT_CONFIRMED = 'email_not_confirmed',
  CONFIRMATION_REQUIRED = 'confirmation_required',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  TOO_MANY_REQUESTS = 'too_many_requests',
  
  // Validation errors
  INVALID_EMAIL = 'invalid_email',
  WEAK_PASSWORD = 'weak_password',
  EMAIL_EXISTS = 'email_exists',
  USER_NOT_FOUND = 'user_not_found',
  INVALID_CREDENTIALS = 'invalid_credentials',
  
  // Network errors
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  
  // Unknown
  UNKNOWN_ERROR = 'unknown_error'
}

// ============== UI State Types ==============

export interface UIState {
  state: AuthState;
  message: string;
  error?: SupabaseAuthError;
  countdown?: number; // For resend email cooldown
}

export interface EmailConfirmationState {
  email: string;
  sentAt: Date | null;
  canResend: boolean;
  cooldownSeconds: number;
}

// ============== Configuration Types ==============

export interface AuthConfig {
  siteUrl: string;
  redirectTo: string;
  enablePKCE: boolean;
  passwordMinLength: number;
  passwordRequirements: {
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
}

// ============== API Response Types ==============

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: SupabaseErrorCode;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface RegisterResponse {
  user: User;
  requiresConfirmation: boolean;
  confirmationSent: boolean;
}

export interface LoginResponse {
  user: User;
  session: AuthSession;
  rememberMe: boolean;
}

export interface ResendConfirmationResponse {
  success: boolean;
  email: string;
  sentAt: string;
  nextResendAvailableAt: string;
}

// ============== Environment Types ==============

export interface EnvironmentConfig {
  isProduction: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string;
  emailRedirectTo: string;
}

// ============== Utility Types ==============

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null | undefined;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;