/**
 * Authentication Modal Component for AvalonMind
 * Enterprise-grade authentication UI with TypeScript and React patterns
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../useAuth';
import { AuthSchemas } from '../schemas';
import { SupabaseErrorCode } from '../types';

// ============== Component Props ==============

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
  onRegisterSuccess?: () => void;
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl?: string;
}

// ============== Form State ==============

interface FormState {
  email: string;
  password: string;
  confirmPassword: string;
  rememberMe: boolean;
}

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

// ============== Component ==============

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onRegisterSuccess,
  supabaseUrl,
  supabaseAnonKey,
  siteUrl = 'http://localhost:5000',
}) => {
  // ============== State ==============
  
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [formState, setFormState] = useState<FormState>({
    email: '',
    password: '',
    confirmPassword: '',
    rememberMe: false,
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ============== Auth Hook ==============
  
  const auth = useAuth({
    supabaseUrl,
    supabaseAnonKey,
    siteUrl,
  });

  // ============== Effects ==============

  // Reset form when modal opens/closes or tab changes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    resetForm();
  }, [activeTab]);

  // Handle auth state changes
  useEffect(() => {
    if (auth.state === 'success') {
      handleAuthSuccess();
    } else if (auth.state === 'error') {
      handleAuthError();
    }
  }, [auth.state, auth.uiState]);

  // ============== Form Handlers ==============

  const resetForm = () => {
    setFormState({
      email: '',
      password: '',
      confirmPassword: '',
      rememberMe: false,
    });
    setFormErrors({});
    setIsSubmitting(false);
    auth.clearError();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    
    // Clear error for this field when user starts typing
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (activeTab === 'login') {
      const validation = AuthSchemas.validateLogin(formState.email, formState.password);
      if (!validation.isValid) {
        Object.assign(errors, validation.errors);
      }
    } else {
      const validation = AuthSchemas.validateRegistration(
        formState.email,
        formState.password,
        formState.confirmPassword
      );
      if (!validation.isValid) {
        Object.assign(errors, validation.errors);
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ============== Auth Handlers ==============

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    await auth.login(formState.email, formState.password, formState.rememberMe);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    await auth.register(formState.email, formState.password);
  };

  const handleResendConfirmation = async () => {
    if (!formState.email) {
      setFormErrors({ general: 'Please enter your email address' });
      return;
    }

    await auth.resendConfirmation(formState.email);
  };

  const handleAuthSuccess = () => {
    setIsSubmitting(false);
    
    if (auth.state === 'success') {
      if (activeTab === 'login' && onLoginSuccess) {
        onLoginSuccess();
      } else if (activeTab === 'register' && onRegisterSuccess) {
        onRegisterSuccess();
      }
      
      // Close modal after successful auth
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1500);
    }
  };

  const handleAuthError = () => {
    setIsSubmitting(false);
    
    if (auth.uiState.error) {
      // Map specific errors to form fields
      const error = auth.uiState.error;
      
      if (error.code === SupabaseErrorCode.EMAIL_NOT_CONFIRMED) {
        setFormErrors({
          general: error.message,
        });
      } else if (error.code === SupabaseErrorCode.INVALID_CREDENTIALS) {
        setFormErrors({
          password: 'Invalid email or password',
        });
      } else if (error.code === SupabaseErrorCode.EMAIL_EXISTS) {
        setFormErrors({
          email: 'An account with this email already exists',
        });
      } else {
        setFormErrors({
          general: error.message,
        });
      }
    }
  };

  // ============== UI Helpers ==============

  const getSubmitButtonText = () => {
    if (isSubmitting) {
      return activeTab === 'login' ? 'Signing in...' : 'Creating account...';
    }
    return activeTab === 'login' ? 'Sign in' : 'Create account';
  };

  const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    if (!password) return { score: 0, label: '', color: 'gray' };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const colors = ['red', 'orange', 'yellow', 'lightgreen', 'green', 'darkgreen'];
    
    return {
      score,
      label: labels[score],
      color: colors[score],
    };
  };

  // ============== Render ==============

  if (!isOpen) return null;

  const passwordStrength = getPasswordStrength(formState.password);
  const isEmailConfirmationState = auth.state === 'awaiting_verification';
  const canResendConfirmation = auth.emailConfirmation.canResend;
  const countdown = auth.uiState.countdown;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-8 pt-8 pb-6 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white font-bold text-xl">A</span>
            </div>
          </div>
          
          <h3 className="text-2xl font-semibold text-gray-900 mb-2">
            {isEmailConfirmationState ? 'Check Your Email' : 'Sign in to Avalon AI'}
          </h3>
          
          <p className="text-sm text-gray-600">
            {isEmailConfirmationState 
              ? `We've sent a confirmation link to ${formState.email}`
              : 'Enter your details to access the game'
            }
          </p>
        </div>

        {/* Modal Content */}
        <div className="px-8 pb-8">
          {isEmailConfirmationState ? (
            // Email Confirmation State
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Check your inbox</p>
                    <p className="text-sm text-blue-700">We've sent a confirmation link to your email</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleResendConfirmation}
                  disabled={!canResendConfirmation || isSubmitting}
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    canResendConfirmation
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? 'Sending...' : 
                   canResendConfirmation ? 'Resend confirmation email' : 
                   `Resend available in ${countdown}s`}
                </button>

                <button
                  onClick={() => {
                    auth.clearError();
                    setActiveTab('login');
                  }}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-colors"
                >
                  Back to login
                </button>
              </div>

              <div className="text-xs text-gray-500 text-center">
                <p>Didn't receive the email? Check your spam folder.</p>
                <p className="mt-1">Make sure you entered the correct email address.</p>
              </div>
            </div>
          ) : (
            // Login/Register Form
            <>
              {/* Tab Navigation */}
              <div className="flex border-b border-gray-200 mb-6">
                <button
                  onClick={() => setActiveTab('login')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'login'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Sign in
                </button>
                <button
                  onClick={() => setActiveTab('register')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'register'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Create account
                </button>
              </div>

              {/* Form */}
              <form onSubmit={activeTab === 'login' ? handleLogin : handleRegister}>
                <div className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email address
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formState.email}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                        formErrors.email ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="you@example.com"
                      disabled={isSubmitting}
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formState.password}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                        formErrors.password ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter your password"
                      disabled={isSubmitting}
                    />
                    {formErrors.password && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                    )}
                    
                    {/* Password Strength Meter (Register only) */}
                    {activeTab === 'register' && formState.password && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Password strength:</span>
                          <span className={`font-medium text-${passwordStrength.color}-600`}>
                            {passwordStrength.label}
                          </span>
                        </div>
                        <div className="h-1 bg-gray-200 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full bg-${passwordStrength.color}-500 transition-all duration-300`}
                            style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password (Register only) */}
                  {activeTab === 'register' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Confirm Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          {showConfirmPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formState.confirmPassword}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 border rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                          formErrors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Confirm your password"
                        disabled={isSubmitting}
                      />
                      {formErrors.confirmPassword && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.confirmPassword}</p>
                      )}
                    </div>
                  )}

                  {/* Remember Me (Login only) */}
                  {activeTab === 'login' && (
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="rememberMe"
                        name="rememberMe"
                        checked={formState.rememberMe}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        disabled={isSubmitting}
                      />
                      <label htmlFor="rememberMe" className="text-sm text-gray-700">
                        Remember me for 7 days
                      </label>
                    </div>
                  )}

                  {/* General Error */}
                  {formErrors.general && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">{formErrors.general}</p>
                      {auth.uiState.error?.code === SupabaseErrorCode.EMAIL_NOT_CONFIRMED && (
                        <button
                          type="button"
                          onClick={handleResendConfirmation}
                          className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                        >
                          Resend confirmation email
                        </button>
                      )}
                    </div>
                  )}

                  {/* Success Message */}
                  {auth.state === 'success' && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-700">{auth.uiState.message}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isSubmitting
                        ? 'bg-indigo-400 cursor-not-allowed text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500'
                    }`}
                  >
                    {getSubmitButtonText()}
                  </button>
                </div>
              </form>

              {/* Email Confirmation Notice */}
              <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <p className="font-medium">📧 Email confirmation required</p>
                <p className="mt-1">Check your inbox after registering to activate your account</p>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-600 text-center">
            By signing in, you agree to our{' '}
            <a href="#" className="text-indigo-600 hover:text-indigo-800">Terms</a> and{' '}
            <a href="#" className="text-indigo-600 hover:text-indigo-800">Privacy Policy</a>
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// ============== Default Export ==============

export default AuthModal;