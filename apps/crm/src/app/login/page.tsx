"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui/button';
import { toast } from 'sonner';
import { useVendorLoginMutation } from '@repo/store/api';
import { Eye, EyeOff } from 'lucide-react';
import { useAppDispatch } from '@repo/store/hooks';
import { setCrmAuth } from '@repo/store/slices/crmAuthSlice';
import { useCrmAuth } from '@/hooks/useCrmAuth';
import Link from 'next/link';
import { NEXT_PUBLIC_WEB_URL } from "@repo/config/config";
import Cookies from 'js-cookie';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [vendorLogin, { isLoading }] = useVendorLoginMutation();
  const { isCrmAuthenticated } = useCrmAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isCrmAuthenticated) {
      window.location.href = '/dashboard';
    }
  }, [isCrmAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      toast.error('Invalid email', {
        description: 'Please enter a valid email address',
        duration: 4000,
      });
      return;
    }

    try {
      const response = await vendorLogin({ email, password }).unwrap();

      if (response.success) {
        // Also ensure client-side cookie is set to prevent any middleware sync delay
        Cookies.set('crm_access_token', response.access_token, {
          expires: 1,
          path: '/',
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
        });

        if (response.access_token) {
          Cookies.set('crm_access_token', response.access_token, {
            expires: 1,
            path: '/',
            sameSite: 'lax',
          });
        }

        dispatch(setCrmAuth({ user: response.user, token: response.access_token, role: response.role, permissions: response.permissions }));

        toast.success('Login successful!', {
          description: 'Welcome back to your dashboard.',
          duration: 2000,
        });

        // Use window.location.href to perform a clean, fresh page transition into /dashboard
        // and eliminate Next.js in-memory client router redirect loops
        window.location.href = '/dashboard';

        router.push('/dashboard');
        router.refresh();
      }
    } catch (error: any) {
      toast.error('Login failed', {
        description: error?.data?.error || 'Invalid credentials. Please try again.',
        duration: 4000,
      });
    }
  };

  // Prevent rendering the form if the user is already logged in and is about to be redirected.
  if (isCrmAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-background/80">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/10 rounded-full"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-spin border-t-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#422A3C] relative overflow-hidden p-4 md:p-8 select-none">
      {/* Background decorative elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Left side diagonal curved white background shape */}
        <svg className="absolute left-0 top-0 h-full w-full hidden md:block text-gray-50 fill-current" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M 0 0 L 65 0 C 80 30, 75 70, 55 100 L 0 100 Z" />
        </svg>

        {/* Top-left background grey circles */}
        <div className="absolute top-[10%] left-[-3%] w-24 h-24 rounded-full bg-gray-200/50"></div>
        <div className="absolute top-[14%] left-[-1%] w-16 h-16 rounded-full bg-gray-200/30"></div>

        {/* Bottom-left background grey circles */}
        <div className="absolute bottom-[-8%] left-[-8%] w-56 h-56 rounded-full bg-gray-200/50"></div>
        <div className="absolute bottom-[4%] left-[-4%] w-40 h-40 rounded-full bg-gray-200/30"></div>
      </div>

      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="absolute top-4 left-4 z-20 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 shadow-md transition-all duration-200"
        aria-label="Go back"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Main Login Card */}
      <div className="w-full max-w-[970px] bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row relative z-10 min-h-[510px] md:h-[540px]">

        {/* Left Column: Brand & Features */}
        <div className="md:w-[40%] bg-[#422A3C] text-white p-6 md:p-8 pt-10 md:pt-14 pb-8 flex flex-col justify-start gap-12 relative overflow-hidden">
          {/* Decorative interior translucent circles */}
          <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10 pointer-events-none"></div>
          <div className="absolute bottom-[39px] left-[29px] right-10 w-16 h-16 rounded-full bg-white/10 pointer-events-none"></div>
          <div className="absolute bottom-[7px] right-[30px] left-10 w-16 h-16 rounded-full bg-white/10 pointer-events-none"></div>

          {/* User lock icon */}
          <div className="flex flex-col items-center relative z-10">
            <div className="w-[80px] h-[80px] flex items-center justify-center filter drop-shadow-sm">
              <img src="/images/user-profile.png" alt="User profile" className="w-full h-full object-contain" />
            </div>
          </div>

          {/* Feature checklist */}
          <div className="space-y-8 relative z-10">
            <div className="flex items-start gap-2.5">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white flex items-center justify-center mt-0.5 shadow-sm">
                <svg className="w-3.5 h-3.5 text-[#422A3C]" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-white text-base leading-tight">Quick & free sign-up</h3>
                <p className="text-white/80 text-xs mt-0.5">Enter your email address to access your salon dashboard.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white flex items-center justify-center mt-0.5 shadow-sm">
                <svg className="w-3.5 h-3.5 text-[#422A3C]" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-white text-base leading-tight">Manage Appointments</h3>
                <p className="text-white/80 text-xs mt-0.5">Focus on your clients while GlowVita handles the rest.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white flex items-center justify-center mt-0.5 shadow-sm">
                <svg className="w-3.5 h-3.5 text-[#422A3C]" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-white text-base leading-tight">Something for everyone</h3>
                <p className="text-white/80 text-xs mt-0.5">The best salon experiences are built with GlowVita.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Form */}
        <div className="flex-1 px-6 md:px-16 flex flex-col">
          {/* Logo at top */}
          <div className="text-center pt-7 pb-4 flex-shrink-0">
            <div className="flex justify-center mb-2">
              <img
                src="/images/GlowVita%20Salon%20PNG.png"
                alt="GlowVita Salon"
                className="h-14 w-auto object-contain"
              />
            </div>
            <p className="text-[#422A3C] text-sm font-semibold tracking-wide">Glowvita Salon for professionals</p>
            <p className="text-gray-500 text-xs mt-0.5">Log in to access and manage your business anytime.</p>
          </div>

          {/* Form centered in remaining space */}
          <div className="flex-1 flex flex-col justify-center pb-6">

            {/* Form fields */}
            <form onSubmit={handleSubmit} className="space-y-1.5">
              <div>
                <input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.replace(/[^a-zA-Z0-9@.]/g, ''))}
                  required
                  className="w-full h-11 px-3.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#422A3C]/25 focus:border-[#422A3C] transition-all text-base font-medium"
                />
              </div>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-11 pl-3.5 pr-10 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#422A3C]/25 focus:border-[#422A3C] transition-all text-base font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Remember me & Forgot Password */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer text-black-600 hover:text-gray-900">
                  <input
                    type="checkbox"
                    id="remember"
                    className="w-4 h-4 rounded border-gray-300 text-[#422A3C] focus:ring-[#422A3C]"
                  />
                  <span>Remember me</span>
                </label>
                <Link href="/forgot-password" className="font-semibold text-gray-700 hover:text-[#422A3C] hover:underline">
                  Forgot Password?
                </Link>
              </div>

              {/* Continue Button */}
              <Button
                type="submit"
                className="w-full h-11 text-base font-bold bg-[#422A3C] hover:bg-[#34202F] text-white rounded-lg shadow-md transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : 'Continue'}
              </Button>

              {/* Divider */}
              <div className="flex items-center py-1">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="px-3 text-sm font-bold text-gray-400">OR</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              {/* Google Login */}
              <button
                type="button"
                onClick={() => {/* Add Google OAuth handler */ }}
                className="w-full h-11 text-sm font-bold bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Footer Links */}
              <div className="pt-2 space-y-2 text-center text-base text-black-600">
                <p>
                  New to GlowVita Salon?{' '}
                  <Link href="/auth/register" className="font-bold text-[#422A3C] hover:underline">
                    Join Our Platform
                  </Link>
                </p>
                <p>
                  For Customer?{' '}
                  <a
                    href={NEXT_PUBLIC_WEB_URL || "https://glowvitasalon.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[#422A3C] hover:underline"
                  >
                    Go to GlowVita for customers
                  </a>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
