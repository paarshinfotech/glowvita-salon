"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@repo/ui/button";
import {
  ArrowRight,
  Menu,
  X,
  User,
  LayoutDashboard,
  Calendar,
  ShoppingCart,
  Star,
  ScrollText,
  Wallet,
  Settings,
  LogOut,
  ChevronDown,
  Gift,
  Instagram,
  Linkedin,
  Sparkles,
} from "lucide-react";
import { NEXT_PUBLIC_CRM_URL } from "@repo/config/config";
import { cn } from "@repo/ui/cn";
import { useAuth } from "@/hooks/useAuth";
import { useAppDispatch } from "@repo/store/hooks";
import { clearUserAuth } from "@repo/store/slices/Web/userAuthSlice";
import { resetToGuest } from "@repo/store/slices/cartSlice";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@repo/ui/dropdown-menu";
import { LogoutConfirmationModal } from "@repo/ui/logout-confirmation-modal";
import Cookies from "js-cookie";
import { NotificationDropdown } from "./NotificationDropdown";

import NotificationManager from "@/utils/NotificationManager";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar";
interface User {
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  avatarUrl?: string;
  profilePicture?: string;
  profileImage?: string;
}

interface MenuItemProps {
  label: string;
  href: string;
}

interface MarketingHeaderProps {
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  isHomePage?: boolean;
  hideMenuItems?: boolean;
  customMenuItems?: MenuItemProps[];
}

const profileNavItems = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    href: "/profile",
  },
  {
    id: "appointments",
    label: "My Appointments",
    icon: Calendar,
    href: "/profile/appointments",
  },
  {
    id: "consultations",
    label: "My Consultations",
    icon: Calendar,
    href: "/profile/consultations",
  },
  {
    id: "orders",
    label: "My Orders",
    icon: ShoppingCart,
    href: "/profile/orders",
  },
  { id: "cart", label: "My Cart", icon: ShoppingCart, href: "/profile/cart" },
  { id: "reviews", label: "My Reviews", icon: Star, href: "/profile/reviews" },
  {
    id: "wishlist",
    label: "My Wishlist",
    icon: ScrollText,
    href: "/profile/wishlist",
  },
  {
    id: "referrals",
    label: "Refer & Earn",
    icon: Gift,
    href: "/profile/referrals",
  },
  { id: "wallet", label: "Wallet", icon: Wallet, href: "/profile/wallet" },
  {
    id: "settings",
    label: "Account Settings",
    icon: Settings,
    href: "/profile/settings",
  },
];

const navItems = [
  { label: "Products", href: "/all-products" },
  { label: "Salons", href: "/salons" },
  { label: "About Us", href: "/about" },
  { label: "Reach Us", href: "/contact" },
];

export function MarketingHeader({
  isMobileMenuOpen,
  toggleMobileMenu,
  isHomePage = false,
  hideMenuItems = false,
  customMenuItems,
}: MarketingHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { isAuthenticated, user, isLoading } = useAuth();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Call server-side logout to clear the httpOnly cookie (js-cookie cannot do this)
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: NotificationManager.currentToken }),
        credentials: 'include'
      });

      // Clear all auth-related data from localStorage
      localStorage.removeItem("userAuthState");
      localStorage.removeItem("crmAuthState");
      localStorage.removeItem("adminAuthState");

      // Clear Redux auth state and reset cart to guest mode
      dispatch(clearUserAuth());
      dispatch(resetToGuest());
      toast.success("You have been logged out.");
      router.push("/client-login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Error during logout. Please try again.");
      router.push("/client-login");
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  const getInitials = (firstName: string = "", lastName: string = "") => {
    const first = firstName ? firstName.charAt(0) : "";
    const last = lastName ? lastName.charAt(0) : "";
    return `${first}${last}`.toUpperCase() || "U";
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    if (isHomePage) {
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", handleScroll);
      };
    } else {
      setIsScrolled(true);
    }
  }, [isHomePage]);

  const isActiveRoute = (href: string) => pathname === href;

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 transition-all duration-300",
          isHomePage && !isScrolled
            ? "bg-transparent"
            : "bg-background/80 backdrop-blur-lg border-b border-border/20"
        )}
      >
        {/* Top Utility Bar */}
        <div className="bg-[#422A3C] text-white text-xs sm:text-sm border-b border-white/10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-4">
            {/* Left: Tagline */}
            <p className="hidden sm:flex items-center gap-2 text-white/95 font-medium truncate">
              <Sparkles className="h-4 w-4 text-amber-300 flex-shrink-0" />
              <span>Glowvita - Har Look Ka Perfect Address</span>
            </p>
            <p className="sm:hidden flex items-center gap-1.5 text-white/95 font-medium truncate text-xs">
              <Sparkles className="h-3.5 w-3.5 text-amber-300 flex-shrink-0" />
              <span>Glowvita - Har Look Ka Perfect Address</span>
            </p>

            {/* Right: For Business + Social Icons */}
            <div className="flex items-center gap-3.5 sm:gap-4 flex-shrink-0 ml-auto">
              <a
                href={`${NEXT_PUBLIC_CRM_URL || "https://partners.glowvitasalon.com"}/login`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white font-semibold text-xs sm:text-sm px-3.5 py-1 rounded-full transition-colors whitespace-nowrap"
              >
                <span>For Business</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>

              <span className="h-4 w-px bg-white/25" aria-hidden="true" />

              <div className="flex items-center gap-3">
                <a
                  href="https://www.instagram.com/glowvitasalon?igsh=MXNneTdjMHo4dzNwdA=="
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GlowVita Salon on Instagram"
                  className="text-white/85 hover:text-white transition-colors"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href="https://www.linkedin.com/company/glowvitasalon/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GlowVita Salon on LinkedIn"
                  className="text-white/85 hover:text-white transition-colors"
                >
                  <Linkedin className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between relative">
          <Link
            href="/"
            className="flex items-center hover:opacity-80 transition-opacity"
          >
            <img
              src="/images/GlowVita%20Salon%20PNG.png"
              alt="GlowVita Salon"
              className="h-14 sm:h-16 w-auto object-contain block mt-2"
            />
          </Link>

          {/* Desktop & Tablet Nav */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
            {!hideMenuItems && (
              <>
                {customMenuItems ? (
                  customMenuItems.map((item, index) => (
                    <Link key={index} href={item.href}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "hover:bg-primary/10 text-sm px-3 relative",
                          isActiveRoute(item.href) &&
                          "after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:w-3/4 after:h-0.5 after:bg-primary after:rounded-full"
                        )}
                      >
                        {item.label}
                      </Button>
                    </Link>
                  ))
                ) : (
                  <>
                    {navItems.map((item, index) => (
                      <Link key={index} href={item.href}>
                        <Button
                          variant="ghost"
                          className={cn(
                            "hover:bg-primary/10 text-md px-5 relative",
                            isActiveRoute(item.href) &&
                            "after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:w-3/4 after:h-0.5 after:bg-primary after:rounded-full"
                          )}
                        >
                          {item.label}
                        </Button>
                      </Link>
                    ))}
                  </>
                )}
              </>
            )}

            {!isLoading && (
              <>
                {isAuthenticated && user && (
                  <div className="mr-2">
                    <NotificationDropdown apiEndpoint="/api/notifications" />
                  </div>
                )}
                {isAuthenticated && user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="group flex items-center gap-2 h-10 rounded-full hover:bg-primary/10 transition-all duration-300"
                        aria-label="User menu"
                      >
                        <Avatar className="h-9 w-9 ring-2 ring-primary/50">
                          <AvatarImage
                            src={user?.profileImage || user?.profilePicture || user?.avatarUrl}
                            alt={`${user?.firstName || "User"} avatar`}
                          />
                          <AvatarFallback className="bg-primary text-white">
                            {getInitials(user?.firstName, user?.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-64 bg-background/95 backdrop-blur-xl border border-border/30 shadow-lg rounded-lg"
                    >
                      <DropdownMenuLabel className="p-5 border-b border-border/20">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 ring-2 ring-primary/50">
                            <AvatarImage
                              src={user?.profileImage || user?.profilePicture || user?.avatarUrl}
                              alt={`${user?.firstName || "User"} avatar`}
                            />
                            <AvatarFallback className="bg-primary text-white">
                              {getInitials(user?.firstName, user?.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate">
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.firstName || user.lastName || "User"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.emailAddress}
                            </p>
                          </div>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuGroup className="p-2">
                        {profileNavItems.map((item) => (
                          <DropdownMenuItem
                            key={item.id}
                            asChild
                            className="rounded-md"
                          >
                            <Link
                              href={item.href}
                              className="flex items-center gap-3"
                            >
                              <item.icon className="h-4 w-4 text-muted-foreground" />
                              <span>{item.label}</span>
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setShowLogoutModal(true)}
                        className="text-destructive m-2 rounded-md cursor-pointer"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Logout</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="ghost"
                    className="text-md px-4 py-2 rounded-lg bg-black text-white hover:bg-black/90 hover:text-white transition-all"
                    asChild
                  >
                    <Link href="/client-login">Login</Link>
                  </Button>
                )}
              </>
            )}
          </nav>

          {/* Mobile Nav Toggle */}
          <div className="lg:hidden flex items-center gap-2">
            {!isLoading && isAuthenticated && user && (
              <div className="mr-1">
                <NotificationDropdown apiEndpoint="/api/notifications" />
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMobileMenu}
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              {isMobileMenuOpen ? (
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
              <span className="sr-only">Toggle menu</span>
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-background/95 backdrop-blur-md border-t border-border/50 absolute top-16 sm:top-20 left-0 w-full z-30 shadow-lg">
            <nav className="flex flex-col gap-1 p-4 max-h-[80vh] overflow-y-auto">
              {!hideMenuItems && (
                <>
                  <div className="space-y-1">
                    {customMenuItems ? (
                      customMenuItems.map((item, index) => (
                        <Button
                          key={index}
                          variant="ghost"
                          className={cn(
                            "w-full justify-start h-12 text-left",
                            isActiveRoute(item.href) && "bg-primary/10"
                          )}
                          asChild
                        >
                          <Link href={item.href}>{item.label}</Link>
                        </Button>
                      ))
                    ) : (
                      <>
                        {navItems.map((item, index) => (
                          <Button
                            key={index}
                            variant="ghost"
                            className={cn(
                              "w-full justify-start h-12 text-left",
                              isActiveRoute(item.href) && "bg-primary/10"
                            )}
                            asChild
                          >
                            <Link href={item.href}>{item.label}</Link>
                          </Button>
                        ))}
                      </>
                    )}
                  </div>

                  <div className="border-t border-border/30 my-4"></div>
                </>
              )}

              <div className="space-y-2">
                {!isLoading &&
                  (isAuthenticated && user ? (
                    <>
                      <Button
                        variant="outline"
                        className="w-full h-12 justify-center"
                        asChild
                      >
                        <Link href="/profile">My Profile</Link>
                      </Button>
                      <Button
                        onClick={() => setShowLogoutModal(true)}
                        className="w-full h-12 justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Logout
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        className="w-full h-12 justify-center rounded-lg bg-black text-white hover:bg-black/90 hover:text-white transition-all"
                        asChild
                      >
                        <Link href="/client-login">Login</Link>
                      </Button>
                      <Button
                        className="w-full h-12 justify-center bg-primary hover:to-secondary/90"
                        asChild
                      >
                        <Link href="/client-register">
                          <span className="flex items-center gap-2">
                            Sign Up
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        </Link>
                      </Button>
                    </>
                  ))}
              </div>
            </nav>
          </div>
        )}
      </header>

      <LogoutConfirmationModal
        open={showLogoutModal}
        onOpenChange={setShowLogoutModal}
        onConfirm={handleLogout}
        isLoading={isLoggingOut}
      />
    </>
  );
}
