'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@repo/store/hooks';
import { useGetProfileQuery, useGetVendorProfileQuery, useRefreshTokenMutation } from '@repo/store/api';
import { updateUser, selectIsSubscriptionExpired } from '@repo/store/slices/crmAuthSlice';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { useRouter, usePathname } from 'next/navigation';
import { useCrmAuth } from '@/hooks/useCrmAuth';
import { useSubscriptionCheck } from '@/hooks/useSubscriptionCheck';
import { cn } from '@repo/ui/cn';
import { Button } from '@repo/ui/button';
import { SubscriptionPlansDialog } from '@/components/SubscriptionPlansDialog';
import { AlertCircle, X, Zap } from 'lucide-react';

export function CrmLayout({ children }: { children: React.ReactNode; }) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const { isCrmAuthenticated, isLoading: isAuthLoading, user, role } = useCrmAuth();
  // ...
  const router = useRouter();
  const pathname = usePathname();
  const [showPlansDialog, setShowPlansDialog] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);
  const dispatch = useAppDispatch();
  const tokenRefreshInterval = useRef<NodeJS.Timeout | null>(null);
  const [refreshToken] = useRefreshTokenMutation();

  // Use the subscription check hook for client-side validation
  const { isExpired, daysRemaining, willExpireSoon, hasScheduledPlan, activeEntry } = useSubscriptionCheck();

  const isAllowedOnExpired = useMemo(() => {
    return (
      pathname.startsWith('/profile') ||
      pathname.startsWith('/sales') ||
      pathname.startsWith('/renew-plan') ||
      pathname.startsWith('/support') ||
      pathname.startsWith('/help') ||
      pathname.includes('expired')
    );
  }, [pathname]);

  // Fetch the user's profile — poll every 60s so subscription transitions (Scheduled→Active)
  // are picked up from the DB automatically without a manual page reload
  const { data: profileData, isSuccess, isLoading: isProfileLoading, refetch: refetchProfile } = useGetProfileQuery(undefined, {
    skip: !isCrmAuthenticated,
    pollingInterval: 60 * 1000, // Re-fetch from server every 60 seconds
  });
  const { data: vendorProfile } = useGetVendorProfileQuery(undefined, {
    skip: !isCrmAuthenticated || !user?._id || (role || user?.role || "").toLowerCase() !== 'vendor',
  });

  useEffect(() => {
    if (isSuccess && profileData) {
      dispatch(updateUser(profileData.user));
    }
  }, [isSuccess, profileData, dispatch]);

  // Smart timer: schedule a refetch exactly when the active plan expires so the
  // Scheduled plan becomes Active in the UI without waiting the full 60s poll cycle
  const smartRefetchTimer = useRef<NodeJS.Timeout | null>(null);

  const activeEntryEndDate = (activeEntry as any)?.endDate as string | undefined;

  useEffect(() => {
    // Clear any previously scheduled timer
    if (smartRefetchTimer.current) {
      clearTimeout(smartRefetchTimer.current);
      smartRefetchTimer.current = null;
    }

    if (!activeEntryEndDate || !isCrmAuthenticated) return;

    const msUntilExpiry = new Date(activeEntryEndDate).getTime() - Date.now();

    // Only schedule if expiry is in the future (and within 24h to avoid huge timeouts)
    if (msUntilExpiry > 0 && msUntilExpiry <= 24 * 60 * 60 * 1000) {
      smartRefetchTimer.current = setTimeout(async () => {
        try {
          // Refetch profile immediately when plan expires — picks up Scheduled→Active transition
          const result = await refetchProfile();
          if (result.data?.user) {
            dispatch(updateUser(result.data.user));
          }
          // Also refresh token to get updated subscription in auth claims
          const tokenResult = await refreshToken({}).unwrap();
          if (tokenResult.success && tokenResult.user) {
            dispatch(updateUser(tokenResult.user));
          }
        } catch (err) {
          console.error('Smart subscription refetch failed:', err);
        }
      }, msUntilExpiry + 2000); // +2s buffer to allow DB to transition
    }

    return () => {
      if (smartRefetchTimer.current) {
        clearTimeout(smartRefetchTimer.current);
      }
    };
  }, [activeEntryEndDate, isCrmAuthenticated, refetchProfile, refreshToken, dispatch]);

  // Token refresh mechanism - runs every 15 minutes
  useEffect(() => {
    if (!isCrmAuthenticated) return;

    const refreshTokenPeriodically = async () => {
      try {
        const result = await refreshToken({}).unwrap();
        if (result.success && result.user) {
          dispatch(updateUser(result.user));
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
      }
    };

    // Refresh immediately on mount
    refreshTokenPeriodically();

    // Set up interval for periodic refresh (15 minutes)
    tokenRefreshInterval.current = setInterval(refreshTokenPeriodically, 15 * 60 * 1000);

    return () => {
      if (tokenRefreshInterval.current) {
        clearInterval(tokenRefreshInterval.current);
      }
    };
  }, [isCrmAuthenticated, refreshToken, dispatch]);

  // Check subscription status on route change (instant detection)
  useEffect(() => {
    if (isExpired && !hasScheduledPlan && isCrmAuthenticated) {
      // Show banner on all pages except those with their own full billing/support UI
      const isSpecialPage = pathname.startsWith('/sales') || pathname.startsWith('/renew-plan');
      setShowBanner(!isSpecialPage);
    } else {
      setShowBanner(false);
    }
  }, [isExpired, hasScheduledPlan, pathname, isCrmAuthenticated, router, forceRefresh, user]);

  const subscription = (user as any)?.subscription;
  const accountStatus = (user as any)?.status;
  const accountRejectionReason = (vendorProfile as any)?.rejectionReason || (user as any)?.rejectionReason;
  const showAccountRejectedBanner = accountStatus === 'Rejected';

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // This effect runs whenever the auth state changes.
    // It's the central point for protecting routes.
    if (!isAuthLoading) {
      if (!isCrmAuthenticated) {
        // If loading is finished and user is not authenticated,
        // redirect to login.
        router.push('/login');
      }
    }
  }, [isAuthLoading, isCrmAuthenticated, router, pathname]);

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  const isPageLoading = isAuthLoading || (isCrmAuthenticated && isProfileLoading);

  // While the auth state is being determined, show a loading screen.
  // This prevents the "flash" of the login page on a refresh when logged in.
  if (isPageLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-background/80">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/10 rounded-full"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-spin border-t-primary"></div>
        </div>
      </div>
    )
  }

  // If loading is done and we're still not authenticated, the redirect effect will
  // have already fired. Rendering null here prevents a flash of the protected layout.
  if (!isCrmAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background relative">
      {/* Subscription Expired Banner - Better UX than modal */}
      {showAccountRejectedBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-700 text-white shadow-2xl border-b-4 border-red-900">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="flex-shrink-0 bg-white/20 p-2 rounded-lg">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">Account Rejected</h3>
                  <p className="text-sm text-white/90">
                    Reason: {accountRejectionReason || 'Please contact support for more details.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-600 via-red-500 to-orange-500 text-white shadow-2xl border-b-4 border-red-700 animate-in slide-in-from-top duration-300">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-shrink-0 bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                  <AlertCircle className="h-6 w-6 animate-pulse" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    Subscription Expired
                    {willExpireSoon && <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Expires in {daysRemaining} days</span>}
                  </h3>
                  <p className="text-sm text-white/90">
                    Your subscription has expired. Renew now to continue accessing all features and modules.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setShowPlansDialog(true)}
                  className="bg-white text-red-600 hover:bg-red-50 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Renew Now
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowBanner(false)}
                  className="text-white hover:bg-white/20 rounded-full h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        isMobile={isMobile}
        isSubExpired={isExpired && !isAllowedOnExpired}
        className={cn(isExpired && !isAllowedOnExpired && 'pointer-events-none filter blur-sm')} />

      <div className={cn(
        "flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden transition-all duration-300",
        !isMobile && (isSidebarOpen ? "lg:ml-64" : "lg:ml-20"),
        (showBanner || showAccountRejectedBanner) && "mt-[88px]"
      )}>
        <Header toggleSidebar={toggleSidebar} subscription={subscription} isSubExpired={isExpired && !isAllowedOnExpired} />

        <main className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden bg-muted/20",
          isExpired && !isAllowedOnExpired && 'pointer-events-none filter blur-sm'
        )}>
          <div className="w-full max-w-none overflow-hidden min-h-full">
            {children}
          </div>
        </main>
      </div>

      {subscription && (
        <SubscriptionPlansDialog
          open={showPlansDialog}
          onOpenChange={(open) => {
            setShowPlansDialog(open);
            // When the dialog closes, refresh the subscription status
            if (!open) {
              setForceRefresh(prev => prev + 1); // Trigger a refresh
              // Also refetch the profile to ensure latest subscription status
              refetchProfile();
            }
          }}
          subscription={subscription}
          userType={(role as any) || 'vendor'}
        />
      )}
    </div>
  );
}
