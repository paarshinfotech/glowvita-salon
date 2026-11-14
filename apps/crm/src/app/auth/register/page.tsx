"use client";

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@repo/ui/button';
import { Label } from '@repo/ui/label';
import { Input } from '@repo/ui/input';
import { toast } from 'sonner';
import { User, Building, Stethoscope, ArrowLeft, Mail, ShieldCheck, RefreshCw, ChevronRight, Smartphone } from 'lucide-react';
import { VendorRegistrationForm } from '@/components/forms/VendorRegistrationForm';
import { DoctorRegistrationForm } from '@/components/forms/DoctorRegistrationForm';
import { SupplierRegistrationForm } from '@/components/forms/SupplierRegistrationForm';
import { cn } from '@repo/ui/cn';

type Role = 'vendor' | 'doctor' | 'supplier' | null;

interface RoleCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
  isSelected: boolean;
  index: number;
}

const RoleCard = ({ icon: Icon, title, description, onClick, isSelected, index }: RoleCardProps) => (
  <div
    className={cn(
      "group relative p-4 sm:p-6 text-center transition-all duration-300 ease-out transform hover:-translate-y-2 hover:scale-[1.02] w-full rounded-xl cursor-pointer overflow-hidden",
      "bg-white border border-gray-100 shadow-md hover:shadow-lg backdrop-blur-sm",
      "animate-fade-in-up",
      isSelected
        ? 'border-purple-400 ring-2 ring-purple-100 shadow-purple-200/40'
        : 'hover:border-purple-200 hover:shadow-purple-100/20'
    )}
    style={{
      animationDelay: `${index * 100}ms`,
    }}
    onClick={onClick}
  >
    {/* Animated background gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-purple-50/30 via-indigo-50/20 to-pink-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

    {/* Floating particles effect */}
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute -top-1 -right-1 w-10 h-10 bg-gradient-to-br from-purple-200/20 to-pink-200/20 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 transform group-hover:scale-125 group-hover:rotate-45" />
      <div className="absolute -bottom-2 -left-2 w-12 h-12 bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100 transform group-hover:scale-110 group-hover:-rotate-45" />
    </div>

    <div className="relative z-10">
      <div className={cn(
        "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 transition-all duration-300 transform group-hover:scale-110",
        "bg-gradient-to-br shadow-lg relative overflow-hidden",
        isSelected
          ? 'from-purple-50 via-indigo-50 to-purple-100 text-purple-600 shadow-purple-100/50 border border-purple-100'
          : 'from-gray-50 via-white to-gray-100 text-gray-500 group-hover:from-purple-50 group-hover:via-indigo-50 group-hover:to-purple-100 group-hover:text-purple-600 group-hover:shadow-purple-100/50 group-hover:border group-hover:border-purple-100'
      )}>
        {/* Icon container shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
        <Icon className="w-9 h-9 relative z-10" />
      </div>

      <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-gray-900 tracking-tight transition-all duration-300">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed group-hover:text-gray-700 font-medium transition-all duration-300">{description}</p>
    </div>
  </div>
);

interface RoleSelectionScreenProps {
  onSelectRole: (role: Role) => void;
}

const RoleSelectionScreen = ({ onSelectRole }: RoleSelectionScreenProps) => (
  <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-10 relative">
    {/* Background animated shapes */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-16 left-8 w-28 h-28 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full opacity-60 animate-float" />
      <div className="absolute top-32 right-12 w-20 h-20 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full opacity-50 animate-float-delayed" />
      <div className="absolute bottom-24 left-16 w-32 h-32 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full opacity-40 animate-float-slow" />
      <div className="absolute bottom-16 right-8 w-24 h-24 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full opacity-50 animate-float-delayed" />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-gradient-to-br from-purple-50/30 to-indigo-50/30 rounded-full opacity-30 animate-pulse-slow" />
    </div>

    <div className="text-center mb-6 sm:mb-12 relative z-10">
      <div className="inline-block mb-3 sm:mb-5">
        <div className="flex justify-center mb-6">
          <img
            src="/images/GlowVita%20Salon%20PNG.png"
            alt="GlowVita Salon"
            className="h-16 w-auto object-contain drop-shadow-lg animate-fade-in"
          />
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2 sm:mb-4 tracking-tight bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-800 bg-clip-text text-transparent animate-fade-in">
          Join GlowVita
        </h1>
        <div className="h-1 w-12 sm:w-20 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full mx-auto animate-expand-width" />
      </div>
      <p className="text-sm sm:text-lg text-gray-600 max-w-2xl mx-auto font-medium leading-relaxed animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        Choose your role and become part of our growing beauty and wellness community
      </p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8 mb-6 sm:mb-12">
      <RoleCard
        icon={Building}
        title="Salon/Vendor"
        description="Register your salon or spa to manage bookings and clients."
        onClick={() => onSelectRole('vendor')}
        isSelected={false}
        index={0}
      />
      <RoleCard
        icon={Stethoscope}
        title="Doctor/Dermatologist"
        description="Join as a professional to offer consultations and services."
        onClick={() => onSelectRole('doctor')}
        isSelected={false}
        index={1}
      />
      <RoleCard
        icon={User}
        title="Supplier"
        description="Register as a supplier to provide products to our vendors."
        onClick={() => onSelectRole('supplier')}
        isSelected={false}
        index={2}
      />
    </div>

    <div className="text-center relative z-10">
      <div className="inline-flex items-center justify-center p-3 sm:p-5 bg-white/80 backdrop-blur-sm rounded-xl shadow-md border border-gray-100 animate-fade-in-up" style={{ animationDelay: '600ms' }}>
        <p className="text-gray-600 font-medium text-sm sm:text-base">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-purple-600 hover:text-purple-700 transition-all duration-300 hover:underline hover:scale-105 inline-block relative group"
          >
            Sign in
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 group-hover:w-full transition-all duration-300" />
          </Link>
        </p>
      </div>
    </div>
  </div >
);

const RegistrationFlow = () => {
  const [step, setStep] = useState<'role' | 'form'>('role');
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const router = useRouter();

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setStep('form');
  };

  const handleSuccess = () => {
    toast.success('Registration submitted successfully! Please log in with your credentials.');
    router.push('/login');
  };

  const renderContent = () => {
    switch (step) {
      case 'role':
        return <RoleSelectionScreen onSelectRole={handleRoleSelect} />;
      case 'form':
        switch (selectedRole) {
          case 'vendor':
            return <VendorRegistrationForm onSuccess={handleSuccess} />;
          case 'doctor':
            return <DoctorRegistrationForm onSuccess={handleSuccess} />;
          case 'supplier':
            return <SupplierRegistrationForm onSuccess={handleSuccess} />;
          default:
            return null;
        }
    }
  };

  return (
    <div className="min-h-screen max-h-screen bg-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Enhanced background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-50/20 via-transparent to-indigo-50/20 transform rotate-12 animate-drift" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-pink-50/20 via-transparent to-purple-50/20 transform -rotate-12 animate-drift-reverse" />
      </div>

      <div className={cn(
        "relative z-10 w-full max-h-full",
        step === 'form' ? "overflow-y-auto sm:overflow-y-scroll md:overflow-y-auto" : ""
      )}>
        <div className={cn(
          "mx-auto w-full",
          step === 'form' ? "max-w-4xl" : "max-w-6xl"
        )}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default function RegisterPage() {
  return (
    <>
      <style jsx global>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }

        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }

        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }

        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }

        .animate-scale-in {
          animation: scale-in 0.4s ease-out;
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }

        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-3deg); }
        }

        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(2deg); }
        }

        @keyframes pulse-slow {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.3; }
          50% { transform: scale(1.05) rotate(2deg); opacity: 0.2; }
        }

        @keyframes expand-width {
          from { width: 0; }
          to { width: 6rem; }
        }

        @keyframes drift {
          0%, 100% { transform: rotate(12deg) translateX(0px); }
          50% { transform: rotate(12deg) translateX(20px); }
        }

        @keyframes drift-reverse {
          0%, 100% { transform: rotate(-12deg) translateX(0px); }
          50% { transform: rotate(-12deg) translateX(-20px); }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out;
          animation-fill-mode: both;
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.5s ease-out;
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .animate-float-delayed {
          animation: float-delayed 8s ease-in-out infinite;
        }

        .animate-float-slow {
          animation: float-slow 10s ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 8s ease-in-out infinite;
        }

        .animate-expand-width {
          animation: expand-width 0.8s ease-out 0.5s both;
        }

        .animate-drift {
          animation: drift 20s ease-in-out infinite;
        }

        .animate-drift-reverse {
          animation: drift-reverse 25s ease-in-out infinite;
        }

        /* Added responsive adjustments for small screens */
        @media (max-width: 640px) {
          .min-h-screen {
            min-height: 100vh;
            height: auto;
          }
          
          .max-h-screen {
            max-height: none;
          }
          
          /* Ensure proper scrolling on mobile */
          .overflow-y-auto {
            -webkit-overflow-scrolling: touch;
          }
        }
      `}</style>
      <Suspense fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <div className="text-gray-600 font-medium">Loading...</div>
          </div>
        </div>
      }>
        <RegistrationFlow />
      </Suspense>
    </>
  );
}