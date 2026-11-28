
"use client";

import { useState, useMemo, Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@repo/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@repo/ui/dialog";
import {
  Tag,
  UserPlus,
  LayoutDashboard,
  Star,
  Gift,
  Heart,
  PieChart,
  BarChart,
  TrendingUp,
  Target,
  ArrowRight,
  Package,
  IndianRupee,
  Copy,
  Check,
  Sparkles,
  Search,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { StatCard } from '../../components/profile/StatCard';
import { Appointment, AppointmentCard } from '../../components/profile/AppointmentCard';
import { useAuth } from '../../hooks/useAuth';
import { useGetPublicProductsQuery, useGetClientOrdersQuery, useGetClientCartQuery, useGetPublicAllOffersQuery } from "@repo/store/api";
import { useGetDoctorWishlistQuery, useGetSalonWishlistQuery } from "@repo/store/services/api";
import { useUserAppointments } from '../../hooks/useUserAppointments';
import { useSalonFilter } from "@/components/landing/SalonFilterContext";

function OverviewContent() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const { userLat, userLng } = useSalonFilter();

  // Fetch user appointments
  const { appointments: appointmentsData = [], isLoading: isLoadingAppointments } = useUserAppointments();

  // Fetch products for new products section
  const { data: productsResponse, isLoading: isLoadingProducts } = useGetPublicProductsQuery({
    lat: userLat || undefined,
    lng: userLng || undefined,
  });

  // // Fetch offers
  const { data: offersResponse, isLoading: isLoadingOffers } = useGetPublicAllOffersQuery(undefined);

  // Fetch client orders
  const { data: ordersData = [] } = useGetClientOrdersQuery(undefined, {
    skip: !isAuthenticated || !user?._id,
    pollingInterval: 5000,
    refetchOnMountOrArgChange: true,
  });

  // Fetch client cart
  const { data: cartData } = useGetClientCartQuery(undefined, { skip: !isAuthenticated || !user?._id });

  // Fetch wishlists
  const { data: doctorWishlistData } = useGetDoctorWishlistQuery(undefined, { skip: !isAuthenticated || !user?._id });
  const { data: salonWishlistData } = useGetSalonWishlistQuery(undefined, { skip: !isAuthenticated || !user?._id });
  const [productWishlistCount, setProductWishlistCount] = useState(0);
  const [showAllAppointments, setShowAllAppointments] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [showAllOffers, setShowAllOffers] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [selectedOfferModal, setSelectedOfferModal] = useState<any>(null);
  const [offerSearchTerm, setOfferSearchTerm] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    toast.success(`Coupon code "${code}" copied!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getUniqueOfferItems = (offer: any): string[] => {
    const unique: string[] = [];
    const seen = new Set<string>();
    [
      ...(offer?.applicableServices || []),
      ...(offer?.applicableSpecialties || []),
      ...(offer?.applicableCategories || []),
    ].forEach((s: string) => {
      if (s) {
        const trimmed = s.trim();
        const lower = trimmed.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          unique.push(trimmed);
        }
      }
    });
    return unique;
  };

  useEffect(() => {
    if (isAuthenticated && user?._id) {
      fetch('/api/client/wishlist')
        .then(res => res.json())
        .then(data => {
          if (data?.success && data?.data?.items) {
            setProductWishlistCount(data.data.items.length);
          }
        })
        .catch(console.error);
    }
  }, [isAuthenticated, user?._id]);

  // Transform and filter appointments to get only upcoming appointments
  const upcomingAppointments = useMemo(() => {
    if (!appointmentsData || appointmentsData.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const seen = new Set();

    return appointmentsData
      .filter((apt: any) => {
        const id = apt.id;
        if (seen.has(id)) return false;
        try {
          const appointmentDate = new Date(apt.date);
          const isUpcoming = appointmentDate >= today && ['Confirmed', 'Scheduled'].includes(apt.status);
          if (isUpcoming) seen.add(id);
          return isUpcoming;
        } catch (e) {
          return false;
        }
      })
      .map((apt: any) => ({
        ...apt,
      }))
      .sort((a: any, b: any) => {
        // Sort by date first
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;

        // Then sort by startTime within same date
        const timeA = a.startTime || (a.serviceItems?.[0]?.startTime) || '00:00';
        const timeB = b.startTime || (b.serviceItems?.[0]?.startTime) || '00:00';
        return timeA.localeCompare(timeB);
      });
  }, [appointmentsData]);

  // Get upcoming (non-delivered) orders sorted by date
  const upcomingOrders = useMemo(() => {
    const ordersArray = Array.isArray(ordersData) ? ordersData : (ordersData as any)?.orders || (ordersData as any)?.data || [];
    if (!ordersArray.length) return [];

    const excludedStatuses = ['delivered', 'cancelled', 'rejected'];
    const seen = new Set();

    return ordersArray
      .filter((order: any) => {
        const id = order._id || order.id;
        if (seen.has(id)) return false;
        const status = (order.orderStatus || order.status || '').toLowerCase();
        const isUpcoming = !excludedStatuses.includes(status);
        if (isUpcoming) seen.add(id);
        return isUpcoming;
      })
      .sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || a.date || 0).getTime();
        const dateB = new Date(b.createdAt || b.date || 0).getTime();
        return dateB - dateA; // latest first
      });
  }, [ordersData]);

  const displayUpcomingOrders = showAllOrders ? upcomingOrders : upcomingOrders.slice(0, 3);

  // Sliced version for display
  const displayUpcomingAppointments = showAllAppointments
    ? upcomingAppointments
    : upcomingAppointments.slice(0, 3);

  // Get new products (recently added products)
  const newProducts = useMemo(() => {
    if (!productsResponse) return [];

    // Handle different response structures
    const productsArray = Array.isArray(productsResponse)
      ? productsResponse
      : productsResponse?.products || productsResponse?.data || [];

    if (!Array.isArray(productsArray) || productsArray.length === 0) return [];

    // Filter available products (stock > 0)
    const availableProducts = productsArray.filter((p: any) => (p.stock || 0) > 0);
    if (availableProducts.length === 0) return [];

    // Sort by creation date and get the newest 2 products
    const sortedProducts = [...availableProducts].sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return sortedProducts.map((product: any) => ({
      id: product._id || product.id,
      name: product.productName || product.name,
      price: product.salePrice || product.price || 0,
      image: product.productImage || product.image || "https://picsum.photos/id/1027/200/200",
      vendorId: product.vendorId || "",
      vendorName: product.vendorName || "Vendor",
    }));
  }, [productsResponse]);

  // Get current offers (newest offers from database)
  const currentOffers = useMemo(() => {
    if (!offersResponse) return [];

    // Handle different response structures
    let offersArray = Array.isArray(offersResponse)
      ? offersResponse
      : offersResponse?.offers || offersResponse?.data || [];

    if (!Array.isArray(offersArray) || offersArray.length === 0) return [];

    // Filter to show ONLY Admin offers (exclude CRM/Vendor offers)
    offersArray = offersArray.filter((offer: any) => offer.isVendorOffer === false);

    // Filter only active offers
    const now = new Date();
    const activeOffers = offersArray.filter((offer: any) => {
      const startDate = new Date(offer.startDate);
      const expiryDate = offer.expires ? new Date(offer.expires) : null;

      return offer.status === 'Active' &&
        startDate <= now &&
        (!expiryDate || expiryDate >= now);
    });

    // Sort by creation date (newest first) and get the top 2
    const sortedOffers = [...activeOffers].sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return sortedOffers.map((offer: any) => ({
      title: offer.type === 'percentage' ? `${offer.value}% Special Discount` : `₹${offer.value} Exclusive Off`,
      description: offer.type === 'percentage'
        ? `Get ${offer.value}% off on your next booking`
        : `Get a flat ₹${offer.value} off on your next booking`,
      icon: offer.type === 'percentage' ? Tag : Gift,
      code: offer.code,
      image: offer.offerImage || "/images/Offer Placeholder.png",
      discount: offer.type === 'percentage' ? `${offer.value}%` : `₹${offer.value}`,
      applicableServices: (offer.applicableServiceNames || offer.applicableServices || []).filter(Boolean),
      applicableSpecialties: (offer.applicableSpecialties || []).filter(Boolean),
      applicableCategories: (offer.applicableCategories || []).filter(Boolean),
    }));
  }, [offersResponse]);

  const displayOffers = showAllOffers ? currentOffers : currentOffers.slice(0, 3);
  const displayNewProducts = showAllProducts ? newProducts : newProducts.slice(0, 3);

  // Calculate dynamic stats
  const stats = useMemo(() => {
    // Total appointments count
    const totalAppointments = appointmentsData?.length || 0;

    // Completed appointments count
    const completedAppointments = appointmentsData?.filter((apt: any) => apt.status?.toLowerCase() === 'completed')?.length || 0;

    // Cart items count (matching cart page structure)
    const cartItems = cartData?.data?.items || [];
    const cartItemsCount = Array.isArray(cartItems) ? cartItems.length : 0;

    // Total product orders count
    const ordersArray = Array.isArray(ordersData) ? ordersData : ordersData?.orders || ordersData?.data || [];
    const totalOrders = ordersArray.length;
    const deliveredOrders = ordersArray.filter((order: any) => order.orderStatus?.toLowerCase() === 'delivered' || order.status?.toLowerCase() === 'delivered').length;

    // Calculate total spent (delivered orders using totalAmount + completed appointments using amountPaid)
    const totalProductSpent = ordersArray.reduce((sum: number, order: any) => {
      const isDelivered = order.orderStatus?.toLowerCase() === 'delivered' || order.status?.toLowerCase() === 'delivered';
      if (!isDelivered) return sum;
      return sum + (order.totalAmount || order.total || 0);
    }, 0);

    const totalAppointmentSpent = (appointmentsData || []).reduce((sum: number, apt: any) => {
      if (apt.status?.toLowerCase() !== 'completed') return sum;
      // amountPaid is the actual amount paid; fallback to finalAmount, then price
      return sum + (apt.amountPaid || apt.finalAmount || apt.price || 0);
    }, 0);

    const totalSpent = totalProductSpent + totalAppointmentSpent;

    // Find most purchased product category
    const categoryCount: { [key: string]: number } = {};
    ordersArray.forEach((order: any) => {
      const items = order.items || order.products || [];
      items.forEach((item: any) => {
        const category = item.category?.name || item.categoryName || item.category || 'Uncategorized';
        categoryCount[category] = (categoryCount[category] || 0) + (item.quantity || 1);
      });
    });

    const mostPurchasedCategory = Object.keys(categoryCount).length > 0
      ? Object.entries(categoryCount).reduce((max, [cat, count]) => count > max[1] ? [cat, count] : max, ['', 0])[0]
      : 'None';

    // Calculate total wishlist items
    const doctorItemsCount = doctorWishlistData?.data?.items?.length || 0;
    const salonItemsCount = salonWishlistData?.data?.items?.length || 0;
    const totalWishlistItems = productWishlistCount + doctorItemsCount + salonItemsCount;

    // Calculate historical monthly spend for bar chart
    const monthlySpends = [0, 0, 0, 0, 0];
    const currentDate = new Date();

    ordersArray.forEach((order: any) => {
      const isDelivered = order.orderStatus?.toLowerCase() === 'delivered' || order.status?.toLowerCase() === 'delivered';
      if (!isDelivered) return;

      const orderDate = new Date(order.createdAt || order.date);
      const diffMonths = (currentDate.getFullYear() - orderDate.getFullYear()) * 12 + (currentDate.getMonth() - orderDate.getMonth());
      if (diffMonths >= 0 && diffMonths < 5) {
        monthlySpends[4 - diffMonths] += (order.totalAmount || order.total || 0);
      }
    });

    (appointmentsData || []).forEach((apt: any) => {
      if (apt.status?.toLowerCase() !== 'completed') return;

      const aptDate = new Date(apt.date);
      const diffMonths = (currentDate.getFullYear() - aptDate.getFullYear()) * 12 + (currentDate.getMonth() - aptDate.getMonth());
      if (diffMonths >= 0 && diffMonths < 5) {
        monthlySpends[4 - diffMonths] += (apt.amountPaid || apt.finalAmount || apt.price || 0);
      }
    });

    const currentMonthSpend = monthlySpends[4];

    const maxSpend = Math.max(...monthlySpends, 1); // Avoid division by zero
    const monthlySpendPercentages = monthlySpends.map(spend => Math.max(10, Math.round((spend / maxSpend) * 100)));

    // Service Mix percentages
    const topCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const totalCategoryCount = topCategories.reduce((sum, [, count]) => sum + count, 0);

    const serviceMix = topCategories.map(([, count]) =>
      totalCategoryCount > 0 ? Math.round((count / totalCategoryCount) * 100) : 0
    );

    // Ensure we always have 3 values for the donuts
    while (serviceMix.length < 3) serviceMix.push(0);

    // Calculate Pro Tier based on total spent
    let tier = "BASIC";
    if (totalSpent >= 10000) tier = "PRO";
    else if (totalSpent >= 5000) tier = "GOLD";
    else if (totalSpent >= 1000) tier = "SILVER";

    return {
      totalAppointments,
      completedAppointments,
      cartItemsCount,
      totalOrders,
      totalSpent,
      currentMonthSpend,
      mostPurchasedCategory,
      wishlistItems: totalWishlistItems,
      monthlySpendPercentages,
      serviceMix,
      tier,
      deliveredOrders,
    };
  }, [appointmentsData, ordersData, cartData, productWishlistCount, doctorWishlistData, salonWishlistData]);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 1. Total Appointments — red calendar icon */}
        <StatCard
          imageSrc="/images/calendar (6) 1.png"
          title="Total Appointments"
          value={stats.totalAppointments}
          change={`${stats.totalAppointments} bookings`}
        />
        {/* 2. Cart Items — orange shopping cart icon */}
        <StatCard
          imageSrc="/images/Cart.png"
          title="Cart Items"
          value={stats.cartItemsCount}
          change={`${stats.cartItemsCount} items in cart`}
        />
        {/* 3. Total Spent — orders / clipboard+box icon */}
        <StatCard
          imageSrc="/images/Appoi + Order.png"
          title="Total Spent"
          value={`₹${stats.totalSpent.toLocaleString()}`}
          change="Orders + Appointments"
        />
        {/* 4. My Wishlist — blue bookmark icon */}
        <StatCard
          imageSrc="/images/Saved.png"
          title="My Wishlist"
          value={stats.wishlistItems}
          change={`${stats.wishlistItems} items saved`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CHARTS */}
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <img src="/images/Appointment (10).png" alt="Appointments" className="h-7 w-7" />
              Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 relative mb-2">
                <svg viewBox="0 0 36 36" className="w-full h-full">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeDasharray="75, 100"
                  />
                  <text x="18" y="22" className="text-xs font-bold fill-blue-600" textAnchor="middle">
                    {stats.completedAppointments}
                  </text>
                </svg>
              </div>
              <div className="text-center text-sm text-muted-foreground">Completed appointments</div>
            </div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <img src="/images/Delivered orders.png" alt="Appointments" className="h-7 w-7" />
              Delivered Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 relative mb-2">
                <svg viewBox="0 0 36 36" className="w-full h-full">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeDasharray={`${stats.totalOrders > 0 ? (stats.deliveredOrders / stats.totalOrders) * 100 : 0}, 100`}
                  />
                  <text x="18" y="22" className="text-xs font-bold fill-blue-600" textAnchor="middle">{stats.deliveredOrders}</text>
                </svg>
              </div>
              <div className="text-center text-sm text-muted-foreground">Successfully delivered</div>
            </div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <img src="/images/Monthly Spend.png" alt="Appointments" className="h-7 w-7" />
              Monthly Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 mb-2 flex items-end justify-center gap-1">
                <div className="w-3 bg-blue-200 rounded-t" style={{ height: `${stats.monthlySpendPercentages[0]}%` }}></div>
                <div className="w-3 bg-blue-300 rounded-t" style={{ height: `${stats.monthlySpendPercentages[1]}%` }}></div>
                <div className="w-3 bg-blue-400 rounded-t" style={{ height: `${stats.monthlySpendPercentages[2]}%` }}></div>
                <div className="w-3 bg-blue-500 rounded-t" style={{ height: `${stats.monthlySpendPercentages[3]}%` }}></div>
                <div className="w-3 bg-blue-600 rounded-t" style={{ height: `${stats.monthlySpendPercentages[4]}%` }}></div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  ₹{stats.currentMonthSpend >= 1000 ? `${(stats.currentMonthSpend / 1000).toFixed(1)}k` : stats.currentMonthSpend.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">This Month</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold leading-tight">Current Offers</CardTitle>
                <CardDescription className="mt-0.5 text-xs sm:text-sm">Don't miss out on these special deals.</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 whitespace-nowrap">
                  {currentOffers.length} Active
                </span>
                {currentOffers.length > 3 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllOffers(!showAllOffers)}
                  >
                    {showAllOffers ? "Show Less" : "View All"}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {isLoadingOffers ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">Loading offers...</span>
              </div>
            ) : displayOffers.length > 0 ? (
              displayOffers.map((offer, idx) => (
                <div key={offer.title + idx} className="flex items-center gap-4 p-3 rounded-lg relative border border-[#c8dff7]" style={{ backgroundColor: '#EBF3FD' }}>
                  {/* Thumbnail */}
                  <div className="w-16 h-16 flex-shrink-0 overflow-hidden rounded-md">
                    <img src={offer.image} alt={offer.title} className="w-full h-full object-cover" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title + code row */}
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h4 className="font-bold truncate text-base">{offer.title}</h4>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(offer.code)}
                        title="Copy coupon code"
                        className="inline-flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-primary/20 leading-none flex-shrink-0 transition-colors"
                      >
                        {offer.code}
                        {copiedCode === offer.code ? (
                          <Check className="h-2.5 w-2.5 text-green-600" />
                        ) : (
                          <Copy className="h-2.5 w-2.5 opacity-70" />
                        )}
                      </button>
                    </div>

                    {/* Applicable services — show max 3 with ... and More button */}
                    {(() => {
                      const uniqueServices = getUniqueOfferItems(offer);
                      const previewServices = uniqueServices.slice(0, 3);
                      const remainingCount = uniqueServices.length - 3;

                      return uniqueServices.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                          {previewServices.map((s: string, i: number) => (
                            <span key={s + i} className="flex items-center gap-1 text-sm text-foreground">
                              <span className="text-primary font-bold leading-none">•</span>
                              <span className="font-semibold">{s}</span>
                            </span>
                          ))}
                          {remainingCount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setOfferSearchTerm("");
                                setSelectedOfferModal(offer);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 bg-white/80 hover:bg-white px-2 py-0.5 rounded-full border border-primary/25 shadow-sm transition-all cursor-pointer"
                            >
                              <span>... +{remainingCount} more</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-1.5">
                          <span className="text-primary font-bold text-sm leading-none">•</span>
                          <span className="text-sm font-semibold text-foreground">All services</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Discount Badge */}
                  <div className="bg-primary text-primary-foreground px-2.5 py-1.5 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm flex-shrink-0">
                    {offer.discount}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">No offers available at the moment.</p>
            )}
          </CardContent>
        </Card>
        {/* NEW PRODUCTS */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold leading-tight">New Products</CardTitle>
                <CardDescription className="mt-0.5 text-xs sm:text-sm">Check out the latest arrivals.</CardDescription>
              </div>
              {newProducts.length > 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllProducts(!showAllProducts)}
                >
                  {showAllProducts ? "Show Less" : "View All"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {isLoadingProducts ? (
              <p className="text-muted-foreground text-center py-8">Loading products...</p>
            ) : displayNewProducts.length > 0 ? (
              displayNewProducts.map((product) => (
                <div key={product.name} className="flex items-center gap-4 p-3 rounded-lg border border-[#c8dff7]" style={{ backgroundColor: '#EBF3FD' }}>
                  <div className="w-16 h-16 flex-shrink-0 overflow-hidden rounded-md relative">
                    <img src={product.image} alt={product.name} className="object-cover w-full h-full" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-base leading-tight mb-0.5">{product.name}</h4>
                    <p className="text-sm font-bold text-primary mt-1.5">₹{product.price.toFixed(2)}</p>
                  </div>
                  <div className="flex gap-2 ml-auto">
                    <div
                      onClick={() => router.push(`/product-details/${product.id}`)}
                      className="cursor-pointer"
                    >
                      <Button variant="outline" size="sm">View</Button>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!isAuthenticated) {
                          router.push(`/client-login?redirect=${encodeURIComponent(window.location.pathname)}`);
                          return;
                        }

                        // Buy Now logic
                        const productForCheckout = {
                          id: product.id,
                          name: product.name,
                          price: product.price,
                          originalPrice: product.price,
                          hasSale: false,
                          image: product.image,
                          vendorId: product.vendorId || "", // We might need to fetch this or ensure it's in the mapped product
                          vendorName: product.vendorName || "Vendor",
                          quantity: 1,
                        };
                        localStorage.setItem("buyNowProduct", JSON.stringify(productForCheckout));
                        router.push("/checkout");
                      }}
                    >
                      Buy Now
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">No new products available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* UPCOMING APPOINTMENTS */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div
                onClick={() => router.push("/profile/appointments")}
                className="hover:opacity-70 transition-opacity cursor-pointer"
              >
                <CardTitle className="text-lg sm:text-xl font-bold leading-tight">Upcoming Appointments ({upcomingAppointments.length})</CardTitle>
                <CardDescription className="mt-0.5 text-xs sm:text-sm">Your next scheduled appointments.</CardDescription>
              </div>
              {upcomingAppointments.length > 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllAppointments(!showAllAppointments)}
                >
                  {showAllAppointments ? "Show Less" : "View All"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {isLoadingAppointments ? (
              <p className="text-muted-foreground text-center py-8">Loading appointments...</p>
            ) : displayUpcomingAppointments.length > 0 ? (
              displayUpcomingAppointments.map(appt => (
                <div
                  key={appt.id}
                  onClick={() => router.push("/profile/appointments")}
                  className="block cursor-pointer hover:shadow-md transition-shadow rounded-lg"
                >
                  <AppointmentCard appointment={appt} />
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">No upcoming appointments.</p>
            )}
          </CardContent>
        </Card>

        {/* UPCOMING ORDERS */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div
                onClick={() => router.push("/profile/orders")}
                className="hover:opacity-70 transition-opacity cursor-pointer"
              >
                <CardTitle className="text-lg sm:text-xl font-bold leading-tight">Upcoming Orders ({upcomingOrders.length})</CardTitle>
                <CardDescription className="mt-0.5 text-xs sm:text-sm">Your active and pending orders.</CardDescription>
              </div>
              {upcomingOrders.length > 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllOrders(!showAllOrders)}
                >
                  {showAllOrders ? "Show Less" : "View All"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {displayUpcomingOrders.length > 0 ? (
              displayUpcomingOrders.map((order: any) => {
                const orderId = order._id || order.id;
                const status = order.orderStatus || order.status || 'Pending';
                const date = order.createdAt || order.date;
                const total = order.totalAmount || 0;
                const itemCount = (order.items || order.products || []).length;
                return (
                  <div
                    key={orderId}
                    onClick={() => router.push("/profile/orders")}
                    className="block p-3 border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-sm">{itemCount} item{itemCount !== 1 ? 's' : ''}</h4>
                        <p className="text-xs text-muted-foreground">Order #{orderId?.slice(-6)?.toUpperCase()}</p>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">{status}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2.5">
                      <p className="text-xs text-muted-foreground">
                        {date ? new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                      </p>
                      <p className="text-base font-bold text-primary">₹{total.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-muted-foreground text-center py-8">No upcoming orders.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attractive Offer Details Modal */}
      <Dialog
        open={!!selectedOfferModal}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOfferModal(null);
            setOfferSearchTerm("");
          }
        }}
      >
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
          {selectedOfferModal && (() => {
            const allItems = getUniqueOfferItems(selectedOfferModal);
            const filteredItems = offerSearchTerm.trim()
              ? allItems.filter((item) =>
                  item.toLowerCase().includes(offerSearchTerm.toLowerCase())
                )
              : allItems;

            return (
              <div className="flex flex-col max-h-[85vh]">
                {/* Top Hero Banner */}
                <div className="relative bg-gradient-to-br from-primary/95 via-primary to-primary/80 text-primary-foreground p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white/30 shadow-md flex-shrink-0 bg-white">
                      <img
                        src={selectedOfferModal.image}
                        alt={selectedOfferModal.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full mb-1.5">
                        <Sparkles className="h-3 w-3" />
                        <span>Special Offer</span>
                      </div>
                      <DialogHeader className="text-left space-y-1">
                        <DialogTitle className="text-xl font-bold text-white leading-tight">
                          {selectedOfferModal.title}
                        </DialogTitle>
                        <DialogDescription className="text-white/85 text-sm">
                          {selectedOfferModal.description}
                        </DialogDescription>
                      </DialogHeader>
                    </div>
                    <div className="bg-white text-primary px-3 py-1.5 rounded-xl text-base font-extrabold shadow-md flex-shrink-0">
                      {selectedOfferModal.discount}
                    </div>
                  </div>

                  {/* Coupon Code Strip */}
                  {selectedOfferModal.code && (
                    <div className="mt-4 flex items-center justify-between gap-3 bg-white/15 backdrop-blur-sm border border-white/25 rounded-xl px-4 py-2.5">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-white/75 font-semibold block">
                          Promo Code
                        </span>
                        <span className="font-mono font-bold text-base tracking-wider text-white">
                          {selectedOfferModal.code}
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleCopyCode(selectedOfferModal.code)}
                        className="gap-1.5 font-semibold shadow-sm"
                      >
                        {copiedCode === selectedOfferModal.code ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-green-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy Code
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Applicable Services / Specialties List */}
                <div className="p-6 bg-background flex-1 overflow-hidden flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h5 className="font-bold text-sm text-foreground">
                        Applicable Services &amp; Categories
                      </h5>
                      <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                        {allItems.length}
                      </span>
                    </div>
                    {allItems.length > 8 && (
                      <div className="relative w-full sm:w-52">
                        <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={offerSearchTerm}
                          onChange={(e) => setOfferSearchTerm(e.target.value)}
                          placeholder="Search services..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-input bg-muted/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                        />
                      </div>
                    )}
                  </div>

                  <div className="overflow-y-auto pr-1 max-h-[300px]">
                    {filteredItems.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {filteredItems.map((item, index) => (
                          <span
                            key={item + index}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#EBF3FD] text-foreground border border-[#c8dff7] hover:border-primary/40 transition-colors"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No matching services found for &ldquo;{offerSearchTerm}&rdquo;.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end pt-2 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedOfferModal(null);
                        setOfferSearchTerm("");
                      }}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProfilePageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OverviewContent />
    </Suspense>
  );
}
