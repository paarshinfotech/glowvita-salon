
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { clearAdminAuth } from "@repo/store/slices/adminAuthSlice";
import { clearCrmAuth, handleSubscriptionExpired } from "@repo/store/slices/crmAuthSlice";
import { NEXT_PUBLIC_ADMIN_URL, NEXT_PUBLIC_CRM_URL, NEXT_PUBLIC_WEB_URL } from "@repo/config/config";

export const SALON_FAVORITES_VERSION = '1.0.1';

// Function to get base URLs with intelligent fallbacks for production
const getBaseUrls = () => {
  // If explicit env vars exist, use them
  if (NEXT_PUBLIC_WEB_URL && NEXT_PUBLIC_CRM_URL && NEXT_PUBLIC_ADMIN_URL) {
    return {
      admin: `${NEXT_PUBLIC_ADMIN_URL}/api`,
      crm: `${NEXT_PUBLIC_CRM_URL}/api`,
      web: `${NEXT_PUBLIC_WEB_URL}/api`,
    };
  }

  // Production default → always same-domain API
  if (typeof window !== "undefined") {
    return {
      admin: "/api",
      crm: "/api",
      web: "/api",
    };
  }

  // SSR fallback
  return {
    admin: "/api",
    crm: "/api",
    web: "/api",
  };
};

const API_BASE_URLS = getBaseUrls();

// Base query function that determines the API URL and sets headers.
const baseQuery = async (args, api, extraOptions) => {
  let requestUrl = typeof args === "string" ? args : args.url;

  if (typeof requestUrl !== "string") {
    return { error: { status: "CUSTOM_ERROR", error: "Invalid URL provided" } };
  }

  let targetService = "web"; // Default
  if (requestUrl.startsWith("/admin")) {
    targetService = "admin";
  } else if (requestUrl.startsWith("/crm")) {
    targetService = "crm";
  } else if (requestUrl.startsWith("/client") || requestUrl.startsWith("/payments")) {
    targetService = "web";
  }

  const baseUrl = API_BASE_URLS[targetService];

  // Cache-busting for all GET requests on the client-side to avoid hydration errors
  let fullUrl = `${baseUrl}${requestUrl}`;
  const method = (typeof args === 'object' && args.method) ? args.method.toUpperCase() : 'GET';

  if (method === 'GET' && typeof window !== 'undefined') {
    // Append regionId for admin requests if not already present
    if (targetService === "admin") {
      const state = api.getState();
      const selectedRegion = state.adminAuth?.selectedRegion;
      if (selectedRegion && !fullUrl.includes('regionId=')) {
        const separator = fullUrl.includes('?') ? '&' : '?';
        fullUrl += `${separator}regionId=${selectedRegion}`;
      }
    }

    const separator = fullUrl.includes('?') ? '&' : '?';
    fullUrl += `${separator}_t=${new Date().getTime()}`;
  }

  const dynamicFetch = fetchBaseQuery({
    baseUrl: "", // We're already building the full URL
    credentials: "include",
    prepareHeaders: (headers, { getState }) => {
      const state = getState();
      let token;

      // Send only the token for the matching service to avoid cross-service auth pollution
      if (targetService === "admin") {
        token = state.adminAuth?.token;
      } else if (targetService === "crm") {
        token = state.crmAuth?.token;
      } else {
        // web service: prefer userAuth, fallback to crmAuth (for CRM users browsing web)
        token = state.userAuth?.token || state.crmAuth?.token;
      }

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  });

  try {
    const result = await dynamicFetch(
      { ...(typeof args === 'object' ? args : {}), url: fullUrl },
      api,
      extraOptions
    );

    // Handle 403 Forbidden
    if (result.error?.status === 403) {
      if (targetService === "crm" || targetService === "web") {
        api.dispatch(handleSubscriptionExpired());
        // Force a refetch of the profile to ensure the UI updates with the latest user data
        api.dispatch(glowvitaApi.endpoints.getProfile.initiate(undefined, { forceRefetch: true }));
      }
      // For targetService === "admin", we don't automatically clear or expire things
      // as 403 in admin usually means "Missing Permission", not "Subscription Expired"
    }

    // Handle 401 Unauthorized
    if (result.error?.status === 401) {
      if (targetService === "crm" || targetService === "web") {
        api.dispatch(clearCrmAuth());
      } else if (targetService === "admin") {
        api.dispatch(clearAdminAuth());
      }
    }

    return result;
  } catch (error) {
    return { error: { status: "CUSTOM_ERROR", error: error.message } };
  }
};

export const glowvitaApi = createApi({
  reducerPath: "glowvitaApi",
  baseQuery: baseQuery,
  tagTypes: [
    "admin", "offers", "Referrals", "Settings", "SuperData", "Supplier",
    "SubscriptionPlan", "Vendor", "doctors", "GeoFence", "Category",
    "Service", "Staff", "Client", "Offers", "Notification",
    "TaxFeeSettings", "User", "PendingServices", "VendorServicesApproval", "AdminProductCategory",
    "ProductCategory", "SmsTemplate", "SmsPackage", "CrmSmsTemplate",
    "TestSmsTemplate", "SmsPackage", "CrmSmsPackage", "CrmCampaign",
    "SocialMediaTemplate", "CrmSocialMediaTemplate", "Marketing",
    "Appointments", "ShippingCharge", "Order", "CrmProducts",
    "SupplierProducts", "CrmOrder", "SupplierProfile", "Cart", "ClientCart",
    "PublicVendors", "PublicVendorServices", "PublicVendorStaff",
    "PublicVendorWorkingHours", "PublicVendorOffers", "PublicProducts",
    "PublicVendorProducts", "PublicServices", "PublicCategories", "WorkingHours", "ClientOrder", "Patient", "Appointment",
    "Consultations", "Consultation", "Expense", "PublicAppointments", "ClientCart", "ClientReferrals",
    "Billing", "VendorServices", "DoctorWishlist", "Product", "CrmClientOrder", "DoctorReviews",
    "SellingServicesReport", "TotalBookingsReport", "CompletedBookingsReport", "CancellationReport", "SalesBySalonReport", "SalesByProductsReport",
    "SalesByBrandReport", "SalesByCategoryReport", "ConsolidatedSalesReport", "SupplierReports", "Products", "Regions", "PublicAllOffers", "AddOns", "PendingWeddingPackages",
    "ReferralReport", "ClientWallet", "ClientWithdrawals", "WalletSettings", "Inventory", "SettlementHistoryReport", "PlatformCollectionsReport", "Doctor", "CrmWallet", "SalonWishlist", "CrmReviews"
  ],

  endpoints: (builder) => ({
    // Regions Endpoints
    getRegions: builder.query({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append("page", params.page);
        if (params.limit) queryParams.append("limit", params.limit);
        const queryString = queryParams.toString();
        return {
          url: `/admin/regions${queryString ? `?${queryString}` : ""}`,
          method: "GET",
        };
      },
      providesTags: ["Regions"],
    }),

    createRegion: builder.mutation({
      query: (regionData) => ({
        url: "/admin/regions",
        method: "POST",
        body: regionData,
      }),
      invalidatesTags: ["Regions"],
    }),

    updateRegion: builder.mutation({
      query: (regionData) => ({
        url: "/admin/regions",
        method: "PUT",
        body: regionData,
      }),
      invalidatesTags: ["Regions"],
    }),

    deleteRegion: builder.mutation({
      query: (id) => ({
        url: `/admin/regions?id=${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Regions"],
    }),

    // Wallet Settings Endpoints
    getWalletSettings: builder.query({
      query: () => ({
        url: "/admin/wallet-settings",
        method: "GET",
      }),
      providesTags: ["WalletSettings"],
    }),

    updateWalletSettings: builder.mutation({
      query: (settings) => ({
        url: "/admin/wallet-settings",
        method: "PUT",
        body: { settings },
      }),
      invalidatesTags: ["WalletSettings"],
    }),

    getAdminWithdrawals: builder.query({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append("page", params.page);
        if (params.limit) queryParams.append("limit", params.limit);
        if (params.status) queryParams.append("status", params.status);
        if (params.regionId) queryParams.append("regionId", params.regionId);
        if (params.search) queryParams.append("search", params.search);
        if (params.userType) queryParams.append("userType", params.userType);

        return {
          url: `/admin/wallet-withdrawals?${queryParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["ClientWithdrawals"],
    }),

    updateWithdrawalStatus: builder.mutation({
      query: (data) => ({
        url: "/admin/wallet-withdrawals",
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["ClientWithdrawals", "ClientWallet"],
    }),

    getAdminTransactions: builder.query({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append("page", params.page);
        if (params.limit) queryParams.append("limit", params.limit);
        if (params.type) queryParams.append("type", params.type);
        if (params.status) queryParams.append("status", params.status);
        if (params.regionId) queryParams.append("regionId", params.regionId);
        if (params.search) queryParams.append("search", params.search);
        if (params.userType) queryParams.append("userType", params.userType);
        if (params.source) queryParams.append("source", params.source);

        return {
          url: `/admin/wallet-transactions?${queryParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["ClientWallet"],
    }),

    getProfile: builder.query({
      query: () => `/crm/auth/profile`,
      providesTags: ['User'],
    }),

    refreshToken: builder.mutation({
      query: () => ({
        url: `/crm/auth/refresh`,
        method: 'POST',
      }),
      invalidatesTags: ['User'],
    }),

    // SMS Templates Endpoints
    getSmsTemplates: builder.query({
      query: () => "/admin/sms-template",
      providesTags: ["SmsTemplate"],
    }),

    getSmsTemplateById: builder.query({
      query: (id) => `/admin/sms-template/${id}`,
      providesTags: (result, error, id) => [{ type: "SmsTemplate", id }],
    }),

    createSmsTemplate: builder.mutation({
      query: (templateData) => ({
        url: "/admin/sms-template",
        method: "POST",
        body: templateData,
      }),
      invalidatesTags: ["SmsTemplate"],
    }),

    updateSmsTemplate: builder.mutation({
      query: ({ id, ...updates }) => ({
        url: `/admin/sms-template?id=${id}`,
        method: "PUT",
        body: updates,
      }),
      invalidatesTags: (result, error, { id }) => [
        "SmsTemplate",
        { type: "SmsTemplate", id },
      ],
    }),

    deleteSmsTemplate: builder.mutation({
      query: (id) => ({
        url: `/admin/sms-template?id=${id}`,
        method: "DELETE",
        body: { _id: id },
      }),
      invalidatesTags: ["SmsTemplate"],
    }),

    // Social Media Template Endpoints
    getSocialMediaTemplates: builder.query({
      query: () => "/admin/social-media-templates",
      providesTags: ["SocialMediaTemplate"],
    }),

    getSocialMediaTemplateById: builder.query({
      query: (id) => `/admin/social-media-templates/${id}`,
      providesTags: (result, error, id) => [
        { type: "SocialMediaTemplate", id },
      ],
    }),

    createSocialMediaTemplate: builder.mutation({
      query: (formData) => ({
        url: "/admin/social-media-templates",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["SocialMediaTemplate", "CrmSocialMediaTemplate"],
    }),

    updateSocialMediaTemplate: builder.mutation({
      query: ({ id, data }) => ({
        url: `/admin/social-media-templates?id=${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        "SocialMediaTemplate",
        "CrmSocialMediaTemplate",
        { type: "SocialMediaTemplate", id },
      ],
    }),

    deleteSocialMediaTemplate: builder.mutation({
      query: (id) => ({
        url: `/admin/social-media-templates?id=${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["SocialMediaTemplate", "CrmSocialMediaTemplate"],
    }),

    // SMS Packages Endpoints
    getSmsPackages: builder.query({
      query: () => "/admin/sms-packages",
      providesTags: ["SmsPackage"],
    }),

    getSmsPackageById: builder.query({
      query: (id) => `/admin/sms-packages/${id}`,
      providesTags: (result, error, id) => [{ type: "SmsPackage", id }],
    }),

    createSmsPackage: builder.mutation({
      query: (packageData) => ({
        url: "/admin/sms-packages",
        method: "POST",
        body: packageData,
      }),
      invalidatesTags: ["SmsPackage"],
    }),

    updateSmsPackage: builder.mutation({
      query: ({ id, ...updates }) => ({
        url: `/admin/sms-packages?id=${id}`,
        method: "PUT",
        body: updates,
      }),
      invalidatesTags: (result, error, { id }) => [
        "SmsPackage",
        { type: "SmsPackage", id },
      ],
    }),

    deleteSmsPackage: builder.mutation({
      query: (id) => ({
        url: `/admin/sms-packages?id=${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["SmsPackage"],
    }),
    // Web App Endpoints
    getMe: builder.query({
      query: () => ({ url: "/auth/me", method: "GET" }),
      providesTags: ["User"],
    }),

    // Public Vendors for landing page
    getPublicVendors: builder.query({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();

        if (params.serviceName) queryParams.append("serviceName", params.serviceName);
        if (params.categoryIds) queryParams.append("categoryIds", params.categoryIds);
        if (params.limit) queryParams.append("limit", params.limit.toString());
        if (params.offset) queryParams.append("offset", params.offset.toString());

        // Coordinate-based location
        if (params.lat != null && params.lng != null) {
          queryParams.append("lat", params.lat.toString());
          queryParams.append("lng", params.lng.toString());
        }

        // Region / Neighborhood fallback or explicit filter
        if (params.city) {
          queryParams.append("city", params.city);
        }

        if (params.offerCode) {
          queryParams.append("offerCode", params.offerCode);
        }

        if (params.regionId) {
          queryParams.append("regionId", params.regionId);
        }

        const queryString = queryParams.toString();
        return {
          url: `/vendors${queryString ? `?${queryString}` : ""}`,
          method: "GET",
        };
      },
      providesTags: ["PublicVendors"],
    }),

    getLandingSalons: builder.query({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();

        // Coordinate-based location
        if (params.lat != null && params.lng != null) {
          queryParams.append("lat", params.lat.toString());
          queryParams.append("lng", params.lng.toString());
        }

        // Region / Neighborhood fallback or explicit filter
        if (params.city) {
          queryParams.append("city", params.city);
        }

        const queryString = queryParams.toString();
        return {
          url: `/vendors/landing${queryString ? `?${queryString}` : ""}`,
          method: "GET",
        };
      },
      providesTags: ["PublicVendors"],
    }),

    getPublicVendorById: builder.query({
      query: (vendorId) => ({ url: `/vendors/${vendorId}`, method: "GET" }),
      providesTags: (result, error, vendorId) => [{ type: "PublicVendor", id: vendorId }],
      transformResponse: (response) => response,
    }),

    // Public Products for landing page
    getPublicProducts: builder.query({
      query: (params) => ({
        url: "/products",
        method: "GET",
        params: params
      }),
      providesTags: ["PublicProducts"],
      transformResponse: (response) => response,
    }),

    // Public Services Endpoint
    getPublicServices: builder.query({
      query: (params = {}) => {
        const { categoryId, limit, page } = params;
        const queryParams = new URLSearchParams();

        if (categoryId) {
          queryParams.append('categoryId', categoryId);
        }

        if (limit) {
          queryParams.append('limit', limit.toString());
        }

        if (page) {
          queryParams.append('page', page.toString());
        }

        const queryString = queryParams.toString();
        return {
          url: `/services${queryString ? `?${queryString}` : ''}`,
          method: "GET"
        };
      },
      providesTags: ["PublicServices"],
      transformResponse: (response) => response,
    }),

    // Public Categories Endpoint
    getPublicCategories: builder.query({
      query: () => ({ url: "/categories", method: "GET" }),
      providesTags: ["PublicCategories"],
      transformResponse: (response) => response,
    }),

    // Public Products for specific vendor
    getPublicVendorProducts: builder.query({
      query: (vendorId) => ({ url: `/products?vendorId=${vendorId}`, method: "GET" }),
      providesTags: (result, error, vendorId) => [{ type: "PublicVendorProducts", id: vendorId }],
      transformResponse: (response) => response,
    }),

    // Public Single Product by ID
    getPublicProductById: builder.query({
      query: (productId) => ({ url: `/products/${productId}`, method: "GET" }),
      providesTags: (result, error, productId) => [{ type: "PublicProduct", id: productId }],
      transformResponse: (response) => response,
    }),

    // Product Questions - Get all published questions for a product (Web)
    getProductQuestions: builder.query({
      query: (productId) => ({ url: `/products/questions/${productId}`, method: "GET" }),
      providesTags: (result, error, productId) => [{ type: "ProductQuestions", id: productId }],
      transformResponse: (response) => response,
    }),

    // Product Questions - Submit a new question (Web)
    submitProductQuestion: builder.mutation({
      query: ({ productId, question }) => ({
        url: `/products/questions/${productId}`,
        method: "POST",
        body: { productId, question }
      }),
      invalidatesTags: (result, error, { productId }) => [{ type: "ProductQuestions", id: productId }],
    }),

    // Product Reviews - Get all reviews for a product (Web)
    getProductReviews: builder.query({
      query: (productId) => ({ url: `/products/reviews/${productId}`, method: "GET" }),
      providesTags: (result, error, productId) => [{ type: "ProductReviews", id: productId }],
      transformResponse: (response) => response,
    }),

    // Product Reviews - Submit a new review (Web)
    submitProductReview: builder.mutation({
      query: ({ productId, rating, comment }) => ({
        url: `/products/reviews/${productId}`,
        method: "POST",
        body: { productId, rating, comment }
      }),
      invalidatesTags: (result, error, { productId }) => [{ type: "ProductReviews", id: productId }],
    }),

    // Salon Reviews - Get all reviews for a salon (Web)
    getSalonReviews: builder.query({
      query: (salonId) => ({ url: `/salons/reviews/${salonId}`, method: "GET" }),
      providesTags: (result, error, salonId) => [{ type: "SalonReviews", id: salonId }],
      transformResponse: (response) => response,
    }),

    // Doctor Reviews - Get all reviews for a doctor (Web)
    getDoctorReviews: builder.query({
      query: (doctorId) => ({ url: `/doctors/reviews/${doctorId}`, method: "GET" }),
      providesTags: (result, error, doctorId) => [{ type: "DoctorReviews", id: doctorId }],
      transformResponse: (response) => response,
    }),

    // Salon Wishlist Endpoints
    getSalonWishlist: builder.query({
      query: () => ({ url: "/client/salon-wishlist", method: "GET" }),
      providesTags: ["SalonWishlist"],
    }),

    addToSalonWishlist: builder.mutation({
      query: (salonId) => ({
        url: "/client/salon-wishlist",
        method: "POST",
        body: { salonId },
      }),
      invalidatesTags: ["SalonWishlist"],
    }),

    removeFromSalonWishlist: builder.mutation({
      query: (salonId) => ({
        url: "/client/salon-wishlist",
        method: "DELETE",
        body: { salonId },
      }),
      invalidatesTags: ["SalonWishlist"],
    }),

    // Public Doctors endpoint (Web App - no authentication required)
    getPublicDoctors: builder.query({
      query: () => ({ url: "/client/doctors", method: "GET" }),
      providesTags: ["doctors"],
    }),

    // Public Services for vendor details page
    getPublicVendorServices: builder.query({
      query: (vendorId) => ({ url: `/services/vendor/${vendorId}`, method: "GET" }),
      providesTags: ["PublicVendorServices"],
      transformResponse: (response) => response,
    }),

    // Public Working Hours for vendor details page
    getPublicVendorWorkingHours: builder.query({
      query: (vendorId) => ({ url: `/working-hours?vendorId=${vendorId}`, method: "GET" }),
      providesTags: ["PublicVendorWorkingHours"],
      transformResponse: (response) => response,
    }),

    // Public Staff for vendor details page
    getPublicVendorStaff: builder.query({
      query: (vendorId) => ({ url: `/staff/vendor/${vendorId}`, method: "GET" }),
      providesTags: ["PublicVendorStaff"],
      transformResponse: (response) => response,
    }),

    // Public Staff by Service for booking flow
    getPublicVendorStaffByService: builder.query({
      query: ({ vendorId, serviceId }) => ({ url: `/staff/vendor/${vendorId}/service/${serviceId}`, method: "GET" }),
      providesTags: ["PublicVendorStaff"],
      transformResponse: (response) => response,
    }),

    // Public Offers for vendor details page
    getPublicVendorOffers: builder.query({
      query: (vendorId) => ({ url: `/offers?businessId=${vendorId}`, method: "GET" }),
      providesTags: ["PublicVendorOffers"],
      transformResponse: (response) => response,
    }),

    // Public All Offers (Admin + CRM) for landing page
    getPublicAllOffers: builder.query({
      query: ({ vendorId, regionId } = {}) => ({
        url: `/all-offers`,
        method: "GET",
        params: {
          ...(vendorId ? { vendorId } : {}),
          ...(regionId ? { regionId } : {}),
        }
      }),
      providesTags: ["PublicAllOffers"],
      transformResponse: (response) => response,
    }),

    // Multi-Service Slot Discovery for booking flow
    getMultiServiceSlots: builder.mutation({
      query: (body) => ({
        url: "/booking/slots/multi",
        method: "POST",
        body
      }),
      transformResponse: (response) => response,
    }),

    // Admin Panel Endpoints
    getAdminMarketingDashboard: builder.query({
      query: () => ({
        url: "/admin/Marketing/dashboard",
        method: "GET",
      }),
      providesTags: ["Marketing"],
    }),
    getUsers: builder.query({
      query: () => ({
        url: "/admin/users",
        method: "GET",
      }),
      providesTags: ["admin"],
    }),
    getAdminOnlineTransactions: builder.query({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append("page", params.page);
        if (params.limit) queryParams.append("limit", params.limit);
        if (params.search) queryParams.append("search", params.search);
        if (params.status && params.status !== 'all') queryParams.append("status", params.status);
        if (params.paymentStatus && params.paymentStatus !== 'all') queryParams.append("paymentStatus", params.paymentStatus);
        if (params.vendorId && params.vendorId !== 'all') queryParams.append("vendorId", params.vendorId);
        if (params.serviceName && params.serviceName !== 'all') queryParams.append("serviceName", params.serviceName);
        if (params.regionId && params.regionId !== 'all') queryParams.append("regionId", params.regionId);

        const queryString = queryParams.toString();
        return {
          url: `/admin/online-transactions${queryString ? `?${queryString}` : ""}`,
          method: "GET",
        };
      },
      providesTags: ["Appointments"],
    }),
    // Service Approval Endpoints
    getVendorServicesForApproval: builder.query({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.status) queryParams.append('status', params.status);
        if (params?.regionId && params.regionId !== 'all') queryParams.append('regionId', params.regionId);

        const queryString = queryParams.toString();
        return {
          url: `/admin/services/service-approval${queryString ? `?${queryString}` : ""}`,
          method: "GET",
        };
      },
      providesTags: ["VendorServicesApproval"],
    }),
    updateServiceStatus: builder.mutation({
      query: ({ serviceId, status, rejectionReason }) => ({
        url: "/admin/services/service-approval",
        method: "PATCH",
        body: { serviceId, status, rejectionReason },
      }),
      invalidatesTags: ["VendorServicesApproval", "VendorServices"],
    }),
    updateVendorServiceOnlineBooking: builder.mutation({
      query: ({ serviceId, onlineBooking }) => ({
        url: "/admin/services/service-approval",
        method: "PUT",
        body: { serviceId, onlineBooking },
      }),
      invalidatesTags: ["VendorServicesApproval", "VendorServices"],
    }),

    // Wedding Package Approval Endpoints
    getPendingWeddingPackages: builder.query({
      query: (regionId) => {
        const params = new URLSearchParams();
        if (regionId && regionId !== 'all') params.append('regionId', regionId);
        const queryString = params.toString();
        return {
          url: `/admin/wedding-packages/approval${queryString ? `?${queryString}` : ""}`,
          method: "GET"
        };
      },
      providesTags: ["PendingWeddingPackages"],
    }),
    updateWeddingPackageStatus: builder.mutation({
      query: ({ packageId, status, rejectionReason }) => ({
        url: "/admin/wedding-packages/approval",
        method: "PATCH",
        body: { packageId, status, rejectionReason },
      }),
      invalidatesTags: ["PendingWeddingPackages", "VendorWeddingPackages", "PublicVendorWeddingPackages"],
    }),

    // Admin
    registerAdmin: builder.mutation({
      query: (admin) => ({
        url: "/admin/auth/register",
        method: "POST",
        body: admin,
      }),
      invalidatesTags: ["admin"],
    }),

    adminLogin: builder.mutation({
      query: (credentials) => ({
        url: "/admin/auth/login",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["admin"],
    }),

    getAdmins: builder.query({
      query: () => ({ url: "/admin", method: "GET" }),
      providesTags: ["admin"],
    }),

    createAdmin: builder.mutation({
      query: (admin) => ({
        url: "/admin",
        method: "POST",
        body: admin,
      }),
      invalidatesTags: ["admin"],
    }),

    updateAdmin: builder.mutation({
      query: ({ id, data }) => ({
        url: `/admin?id=${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["admin"],
    }),

    deleteAdmin: builder.mutation({
      query: (id) => ({
        url: `/admin?id=${id}`,
        method: "DELETE",
        body: { id },
      }),
      invalidatesTags: ["admin"],
    }),

    // offfers
    getAdminOffers: builder.query({
      query: (params) => {
        const regionId = typeof params === 'string' ? params : params?.regionId;
        return {
          url: "/admin/offers",
          method: "GET",
          params: regionId ? { regionId } : {}
        };
      },
      providesTags: ["offers"],
    }),

    createAdminOffer: builder.mutation({
      query: (offer) => ({
        url: "/admin/offers",
        method: "POST",
        body: offer,
      }),
      invalidatesTags: ["offers"],
    }),

    updateAdminOffer: builder.mutation({
      query: (offer) => ({
        url: `/admin/offers`,
        method: "PUT",
        body: offer,
      }),
      invalidatesTags: ["offers"],
    }),

    deleteAdminOffer: builder.mutation({
      query: (id) => ({
        url: `/admin/offers`,
        method: "DELETE",
        body: { id },
      }),
      invalidatesTags: ["offers"],
    }),

    // refferal endpoints
    getReferrals: builder.query({
      query: (params) => {
        const referralType = typeof params === 'string' ? params : params?.referralType || params?.type;
        const regionId = typeof params === 'object' ? params?.regionId : undefined;
        return {
          url: "/admin/referrals",
          method: "GET",
          params: { referralType, regionId },
        };
      },
      providesTags: ["Referrals"],
    }),
    createReferral: builder.mutation({
      query: (referral) => ({
        url: "/admin/referrals",
        method: "POST",
        body: referral,
      }),
      invalidatesTags: ["Referrals"],
    }),
    updateReferral: builder.mutation({
      query: (referral) => ({
        url: "/admin/referrals",
        method: "PUT",
        body: referral,
      }),
      invalidatesTags: ["Referrals"],
    }),
    deleteReferral: builder.mutation({
      query: (id) => ({
        url: "/admin/referrals",
        method: "DELETE",
        body: { id },
      }),
      invalidatesTags: ["Referrals"],
    }),
    updateSettings: builder.mutation({
      query: ({ referralType, settings }) => ({
        url: "/admin/referrals",
        method: "PATCH",
        body: { referralType, settings },
      }),
      invalidatesTags: ["Settings"],
    }),

    getSettings: builder.query({
      query: (params) => {
        const referralType = typeof params === 'string' ? params : params?.referralType || params?.type;
        const regionId = typeof params === 'object' ? params?.regionId : undefined;
        return {
          url: "/admin/referrals",
          method: "GET",
          params: { settings: true, referralType, regionId },
        };
      },
      providesTags: ["Settings"],
    }),

    // CRM-specific referral endpoints
    getCrmReferrals: builder.query({
      query: (referralType) => ({
        url: "/crm/referrals",
        method: "GET",
        params: { referralType },
      }),
      providesTags: ["CrmReferrals"],
    }),
    getCrmReferralSettings: builder.query({
      query: (referralType) => ({
        url: "/crm/referrals",
        method: "POST",
        body: { action: 'getSettings', referralType },
      }),
      providesTags: ["CrmSettings"],
    }),

    // SuperData (Dropdowns) Endpoints
    getSuperData: builder.query({
      query: () => ({ url: "/admin/super-data", method: "GET" }),
      providesTags: ["SuperData"],
    }),

    createSuperDataItem: builder.mutation({
      query: (item) => ({
        url: "/admin/super-data",
        method: "POST",
        body: item,
      }),
      invalidatesTags: ["SuperData"],
    }),

    updateSuperDataItem: builder.mutation({
      query: (item) => ({
        url: "/admin/super-data",
        method: "PUT",
        body: item,
      }),
      invalidatesTags: ["SuperData"],
    }),

    deleteSuperDataItem: builder.mutation({
      query: ({ id }) => ({
        url: "/admin/super-data",
        method: "DELETE",
        body: { id },
      }),
      invalidatesTags: ["SuperData"],
    }),

    // Tax Fee Settings Endpoints
    getTaxFeeSettings: builder.query({
      query: () => ({ url: "/admin/tax-fees", method: "GET" }),
      providesTags: ["TaxFeeSettings"],
    }),

    updateTaxFeeSettings: builder.mutation({
      query: (settings) => ({
        url: "/admin/tax-fees",
        method: "PATCH",
        body: settings,
      }),
      invalidatesTags: ["TaxFeeSettings"],
    }),

    // Marketing Endpoints
    // Other marketing-related endpoints can go here

    createSmsTemplate: builder.mutation({
      query: (template) => ({
        url: "/admin/sms-template",
        method: "POST",
        body: template,
      }),
      invalidatesTags: ["SmsTemplate"],
    }),

    updateSmsTemplate: builder.mutation({
      query: ({ _id, ...updates }) => ({
        url: `/admin/sms-template?id=${_id}`,
        method: "PUT",
        body: updates,
      }),
      invalidatesTags: (result, error, { _id }) => [
        "SmsTemplate",
        { type: "SmsTemplate", id: _id },
      ],
    }),

    deleteSmsTemplate: builder.mutation({
      query: (id) => ({
        url: `/admin/sms-template?id=${id}`,
        method: "DELETE",
        body: { _id: id },
      }),
      invalidatesTags: ["Marketing"],
    }),

    // Vendor Endpoints
    createVendor: builder.mutation({
      query: (vendorData) => ({
        url: "/admin/vendor",
        method: "POST",
        body: vendorData,
      }),
      invalidatesTags: ["Vendor"],
    }),

    getVendors: builder.query({
      query: (params) => {
        const regionId = typeof params === 'string' ? params : params?.regionId;
        const queryParams = new URLSearchParams();
        if (regionId && regionId !== 'all') {
          queryParams.append('regionId', regionId);
        }
        const queryString = queryParams.toString();
        return {
          url: `/admin/vendor${queryString ? `?${queryString}` : ""}`,
          method: "GET"
        };
      },
      providesTags: ["Vendor"],
      transformResponse: (response) => response,
    }),

    getVendorById: builder.query({
      query: (id) => ({ url: `/admin/vendor?id=${id}` }),
      providesTags: (result, error, id) => [{ type: "Vendor", id }],
    }),

    updateVendor: builder.mutation({
      query: ({ id, ...vendorData }) => ({
        url: "/admin/vendor",
        method: "PUT",
        body: { id, ...vendorData },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Vendor", id },
        "Vendor",
      ],
    }),

    updateVendorStatus: builder.mutation({
      query: ({ id, status, rejectionReason }) => ({
        url: "/admin/vendor",
        method: "PATCH",
        body: { id, status, rejectionReason },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Vendor", id },
        "Vendor",
      ],
    }),

    // Add new endpoint for updating vendor document status
    updateVendorDocumentStatus: builder.mutation({
      query: ({ vendorId, documentType, status, rejectionReason }) => ({
        url: "/admin/vendor",
        method: "PATCH",
        body: { vendorId, documentType, status, rejectionReason },
      }),
      invalidatesTags: (result, error, { vendorId }) => [
        { type: "Vendor", vendorId },
        "Vendor",
      ],
    }),

    updateVendorDocuments: builder.mutation({
      query: ({ id, documents }) => ({
        url: "/admin/vendor",
        method: "PATCH",
        body: { id, documents },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Vendor", id },
        "Vendor",
      ],
    }),

    deleteVendor: builder.mutation({
      query: ({ id }) => ({
        url: "/admin/vendor",
        method: "DELETE",
        body: { id },
      }),
      invalidatesTags: ["Vendor"],
    }),

    // Doctor Endpoints
    getDoctors: builder.query({
      query: (params) => {
        const regionId = typeof params === 'string' ? params : params?.regionId;
        const queryParams = new URLSearchParams();
        if (regionId && regionId !== 'all') queryParams.append("regionId", regionId);
        const queryString = queryParams.toString();
        return {
          url: `/admin/doctors${queryString ? `?${queryString}` : ""}`,
          method: "GET",
        };
      },
      providesTags: ["doctors"],
    }),

    createDoctor: builder.mutation({
      query: (doctor) => ({
        url: "/admin/doctors",
        method: "POST",
        body: doctor,
      }),
      invalidatesTags: ["doctors"],
    }),

    // Public CRM doctor self-registration (no admin token required)
    registerDoctorCrm: builder.mutation({
      query: (doctor) => ({
        url: "/crm/auth/register-doctor",
        method: "POST",
        body: doctor,
      }),
      invalidatesTags: ["doctors"],
    }),

    updateDoctor: builder.mutation({
      query: (doctor) => ({
        url: "/admin/doctors",
        method: "PUT",
        body: doctor,
      }),
      invalidatesTags: ["doctors"],
    }),

    deleteDoctor: builder.mutation({
      query: (id) => ({
        url: "/admin/doctors",
        method: "DELETE",
        body: { id },
      }),
      invalidatesTags: ["doctors"],
    }),

    updateDoctorStatus: builder.mutation({
      query: ({ id, status, rejectionReason }) => ({
        url: "/admin/doctors",
        method: "PATCH",
        body: { id, status, rejectionReason },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "doctors", id },
        "doctors",
      ],
    }),

    updateDoctorDocumentStatus: builder.mutation({
      query: ({ doctorId, documentType, status, rejectionReason }) => ({
        url: "/admin/doctors",
        method: "PATCH",
        body: { doctorId, documentType, status, rejectionReason },
      }),
      invalidatesTags: (result, error, { doctorId }) => [
        { type: "doctors", id: doctorId },
        "doctors",
      ],
    }),

    // Subscription Plan Endpoints
    getSubscriptionPlans: builder.query({
      query: (params) => {
        const regionId = typeof params === 'string' ? params : params?.regionId;
        return {
          url: "/admin/subscription-plans",
          method: "GET",
          params: regionId ? { regionId } : {}
        };
      },
      providesTags: ["SubscriptionPlan"],
    }),

    getCrmSubscriptionPlans: builder.query({
      query: () => ({ url: "/crm/subscription/plans", method: "GET" }),
      providesTags: ["SubscriptionPlan"],
    }),

    createSubscriptionPlan: builder.mutation({
      query: (plan) => ({
        url: "/admin/subscription-plans",
        method: "POST",
        body: plan,
      }),
      invalidatesTags: ["SubscriptionPlan", "Vendor"],
    }),

    updateSubscriptionPlan: builder.mutation({
      query: ({ _id, ...planData }) => ({
        url: `/admin/subscription-plans?id=${_id}`,
        method: "PATCH",
        body: planData,
      }),
      invalidatesTags: (result, error, { _id }) => [
        { type: "SubscriptionPlan", id: _id },
        "SubscriptionPlan",
      ],
    }),

    deleteSubscriptionPlan: builder.mutation({
      query: (id) => ({
        url: `/admin/subscription-plans?id=${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["SubscriptionPlan", "Vendor"],
    }),

    renewPlan: builder.mutation({
      query: (data) => ({
        url: "/admin/subscription-renewal",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Vendor"],
    }),

    getSupplierOrders: builder.query({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.regionId && params.regionId !== 'all') queryParams.append('regionId', params.regionId);
        if (params.status && params.status !== 'all') queryParams.append('status', params.status);
        const queryString = queryParams.toString();
        return {
          url: `/admin/supplier-orders${queryString ? `?${queryString}` : ""}`,
          method: "GET"
        };
      },
      providesTags: ["Order"],
      transformResponse: (response) => (response && response.success ? response.data || [] : []),
    }),

    // Supplier Endpoints
    getSuppliers: builder.query({
      query: (params) => {
        const regionId = typeof params === 'string' ? params : params?.regionId;
        const queryParams = new URLSearchParams();
        if (regionId && regionId !== 'all') queryParams.append('regionId', regionId);
        const queryString = queryParams.toString();
        return {
          url: `/admin/suppliers${queryString ? `?${queryString}` : ""}`,
          method: "GET"
        };
      },
      providesTags: ["Supplier"],
    }),

    createSupplier: builder.mutation({
      query: (supplierData) => ({
        url: "/admin/suppliers",
        method: "POST",
        body: supplierData,
      }),
      invalidatesTags: ["Supplier"],
    }),

    registerSupplier: builder.mutation({
      query: (supplierData) => ({
        url: "/crm/supplier/register",
        method: "POST",
        body: supplierData,
      }),
      invalidatesTags: ["Supplier"],
    }),

    updateSupplier: builder.mutation({
      query: ({ id, ...supplierData }) => ({
        url: `/admin/suppliers`,
        method: "PUT",
        body: { id, ...supplierData },
      }),
      invalidatesTags: ["Supplier"],
    }),

    deleteSupplier: builder.mutation({
      query: (id) => ({
        url: `/admin/suppliers`,
        method: "DELETE",
        body: { id },
      }),
      invalidatesTags: ["Supplier"],
    }),

    updateSupplierStatus: builder.mutation({
      query: ({ id, status, rejectionReason }) => ({
        url: "/admin/suppliers",
        method: "PATCH",
        body: { id, status, rejectionReason },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Supplier", id },
        "Supplier",
      ],
    }),

    updateSupplierDocumentStatus: builder.mutation({
      query: ({ supplierId, documentType, status, rejectionReason }) => ({
        url: "/admin/suppliers",
        method: "PATCH",
        body: { supplierId, documentType, status, rejectionReason },
      }),
      invalidatesTags: (result, error, { supplierId }) => [
        { type: "Supplier", id: supplierId },
        "Supplier",
      ],
    }),


    // Categories
    getCategories: builder.query({
      query: (params) => {
        const { regionId } = params || {};
        return {
          url: "/admin/categories",
          method: "GET",
          params: regionId ? { regionId } : {}
        };
      },
      providesTags: ["Category"],
    }),

    createCategory: builder.mutation({
      query: (category) => ({
        url: "/admin/categories",
        method: "POST",
        body: category,
      }),
      invalidatesTags: ["Category"],
    }),

    updateCategory: builder.mutation({
      query: (category) => ({
        url: `/admin/categories`,
        method: "PUT",
        body: category,
      }),
      invalidatesTags: ["Category"],
    }),

    deleteCategory: builder.mutation({
      query: ({ id }) => ({
        url: `/admin/categories`,
        method: "DELETE",
        body: { id },
      }),
      invalidatesTags: ["Category"],
    }),

    // Services
    getServices: builder.query({
      query: () => ({ url: "/admin/services", method: "GET" }),
      providesTags: ["Service"],
    }),

    createService: builder.mutation({
      query: (service) => ({
        url: "/admin/services",
        method: "POST",
        body: service,
      }),
      invalidatesTags: ["Service"],
    }),

    updateService: builder.mutation({
      query: (service) => ({
        url: `/admin/services`,
        method: "PUT",
        body: service,
      }),
      invalidatesTags: ["Service"],
    }),

    deleteService: builder.mutation({
      query: ({ id }) => ({
        url: `/admin/services`,
        method: "DELETE",
        body: { id },
      }),
      invalidatesTags: ["Service"],
    }),

    // Product Masters - Admin creates master product templates
    getProductMasters: builder.query({
      query: () => ({ url: "/admin/product-masters", method: "GET" }),
      transformResponse: (response) => (response && response.success ? response.data || [] : []),
      providesTags: ["ProductMaster"],
    }),

    createProductMaster: builder.mutation({
      query: (productMaster) => ({
        url: "/admin/product-masters",
        method: "POST",
        body: productMaster,
      }),
      invalidatesTags: ["ProductMaster"],
    }),

    updateProductMaster: builder.mutation({
      query: (productMaster) => ({
        url: `/admin/product-masters`,
        method: "PUT",
        body: productMaster,
      }),
      invalidatesTags: ["ProductMaster"],
    }),

    deleteProductMaster: builder.mutation({
      query: ({ id }) => ({
        url: `/admin/product-masters`,
        method: "DELETE",
        body: { id },
      }),
      invalidatesTags: ["ProductMaster"],
    }),

    // Notifications
    getNotifications: builder.query({
      query: () => ({ url: "/admin/custompushnotification", method: "GET" }),
      providesTags: ["Notification"],
    }),

    createNotification: builder.mutation({
      query: (notification) => ({
        url: "/admin/custompushnotification",
        method: "POST",
        body: notification,
      }),
      invalidatesTags: ["Notification"],
    }),

    updateNotification: builder.mutation({
      query: (notification) => ({
        url: `/admin/custompushnotification`,
        method: "PUT",
        body: notification,
      }),
      invalidatesTags: ["Notification"],
    }),

    deleteNotification: builder.mutation({
      query: ({ _id }) => ({
        url: `/admin/custompushnotification`,
        method: "DELETE",
        body: { _id },
      }),
      invalidatesTags: ["Notification"],
    }),

    // Tax Fee Settings Endpoints
    getTaxFeeSettings: builder.query({
      query: () => ({ url: "/admin/tax-fees", method: "GET" }),
      providesTags: ["TaxFeeSettings"],
    }),

    updateTaxFeeSettings: builder.mutation({
      query: (settings) => ({
        url: "/admin/tax-fees",
        method: "PATCH",
        body: settings,
      }),
      invalidatesTags: ["TaxFeeSettings"],
    }),

    // FAQ Endpoints
    getFaqs: builder.query({
      query: () => "/admin/faqs",
      providesTags: ["Faq"],
    }),

    createFaq: builder.mutation({
      query: (faq) => ({
        url: "/admin/faqs",
        method: "POST",
        body: faq,
      }),
      invalidatesTags: ["Faq"],
    }),

    updateFaq: builder.mutation({
      query: ({ id, ...updates }) => ({
        url: "/admin/faqs",
        method: "PATCH",
        body: { id, ...updates },
      }),
      invalidatesTags: ["Faq"],
    }),

    deleteFaq: builder.mutation({
      query: (id) => ({
        url: "/admin/faqs",
        method: "DELETE",
        body: { id },
      }),
      invalidatesTags: ["Faq"],
    }),

    // Admin Clients Endpoints
    getAdminClients: builder.query({
      query: ({ vendorId, page = 1, limit = 100 } = {}) => {
        const params = new URLSearchParams();
        if (vendorId) params.append('vendorId', vendorId);
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        return { url: `/admin/clients?${params.toString()}`, method: "GET" };
      },
      providesTags: ["Client"],
      transformResponse: (response) => (response && response.success ? response.data || [] : []),
    }),

    // Admin Users Endpoints
    getAdminUsers: builder.query({
      query: ({ vendorId, regionId, page = 1, limit = 100 } = {}) => {
        const params = new URLSearchParams();
        if (vendorId) params.append('vendorId', vendorId);
        if (regionId && regionId !== 'all') params.append('regionId', regionId);
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        return { url: `/admin/users?${params.toString()}`, method: "GET" };
      },
      transformResponse: (response) => (response && response.success ? response.data || [] : []),
    }),

    // Admin Dashboard Endpoint
    getAdminDashboardStats: builder.query({
      query: (params) => ({
        url: "/admin/dashboard",
        method: "GET",
        params: params || {}
      }),
      transformResponse: (response) => (response && response.success ? (response.data || response) : {}),
    }),

    // Booking Summary Reports Endpoints
    getSellingServicesReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/booking-summary/selling-services",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["SellingServicesReport"],
      transformResponse: (response) => (response && response.success ? (response.data || response) : {}),
    }),

    getTotalBookingsReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/booking-summary/total-bookings",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["TotalBookingsReport"],
      transformResponse: (response) => (response && response.success ? (response.data || response) : {}),
    }),

    getCompletedBookingsReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/booking-summary/completed-bookings",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["CompletedBookingsReport"],
      transformResponse: (response) => (response && response.success ? (response.data || response) : {}),
    }),

    getCancellationReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/booking-summary/cancellation",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["CancellationReport"],
      transformResponse: (response) => (response && response.success ? response.data : {}),
    }),

    getSalesBySalonReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/booking-summary/sales-by-salon",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["SalesBySalonReport"],
      transformResponse: (response) => (response && response.success ? response.data : {}),
    }),

    getSalesByProductsReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/booking-summary/sales-by-products",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["SalesByProductsReport"],
      transformResponse: (response) => (response && response.success ? response.data : {}),
    }),

    // Consolidated Sales Report
    getConsolidatedSalesReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/Financial-Reports/salesreport",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["ConsolidatedSalesReport"],
      transformResponse: (response) => (response && response.success ? response.data : {}),
    }),

    // Subscription Report
    getSubscriptionReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/Financial-Reports/subscription-report",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["SubscriptionReport"],
      transformResponse: (response) => (response && response.success ? response.data : {}),
    }),

    // Marketing Campaign Report
    getMarketingCampaignReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/marketing-reports/campaigns",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["MarketingCampaignReport"],
      transformResponse: (response) => (response && response.success ? response.data : {}),
    }),

    // Sales by Brand Report
    getSalesByBrandReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/product-reports/sales-by-brand",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["SalesByBrandReport"],
      transformResponse: (response) => (response && response.success ? response.data : {}),
    }),

    // Sales by Category Report
    getSalesByCategoryReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/product-reports/sales-by-category",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["SalesByCategoryReport"],
      transformResponse: (response) => (response && response.success ? response.data : {}),
    }),

    // Vendor Payable Report
    getVendorPayableReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/settlementreport/vendor-payable",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["VendorPayableReport"],
      transformResponse: (response) => response,
    }),

    // Vendor Payout Settlement Report
    getVendorPayoutSettlementReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/settlementreport/vendor-payout",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["VendorPayoutSettlementReport"],
      transformResponse: (response) => response,
    }),

    // Vendor Payout Settlement Report Product
    getVendorPayoutSettlementReportProduct: builder.query({
      query: (params) => ({
        url: "/admin/reports/settlementreport/vendor-payout-product",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["VendorPayoutSettlementReportProduct"],
      transformResponse: (response) => response,
    }),

    // Vendor Payable to Admin Report Product
    getVendorPayableReportProduct: builder.query({
      query: (params) => ({
        url: "/admin/reports/settlementreport/vendor-payable-product",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["VendorPayableReportProduct"],
      transformResponse: (response) => response,
    }),

    // Referral Report
    getReferralReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/referral-reports/all-referrals",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["ReferralReport"],
      transformResponse: (response) => (response && response.success ? response.data : {}),
    }),

    // Settlement History Report
    getSettlementHistoryReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/settlementreport/history",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["SettlementHistoryReport"],
      transformResponse: (response) => (response && response.success ? response : {}),
    }),

    // Platform Collections Report
    getPlatformCollectionsReport: builder.query({
      query: (params) => ({
        url: "/admin/reports/platform-collections",
        method: "GET",
        params: params || {}
      }),
      providesTags: ["PlatformCollectionsReport"],
      transformResponse: (response) => (response && response.success ? response.data : {}),
    }),
    // Admin Product Categories 

    getAdminProductCategories: builder.query({
      query: () => ({ url: "/admin/product-categories", method: "GET" }),
      providesTags: ["AdminProductCategory"],
    }),
    createAdminProductCategory: builder.mutation({
      query: (category) => ({ url: "/admin/product-categories", method: "POST", body: category }),
      invalidatesTags: ["AdminProductCategory"],
    }),
    updateAdminProductCategory: builder.mutation({
      query: (category) => ({ url: "/admin/product-categories", method: "PUT", body: category }),
      invalidatesTags: ["AdminProductCategory"],
    }),
    deleteAdminProductCategory: builder.mutation({
      query: ({ id }) => ({ url: "/admin/product-categories", method: "DELETE", body: { id } }),
      invalidatesTags: ["AdminProductCategory"],
    }),


    // Product Approval
    // Removed old combined product approval endpoints - using separate vendor/supplier endpoints now

    // Vendor Product Approval (separate from general product approval)
    getVendorProductApprovals: builder.query({
      query: (regionId) => {
        const params = new URLSearchParams();
        if (regionId && regionId !== 'all') params.append('regionId', regionId);
        const queryString = params.toString();
        return {
          url: `/admin/product-approval/vendor${queryString ? `?${queryString}` : ""}`,
          method: "GET"
        };
      },
      providesTags: ["Product"],
    }),
    // Supplier Product Approval (separate from general product approval)
    getSupplierProductApprovals: builder.query({
      query: (regionId) => {
        const params = new URLSearchParams();
        if (regionId && regionId !== 'all') params.append('regionId', regionId);
        const queryString = params.toString();
        return {
          url: `/admin/product-approval/supplier${queryString ? `?${queryString}` : ""}`,
          method: "GET"
        };
      },
      providesTags: ["Product"],
    }),

    // Update Vendor Product Status
    updateVendorProductStatus: builder.mutation({
      query: ({ productId, status, rejectionReason }) => ({
        url: "/admin/product-approval/vendor",
        method: "PATCH",
        body: { productId, status, rejectionReason },
      }),
      invalidatesTags: ["Product", "CrmProducts"],
    }),

    // Update Supplier Product Status
    updateSupplierProductStatus: builder.mutation({
      query: ({ productId, status, rejectionReason }) => ({
        url: "/admin/product-approval/supplier",
        method: "PATCH",
        body: { productId, status, rejectionReason },
      }),
      invalidatesTags: ["Product", "CrmProducts"],
    }),
    //======================================================== CRM Endpoints ====================================================//
    // Wallet Endpoints (CRM)
    getCrmWallet: builder.query({
      query: (params) => ({
        url: `/crm/wallet?page=${params?.page || 1}&limit=${params?.limit || 10}`,
        method: "GET"
      }),
      providesTags: ["CrmWallet"],
    }),
    withdrawFromCrmWallet: builder.mutation({
      query: (body) => ({
        url: "/crm/wallet/withdraw",
        method: "POST",
        body
      }),
      invalidatesTags: ["CrmWallet"],
    }),

    // Vendor Endpoints
    vendorLogin: builder.mutation({
      query: (credentials) => ({ url: "/crm/auth/login", method: "POST", body: credentials }),
    }),
    vendorRegister: builder.mutation({
      query: (vendorData) => ({ url: "/crm/auth/register", method: "POST", body: vendorData }),
    }),
    getVendorServices: builder.query({
      query: ({ vendorId, page = 1, limit = 100, status = null, category = null }) => ({
        url: `/crm/services?vendorId=${vendorId}&page=${page}&limit=${limit}${status ? `&status=${status}` : ""}${category ? `&category=${category}` : ""}`,
        method: "GET",
      }),
      providesTags: ["VendorServices"],
    }),
    createVendorServices: builder.mutation({
      query: ({ vendor, services }) => ({ url: "/crm/services", method: "POST", body: { vendor, services } }),
      invalidatesTags: ["VendorServices"],
    }),
    updateVendorServices: builder.mutation({
      query: ({ vendor, services }) => ({ url: "/crm/services", method: "PUT", body: { vendor, services } }),
      invalidatesTags: ["VendorServices"],
    }),
    deleteVendorServices: builder.mutation({
      query: ({ vendor, serviceId }) => ({ url: "/crm/services", method: "DELETE", body: { vendor, serviceId } }),
      invalidatesTags: ["VendorServices"],
    }),
    getOffers: builder.query({ query: () => "/crm/offers", providesTags: ["Offer"] }),
    createOffer: builder.mutation({
      query: (body) => ({ url: "/crm/offers", method: "POST", body }),
      invalidatesTags: ["Offer"],
    }),
    updateOffer: builder.mutation({
      query: (body) => ({ url: "/crm/offers", method: "PUT", body }),
      invalidatesTags: ["Offer"],
    }),
    deleteOffer: builder.mutation({
      query: (id) => ({ url: "/crm/offers", method: "DELETE", body: { id } }),
      invalidatesTags: ["Offer"],
    }),
    getVendorNotifications: builder.query({
      query: ({ vendorId }) => ({ url: `/crm/notifications?vendorId=${vendorId}`, method: "GET" }),
      providesTags: ["VendorNotifications"],
    }),
    createVendorNotification: builder.mutation({
      query: (notification) => ({ url: "/crm/notifications", method: "POST", body: notification }),
      invalidatesTags: ["VendorNotifications"],
    }),
    deleteVendorNotification: builder.mutation({
      query: ({ notificationId }) => ({ url: "/crm/notifications", method: "DELETE", body: { notificationId } }),
      invalidatesTags: ["VendorNotifications"],
    }),

    // Add-On Endpoints
    getAddOns: builder.query({
      query: () => "/crm/add-ons",
      providesTags: ["AddOns"],
    }),
    createAddOn: builder.mutation({
      query: (body) => ({
        url: "/crm/add-ons",
        method: "POST",
        body,
      }),
      invalidatesTags: ["AddOns"],
    }),
    updateAddOn: builder.mutation({
      query: (body) => ({
        url: "/crm/add-ons",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["AddOns"],
    }),
    deleteAddOn: builder.mutation({
      query: (id) => ({
        url: `/crm/add-ons?id=${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["AddOns"],
    }),

    // Products endpoints
    getCrmProducts: builder.query({
      query: ({ vendorId } = {}) => ({
        url: "/crm/products",
        method: "GET",
        params: vendorId ? { vendorId } : {}
      }),
      providesTags: ["CrmProducts"],
      transformResponse: (response) => response.data || [],
    }),
    createCrmProduct: builder.mutation({
      query: (product) => ({ url: "/crm/products", method: "POST", body: product }),
      invalidatesTags: ["CrmProducts"],
    }),
    createBulkCrmProducts: builder.mutation({
      query: (products) => ({ url: "/crm/products", method: "POST", body: products }),
      invalidatesTags: ["CrmProducts"],
    }),
    updateCrmProduct: builder.mutation({
      query: (product) => ({ url: "/crm/products", method: "PUT", body: product }),
      invalidatesTags: ["CrmProducts"],
    }),
    deleteCrmProduct: builder.mutation({
      query: (data) => ({
        url: "/crm/products",
        method: "DELETE",
        body: typeof data === 'object' && data.id ? data : { id: data }
      }),
      invalidatesTags: ["CrmProducts"],
    }),
    getCrmProductMasters: builder.query({
      query: () => ({ url: "/crm/product-masters", method: "GET" }),
      transformResponse: (response) => (response && response.success ? response.data || [] : []),
      providesTags: ["ProductMaster"],
    }),


    // Inventory Endpoints
    adjustInventory: builder.mutation({
      query: (body) => ({
        url: "/crm/inventory/adjust",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Inventory", "CrmProducts"],
    }),

    getInventoryTransactions: builder.query({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params) {
          Object.keys(params).forEach(key => {
            if (params[key]) queryParams.append(key, params[key]);
          });
        }
        return {
          url: `/crm/inventory/transactions?${queryParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["Inventory"],
    }),

    getLowStockProducts: builder.query({
      query: (threshold) => ({
        url: `/crm/inventory/low-stock${threshold ? `?threshold=${threshold}` : ''}`,
        method: "GET",
      }),
      providesTags: ["Inventory", "CrmProducts"],
    }),

    // CRM Product Questions - Get all questions for vendor's products
    getCrmProductQuestions: builder.query({
      query: (filter = 'all') => ({ url: `/crm/product-questions?filter=${filter}`, method: "GET" }),
      providesTags: ["CrmProductQuestions"],
      transformResponse: (response) => response,
    }),

    // CRM Product Questions - Answer a question
    answerProductQuestion: builder.mutation({
      query: ({ questionId, answer, isPublished }) => ({
        url: `/crm/product-questions/${questionId}`,
        method: "PATCH",
        body: { answer, isPublished }
      }),
      invalidatesTags: ["CrmProductQuestions"],
    }),

    // CRM Product Questions - Delete a question
    deleteProductQuestion: builder.mutation({
      query: (questionId) => ({
        url: `/crm/product-questions/${questionId}`,
        method: "DELETE"
      }),
      invalidatesTags: ["CrmProductQuestions"],
    }),

    // Supplier Product Questions - Get all questions for supplier's products
    getSupplierProductQuestions: builder.query({
      query: (filter = 'all') => ({ url: `/crm/supplier/product-questions?filter=${filter}`, method: "GET" }),
      providesTags: ["SupplierProductQuestions"],
      transformResponse: (response) => response,
    }),

    // Supplier Product Questions - Answer a question
    answerSupplierProductQuestion: builder.mutation({
      query: ({ questionId, answer, isPublished }) => ({
        url: `/crm/supplier/product-questions`,
        method: "PATCH",
        body: { questionId, answer, isPublished }
      }),
      invalidatesTags: ["SupplierProductQuestions"],
    }),

    // Supplier Product Questions - Delete a question
    deleteSupplierProductQuestion: builder.mutation({
      query: (questionId) => ({
        url: `/crm/supplier/product-questions?questionId=${questionId}`,
        method: "DELETE"
      }),
      invalidatesTags: ["SupplierProductQuestions"],
    }),

    // CRM Reviews - Get all reviews for vendor's products/services/salons
    getCrmReviews: builder.query({
      query: ({ filter = 'all', entityType = 'all' }) => ({
        url: `/crm/reviews?filter=${filter}&entityType=${entityType}`,
        method: "GET"
      }),
      providesTags: ["CrmReviews"],
      transformResponse: (response) => response,
    }),

    // CRM Reviews - Approve/Reject a review
    approveReview: builder.mutation({
      query: ({ reviewId, isApproved }) => ({
        url: `/crm/reviews/${reviewId}`,
        method: "PATCH",
        body: { isApproved }
      }),
      invalidatesTags: ["CrmReviews"],
    }),

    // CRM Reviews - Delete a review
    deleteReview: builder.mutation({
      query: (reviewId) => ({ url: `/crm/reviews/${reviewId}`, method: "DELETE" }),
      invalidatesTags: ["CrmReviews"],
    }),

    // New endpoint to fetch all vendor products with origin 'Vendor'
    getAllVendorProducts: builder.query({
      query: () => ({ url: "/products", method: "GET" }),
      providesTags: ["CrmProducts"],
      transformResponse: (response) => response,
    }),

    // New endpoints for vendor product operations
    updateVendorProduct: builder.mutation({
      query: (product) => ({ url: "/crm/vendor/products", method: "PUT", body: product }),
      invalidatesTags: ["CrmProducts"],
    }),
    deleteVendorProduct: builder.mutation({
      query: (id) => ({ url: "/crm/vendor/products", method: "DELETE", body: { id } }),
      invalidatesTags: ["CrmProducts"],
    }),
    createVendorProduct: builder.mutation({
      query: (product) => ({ url: "/crm/vendor/products", method: "POST", body: product }),
      invalidatesTags: ["CrmProducts"],
    }),

    // Supplier Products & Profile
    getSupplierProducts: builder.query({
      query: () => ({ url: '/crm/supplier-products' }),
      providesTags: ['SupplierProducts'],
    }),
    getSupplierProfile: builder.query({
      query: (id) => `/crm/supplier-profile/${id}`,
      providesTags: (result, error, id) => [{ type: 'SupplierProfile', id }],
    }),

    // Add new endpoint for getting current supplier's profile
    getCurrentSupplierProfile: builder.query({
      query: () => ({ url: "/crm/supplier-profile", method: "GET" }),
      providesTags: ["Supplier"],
    }),

    // Add new endpoint for updating supplier profile
    updateSupplierProfile: builder.mutation({
      query: (supplierData) => ({
        url: "/crm/supplier-profile",
        method: "PUT",
        body: supplierData,
      }),
      invalidatesTags: ["Supplier"],
    }),

    // Orders
    getCrmOrders: builder.query({
      query: () => ({ url: '/crm/orders' }),
      providesTags: ['CrmOrder'],
    }),
    createCrmOrder: builder.mutation({
      query: (orderData) => ({ url: '/crm/orders', method: 'POST', body: orderData }),
      invalidatesTags: ['CrmOrder'],
    }),
    updateCrmOrder: builder.mutation({
      query: ({ orderId, ...updateData }) => ({
        url: '/crm/orders',
        method: 'PATCH',
        body: { orderId, ...updateData },
      }),
      invalidatesTags: ['CrmOrder'],
    }),

    // Online Customer Orders
    getCrmClientOrders: builder.query({
      query: () => ({ url: '/crm/client-orders' }),
      providesTags: ['CrmClientOrder'],
    }),
    updateCrmClientOrder: builder.mutation({
      query: ({ orderId, ...updateData }) => ({
        url: '/crm/client-orders',
        method: 'PATCH',
        body: { orderId, ...updateData },
      }),
      invalidatesTags: ['CrmClientOrder'],
    }),

    // shipping charge endpoints
    getShippingConfig: builder.query({
      query: () => ({ url: "/crm/shipping", method: "GET" }),
      providesTags: ["ShippingCharge"],
      transformResponse: (response) => response.data || response,
    }),
    updateShippingConfig: builder.mutation({
      query: (charge) => ({ url: "/crm/shipping", method: "PUT", body: charge }),
      invalidatesTags: ["ShippingCharge"],
      transformResponse: (response) => response.data || response,
    }),

    // Public shipping config endpoint
    getPublicShippingConfig: builder.query({
      query: (vendorId) => ({
        url: `/shipping${vendorId ? `?vendorId=${vendorId}` : ""}`,
        method: "GET"
      }),
      providesTags: ["ShippingCharge"],
      keepUnusedDataFor: 0, // Don't cache this data
      transformResponse: (response) => response.data || response,
    }),

    // product categories endpoints
    getProductCategories: builder.query({
      query: () => ({ url: "/crm/product-categories", method: "GET" }),
      providesTags: ["ProductCategory"],
    }),
    createProductCategory: builder.mutation({
      query: (category) => ({ url: "/crm/product-categories", method: "POST", body: category }),
      invalidatesTags: ["ProductCategory"],
    }),

    // Block Time Endpoints
    getBlockedTimes: builder.query({
      query: (staffId) => ({ url: `/crm/block-time/${staffId}`, method: 'GET' }),
      providesTags: ['BlockTime'],
    }),
    createBlockTime: builder.mutation({
      query: (blockTimeData) => ({
        url: '/crm/block-time',
        method: 'POST',
        body: blockTimeData,
      }),
      invalidatesTags: ['BlockTime'],
    }),
    deleteBlockTime: builder.mutation({
      query: (blockTimeId) => ({
        url: `/crm/block-time/${blockTimeId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['BlockTime'],
    }),

    // Staff Endpoints
    getStaff: builder.query({
      query: () => ({ url: "/crm/staff", method: "GET" }),
      providesTags: ["Staff"],
    }),
    createStaff: builder.mutation({
      query: (staff) => ({ url: "/crm/staff", method: "POST", body: staff }),
      invalidatesTags: ["Staff"],
    }),
    updateStaff: builder.mutation({
      query: (staff) => ({ url: "/crm/staff", method: "PUT", body: staff }),
      invalidatesTags: ["Staff"],
    }),
    deleteStaff: builder.mutation({
      query: (id) => ({ url: "/crm/staff", method: "DELETE", body: { id } }),
      invalidatesTags: ["Staff"],
    }),
    sendStaffCredentials: builder.mutation({
      query: (staffId) => ({
        url: "/crm/staff/send-credentials",
        method: "POST",
        body: { staffId },
      }),
    }),

    // Add-Ons Endpoints
    getAddOns: builder.query({
      query: () => ({ url: "/crm/add-ons", method: "GET" }),
      providesTags: ["AddOns"],
    }),
    createAddOn: builder.mutation({
      query: (addOn) => ({ url: "/crm/add-ons", method: "POST", body: addOn }),
      invalidatesTags: ["AddOns"],
    }),
    getStaffEarnings: builder.query({
      query: ({ id, startDate, endDate }) => {
        let url = `/crm/staff/earnings/${id}`;
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;
        return { url, method: "GET" };
      },
      providesTags: ["Staff"],
    }),
    recordStaffPayout: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/crm/staff/earnings/${id}`, method: "POST", body }),
      invalidatesTags: ["Staff"],
    }),
    updateAddOn: builder.mutation({
      query: (addOn) => ({ url: "/crm/add-ons", method: "PUT", body: addOn }),
      invalidatesTags: ["AddOns"],
    }),
    deleteAddOn: builder.mutation({
      query: (id) => ({ url: `/crm/add-ons?id=${id}`, method: "DELETE" }),
      invalidatesTags: ["AddOns"],
    }),

    // Expense Endpoints
    getExpenses: builder.query({
      query: () => ({ url: "/crm/expenses", method: "GET" }),
      providesTags: ["Expense"],
    }),
    createExpense: builder.mutation({
      query: (expense) => ({ url: "/crm/expenses", method: "POST", body: expense }),
      invalidatesTags: ["Expense"],
    }),
    updateExpense: builder.mutation({
      query: (expense) => ({ url: "/crm/expenses", method: "PUT", body: expense }),
      invalidatesTags: ["Expense"],
    }),
    deleteExpense: builder.mutation({
      query: (id) => ({ url: "/crm/expenses", method: "DELETE", body: { id } }),
      invalidatesTags: ["Expense"],
    }),
    getCrmExpenseTypes: builder.query({
      query: () => ({ url: "/crm/superdata?type=expenseType", method: "GET" }),
      providesTags: ["SuperData"],
    }),
    getCrmPaymentModes: builder.query({
      query: () => ({ url: "/crm/superdata?type=paymentMode", method: "GET" }),
      providesTags: ["SuperData"],
    }),

    //working hours endpoint
    getWorkingHours: builder.query({
      query: () => ({ url: "/crm/workinghours", method: "GET" }),
      providesTags: ["WorkingHours"],
    }),
    updateWorkingHours: builder.mutation({
      query: (workingHours) => ({ url: "/crm/workinghours", method: "PUT", body: workingHours }),
      invalidatesTags: ["WorkingHours", "Staff"],
    }),
    addSpecialHours: builder.mutation({
      query: (specialHours) => ({ url: "/crm/workinghours", method: "POST", body: specialHours }),
      invalidatesTags: ["WorkingHours", "Staff"],
    }),
    deleteSpecialHours: builder.mutation({
      query: (id) => ({ url: `/crm/workinghours?id=${id}`, method: "DELETE" }),
      invalidatesTags: ["WorkingHours", "Staff"],
    }),

    // appointments endpoints
    getAppointments: builder.query({
      query: () => ({ url: "/crm/appointments", method: "GET" }),
      providesTags: (result = [], error, arg) => ['Appointments', ...result.map(({ id }) => ({ type: 'Appointment', id }))],
    }),
    createAppointment: builder.mutation({
      query: (appointment) => ({ url: "/crm/appointments", method: "POST", body: appointment }),
      invalidatesTags: ['Appointments'],
    }),
    updateAppointment: builder.mutation({
      query: (appointmentData) => {
        const { _id, ...updates } = appointmentData;

        return {
          url: `/crm/appointments/${_id}`,
          method: "PUT",
          body: updates,
        };
      },
      invalidatesTags: (result, error, { _id }) => [
        { type: 'Appointment', id: _id },
        'Appointments'
      ],
    }),
    updateAppointmentStatus: builder.mutation({
      query: ({ id, status, cancellationReason }) => ({ url: `/crm/appointments`, method: "PATCH", body: { _id: id, status, cancellationReason } }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Appointment', id }, 'Appointments'],
    }),
    deleteAppointment: builder.mutation({
      query: (id) => ({ url: `/crm/appointments/${id}`, method: "DELETE" }),
      invalidatesTags: ['Appointments'],
    }),

    // Client Endpoints
    getClients: builder.query({
      query: ({ search, status, page = 1, limit = 100, source = 'all' } = {}) => {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (status) params.append('status', status);
        if (source && source !== 'all') params.append('source', source);
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        return { url: `/crm/clients?${params.toString()}`, method: "GET" };
      },
      providesTags: ["Client"],
      transformResponse: (response) => (response && response.success ? response.data || [] : []),
    }),
    createClient: builder.mutation({
      query: (client) => ({ url: "/crm/clients", method: "POST", body: client }),
      invalidatesTags: ["Client"],
    }),
    updateClient: builder.mutation({
      query: (client) => ({ url: "/crm/clients", method: "PUT", body: client }),
      invalidatesTags: ["Client"],
    }),
    deleteClient: builder.mutation({
      query: (id) => ({ url: "/crm/clients", method: "DELETE", body: { id } }),
      invalidatesTags: ["Client"],
    }),

    // Vendor Profile Endpoints
    getVendorProfile: builder.query({
      query: () => ({ url: "/crm/vendor", method: "GET" }),
      providesTags: ["Vendor"],
    }),

    updateVendorProfile: builder.mutation({
      query: (vendorData) => ({ url: "/crm/vendor", method: "PUT", body: vendorData }),
      invalidatesTags: ["Vendor"],
    }),

    // Doctor Profile Endpoints
    getDoctorProfile: builder.query({
      query: () => ({ url: "/crm/doctor-profile", method: "GET" }),
      providesTags: ["doctors"],
    }),

    updateDoctorProfile: builder.mutation({
      query: (doctorData) => ({ url: "/crm/doctor-profile", method: "PUT", body: doctorData }),
      invalidatesTags: ["doctors"],
    }),

    // Doctor Working Hours Endpoints (Web - for booking)
    getDoctorWorkingHours: builder.query({
      query: (doctorId) => ({ url: `/api/doctor/working-hours?doctorId=${doctorId}`, method: 'GET' }),
      providesTags: ['DoctorWorkingHours'],
    }),
    updateDoctorWorkingHours: builder.mutation({
      query: ({ doctorId, hours }) => ({ url: `/api/doctor/working-hours`, method: 'PUT', body: { doctorId, hours } }),
      invalidatesTags: ['DoctorWorkingHours'],
    }),

    // Doctor Working Hours Endpoints (CRM - for timetable management)
    getCrmDoctorWorkingHours: builder.query({
      query: () => ({ url: `/crm/doctor-workinghours`, method: 'GET' }),
      providesTags: ['CrmDoctorWorkingHours'],
    }),
    updateCrmDoctorWorkingHours: builder.mutation({
      query: (workingHours) => ({ url: `/crm/doctor-workinghours`, method: 'PUT', body: workingHours }),
      invalidatesTags: ['CrmDoctorWorkingHours'],
    }),
    addCrmDoctorSpecialHours: builder.mutation({
      query: (specialHours) => ({ url: `/crm/doctor-workinghours`, method: 'POST', body: specialHours }),
      invalidatesTags: ['CrmDoctorWorkingHours'],
    }),
    removeCrmDoctorSpecialHours: builder.mutation({
      query: (date) => ({ url: `/crm/doctor-workinghours?date=${date}`, method: 'DELETE' }),
      invalidatesTags: ['CrmDoctorWorkingHours'],
    }),

    //subscription renewal
    changePlan: builder.mutation({
      query: (data) => ({ url: `/crm/subscription`, method: "POST", body: data }),
      invalidatesTags: ["SubscriptionPlan", "Vendor", "User"],
    }),
    renewPlan: builder.mutation({
      query: (data) => ({ url: `/crm/subscription/renew`, method: "POST", body: data }),
      invalidatesTags: ["SubscriptionPlan", "Vendor", "User"],
    }),

    // CRM SMS Packages Endpoints
    getCrmSmsPackages: builder.query({
      query: () => ({ url: "/crm/sms-packages", method: "GET" }),
      providesTags: ["CrmSmsPackage"],
    }),
    getCrmCampaigns: builder.query({
      query: () => ({ url: "/crm/campaigns", method: "GET" }),
      providesTags: ["CrmCampaign"],
    }),
    createCrmCampaign: builder.mutation({
      query: (campaign) => ({ url: "/crm/campaigns", method: "POST", body: campaign }),
      invalidatesTags: ["CrmCampaign"],
    }),
    updateCrmCampaign: builder.mutation({
      query: (campaign) => ({ url: "/crm/campaigns", method: "PUT", body: campaign }),
      invalidatesTags: ["CrmCampaign"],
    }),
    getCrmSocialMediaTemplates: builder.query({
      query: () => ({ url: "/crm/social-media-templates", method: "GET" }),
      providesTags: ["CrmSocialMediaTemplate"],
      transformResponse: (response) => {
        const templates = response?.data || [];
        const total = response?.total || templates.length;
        return { templates, total };
      }
    }),
    saveCustomizedTemplate: builder.mutation({
      query: (templateData) => ({ url: "/crm/social-media-templates", method: "POST", body: templateData }),
      invalidatesTags: ["CrmSocialMediaTemplate"],
    }),
    deleteCustomizedTemplate: builder.mutation({
      query: (id) => ({ url: `/crm/social-media-templates?id=${id}`, method: "DELETE" }),
      invalidatesTags: ["CrmSocialMediaTemplate"],
    }),

    // CRM SMS Purchase Endpoints
    purchaseSmsPackage: builder.mutation({
      query: (packageData) => ({ url: "/crm/sms-purchase", method: "POST", body: packageData }),
      invalidatesTags: ["Vendor"],
    }),
    getSmsPurchaseHistory: builder.query({
      query: (params) => ({
        url: "/crm/sms-purchase",
        method: "GET",
        params
      }),
      providesTags: ["Vendor"],
    }),
    getSmsBalance: builder.query({
      query: () => ({
        url: "/crm/sms-balance",
        method: "GET"
      }),
      providesTags: ["Vendor"],
    }),

    // Cart Endpoints (CRM)
    getCart: builder.query({
      query: () => ({ url: "/crm/cart", method: "GET" }),
      providesTags: ["Cart"],
    }),
    addToCart: builder.mutation({
      query: (item) => ({ url: "/crm/cart", method: "POST", body: item }),
      invalidatesTags: ["Cart"],
    }),
    updateCartItem: builder.mutation({
      query: ({ productId, quantity }) => ({ url: "/crm/cart", method: "PUT", body: { productId, quantity } }),
      invalidatesTags: ["Cart"],
    }),
    removeFromCart: builder.mutation({
      query: (productId) => ({ url: "/crm/cart", method: "DELETE", body: { productId } }),
      invalidatesTags: ["Cart"],
    }),

    // Client Cart Endpoints (Web App)
    getClientCart: builder.query({
      query: () => ({ url: "/client/cart", method: "GET" }),
      providesTags: ["ClientCart"],
    }),
    addToClientCart: builder.mutation({
      query: (item) => ({ url: "/client/cart", method: "POST", body: item }),
      invalidatesTags: ["ClientCart"],
    }),
    updateClientCartItem: builder.mutation({
      query: ({ productId, quantity }) => ({ url: "/client/cart", method: "PUT", body: { productId, quantity } }),
      invalidatesTags: ["ClientCart"],
    }),
    removeFromClientCart: builder.mutation({
      query: ({ productId }) => ({ url: "/client/cart", method: "DELETE", body: { productId } }),
      invalidatesTags: ["ClientCart"],
    }),

    // Client Referrals Endpoint (Web App - for customers)
    getClientReferrals: builder.query({
      query: () => ({ url: "/client/referrals", method: "GET" }),
      providesTags: ["ClientReferrals"],
    }),

    // Claim Referral Bonus Endpoint (Web App - for customers)
    claimReferralBonus: builder.mutation({
      query: (data) => ({ url: "/client/referrals", method: "POST", body: data }),
      invalidatesTags: ["ClientReferrals", "ClientWallet"],
    }),

    // Client Wallet Endpoints (Web App - for customers)
    getClientWallet: builder.query({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append("page", params.page);
        if (params.limit) queryParams.append("limit", params.limit);
        if (params.type) queryParams.append("type", params.type);
        if (params.source) queryParams.append("source", params.source);
        if (params.status) queryParams.append("status", params.status);
        const queryString = queryParams.toString();
        return { url: `/client/wallet${queryString ? `?${queryString}` : ""}`, method: "GET" };
      },
      providesTags: ["ClientWallet"],
    }),
    addMoneyToWallet: builder.mutation({
      query: (data) => ({ url: "/client/wallet/add-money", method: "POST", body: data }),
      invalidatesTags: ["ClientWallet"],
    }),
    verifyWalletPayment: builder.mutation({
      query: (data) => ({ url: "/client/wallet/verify-payment", method: "POST", body: data }),
      invalidatesTags: ["ClientWallet"],
    }),
    withdrawFromWallet: builder.mutation({
      query: (data) => ({ url: "/client/wallet/withdraw", method: "POST", body: data }),
      invalidatesTags: ["ClientWallet", "ClientWithdrawals"],
    }),
    getWithdrawalHistory: builder.query({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append("page", params.page);
        if (params.limit) queryParams.append("limit", params.limit);
        if (params.status) queryParams.append("status", params.status);
        const queryString = queryParams.toString();
        return { url: `/client/wallet/withdraw${queryString ? `?${queryString}` : ""}`, method: "GET" };
      },
      providesTags: ["ClientWithdrawals"],
    }),

    // Doctor Wishlist Endpoints (Web App)
    getDoctorWishlist: builder.query({
      query: () => ({ url: "/client/doctor-wishlist", method: "GET" }),
      providesTags: ["DoctorWishlist"],
    }),
    checkDoctorWishlistStatus: builder.query({
      query: (doctorId) => ({ url: `/client/doctor-wishlist/${doctorId}`, method: "GET" }),
      providesTags: (result, error, doctorId) => [{ type: "DoctorWishlist", id: doctorId }],
    }),
    addDoctorToWishlist: builder.mutation({
      query: (doctorId) => ({ url: "/client/doctor-wishlist", method: "POST", body: { doctorId } }),
      invalidatesTags: ["DoctorWishlist"],
    }),
    removeDoctorFromWishlist: builder.mutation({
      query: (doctorId) => ({ url: `/client/doctor-wishlist/${doctorId}`, method: "DELETE" }),
      invalidatesTags: ["DoctorWishlist"],
    }),

    // Public Tax Fee Settings Endpoint (Web App - no authentication required)
    getPublicTaxFeeSettings: builder.query({
      query: () => ({ url: "/client/tax-fees", method: "GET" }),
      providesTags: ["TaxFeeSettings"],
    }),

    // Web App Login
    userLogin: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),

    // Patient Endpoints
    getPatients: builder.query({
      query: () => ({ url: "/crm/patients", method: "GET" }),
      providesTags: ["Patient"],
    }),
    createPatient: builder.mutation({
      query: (patient) => ({
        url: "/crm/patients",
        method: "POST",
        body: patient,
      }),
      invalidatesTags: ["Patient"],
    }),
    updatePatient: builder.mutation({
      query: (patient) => ({
        url: "/crm/patients",
        method: "PUT",
        body: patient,
      }),
      invalidatesTags: ["Patient"],
    }),
    deletePatient: builder.mutation({
      query: (id) => ({
        url: "/crm/patients",
        method: "DELETE",
        body: { id },
      }),
      invalidatesTags: ["Patient"],
    }),
    // Billing Endpoints
    createBilling: builder.mutation({
      query: (billingData) => ({
        url: "/crm/billing",
        method: "POST",
        body: billingData,
      }),
      invalidatesTags: ["Billing"],
    }),
    getBillingRecords: builder.query({
      query: ({ vendorId, startDate, endDate, page = 1, limit = 50 } = {}) => {
        const params = new URLSearchParams();
        if (vendorId) params.append('vendorId', vendorId);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        params.append('page', (page || 1).toString());
        params.append('limit', (limit || 50).toString());
        return { url: `/crm/billing?${params.toString()}`, method: "GET" };
      },
      providesTags: ["Billing"],
    }),
    getBillingById: builder.query({
      query: (id) => ({ url: `/crm/billing/${id}`, method: "GET" }),
      providesTags: (result, error, id) => [{ type: "Billing", id }],
    }),
    updateBilling: builder.mutation({
      query: (billingData) => ({
        url: "/crm/billing",
        method: "PUT",
        body: billingData,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Billing", id },
        "Billing",
      ],
    }),

    // Add the delete billing mutation
    deleteBilling: builder.mutation({
      query: (id) => ({
        url: "/crm/billing",
        method: "DELETE",
        body: { id },
      }),
      invalidatesTags: ["Billing"],
    }),

    // Doctor Consultation Endpoints (Web App - Physical & Video Consultations)
    getConsultations: builder.query({
      query: ({ doctorId, patientId, userId, phoneNumber, status, consultationType, startDate, endDate, page = 1, limit = 50 } = {}) => {
        const params = new URLSearchParams();
        if (doctorId) params.append('doctorId', doctorId);
        if (patientId) params.append('patientId', patientId);
        if (userId) params.append('userId', userId);
        if (phoneNumber) params.append('phoneNumber', phoneNumber);
        if (status) params.append('status', status);
        if (consultationType) params.append('consultationType', consultationType);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        return { url: `/consultations?${params.toString()}`, method: "GET" };
      },
      providesTags: (result = []) => [
        'Consultations',
        ...((result.data?.consultations || []).map(({ _id }) => ({ type: 'Consultation', id: _id })))
      ],
    }),
    getBookedSlots: builder.query({
      query: ({ doctorId, date }) => {
        const params = new URLSearchParams();
        if (doctorId) params.append('doctorId', doctorId);
        if (date) params.append('date', date);
        return { url: `/consultations/booked-slots?${params.toString()}`, method: "GET" };
      },
      providesTags: ['Consultations'],
    }),
    getConsultationById: builder.query({
      query: (id) => ({ url: `/consultations/${id}`, method: "GET" }),
      providesTags: (result, error, id) => [{ type: 'Consultation', id }],
    }),
    createConsultation: builder.mutation({
      query: (consultationData) => ({
        url: "/consultations",
        method: "POST",
        body: consultationData,
      }),
      invalidatesTags: ['Consultations'], // This will also refetch booked slots
    }),
    updateConsultation: builder.mutation({
      query: ({ consultationId, ...updates }) => ({
        url: "/consultations",
        method: "PUT",
        body: { consultationId, ...updates },
      }),
      invalidatesTags: (result, error, { consultationId }) => [
        { type: 'Consultation', id: consultationId },
        'Consultations'
      ],
    }),
    cancelConsultation: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/consultations?id=${id}&reason=${encodeURIComponent(reason || 'Cancelled by user')}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Consultation', id },
        'Consultations'
      ],
    }),

    getClientOrders: builder.query({
      query: () => ({ url: "/client/orders", method: "GET" }),
      providesTags: ["ClientOrder"],
    }),
    createClientOrder: builder.mutation({
      query: (orderData) => ({ url: "/client/orders", method: "POST", body: orderData }),
      invalidatesTags: ["ClientOrder"],
    }),
    createPaymentOrder: builder.mutation({
      query: (paymentData) => ({ url: "/payments/create-order", method: "POST", body: paymentData }),
    }),
    verifyPayment: builder.mutation({
      query: (verificationData) => ({ url: "/payments/verify", method: "POST", body: verificationData }),
    }),

    // Public Appointment Endpoints
    getPublicAppointments: builder.query({
      query: ({ vendorId, staffId, date, startDate, endDate, userId }) => {
        const params = new URLSearchParams();
        if (vendorId) params.append('vendorId', vendorId);
        if (staffId) params.append('staffId', staffId);
        if (date) params.append('date', date);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (userId) params.append('userId', userId);
        // Add cache buster
        params.append('_t', Date.now().toString());

        return {
          url: `/appointments?${params.toString()}`,
          method: "GET"
        };
      },
      providesTags: (result, error, arg) => [
        'PublicAppointments',
        { type: 'PublicAppointments', id: `${arg.vendorId || 'all'}-${arg.date || 'all'}` }
      ],
      // DISABLE ALL CACHING - always fetch fresh data
      keepUnusedDataFor: 0,
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }),
    createPublicAppointment: builder.mutation({
      query: (appointmentData) => ({ url: "/appointments", method: "POST", body: appointmentData }),
      invalidatesTags: ['PublicAppointments'],
      // Force immediate refetch after mutation
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          // Invalidate all appointment queries
          dispatch(glowvitaApi.util.invalidateTags(['PublicAppointments']));
        } catch { }
      },
    }),



    // Confirm Booking Mutation (uses main booking endpoint)
    confirmBooking: builder.mutation({
      query: (confirmationData) => ({
        url: "/booking/confirm",
        method: "POST",
        body: confirmationData
      }),
      invalidatesTags: ['PublicAppointments'],
    }),

    // Cancel Booking Mutation
    cancelBooking: builder.mutation({
      query: ({ appointmentId, reason }) => ({
        url: "/booking/booking",
        method: "DELETE",
        body: { appointmentId, reason }
      }),
      invalidatesTags: ['PublicAppointments', 'Appointments'],
    }),

    // Fetch invoice for a specific appointment (Web - for clients)
    getAppointmentInvoice: builder.query({
      query: (appointmentId) => ({
        url: `/invoice/${appointmentId}`,
        method: "GET",
      }),
      providesTags: (result, error, appointmentId) => [
        { type: 'AppointmentInvoice', id: appointmentId }
      ],
    }),

    // Acquire slot lock for preventing concurrent bookings
    acquireSlotLock: builder.mutation({
      query: (lockData) => ({
        url: "/booking/lock",
        method: "POST",
        body: lockData
      }),
      invalidatesTags: ['AvailableSlots'],
      async onQueryStarted(lockData, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Optimistic update: remove locked slot from cache
          dispatch(
            api.util.updateQueryData('getAvailableSlots',
              { vendorId: lockData.vendorId, date: lockData.date },
              (draft) => {
                return draft.filter(slot => slot.startTime !== lockData.startTime);
              }
            )
          );
        } catch { }
      },
    }),

    // Release slot lock
    releaseSlotLock: builder.mutation({
      query: ({ lockToken }) => ({
        url: "/booking/release-lock",
        method: "POST",
        body: { lockToken }
      }),
      invalidatesTags: ['AvailableSlots'],
    }),

    // Get available slots with caching
    getAvailableSlots: builder.query({
      query: ({ vendorId, staffId, serviceIds, addOnIds, date, isHomeService, location }) => {
        const params = new URLSearchParams({
          vendorId,
          staffId: staffId || 'any',
          ...(serviceIds && { serviceIds: Array.isArray(serviceIds) ? serviceIds.join(',') : serviceIds }),
          ...(addOnIds && { addOnIds: Array.isArray(addOnIds) ? addOnIds.join(',') : addOnIds }),
          date: date,
          isHomeService: isHomeService?.toString() || 'false',
          ...(location?.lat && { lat: location.lat.toString() }),
          ...(location?.lng && { lng: location.lng.toString() })
        });
        return {
          url: `/booking/slots?${params.toString()}`,
          method: "GET"
        };
      },
      providesTags: ['AvailableSlots'],
      keepUnusedDataFor: 180, // 3 minutes cache
    }),


    // Lock Wedding Package Mutation
    lockWeddingPackage: builder.mutation({
      query: (lockData) => ({
        url: "/scheduling/wedding-package",
        method: "POST",
        body: lockData
      }),
    }),

    // Public Wedding Packages Endpoint
    getPublicVendorWeddingPackages: builder.query({
      query: (vendorId) => ({ url: `/wedding-packages/vendor/${vendorId}`, method: "GET" }),
      providesTags: ["PublicVendorWeddingPackages"],
      transformResponse: (response) => {
        console.log("🔍 Redux transformResponse - raw response:", response);
        console.log("🔍 Redux transformResponse - first package keys:", response?.data?.[0] ? Object.keys(response.data[0]) : "no data");
        return response;
      },
    }),

    // CRM Wedding Packages Endpoints
    getVendorWeddingPackages: builder.query({
      query: (vendorId) => ({ url: `/crm/wedding-packages`, method: "GET" }),
      providesTags: ["VendorWeddingPackages"],
      transformResponse: (response) => response,
    }),

    createWeddingPackage: builder.mutation({
      query: (packageData) => ({
        url: "/crm/wedding-packages",
        method: "POST",
        body: packageData,
      }),
      invalidatesTags: ["VendorWeddingPackages", "PublicVendorWeddingPackages"],
    }),

    updateWeddingPackage: builder.mutation({
      query: ({ packageId, ...packageData }) => ({
        url: `/crm/wedding-packages`,
        method: "PUT",
        body: { packageId, ...packageData },
      }),
      invalidatesTags: ["VendorWeddingPackages", "PublicVendorWeddingPackages"],
    }),

    deleteWeddingPackage: builder.mutation({
      query: (packageId) => ({
        url: `/crm/wedding-packages`,
        method: "DELETE",
        body: { packageId },
      }),
      invalidatesTags: ["VendorWeddingPackages", "PublicVendorWeddingPackages"],
    }),

    // Payment Collection Endpoint
    collectPayment: builder.mutation({
      query: (paymentData) => ({
        url: "/crm/payments/collect",
        method: "POST",
        body: paymentData,
      }),
      invalidatesTags: ['Appointments'],
    }),

    // Payment Collections Endpoint
    getPaymentCollections: builder.query({
      query: (appointmentId) => ({
        url: `/crm/payments/collections?appointmentId=${appointmentId}`,
        method: "GET",
      }),
      providesTags: ['PaymentCollections'],
    }),

    // Admin Reports - Supplier Product Reviews
    getSupplierProductReviewsReport: builder.query({
      query: () => ({
        url: "/admin/reports/supplier-product-reviews",
        method: "GET"
      }),
      providesTags: ["AdminReports"],
      transformResponse: (response) => response,
    }),

    // Supplier Reports - CRM Panel
    // Total Orders Report
    getSupplierTotalOrdersReport: builder.query({
      query: () => ({
        url: "/crm/reports/supplier/total-orders",
        method: "GET"
      }),
      providesTags: ["SupplierReports"],
      transformResponse: (response) => response,
    }),

    // Pending Orders Report
    getSupplierPendingOrdersReport: builder.query({
      query: () => ({
        url: "/crm/reports/supplier/pending-orders",
        method: "GET"
      }),
      providesTags: ["SupplierReports"],
      transformResponse: (response) => response,
    }),

    // Completed Orders Report
    getSupplierCompletedOrdersReport: builder.query({
      query: () => ({
        url: "/crm/reports/supplier/completed-orders",
        method: "GET"
      }),
      providesTags: ["SupplierReports"],
      transformResponse: (response) => response,
    }),

    // Confirmed Orders Report
    getSupplierConfirmedOrdersReport: builder.query({
      query: () => ({
        url: "/crm/reports/supplier/confirmed-orders",
        method: "GET"
      }),
      providesTags: ["SupplierReports"],
      transformResponse: (response) => response,
    }),

    // Platform Collections Report
    getSupplierPlatformCollectionsReport: builder.query({
      query: () => ({
        url: "/crm/reports/supplier/platform-collections",
        method: "GET"
      }),
      providesTags: ["SupplierReports"],
      transformResponse: (response) => response,
    }),

    // Product Sales Report
    getSupplierProductSalesReport: builder.query({
      query: ({ product, category, brand } = {}) => {
        const params = new URLSearchParams();
        if (product) params.append('product', product);
        if (category) params.append('category', category);
        if (brand) params.append('brand', brand);
        return {
          url: `/crm/reports/supplier/product-sales?${params.toString()}`,
          method: "GET"
        };
      },
      providesTags: ["SupplierReports"],
      transformResponse: (response) => response,
    }),

    // Appointment Report Endpoints
    getAllAppointmentsReport: builder.query({
      query: ({ period = 'all', startDate, endDate, client, service, staff, status, bookingType }) => {
        const params = new URLSearchParams();
        params.append('period', period);
        if ((period === 'custom' || period === 'today' || period === 'yesterday') && startDate && endDate) {
          params.append('startDate', startDate.toISOString());
          params.append('endDate', endDate.toISOString());
        }
        // Add additional filter parameters
        if (client) params.append('client', client);
        if (service) params.append('service', service);
        if (staff) params.append('staff', staff);
        if (status) params.append('status', status);
        if (bookingType) params.append('bookingType', bookingType);
        return { url: `/crm/vendor/reports/all-appointments?${params.toString()}`, method: "GET" };
      },
      providesTags: ["Appointments"],
    }), getSummaryByServiceReport: builder.query({
      query: ({ period = 'all', startDate, endDate, client, service, staff, status, bookingType }) => {
        const params = new URLSearchParams();
        params.append('period', period);
        if ((period === 'custom' || period === 'today' || period === 'yesterday') && startDate && endDate) {
          params.append('startDate', startDate.toISOString());
          params.append('endDate', endDate.toISOString());
        }
        // Add additional filter parameters
        if (client) params.append('client', client);
        if (service) params.append('service', service);
        if (staff) params.append('staff', staff);
        if (status) params.append('status', status);
        if (bookingType) params.append('bookingType', bookingType);
        return { url: `/crm/vendor/reports/summary-by-service?${params.toString()}`, method: "GET" };
      },
      providesTags: ["Appointments"],
    }), getCompletedAppointmentsReport: builder.query({
      query: ({ period = 'all', startDate, endDate, client, service, staff, status, bookingType }) => {
        const params = new URLSearchParams();
        params.append('period', period);
        if ((period === 'custom' || period === 'today' || period === 'yesterday') && startDate && endDate) {
          params.append('startDate', startDate.toISOString());
          params.append('endDate', endDate.toISOString());
        }
        // Add additional filter parameters
        if (client) params.append('client', client);
        if (service) params.append('service', service);
        if (staff) params.append('staff', staff);
        if (status) params.append('status', status);
        if (bookingType) params.append('bookingType', bookingType);
        return { url: `/crm/vendor/reports/completed-appointments?${params.toString()}`, method: "GET" };
      },
      providesTags: ["Appointments"],
    }),
    getCancelledAppointmentsReport: builder.query({
      query: ({ period = 'all', startDate, endDate, client, service, staff, status, bookingType }) => {
        const params = new URLSearchParams();
        params.append('period', period);
        if ((period === 'custom' || period === 'today' || period === 'yesterday') && startDate && endDate) {
          params.append('startDate', startDate.toISOString());
          params.append('endDate', endDate.toISOString());
        }
        // Add additional filter parameters
        if (client) params.append('client', client);
        if (service) params.append('service', service);
        if (staff) params.append('staff', staff);
        if (status) params.append('status', status);
        if (bookingType) params.append('bookingType', bookingType);
        return { url: `/crm/vendor/reports/cancelled-appointments?${params.toString()}`, method: "GET" };
      },
      providesTags: ["Appointments"],
    }),

    // Sales Report Endpoints
    getSalesByServiceReport: builder.query({
      query: ({ period = 'all', startDate, endDate, client, service, staff, status, bookingType }) => {
        const params = new URLSearchParams();
        params.append('period', period);
        if ((period === 'custom' || period === 'today' || period === 'yesterday') && startDate && endDate) {
          params.append('startDate', startDate.toISOString());
          params.append('endDate', endDate.toISOString());
        }
        // Add additional filter parameters
        if (client) params.append('client', client);
        if (service) params.append('service', service);
        if (staff) params.append('staff', staff);
        if (status) params.append('status', status);
        if (bookingType) params.append('bookingType', bookingType);
        return { url: `/crm/vendor/reports/sales-by-service?${params.toString()}`, method: "GET" };
      },
      providesTags: ["Appointments"],
    }),
    getSalesByCustomerReport: builder.query({
      query: ({ period = 'all', startDate, endDate, client, service, staff, status, bookingType }) => {
        const params = new URLSearchParams();
        params.append('period', period);
        if ((period === 'custom' || period === 'today' || period === 'yesterday') && startDate && endDate) {
          params.append('startDate', startDate.toISOString());
          params.append('endDate', endDate.toISOString());
        }
        // Add additional filter parameters
        if (client) params.append('client', client);
        if (service) params.append('service', service);
        if (staff) params.append('staff', staff);
        if (status) params.append('status', status);
        if (bookingType) params.append('bookingType', bookingType);
        return { url: `/crm/vendor/reports/sales-by-customer?${params.toString()}`, method: "GET" };
      },
      providesTags: ["Appointments"],
    }),

    // Product Summary Report
    getProductSummaryReport: builder.query({
      query: ({ product, category, brand, status, isActive }) => {
        const params = new URLSearchParams();
        // Add filter parameters
        if (product) params.append('product', product);
        if (category) params.append('category', category);
        if (brand) params.append('brand', brand);
        if (status) params.append('status', status);
        if (isActive !== undefined) params.append('isActive', isActive);
        return { url: `/crm/vendor/reports/product-summary?${params.toString()}`, method: "GET" };
      },
      providesTags: ["Products"],
    }),

    // Inventory/Stock Report
    getInventoryStockReport: builder.query({
      query: ({ product, category, brand }) => {
        const params = new URLSearchParams();
        // Add filter parameters
        if (product) params.append('product', product);
        if (category) params.append('category', category);
        if (brand) params.append('brand', brand);
        return { url: `/crm/vendor/reports/inventory-stock?${params.toString()}`, method: "GET" };
      },
      providesTags: ["Products"],
    }),

    // Sales by Product Report
    getSalesByProductReport: builder.query({
      query: ({ period = 'all', startDate, endDate, product, customer, status, category, brand }) => {
        const params = new URLSearchParams();
        params.append('period', period);
        if ((period === 'custom' || period === 'today' || period === 'yesterday') && startDate && endDate) {
          params.append('startDate', startDate.toISOString());
          params.append('endDate', endDate.toISOString());
        }
        // Add additional filter parameters
        if (product) params.append('product', product);
        if (customer) params.append('customer', customer);
        if (status) params.append('status', status);
        if (category) params.append('category', category);
        if (brand) params.append('brand', brand);
        return { url: `/crm/vendor/reports/sales-by-product?${params.toString()}`, method: "GET" };
      },
      providesTags: ["Products"],
    }),

    // Category-wise Product Report
    getCategoryWiseProductReport: builder.query({
      query: ({ product, category, brand }) => {
        const params = new URLSearchParams();
        // Add filter parameters
        if (product) params.append('product', product);
        if (category) params.append('category', category);
        if (brand) params.append('brand', brand);
        return { url: `/crm/vendor/reports/category-wise-product?${params.toString()}`, method: "GET" };
      },
      providesTags: ["Products"],
    }),

    // Unique Values for Appointment Filters
    getUniqueClients: builder.query({
      query: () => ({
        url: '/crm/vendor/reports/unique-clients',
        method: 'GET'
      }),
      providesTags: ["Appointments"]
    }),
    getUniqueServices: builder.query({
      query: () => ({
        url: '/crm/vendor/reports/unique-services',
        method: 'GET'
      }),
      providesTags: ["Appointments"]
    }),
    getUniqueStaff: builder.query({
      query: () => ({
        url: '/crm/vendor/reports/unique-staff',
        method: 'GET'
      }),
      providesTags: ["Appointments"]
    }),

    // Unique product attributes for reports
    getUniqueProductNames: builder.query({
      query: () => ({
        url: '/crm/vendor/reports/unique-product-names',
        method: 'GET'
      }),
      providesTags: ["CrmProducts"]
    }),

    getUniqueBrands: builder.query({
      query: () => ({
        url: '/crm/vendor/reports/unique-brands',
        method: 'GET'
      }),
      providesTags: ["CrmProducts"]
    }),

    getUniqueCategories: builder.query({
      query: () => ({
        url: '/crm/vendor/reports/unique-categories',
        method: 'GET'
      }),
      providesTags: ["CrmProducts"]
    }),

    // Settlement Summary Report
    getSettlementSummaryReport: builder.query({
      query: ({ period = 'all', startDate, endDate, settlementFromDate, settlementToDate }) => {
        const params = new URLSearchParams();
        params.append('period', period);
        if ((period === 'custom' || period === 'today' || period === 'week' || period === 'month' || period === 'year') && startDate && endDate) {
          params.append('startDate', startDate);
          params.append('endDate', endDate);
        }
        if (settlementFromDate) params.append('settlementFromDate', settlementFromDate);
        if (settlementToDate) params.append('settlementToDate', settlementToDate);

        return {
          url: `/crm/vendor/reports/settlement-summary?${params.toString()}`,
          method: 'GET'
        };
      },
      providesTags: ["CrmReports"]
    }),

    // Consolidated Sales Report (CRM)
    getVendorConsolidatedSalesReport: builder.query({
      query: (filters) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, value.toString());
          }
        });
        return {
          url: `/crm/vendor/reports/salesreport?${params.toString()}`,
          method: 'GET'
        };
      },
      providesTags: ["CrmReports"]
    }),
  }),
});

export const {
  useGetProfileQuery,
  useRefreshTokenMutation,

  // Web App
  useGetMeQuery,
  useGetPublicVendorsQuery,
  useGetLandingSalonsQuery,
  useGetPublicVendorByIdQuery,
  useGetPublicProductsQuery,
  useGetPublicServicesQuery,
  useGetPublicCategoriesQuery,
  useGetPublicVendorProductsQuery,
  useGetPublicProductByIdQuery,
  useGetProductQuestionsQuery,
  useSubmitProductQuestionMutation,
  useGetProductReviewsQuery,
  useSubmitProductReviewMutation,
  useGetSalonReviewsQuery,
  useGetPublicVendorServicesQuery,
  useGetPublicVendorWorkingHoursQuery,
  useGetPublicVendorStaffQuery,
  useGetPublicVendorStaffByServiceQuery,
  useGetPublicVendorOffersQuery,
  useGetPublicAllOffersQuery,
  useGetMultiServiceSlotsMutation,
  useUserLoginMutation,
  useGetClientOrdersQuery,
  useCreateClientOrderMutation,
  useCreatePaymentOrderMutation,
  useVerifyPaymentMutation,

  // Admin Panel
  useAdminLoginMutation,
  useRegisterAdminMutation,
  useCreateAdminMutation,
  useUpdateAdminMutation,
  useDeleteAdminMutation,
  useGetAdminsQuery,
  useGetUsersQuery,
  useUpdateServiceStatusMutation,
  useGetAdminOffersQuery,
  useCreateAdminOfferMutation,
  useUpdateAdminOfferMutation,
  useDeleteAdminOfferMutation,
  useGetReferralsQuery,
  useCreateReferralMutation,
  useUpdateReferralMutation,
  useDeleteReferralMutation,
  useUpdateSettingsMutation,
  useGetSettingsQuery,
  useGetSuperDataQuery,
  useCreateSuperDataItemMutation,
  useUpdateSuperDataItemMutation,
  useDeleteSuperDataItemMutation,
  useGetAdminProductCategoriesQuery,
  useCreateAdminProductCategoryMutation,
  useUpdateAdminProductCategoryMutation,
  useDeleteAdminProductCategoryMutation,
  useCreateVendorMutation,
  useGetVendorsQuery,
  useGetVendorByIdQuery,
  useUpdateVendorMutation,
  useUpdateVendorStatusMutation,
  useUpdateVendorDocumentStatusMutation,
  useDeleteVendorMutation,
  useGetDoctorsQuery,
  useCreateDoctorMutation,
  useRegisterDoctorCrmMutation,
  useUpdateDoctorMutation,
  useUpdateDoctorStatusMutation,
  useUpdateDoctorDocumentStatusMutation,
  useDeleteDoctorMutation,
  useGetSuppliersQuery,
  useGetSupplierOrdersQuery,
  useCreateSupplierMutation,
  useRegisterSupplierMutation,
  useUpdateSupplierMutation,
  useUpdateSupplierStatusMutation,
  useUpdateSupplierDocumentStatusMutation,
  useDeleteSupplierMutation,
  useGetSubscriptionPlansQuery,
  useGetCrmSubscriptionPlansQuery,
  useCreateSubscriptionPlanMutation,
  useUpdateSubscriptionPlanMutation,
  useDeleteSubscriptionPlanMutation,
  useGetSmsTemplatesQuery,
  useGetSmsTemplateByIdQuery,
  useCreateSmsTemplateMutation,
  useUpdateSmsTemplateMutation,
  useDeleteSmsTemplateMutation,
  useGetSmsPackagesQuery,
  useGetSmsPackageByIdQuery,
  useCreateSmsPackageMutation,
  useUpdateSmsPackageMutation,
  useDeleteSmsPackageMutation,
  useGetSocialMediaTemplatesQuery,
  useGetSocialMediaTemplateByIdQuery,
  useCreateSocialMediaTemplateMutation,
  useUpdateSocialMediaTemplateMutation,
  useDeleteSocialMediaTemplateMutation,
  useGetGeoFencesQuery,
  useCreateGeoFenceMutation,
  useUpdateGeoFenceMutation,
  useDeleteGeoFenceMutation,
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useGetServicesQuery,
  useCreateServiceMutation,
  useUpdateServiceMutation,
  useDeleteServiceMutation,
  useGetNotificationsQuery,
  useCreateNotificationMutation,
  useUpdateNotificationMutation,
  useDeleteNotificationMutation,
  useGetTaxFeeSettingsQuery,
  useUpdateTaxFeeSettingsMutation,
  useGetFaqsQuery,
  useCreateFaqMutation,
  useUpdateFaqMutation,
  useDeleteFaqMutation,
  // useGetVendorProductsQuery,  // Removed old combined product approval hook
  // useUpdateProductStatusMutation,  // Removed old combined product approval hook
  useGetAdminClientsQuery,
  useGetAdminUsersQuery,
  useGetAdminDashboardStatsQuery,
  useGetSellingServicesReportQuery,
  useGetTotalBookingsReportQuery,
  useGetCompletedBookingsReportQuery,
  useGetCancellationReportQuery,
  useGetSalesBySalonReportQuery,
  useGetSalesByProductsReportQuery,
  useGetSalesByBrandReportQuery,
  useGetSalesByCategoryReportQuery,
  useGetConsolidatedSalesReportQuery,
  useGetSubscriptionReportQuery,
  useGetMarketingCampaignReportQuery,

  // Vendor Product Approval Hooks
  useGetVendorProductApprovalsQuery,
  useGetSupplierProductApprovalsQuery,
  useUpdateVendorProductStatusMutation,
  useUpdateSupplierProductStatusMutation,

  // CRM Endpoints
  useVendorLoginMutation,
  useVendorRegisterMutation,
  useGetVendorServicesQuery,
  useCreateVendorServicesMutation,
  useUpdateVendorServicesMutation,
  useDeleteVendorServicesMutation,
  useGetOffersQuery,
  useCreateOfferMutation,
  useUpdateOfferMutation,
  useDeleteOfferMutation,
  useGetVendorNotificationsQuery,
  useCreateVendorNotificationMutation,
  useDeleteVendorNotificationMutation,
  useGetCrmProductsQuery,
  useCreateCrmProductMutation,
  useUpdateCrmProductMutation,
  useDeleteCrmProductMutation,
  useGetCrmProductQuestionsQuery,
  useAnswerProductQuestionMutation,
  useDeleteProductQuestionMutation,
  useGetCrmReviewsQuery,
  useApproveReviewMutation,
  useDeleteReviewMutation,
  useGetSupplierProductsQuery,
  useGetSupplierProfileQuery,
  useGetCurrentSupplierProfileQuery,
  useUpdateSupplierProfileMutation,
  useGetCrmOrdersQuery,
  useCreateCrmOrderMutation,
  useUpdateCrmOrderMutation,
  useGetCrmClientOrdersQuery,
  useUpdateCrmClientOrderMutation,
  useGetShippingConfigQuery,
  useUpdateShippingConfigMutation,
  useGetPublicShippingConfigQuery,
  useGetProductCategoriesQuery,
  useCreateProductCategoryMutation,
  useGetStaffQuery,
  useCreateStaffMutation,
  useUpdateStaffMutation,
  useDeleteStaffMutation,
  useSendStaffCredentialsMutation,
  useGetAddOnsQuery,
  useCreateAddOnMutation,
  useUpdateAddOnMutation,
  useDeleteAddOnMutation,
  useGetExpensesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useGetCrmExpenseTypesQuery,
  useGetCrmPaymentModesQuery,
  useGetWorkingHoursQuery,
  useUpdateWorkingHoursMutation,
  useAddSpecialHoursMutation,
  useDeleteSpecialHoursMutation,
  useGetAppointmentsQuery,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
  useDeleteAppointmentMutation,
  useGetClientsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
  useGetVendorProfileQuery,
  useUpdateVendorProfileMutation,
  useGetDoctorProfileQuery,
  useUpdateDoctorProfileMutation,
  useGetDoctorWorkingHoursQuery,
  useUpdateDoctorWorkingHoursMutation,
  useGetCrmDoctorWorkingHoursQuery,
  useUpdateCrmDoctorWorkingHoursMutation,
  useAddCrmDoctorSpecialHoursMutation,
  useRemoveCrmDoctorSpecialHoursMutation,
  useGetCrmReferralsQuery,
  useGetCrmReferralSettingsQuery,
  useChangePlanMutation,
  useRenewPlanMutation,
  useGetCrmSmsPackagesQuery,
  useGetCrmCampaignsQuery,
  useCreateCrmCampaignMutation,
  useUpdateCrmCampaignMutation,
  useGetCrmSocialMediaTemplatesQuery,
  useSaveCustomizedTemplateMutation,
  useDeleteCustomizedTemplateMutation,
  usePurchaseSmsPackageMutation,
  useGetSmsPurchaseHistoryQuery,
  useGetSmsBalanceQuery,

  // New endpoint for fetching all vendor products
  useGetAllVendorProductsQuery,

  // New endpoints for vendor product operations
  useUpdateVendorProductMutation,
  useDeleteVendorProductMutation,
  useCreateVendorProductMutation,

  useGetSupplierProductQuestionsQuery,
  useAnswerSupplierProductQuestionMutation,
  useDeleteSupplierProductQuestionMutation,

  // Cart Endpoints (CRM)
  useGetCartQuery,
  useAddToCartMutation,
  useUpdateCartItemMutation,
  useRemoveFromCartMutation,

  // Client Cart Endpoints (Web App)
  useGetClientCartQuery,
  useAddToClientCartMutation,
  useUpdateClientCartItemMutation,
  useRemoveFromClientCartMutation,

  // Client Referrals Endpoint (Web App)
  useGetClientReferralsQuery,

  // Client Wallet Endpoints (Web App)
  useGetClientWalletQuery,
  useAddMoneyToWalletMutation,
  useVerifyWalletPaymentMutation,
  useWithdrawFromWalletMutation,
  useGetWithdrawalHistoryQuery,

  // Doctor Wishlist Endpoints (Web App)
  useGetDoctorWishlistQuery,
  useCheckDoctorWishlistStatusQuery,
  useAddDoctorToWishlistMutation,
  useRemoveDoctorFromWishlistMutation,

  // Salon Wishlist Endpoints (Web App)
  useGetSalonWishlistQuery,
  useAddToSalonWishlistMutation,
  useRemoveFromSalonWishlistMutation,

  // Public Doctors Endpoint (Web App - no auth required)
  useGetPublicDoctorsQuery,

  // Public Tax Fee Settings (Web App - no auth required)
  useGetPublicTaxFeeSettingsQuery,

  // Block Time Endpoints
  useGetBlockedTimesQuery,
  useCreateBlockTimeMutation,
  useDeleteBlockTimeMutation,

  // Billing Endpoints
  useCreateBillingMutation,
  useGetBillingRecordsQuery,
  useGetBillingByIdQuery,
  useUpdateBillingMutation,
  useDeleteBillingMutation,
  useUpdateAppointmentStatusMutation,
  useGetPatientsQuery,
  useCreatePatientMutation,
  useUpdatePatientMutation,
  useDeletePatientMutation,

  // Consultation Hooks (Physical & Video)
  useGetConsultationsQuery,
  useGetBookedSlotsQuery,
  useGetConsultationByIdQuery,
  useCreateConsultationMutation,
  useUpdateConsultationMutation,
  useCancelConsultationMutation,

  // Public Appointment Hooks
  useGetPublicAppointmentsQuery,
  useCreatePublicAppointmentMutation,
  // Slot Lock Mutation
  useAcquireSlotLockMutation,
  // Confirm Booking Mutation
  useConfirmBookingMutation,
  // Cancel Booking Mutation (added)
  useCancelBookingMutation,
  // Appointment Invoice Hook (Web - for clients)
  useGetAppointmentInvoiceQuery,
  // Lock Wedding Package Mutation
  useLockWeddingPackageMutation,
  // Public Wedding Packages Hook
  useGetPublicVendorWeddingPackagesQuery,
  // CRM Wedding Packages Hooks
  useGetVendorWeddingPackagesQuery,
  useCreateWeddingPackageMutation,
  useUpdateWeddingPackageMutation,
  useDeleteWeddingPackageMutation,
  // New Wedding Package Approval Hooks
  useGetPendingWeddingPackagesQuery,
  useUpdateWeddingPackageStatusMutation,


  // Payment Collection Hook
  useCollectPaymentMutation,


  // Appointment Report Hooks
  useGetAllAppointmentsReportQuery,
  useGetSummaryByServiceReportQuery,
  useGetCompletedAppointmentsReportQuery,
  useGetCancelledAppointmentsReportQuery,
  // Sales Report Hooks
  useGetSalesByServiceReportQuery,
  useGetSalesByCustomerReportQuery,
  useGetVendorPayableReportQuery,
  useGetVendorPayoutSettlementReportQuery,
  useGetVendorPayoutSettlementReportProductQuery,
  useGetVendorPayableReportProductQuery,
  useGetReferralReportQuery,
  useGetSettlementHistoryReportQuery,
  useGetPlatformCollectionsReportQuery,
  // Product Report Hooks
  useGetProductSummaryReportQuery,
  useGetSalesByProductReportQuery,
  useGetInventoryStockReportQuery,
  useGetCategoryWiseProductReportQuery,
  useGetUniqueClientsQuery,
  useGetUniqueServicesQuery,
  useGetUniqueStaffQuery,
  useGetUniqueProductNamesQuery,
  useGetUniqueBrandsQuery,
  useGetUniqueCategoriesQuery,
  useGetSettlementSummaryReportQuery,
  useGetVendorConsolidatedSalesReportQuery,

  // Staff Earnings Hooks
  useGetStaffEarningsQuery,
  useRecordStaffPayoutMutation,

  // Payment Collections Hook
  useGetPaymentCollectionsQuery,
  useGetSupplierProductReviewsReportQuery,

  // Supplier Report Hooks
  useGetSupplierTotalOrdersReportQuery,
  useGetSupplierPendingOrdersReportQuery,
  useGetSupplierCompletedOrdersReportQuery,
  useGetSupplierConfirmedOrdersReportQuery,
  useGetSupplierPlatformCollectionsReportQuery,
  useGetSupplierProductSalesReportQuery,

  // Regions Hooks
  useGetRegionsQuery,
  useCreateRegionMutation,
  useUpdateRegionMutation,
  useDeleteRegionMutation,
  useGetVendorServicesForApprovalQuery,

  // Wallet Settings Hooks
  useGetWalletSettingsQuery,
  useUpdateWalletSettingsMutation,

  useClaimReferralBonusMutation,

  // Product Masters Hooks
  useGetProductMastersQuery,
  useCreateProductMasterMutation,
  useUpdateProductMasterMutation,
  useDeleteProductMasterMutation,
  useGetCrmProductMastersQuery,

  // Inventory Hooks
  useAdjustInventoryMutation,
  useGetInventoryTransactionsQuery,
  useGetLowStockProductsQuery,

  // CRM Wallet Hooks
  useGetCrmWalletQuery,
  useWithdrawFromCrmWalletMutation,

  // Admin Wallet Monitoring Hooks
  useGetAdminWithdrawalsQuery,
  useUpdateWithdrawalStatusMutation,
  useGetAdminTransactionsQuery,
  useGetAdminOnlineTransactionsQuery,

  // Admin Marketing Dashboard Hook
  useGetAdminMarketingDashboardQuery,
} = glowvitaApi;
