/**
 * Authentication Hook for AvalonMind
 * React-style hook for managing authentication state with Supabase
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  AuthState,
  AuthFormData,
  SupabaseAuthError,
  SupabaseErrorCode,
  UIState,
  EmailConfirmationState,
  User,
  AuthSession,
} from './types';
import { SupabaseAuthService } from './supabase.service';
import { AuthSchemas } from './schemas';

// ============== Hook Configuration ==============

interface UseAuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl?: string;
  enablePKCE?: boolean;
  autoCheckSession?: boolean;
  sessionCheckInterval?: number;
}

interface UseAuthReturn {
  // State
  state: AuthState;
  uiState: UIState;
  user: User | null;
  session: AuthSession | null;
  emailConfirmation: EmailConfirmationState;
  
  // Actions
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  checkSession: () => Promise<void>;
  
  // Utilities
  isAuthenticated: boolean;
  isEmailConfirmed: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  isAwaitingVerification: boolean;
  hasError: boolean;
  clearError: () => void;
  startCountdown: (seconds: number) => void;
}

// ============== Default Configuration ==============

const DEFAULT_CONFIG: Partial<UseAuthConfig> = {
  siteUrl: 'http://localhost:5000',
  enablePKCE: true,
  autoCheckSession: true,
  sessionCheckInterval: 30000, // 30 seconds
};

// ============== Hook Implementation ==============

export function useAuth(config: UseAuthConfig): UseAuthReturn {
  // Merge with defaults
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Service instance
  const [service] = useState(() => 
    new SupabaseAuthService({
      isProduction: !fullConfig.siteUrl!.includes('localhost') && !fullConfig.siteUrl!.includes('127.0.0.1'),
      supabaseUrl: fullConfig.supabaseUrl,
      supabaseAnonKey: fullConfig.supabaseAnonKey,
      siteUrl: fullConfig.siteUrl!,
      emailRedirectTo: `${fullConfig.siteUrl}/auth/callback`,
    })
  );

  // State
  const [state, setState] = useState<AuthState>('idle');
  const [uiState, setUiState] = useState<UIState>({
    state: 'idle',
    message: '',
  });
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [emailConfirmation, setEmailConfirmation] = useState<EmailConfirmationState>({
    email: '',
    sentAt: null,
    canResend: true,
    cooldownSeconds: 60,
  });

  // Refs
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const sessionCheckRef = useRef<NodeJS.Timeout | null>(null);

  // ============== State Helpers ==============

  const updateUiState = useCallback((updates: Partial<UIState>) => {
    setUiState(prev => ({ ...prev, ...updates }));
  }, []);

  const setError = useCallback((error: SupabaseAuthError) => {
    setState('error');
    updateUiState({
      state: 'error',
      message: error.message,
      error,
    });
  }, [updateUiState]);

  const setSuccess = useCallback((message: string) => {
    setState('success');
    updateUiState({
      state: 'success',
      message,
      error: undefined,
    });
  }, [updateUiState]);

  const setLoading = useCallback((message: string = 'Loading...') => {
    setState('loading');
    updateUiState({
      state: 'loading',
      message,
    });
  }, [updateUiState]);

  const setSubmitting = useCallback((message: string = 'Processing...') => {
    setState('submitting');
    updateUiState({
      state: 'submitting',
      message,
    });
  }, [updateUiState]);

  const setAwaitingVerification = useCallback((email: string) => {
    setState('awaiting_verification');
    setEmailConfirmation(prev => ({
      ...prev,
      email,
      sentAt: new Date(),
      canResend: false,
    }));
    updateUiState({
      state: 'awaiting_verification',
      message: `Please check your email (${email}) to confirm your account.`,
    });
    
    // Start cooldown timer
    startCountdown(emailConfirmation.cooldownSeconds);
  }, [emailConfirmation.cooldownSeconds]);

  // ============== Countdown Timer ==============

  const startCountdown = useCallback((seconds: number) => {
    // Clear existing countdown
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    let remaining = seconds;
    
    const updateCountdown = () => {
      updateUiState({
        countdown: remaining,
      });

      if (remaining <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        setEmailConfirmation(prev => ({
          ...prev,
          canResend: true,
        }));
        updateUiState({
          countdown: undefined,
        });
      }
      
      remaining--;
    };

    // Initial update
    updateCountdown();
    
    // Start interval
    countdownRef.current = setInterval(updateCountdown, 1000);
  }, [updateUiState]);

  // ============== Session Management ==============

  const checkSession = useCallback(async () => {
    try {
      setLoading('Checking session...');
      
      const response = await service.getSession();
      
      if (response.success) {
        if (response.data) {
          setSession(response.data);
          setUser(response.data.user);
          setState('idle');
          updateUiState({
            state: 'idle',
            message: 'Session active',
          });
        } else {
          setSession(null);
          setUser(null);
          setState('idle');
          updateUiState({
            state: 'idle',
            message: 'No active session',
          });
        }
      } else {
        setError({
          name: 'SessionError',
          message: response.error?.message || 'Failed to check session',
          code: response.error?.code || SupabaseErrorCode.UNKNOWN_ERROR,
        });
      }
    } catch (error) {
      setError({
        name: 'SessionError',
        message: 'Failed to check session',
        code: SupabaseErrorCode.UNKNOWN_ERROR,
      });
    }
  }, [service, setLoading, setError, updateUiState]);

  // ============== Authentication Actions ==============

  const register = useCallback(async (email: string, password: string) => {
    try {
      // Validate inputs
      const validation = AuthSchemas.validateRegistration(email, password, password);
      if (!validation.isValid) {
        setError({
          name: 'ValidationError',
          message: Object.values(validation.errors).join(', '),
          code: SupabaseErrorCode.INVALID_EMAIL,
        });
        return;
      }

      setSubmitting('Creating your account...');

      const response = await service.register(email, password);

      if (response.success && response.data) {
        if (response.data.requiresConfirmation) {
          setAwaitingVerification(email);
          setSuccess('Registration successful! Please check your email to confirm your account.');
        } else {
          setUser(response.data.user);
          setSuccess('Registration successful! You are now logged in.');
        }
      } else {
        setError({
          name: 'RegistrationError',
          message: response.error?.message || 'Registration failed',
          code: response.error?.code || SupabaseErrorCode.UNKNOWN_ERROR,
        });
      }
    } catch (error) {
      setError({
        name: 'RegistrationError',
        message: 'An unexpected error occurred during registration',
        code: SupabaseErrorCode.UNKNOWN_ERROR,
      });
    }
  }, [service, setSubmitting, setError, setSuccess, setAwaitingVerification]);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      // Validate inputs
      const validation = AuthSchemas.validateLogin(email, password);
      if (!validation.isValid) {
        setError({
          name: 'ValidationError',
          message: Object.values(validation.errors).join(', '),
          code: SupabaseErrorCode.INVALID_CREDENTIALS,
        });
        return;
      }

      setSubmitting('Logging in...');

      const response = await service.login(email, password, rememberMe);

      if (response.success && response.data) {
        setUser(response.data.user);
        setSession(response.data.session);
        setSuccess('Login successful! Welcome back.');
      } else {
        // Check for email confirmation error
        if (response.error?.code === SupabaseErrorCode.EMAIL_NOT_CONFIRMED) {
          setAwaitingVerification(email);
          setError({
            name: 'EmailConfirmationError',
            message: response.error.message,
            code: response.error.code,
          });
        } else {
          setError({
            name: 'LoginError',
            message: response.error?.message || 'Login failed',
            code: response.error?.code || SupabaseErrorCode.UNKNOWN_ERROR,
          });
        }
      }
    } catch (error) {
      setError({
        name: 'LoginError',
        message: 'An unexpected error occurred during login',
        code: SupabaseErrorCode.UNKNOWN_ERROR,
      });
    }
  }, [service, setSubmitting, setError, setSuccess, setAwaitingVerification]);

  const logout = useCallback(async () => {
    try {
      setSubmitting('Logging out...');

      const response = await service.logout();

      if (response.success) {
        setUser(null);
        setSession(null);
        setSuccess('Logged out successfully.');
      } else {
        setError({
          name: 'LogoutError',
          message: response.error?.message || 'Logout failed',
          code: response.error?.code || SupabaseErrorCode.UNKNOWN_ERROR,
        });
      }
    } catch (error) {
      setError({
        name: 'LogoutError',
        message: 'An unexpected error occurred during logout',
        code: SupabaseErrorCode.UNKNOWN_ERROR,
      });
    }
  }, [service, setSubmitting, setError, setSuccess]);

  const resendConfirmation = useCallback(async (email: string) => {
    try {
      // Validate email
      const emailValidation = AuthSchemas.validateEmail(email);
      if (!emailValidation.isValid) {
        setError({
          name: 'ValidationError',
          message: emailValidation.error || 'Invalid email address',
          code: SupabaseErrorCode.INVALID_EMAIL,
        });
        return;
      }

      // Check cooldown
      if (!emailConfirmation.canResend) {
        setError({
          name: 'RateLimitError',
          message: `Please wait ${uiState.countdown || emailConfirmation.cooldownSeconds} seconds before resending`,
          code: SupabaseErrorCode.RATE_LIMIT_EXCEEDED,
        });
        return;
      }

      setSubmitting('Resending confirmation email...');

      const response = await service.resendConfirmation(email);

      if (response.success && response.data) {
        setEmailConfirmation(prev => ({
          ...prev,
          sentAt: new Date(response.data!.sentAt),
          canResend: false,
        }));
        
        // Start cooldown timer
        startCountdown(emailConfirmation.cooldownSeconds);
        
        setSuccess('Confirmation email resent! Please check your inbox.');
      } else {
        setError({
          name: 'ResendError',
          message: response.error?.message || 'Failed to resend confirmation',
          code: response.error?.code || SupabaseErrorCode.UNKNOWN_ERROR,
        });
      }
    } catch (error) {
      setError({
        name: 'ResendError',
        message: 'An unexpected error occurred while resending confirmation',
        code: SupabaseErrorCode.UNKNOWN_ERROR,
      });
    }
  }, [service, emailConfirmation, uiState.countdown, setSubmitting, setError, setSuccess, startCountdown]);

  // ============== Utility Functions ==============

  const clearError = useCallback(() => {
    setState('idle');
    updateUiState({
      state: 'idle',
      message: '',
      error: undefined,
    });
  }, [updateUiState]);

  // ============== Effects ==============

  // Auto-check session on mount
  useEffect(() => {
    if (fullConfig.autoCheckSession) {
      checkSession();
      
      // Set up periodic session check
      sessionCheckRef.current = setInterval(
        checkSession,
        fullConfig.sessionCheckInterval!
      );
    }

    return () => {
      // Clean up intervals
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      if (sessionCheckRef.current) {
        clearInterval(sessionCheckRef.current);
      }
    };
  }, [checkSession, fullConfig.autoCheckSession, fullConfig.sessionCheckInterval]);

  // ============== Computed Properties ==============

  const isAuthenticated = !!user && !!session;
  const isEmailConfirmed = !!user?.email_confirmed_at;
  const isLoading = state === 'loading';
  const isSubmitting = state === 'submitting';
  const isAwaitingVerification = state === 'awaiting_verification';
  const hasError = state === 'error';

  // ============== Return Object ==============

  return {
    // State
    state,
    uiState,
    user,
    session,
    emailConfirmation,
    
    // Actions
    register,
    login,
    logout,
    resendConfirmation,
    checkSession,
    
    // Utilities
    isAuthenticated,
    isEmailConfirmed,
    isLoading,
    isSubmitting,
    isAwaitingVerification,
    hasError,
    clearError,
    startCountdown,
  };
}

// ============== Hook Factory ==============

/**
 * Create a pre-configured useAuth hook for AvalonMind
 */
export function createUseAuth(supabaseUrl: string, supabaseAnonKey: string) {
  return function useAvalonAuth(siteUrl?: string) {
    return useAuth({
      supabaseUrl,
      supabaseAnonKey,
      siteUrl: siteUrl || 'http://localhost:5000',
    });
  };
}

// ============== Default Export ==============

export default useAuth;