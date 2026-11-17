"use client";

import React, { useState, useEffect, useRef } from "react";
import { MapPin, Filter, RotateCcw, X } from "lucide-react";
import { useGetPublicVendorsQuery, useGetLandingSalonsQuery } from "@repo/store/services/api";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useSalonFilter } from "./SalonFilterContext";

interface VendorData {
  _id: string;
  businessName: string;
  email: string;
  phone: string;
  state: string;
  city: string;
  description?: string;
  category: "unisex" | "men" | "women";
  subCategories: string[];
  profileImage?: string;
  gallery?: string[];
  location?: {
    lat: number;
    lng: number;
  };
  vendorType?: string;
  services?: Array<{
    _id: string;
    name: string;
    category: {
      _id: string;
      name: string;
    } | null;
    price: number;
    duration: number;
    description: string;
  }>;
  rating?: number;
  clientCount?: number;
  offers?: Array<{
    _id: string;
    name: string;
    discount: number;
    // Add other offer properties as needed
  }>;
}

interface TransformedSalon {
  id: string;
  name: string;
  type: string;
  location: string;
  rating: number | string;
  clients: string;
  image: string;
  badge: string | null;
  serviceNames: string[];
  isHomeService?: boolean;
  isWeddingService?: boolean;
}

interface WhereToGoProps {
  maxSalons?: number;
  showViewAllButton?: boolean;
}

// MultiSelect component
interface MultiSelectProps {
  options: string[];
  selectedOptions: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder: string;
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selectedOptions,
  onSelectionChange,
  placeholder,
  label,
  isOpen,
  onToggle,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen, onClose]);

  // Reset search when closed
  useEffect(() => {
    if (!isOpen) setSearchTerm("");
  }, [isOpen]);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (option: string) => {
    if (selectedOptions.includes(option)) {
      onSelectionChange(selectedOptions.filter(item => item !== option));
    } else {
      onSelectionChange([...selectedOptions, option]);
    }
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="text-xs text-gray-700 font-bold uppercase tracking-wider">{label}</label>
      <div
        className={`mt-1 w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none cursor-pointer ${isOpen ? 'ring-1 ring-primary' : ''}`}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between h-full gap-2">
          <div className="flex-1 max-h-full overflow-y-auto pr-1 custom-scrollbar">
            <div className="flex flex-wrap gap-1 py-0.5">
              {selectedOptions.length > 0 ? (
                selectedOptions.map(option => (
                  <div key={option} className="flex items-center bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-md whitespace-nowrap">
                    {option}
                    <button
                      type="button"
                      className="ml-1 text-primary/70 hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOption(option);
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))
              ) : (
                <span className="text-muted-foreground/70">{placeholder}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {selectedOptions.length > 0 && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  clearAll();
                }}
              >
                <X size={16} />
              </button>
            )}
            <div className="ml-2 flex-shrink-0">
              <img src="/images/caret-down 1.png" alt="arrow" className={`w-3 h-3 object-contain transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto custom-scrollbar">
          <div className="p-2">
            <input
              type="text"
              placeholder="Search..."
              className="w-full h-8 px-2 text-sm border border-border rounded-md mb-2"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-40 overflow-auto custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <div
                  key={option}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-accent ${selectedOptions.includes(option) ? 'bg-accent' : ''}`}
                  onClick={() => toggleOption(option)}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedOptions.includes(option)}
                      readOnly
                      className="mr-2"
                    />
                    {option}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const WhereToGo: React.FC<WhereToGoProps> = ({
  maxSalons = Infinity,
  showViewAllButton = true
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const isSalonsPage = pathname === '/salons';
  const { userLat, userLng, selectedCity, setSelectedCity, locationLabel, serviceQuery } = useSalonFilter();

  // Fetch params for filtering reactively
  const searchParams = useSearchParams();
  const qLat = searchParams?.get("lat") ? parseFloat(searchParams.get("lat")!) : userLat;
  const qLng = searchParams?.get("lng") ? parseFloat(searchParams.get("lng")!) : userLng;
  const qCityRaw = searchParams?.get("city") || searchParams?.get("locationLabel") || selectedCity;
  const qCity = qCityRaw?.split(',')[0].trim();
  const qServiceName = searchParams?.get("serviceName") || serviceQuery;
  const qOfferCode = searchParams?.get("offerCode") || "";
  const qRegionId = searchParams?.get("regionId") || "";

  const {
    data: vendorsData,
    isLoading: isVendorsLoading,
    error: vendorsError,
  } = useGetPublicVendorsQuery({
    lat: qLat || undefined,
    lng: qLng || undefined,
    city: qCity || undefined,
    serviceName: qServiceName || undefined,
    offerCode: qOfferCode || undefined,
    regionId: qRegionId || undefined,
    limit: 1000
  }, { skip: !isSalonsPage });

  const {
    data: landingData,
    isLoading: isLandingLoading,
    error: landingError,
  } = useGetLandingSalonsQuery(
    { lat: userLat, lng: userLng },
    { skip: isSalonsPage }
  );

  const isLoading = (isSalonsPage ? isVendorsLoading : isLandingLoading) || false;
  const error = isSalonsPage ? vendorsError : landingError;

  // State for filter controls (only show on salons page)
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [serviceFilter, setServiceFilter] = useState<string[]>([]);
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string[]>([]);

  // Track which dropdown is open — only one at a time
  const [openDropdown, setOpenDropdown] = useState<"category" | "service" | "location" | null>(null);

  const toggleDropdown = (name: "category" | "service" | "location") => {
    setOpenDropdown(prev => (prev === name ? null : name));
  };

  const closeDropdown = () => setOpenDropdown(null);

  console.log("Vendors Data :", vendorsData);

  // Extract unique categories, services, and locations from vendors data
  const categories = ["Unisex", "Women", "Men"];

  const services = React.useMemo(() => {
    if (!vendorsData?.vendors) return [];
    const uniqueServices = new Set<string>();
    vendorsData.vendors.forEach((vendor: VendorData) => {
      if (vendor.services && Array.isArray(vendor.services)) {
        vendor.services.forEach(service => {
          uniqueServices.add(service.name);
        });
      }
    });
    return Array.from(uniqueServices);
  }, [vendorsData]);

  const locations = React.useMemo(() => {
    if (isSalonsPage) {
      if (!vendorsData?.vendors) return [];
      const uniqueLocations = new Set<string>();
      vendorsData.vendors.forEach((vendor: VendorData) => {
        uniqueLocations.add(`${vendor.city}, ${vendor.state}`);
      });
      return Array.from(uniqueLocations);
    } else {
      if (!landingData?.data?.cities) return [];
      return landingData.data.cities;
    }
  }, [vendorsData, landingData, isSalonsPage]);

  // Function to reset all filters to default values
  const resetFilters = () => {
    setCategoryFilter([]);
    setServiceFilter([]);
    setRatingFilter("all");
    setLocationFilter([]);
    setOpenDropdown(null);
  };

  // Transform vendor data to match the card structure
  const salons = React.useMemo(() => {
    const transformVendor = (vendor: any) => {
      const imageUrl =
        vendor.profileImage ||
        "/images/salon-placeholder.png";

      const hasOffer =
        vendor.offers &&
        Array.isArray(vendor.offers) &&
        vendor.offers.some((offer: any) => {
          const now = new Date();
          const startDate = offer.startDate ? new Date(offer.startDate) : null;
          const expires = offer.expires ? new Date(offer.expires) : null;
          return (!startDate || now >= startDate) && (!expires || now <= expires);
        });

      const isHomeService =
        vendor.isHomeService === true ||
        (vendor.vendorType && ["hybrid", "home-only", "vendor-home-travel"].includes(vendor.vendorType)) ||
        (vendor.subCategories?.includes("at-home")) ||
        (vendor.services?.some((s: any) => (!s.status || s.status === 'approved') && (s.homeService?.available || s.serviceHomeService?.available)));

      const isWeddingService =
        vendor.isWeddingService === true ||
        vendor.services?.some((s: any) => (!s.status || s.status === 'approved') && (s.weddingService?.available || s.serviceWeddingService?.available)) ||
        (vendor.vendorServicesItems?.[0]?.services?.some((s: any) => (!s.status || s.status === 'approved') && (s.weddingService?.available || s.serviceWeddingService?.available)));

      return {
        id: vendor._id,
        name: vendor.businessName || "Beauty Salon",
        type:
          vendor.category === "unisex"
            ? "Full-Service Salon"
            : vendor.category === "women"
              ? "Women's Beauty Salon"
              : vendor.category === "men"
                ? "Men's Grooming"
                : "Beauty Services",
        location: `${vendor.city || "Unknown City"}, ${vendor.state || "Unknown State"}`,
        rating: vendor.rating || "0.0",
        clients: `${vendor.dynamicClientCount ||
          vendor.stats?.find((s: any) => s.label === "Happy Clients")?.value ||
          vendor.clientCount ||
          0}+`,
        image: imageUrl,
        badge: hasOffer ? "Offer Available" : null,
        serviceNames: vendor.services?.map((s: any) => s.name) || [],
        isHomeService,
        isWeddingService,
      };
    };

    if (!isSalonsPage) {
      if (!landingData?.data) return { recommended: [] };
      return {
        recommended: landingData.data.recommended.map(transformVendor).slice(0, maxSalons),
      };
    }

    if (!vendorsData?.vendors || !Array.isArray(vendorsData.vendors)) {
      return [];
    }

    const allTransformedSalons = vendorsData.vendors.map(transformVendor);

    // Apply filters if on salons page
    let filteredSalons = allTransformedSalons;
    if (isSalonsPage) {
      // Category Filter
      if (categoryFilter.length > 0) {
        filteredSalons = filteredSalons.filter((salon: TransformedSalon) => {
          const isUnisex = salon.type.includes("Full-Service");
          const isWomen = salon.type.includes("Women's");
          const isMen = salon.type.includes("Men's");

          if (categoryFilter.includes("Unisex") && isUnisex) return true;
          if (categoryFilter.includes("Women") && (isWomen || isUnisex)) return true;
          if (categoryFilter.includes("Men") && (isMen || isUnisex)) return true;

          return false;
        });
      }

      // Service Filter
      if (serviceFilter.length > 0) {
        filteredSalons = filteredSalons.filter((salon: TransformedSalon) => {
          return serviceFilter.some(service => salon.serviceNames.includes(service));
        });
      }

      // Rating Filter
      if (ratingFilter !== "all") {
        if (ratingFilter === "high-to-low") {
          filteredSalons.sort((a: TransformedSalon, b: TransformedSalon) => Number(b.rating) - Number(a.rating));
        } else if (ratingFilter === "low-to-high") {
          filteredSalons.sort((a: TransformedSalon, b: TransformedSalon) => Number(a.rating) - Number(b.rating));
        }
      }

      // Location Filter
      if (locationFilter.length > 0) {
        filteredSalons = filteredSalons.filter((salon: TransformedSalon) => locationFilter.includes(salon.location));
      }
    }

    // Return only the limited number of salons
    return filteredSalons
      .slice(0, maxSalons) as TransformedSalon[]; // Limit to maxSalons based on prop
  }, [vendorsData, landingData, maxSalons, isSalonsPage, categoryFilter, serviceFilter, ratingFilter, locationFilter]);

  const renderSalonGrid = (salonsToRender: TransformedSalon[], title?: string) => (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold text-foreground border-l-4 border-primary pl-4">
            {title}
          </h3>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {salonsToRender.map((salon: TransformedSalon) => (
          <div
            key={salon.id}
            className="group p-4 border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
            style={{ backgroundColor: "#FFFFFF" }}
            onClick={() => router.push(`/salon-details/${salon.id}`)}
          >
            {/* Image Container */}
            <div className="relative h-48 overflow-hidden rounded-xl border border-gray-200">
              <img
                src={salon.image}
                alt={salon.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => { (e.target as HTMLImageElement).src = "/images/salon-placeholder.png"; }}
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

              {/* Service Badges */}
              <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5 z-10">
                {salon.isHomeService && (
                  <div
                    className="flex items-center gap-1 text-white text-[9px] font-bold px-2 py-1 rounded-full shadow-lg backdrop-blur-sm"
                    style={{ backgroundColor: "#00000082" }}
                  >
                    <img src="/images/home (12) 1.png" alt="home service" className="w-3 h-3" />
                    <span className="uppercase tracking-wider">Home service</span>
                  </div>
                )}
                {salon.isWeddingService && (
                  <div
                    className="flex items-center gap-1 text-white text-[9px] font-bold px-2 py-1 rounded-full shadow-lg backdrop-blur-sm"
                    style={{ backgroundColor: "#00000082" }}
                  >
                    <img src="/images/like (3) 1 (1).png" alt="wedding service" className="w-3 h-3" />
                    <span className="uppercase tracking-wider">Wedding Service</span>
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="pt-3 px-1">
              {/* Title and Rating */}
              <div className="flex items-start justify-between mb-2">
                <h3
                  className="font-bold text-base leading-tight truncate pr-2 flex-1"
                  style={{ color: "#252B42" }}
                >
                  {salon.name}
                </h3>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <img src="/images/star 6.png" alt="rating" className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold text-gray-900">
                    {Number(salon.rating).toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Location */}
              <div className="mb-2">
                <p className="text-gray-900 text-[11px] uppercase tracking-wider font-normal truncate">
                  {salon.type}
                </p>
                <div className="flex items-start gap-1.5 mt-1.5">
                  <img src="/images/placeholder 6.png" alt="location" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-900 text-[13px] leading-tight truncate font-normal">
                    {salon.location}
                  </p>
                </div>
              </div>

              {/* Clients + Offer */}
              <div className="flex items-center justify-between pt-1 h-8">
                <div className="flex items-center gap-1.5">
                  <img src="/images/customer 6.png" alt="clients" className="w-3.5 h-3.5" />
                  <span className="text-[13px] font-semibold text-card-foreground">
                    {salon.clients} Clients
                  </span>
                </div>
                {salon.badge && (
                  <img
                    src="/images/new-offer.png"
                    alt="Offer"
                    className="h-8 w-auto object-contain"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section className="py-8 container mx-auto px-4 sm:px-6 lg:px-8 bg-background">
      {/* Filters Row - Only show on salons page */}
      {isSalonsPage && (
        <div className="mb-12 mx-8 md:mx-16 lg:mx-24">
          <div className="p-8 md:p-10 bg-[#EBF3FD] border border-blue-100 rounded-3xl shadow-sm">
            <div className="flex items-center justify-end mb-4">
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 font-bold bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-colors duration-200"
              >
                <img src="/images/redo 1.png" alt="refresh" className="h-3.5 w-3.5 object-contain" />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
              {/* Category Filter */}
              <div className="flex flex-col gap-2">
                <MultiSelect
                  options={categories}
                  selectedOptions={categoryFilter}
                  onSelectionChange={setCategoryFilter}
                  placeholder="All Categories"
                  label="Category"
                  isOpen={openDropdown === "category"}
                  onToggle={() => toggleDropdown("category")}
                  onClose={closeDropdown}
                />
              </div>

              {/* Service Filter */}
              <div className="flex flex-col gap-2">
                <MultiSelect
                  options={services}
                  selectedOptions={serviceFilter}
                  onSelectionChange={setServiceFilter}
                  placeholder="All Services"
                  label="Service"
                  isOpen={openDropdown === "service"}
                  onToggle={() => toggleDropdown("service")}
                  onClose={closeDropdown}
                />
              </div>

              {/* Rating Filter - Single Select */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-700 font-bold uppercase tracking-wider">Rating</label>
                <div className="relative">
                  <select
                    value={ratingFilter}
                    onChange={(e) => setRatingFilter(e.target.value)}
                    onFocus={closeDropdown}
                    className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none appearance-none pr-8 text-gray-700 font-normal"
                  >
                    <option value="all">All Ratings</option>
                    <option value="high-to-low">Highest Rated First</option>
                    <option value="low-to-high">Lowest Rated First</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
                    <img src="/images/caret-down 1.png" alt="arrow" className="w-3 h-3 object-contain" />
                  </div>
                </div>
              </div>

              {/* Location Filter */}
              <div className="flex flex-col gap-2">
                <MultiSelect
                  options={locations}
                  selectedOptions={locationFilter}
                  onSelectionChange={setLocationFilter}
                  placeholder="All Locations"
                  label="Location"
                  isOpen={openDropdown === "location"}
                  onToggle={() => toggleDropdown("location")}
                  onClose={closeDropdown}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-5 flex items-center justify-between">
        <h2
          className="relative inline-block text-2xl md:text-3xl font-serif font-bold pb-3"
          style={{ color: "#252B42" }}
        >
          {isSalonsPage ? "Our Salons" : "Recommended Salons"}
          <span
            className="absolute left-0 bottom-0 h-[3px] w-full rounded-full"
            style={{
              background:
                "linear-gradient(to right, #252B42 0%, #252B42 40%, transparent 100% )",
            }}
          />
        </h2>
        {showViewAllButton && (
          <button
            className="group flex items-center gap-2 text-sm font-semibold flex-shrink-0"
            style={{ color: "#252B42" }}
            onClick={() => {
              const params = new URLSearchParams();
              if (userLat) params.append("lat", userLat.toString());
              if (userLng) params.append("lng", userLng.toString());
              if (locationLabel) params.append("locationLabel", locationLabel);
              const queryString = params.toString() ? `?${params.toString()}` : "";
              router.push(`/salons${queryString}`);
            }}
          >
            View All
            <img src="/images/arrow.png" alt="arrow" className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        )}
      </div>

      {qOfferCode && (
        <div className="mb-6 flex items-center gap-3 bg-primary/5 border border-primary/20 p-4 rounded-2xl w-fit">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Active Offer:</span>
            <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{qOfferCode}</span>
          </div>
          <button
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              params.delete("offerCode");
              const queryString = params.toString() ? `?${params.toString()}` : "";
              router.push(`${pathname}${queryString}`);
            }}
            className="text-xs text-muted-foreground hover:text-destructive underline font-medium"
          >
            Clear offer filter
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="group bg-card border border-border rounded-3xl overflow-hidden shadow-sm animate-pulse"
            >
              <div className="h-48 bg-muted" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="h-8 bg-muted rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : landingData?.noServiceArea ? (
        <div className="py-20 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-6">
            <MapPin className="w-10 h-10 text-primary/30" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-3">We're not available here yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-8 font-medium">
            We are currently expanding and haven't reached your location yet. We’ll be available in your area soon—stay tuned!
          </p>

        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">Error loading salons</p>
          <button onClick={() => window.location.reload()} className="bg-primary text-white px-4 py-2 rounded-full">Retry</button>
        </div>
      ) : isSalonsPage ? (
        <>
          {Array.isArray(salons) && salons.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No salons found matching your filters.</p>
            </div>
          ) : (
            renderSalonGrid(salons as TransformedSalon[])
          )}
        </>
      ) : (
        <>
          {renderSalonGrid((salons as any).recommended)}
        </>
      )}


    </section>
  );
};

export default WhereToGo;