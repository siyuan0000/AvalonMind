/**
 * Supabase Authentication Service
 * Enterprise-grade service layer for Supabase authentication with PKCE flow
 */

import { createClient, SupabaseClient, AuthError } from '@supabase/supabase-js';
import type { User, Session } from '@supabase/supabase-js';
import {
  AuthConfig,
  EnvironmentConfig,
  SupabaseAuthError,
  SupabaseErrorCode,
  ApiResponse,
  RegisterResponse,
  LoginResponse,
  ResendConfirmationResponse,
  AuthSession
} from './types';
import { AuthSchemas } from './schemas';

// ============== Configuration ==============

const DEFAULT_CONFIG: AuthConfig = {
  siteUrl: 'http://localhost:5000',
  redirectTo: 'http://localhost:5000/auth/callback',
  enablePKCE: true,
  passwordMinLength: 8,
  passwordRequirements: {
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },
};

// ============== Error Mapping ==============

const ERROR_MAPPINGS: Record<string, { code: SupabaseErrorCode; message: string }> = {
  // Supabase Auth Errors
  'Invalid login credentials': {
    code: SupabaseErrorCode.INVALID_CREDENTIALS,
    message: 'Invalid email or password. Please try again.',
  },
  'Email not confirmed': {
    code: SupabaseErrorCode.EMAIL_NOT_CONFIRMED,
    message: 'Please confirm your email address before logging in.',
  },
  'User already registered': {
    code: SupabaseErrorCode.EMAIL_EXISTS,
    message: 'An account with this email already exists.',
  },
  'Password should be at least 6 characters': {
    code: SupabaseErrorCode.WEAK_PASSWORD,
    message: 'Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters.',
  },
  'Invalid email address': {
    code: SupabaseErrorCode.INVALID_EMAIL,
    message: 'Please enter a valid email address.',
  },
  'User not found': {
    code: SupabaseErrorCode.USER_NOT_FOUND,
    message: 'No account found with this email address.',
  },
  'Too many requests': {
    code: SupabaseErrorCode.RATE_LIMIT_EXCEEDED,
    message: 'Too many attempts. Please try again in a few minutes.',
  },
  'rate_limit_exceeded': {
    code: SupabaseErrorCode.RATE_LIMIT_EXCEEDED,
    message: 'Too many attempts. Please try again in a few minutes.',
  },
  'Network request failed': {
    code: SupabaseErrorCode.NETWORK_ERROR,
    message: 'Network error. Please check your connection and try again.',
  },
};

// ============== SupabaseAuthService Class ==============

export class SupabaseAuthService {
  private client: SupabaseClient | null = null;
  private config: AuthConfig;
  private environment: EnvironmentConfig;

  constructor(environment: EnvironmentConfig, config: Partial<AuthConfig> = {}) {
    this.environment = environment;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeClient();
  }

  // ============== Initialization ==============

  private initializeClient(): void {
    try {
      if (!this.environment.supabaseUrl || !this.environment.supabaseAnonKey) {
        throw new Error('Supabase URL and anon key are required');
      }

      this.client = createClient(
        this.environment.supabaseUrl,
        this.environment.supabaseAnonKey,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            flowType: this.config.enablePKCE ? 'pkce' : 'implicit',
            storage: localStorage,
            storageKey: 'avalonmind-auth',
          },
        }
      );

      console.log('[SupabaseAuthService] Client initialized successfully');
    } catch (error) {
      console.error('[SupabaseAuthService] Failed to initialize client:', error);
      throw error;
    }
  }

  // ============== Error Handling ==============

  private mapSupabaseError(error: any): SupabaseAuthError {
    console.error('[SupabaseAuthService] Raw error:', error);

    // Check if it's a network error
    if (!navigator.onLine) {
      return {
        name: 'NetworkError',
        message: 'You are offline. Please check your internet connection.',
        code: SupabaseErrorCode.NETWORK_ERROR,
      };
    }

    // Check if it's a timeout
    if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
      return {
        name: 'TimeoutError',
        message: 'Request timed out. Please try again.',
        code: SupabaseErrorCode.TIMEOUT,
      };
    }

    // Map known Supabase errors
    const errorMessage = error.message || error.toString();
    const errorStatus = error.status || error.statusCode;

    for (const [key, mapping] of Object.entries(ERROR_MAPPINGS)) {
      if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
        return {
          name: 'AuthError',
          message: mapping.message,
          code: mapping.code,
          status: errorStatus,
        };
      }
    }

    // Handle specific error codes from Supabase
    if (error.code) {
      switch (error.code) {
        case 'user_already_exists':
          return {
            name: 'AuthError',
            message: 'An account with this email already exists.',
            code: SupabaseErrorCode.EMAIL_EXISTS,
            status: errorStatus,
          };
        case 'email_not_confirmed':
          return {
            name: 'AuthError',
            message: 'Please confirm your email address before logging in.',
            code: SupabaseErrorCode.EMAIL_NOT_CONFIRMED,
            status: errorStatus,
          };
        case 'invalid_credentials':
          return {
            name: 'AuthError',
            message: 'Invalid email or password.',
            code: SupabaseErrorCode.INVALID_CREDENTIALS,
            status: errorStatus,
          };
      }
    }

    // Default unknown error
    return {
      name: 'UnknownError',
      message: 'An unexpected error occurred. Please try again.',
      code: SupabaseErrorCode.UNKNOWN_ERROR,
      status: errorStatus,
    };
  }

  private createErrorResponse<T>(error: any): ApiResponse<T> {
    const mappedError = this.mapSupabaseError(error);
    return {
      success: false,
      error: {
        code: mappedError.code,
        message: mappedError.message,
        details: error,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private createSuccessResponse<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  // ============== Authentication Methods ==============

  /**
   * Register a new user with email confirmation
   */
  async register(
    email: string,
    password: string
  ): Promise<ApiResponse<RegisterResponse>> {
    try {
      // Validate inputs
      const sanitizedEmail = AuthSchemas.sanitizeEmail(email);
      const sanitizedPassword = AuthSchemas.sanitizePassword(password);

      const validation = AuthSchemas.validateRegistration(
        sanitizedEmail,
        sanitizedPassword,
        sanitizedPassword
      );
      
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: SupabaseErrorCode.INVALID_EMAIL,
            message: Object.values(validation.errors).join(', '),
          },
          timestamp: new Date().toISOString(),
        };
      }

      if (!this.client) {
        throw new Error('Supabase client not initialized');
      }

      // Determine redirect URL based on environment
      const redirectTo = this.environment.isProduction
        ? `${this.environment.siteUrl}/auth/callback`
        : `${this.config.siteUrl}/auth/callback`;

      console.log(`[SupabaseAuthService] Registering user with redirect: ${redirectTo}`);

      // Sign up with Supabase (PKCE flow)
      const { data, error } = await this.client.auth.signUp({
        email: sanitizedEmail,
        password: sanitizedPassword,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            email: sanitizedEmail,
            created_at: new Date().toISOString(),
          },
        },
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error('No user data returned from registration');
      }

      // Check if email confirmation is required
      const requiresConfirmation = !!data.user.identities?.[0]?.identity_data?.email_verified === false;
      const confirmationSent = data.session === null && requiresConfirmation;

      const response: RegisterResponse = {
        user: {
          id: data.user.id,
          email: data.user.email!,
          email_confirmed_at: data.user.email_confirmed_at,
          created_at: data.user.created_at,
          updated_at: data.user.updated_at,
        },
        requiresConfirmation,
        confirmationSent,
      };

      return this.createSuccessResponse(response);
    } catch (error) {
      return this.createErrorResponse(error);
    }
  }

  /**
   * Login an existing user
   */
  async login(
    email: string,
    password: string,
    rememberMe: boolean = false
  ): Promise<ApiResponse<LoginResponse>> {
    try {
      // Validate inputs
      const sanitizedEmail = AuthSchemas.sanitizeEmail(email);
      const sanitizedPassword = AuthSchemas.sanitizePassword(password);

      const validation = AuthSchemas.validateLogin(sanitizedEmail, sanitizedPassword);
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: SupabaseErrorCode.INVALID_CREDENTIALS,
            message: Object.values(validation.errors).join(', '),
          },
          timestamp: new Date().toISOString(),
        };
      }

      if (!this.client) {
        throw new Error('Supabase client not initialized');
      }

      // Sign in with Supabase
      const { data, error } = await this.client.auth.signInWithPassword({
        email: sanitizedEmail,
        password: sanitizedPassword,
      });

      if (error) {
        throw error;
      }

      if (!data.user || !data.session) {
        throw new Error('No user or session returned from login');
      }

      // Check if email is confirmed
      if (!data.user.email_confirmed_at) {
        throw {
          message: 'Email not confirmed',
          code: 'email_not_confirmed',
        };
      }

      const response: LoginResponse = {
        user: {
          id: data.user.id,
          email: data.user.email!,
          email_confirmed_at: data.user.email_confirmed_at,
          created_at: data.user.created_at,
          updated_at: data.user.updated_at,
        },
        session: {
          user: data.user,
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at!,
        },
        rememberMe,
      };

      return this.createSuccessResponse(response);
    } catch (error) {
      return this.createErrorResponse(error);
    }
  }

  /**
   * Resend email confirmation
   */
  async resendConfirmation(email: string): Promise<ApiResponse<ResendConfirmationResponse>> {
    try {
      // Validate email
      const sanitizedEmail = AuthSchemas.sanitizeEmail(email);
      const emailValidation = AuthSchemas.validateEmail(sanitizedEmail);
      
      if (!emailValidation.isValid) {
        return {
          success: false,
          error: {
            code: SupabaseErrorCode.INVALID_EMAIL,
            message: emailValidation.error || 'Invalid email address',
          },
          timestamp: new Date().toISOString(),
        };
      }

      if (!this.client) {
        throw new Error('Supabase client not initialized');
      }

      // Determine redirect URL
      const redirectTo = this.environment.isProduction
        ? `${this.environment.siteUrl}/auth/callback`
        : `${this.config.siteUrl}/auth/callback`;

      // Resend confirmation email using Supabase's resend method
      const { error } = await this.client.auth.resend({
        type: 'signup',
        email: sanitizedEmail,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        throw error;
      }

      const response: ResendConfirmationResponse = {
        success: true,
        email: sanitizedEmail,
        sentAt: new Date().toISOString(),
        nextResendAvailableAt: new Date(Date.now() + 60000).toISOString(), // 1 minute cooldown
      };

      return this.createSuccessResponse(response);
    } catch (error) {
      return this.createErrorResponse(error);
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<ApiResponse<void>> {
    try {
      if (!this.client) {
        throw new Error('Supabase client not initialized');
      }

      const { error } = await this.client.auth.signOut();
      
      if (error) {
        throw error;
      }

      return this.createSuccessResponse(undefined);
    } catch (error) {
      return this.createErrorResponse(error);
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<ApiResponse<AuthSession | null>> {
    try {
      if (!this.client) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await this.client.auth.getSession();
      
      if (error) {
        throw error;
      }

      if (!data.session) {
        return this.createSuccessResponse(null);
      }

      const session: AuthSession = {
        user: data.session.user,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at!,
      };

      return this.createSuccessResponse(session);
    } catch (error) {
      return this.createErrorResponse(error);
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<ApiResponse<User | null>> {
    try {
      if (!this.client) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await this.client.auth.getUser();
      
      if (error) {
        throw error;
      }

      if (!data.user) {
        return this.createSuccessResponse(null);
      }

      const user: User = {
        id: data.user.id,
        email: data.user.email!,
        email_confirmed_at: data.user.email_confirmed_at,
        created_at: data.user.created_at,
        updated_at: data.user.updated_at,
      };

      return this.createSuccessResponse(user);
    } catch (error) {
      return this.createErrorResponse(error);
    }
  }

  /**
   * Check if user exists and is confirmed
   */
  async checkUserStatus(email: string): Promise<ApiResponse<{
    exists: boolean;
    confirmed: boolean;
    canLogin: boolean;
  }>> {
    try {
      // This is a simplified check - in production, you might want to
      // implement a proper check via your backend API
      const sessionResponse = await this.getSession();
      
      if (!sessionResponse.success || !sessionResponse.data) {
        return this.createSuccessResponse({
          exists: false,
          confirmed: false,
          canLogin: false,
        });
      }

      const userEmail = sessionResponse.data.user.email;
      const isCurrentUser = userEmail === AuthSchemas.sanitizeEmail(email);
      
      return this.createSuccessResponse({
        exists: isCurrentUser,
        confirmed: !!sessionResponse.data.user.email_confirmed_at,
        canLogin: isCurrentUser && !!sessionResponse.data.user.email_confirmed_at,
      });
    } catch (error) {
      return this.createErrorResponse(error);
    }
  }

  // ============== Utility Methods ==============

  /**
   * Get email redirect URL for current environment
   */
  getEmailRedirectUrl(): string {
    return this.environment.isProduction
      ? `${this.environment.siteUrl}/auth/callback`
      : `${this.config.siteUrl}/auth/callback`;
  }

  /**
   * Check if we're in production environment
   */
  isProduction(): boolean {
    return this.environment.isProduction;
  }

  /**
   * Get current configuration
   */
  getConfig(): AuthConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AuthConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============== Factory Function ==============

/**
 * Create a SupabaseAuthService instance with environment configuration
 */
export function createSupabaseAuthService(
  supabaseUrl: string,
  supabaseAnonKey: string,
  siteUrl: string = 'http://localhost:5000'
): SupabaseAuthService {
  const isProduction = !siteUrl.includes('localhost') && !siteUrl.includes('127.0.0.1');
  
  const environment: EnvironmentConfig = {
    isProduction,
    supabaseUrl,
    supabaseAnonKey,
    siteUrl,
    emailRedirectTo: isProduction 
      ? `${siteUrl}/auth/callback`
      : 'http://localhost:5000/auth/callback',
  };

  return new SupabaseAuthService(environment);
}

// ============== Default Export ==============

export default SupabaseAuthService;