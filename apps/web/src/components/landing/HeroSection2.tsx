import React, { useState, useMemo, useEffect } from "react";
import {
  Scissors,
  MapPin,
  Sparkles,
  Navigation,
} from "lucide-react";
import {
  useGetPublicCategoriesQuery,
  useGetPublicServicesQuery,
  useGetPublicVendorsQuery,
} from "@repo/store/services/api";
import { useRouter } from "next/navigation";
import { cn } from "@repo/ui/cn";
import { useLoadScript } from "@react-google-maps/api";
import { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY } from "@repo/config/config";
import { useSalonFilter } from "./SalonFilterContext";

const GOOGLE_MAPS_LIBRARIES: any = ["places"];

const HeroSection2 = () => {
  const router = useRouter();

  // ── Shared filter context — updating this changes landing page sections ─────
  const { setUserLocation, userLat, userLng, locationLabel, clearLocation } = useSalonFilter();

  const [serviceInput, setServiceInput] = useState("");
  // Synced with context's locationLabel so the input reflects auto-detected location
  const [locationInput, setLocationInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [isServiceFocused, setIsServiceFocused] = useState(false);
  const [isLocationFocused, setIsLocationFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Locally resolved coords for the current typed/selected location
  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);

  const { data: categoriesData, isLoading: categoriesLoading } =
    useGetPublicCategoriesQuery(undefined);
  const { data: servicesData } = useGetPublicServicesQuery({ limit: 100 });
  const { data: vendorsData } = useGetPublicVendorsQuery({ limit: 100 });

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [locationPredictions, setLocationPredictions] = useState<any[]>([]);
  const [isLocating, setIsLocating] = useState(false);

  // ── Sync with global context (Requirements 1 & 3) ─────────────────────────
  useEffect(() => {
    if (locationLabel) {
      // Sync the input if it's currently empty or generic
      if (!locationInput || locationInput === "Current Location") {
        setLocationInput(locationLabel);
      }
    }
  }, [locationLabel]);

  // Sync coords from auto-detect/profile to local state
  useEffect(() => {
    if (userLat != null && userLng != null && selectedLat === null) {
      setSelectedLat(userLat);
      setSelectedLng(userLng);
    }
  }, [userLat, userLng]);

  // ── Service / Category autocomplete ───────────────────────────────────────
  const suggestions = useMemo(() => {
    const input = serviceInput.toLowerCase();
    const results: any[] = [];

    if (servicesData?.services) {
      const svcs = servicesData.services
        .filter((s: any) => s.name.toLowerCase().includes(input))
        .slice(0, 50);
      results.push(...svcs.map((s: any) => ({ ...s, type: "service" })));
    }

    if (categoriesData?.categories) {
      const cats = categoriesData.categories
        .filter((c: any) => c.name.toLowerCase().includes(input))
        .slice(0, 10);
      results.push(...cats.map((c: any) => ({ ...c, type: "category" })));
    }

    if (vendorsData?.vendors) {
      const vendors = vendorsData.vendors
        .filter((v: any) => v.businessName?.toLowerCase().includes(input))
        .slice(0, 10);
      results.push(...vendors.map((v: any) => ({ ...v, type: "salon", name: v.businessName })));
    }

    return results;
  }, [serviceInput, categoriesData, servicesData, vendorsData]);

  // ── Google Places autocomplete (geocode = allows neighbourhoods too) ───────
  useEffect(() => {
    if (!isLoaded || !locationInput || locationInput === "Current Location") {
      setLocationPredictions([]);
      return;
    }

    const svc = new google.maps.places.AutocompleteService();
    svc.getPlacePredictions(
      {
        input: locationInput,
        types: ["geocode"], // allows areas, suburbs, cities, states
        componentRestrictions: { country: "in" },
      },
      (predictions) => setLocationPredictions(predictions || [])
    );
  }, [locationInput, isLoaded]);

  // ── Clear resolved coords when user re-types ──────────────────────────────
  const handleLocationInputChange = (value: string) => {
    setLocationInput(value);
    setSelectedLat(null);
    setSelectedLng(null);
    if (!value.trim()) {
      clearLocation();
    }
  };

  // ── Geocode a place_id and update both local state AND context ────────────
  const handleSelectPrediction = (prediction: any) => {
    const label =
      prediction.structured_formatting?.main_text ||
      prediction.description.split(",")[0].trim();
    setLocationInput(prediction.description);
    setIsLocationFocused(false);

    if (!isLoaded) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ placeId: prediction.place_id }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const loc = results[0].geometry.location;
        const lat = loc.lat();
        const lng = loc.lng();
        setSelectedLat(lat);
        setSelectedLng(lng);
        // ↓ Update context → WhereToDo / AllSalons / NewlyAdded re-query immediately
        setUserLocation(lat, lng, label);
      }
    });
  };

  // ── Use browser geolocation ────────────────────────────────────────────────
  const handleCurrentLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setSelectedLat(latitude);
        setSelectedLng(longitude);
        setLocationInput("Current Location");
        setIsLocating(false);
        // ↓ Also update context
        setUserLocation(latitude, longitude, "Current Location");
      },
      () => setIsLocating(false)
    );
  };

  // ── Geocode helper (promise wrapper) ──────────────────────────────────────
  const geocodeText = (text: string): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!isLoaded) return resolve(null);
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { address: text, region: "in" },
        (results, status) => {
          if (status === "OK" && results && results[0]) {
            const loc = results[0].geometry.location;
            resolve({ lat: loc.lat(), lng: loc.lng() });
          } else {
            resolve(null);
          }
        }
      );
    });
  };

  // ── Navigate to search — geocodes text if no coords yet ──────────────────
  const handleSearch = async () => {
    setIsSearching(true);
    const params = new URLSearchParams();

    let catId = selectedCategoryId;
    if (!catId && serviceInput && categoriesData?.categories) {
      const trimmed = serviceInput.toLowerCase().trim();
      const matched = categoriesData.categories.find(
        (c: any) => c.name?.toLowerCase().trim() === trimmed
      );
      if (matched) {
        catId = matched._id;
      }
    }

    if (serviceInput) params.append("serviceName", serviceInput);
    if (catId) params.append("categoryIds", catId);

    let finalLat = selectedLat;
    let finalLng = selectedLng;

    // If user typed something but never selected from dropdown, geocode now
    if (
      (finalLat == null || finalLng == null) &&
      locationInput &&
      locationInput !== "Current Location"
    ) {
      const result = await geocodeText(locationInput);
      if (result) {
        finalLat = result.lat;
        finalLng = result.lng;
        setSelectedLat(result.lat);
        setSelectedLng(result.lng);
        // Also update context so landing sections update
        setUserLocation(
          result.lat,
          result.lng,
          locationInput.split(",")[0].trim()
        );
      }
    }

    if (finalLat != null && finalLng != null) {
      params.append("lat", finalLat.toString());
      params.append("lng", finalLng.toString());
      if (locationInput && locationInput !== "Current Location") {
        params.append("locationLabel", locationInput.split(",")[0].trim());
      }
    } else if (locationInput && locationInput !== "Current Location") {
      // Fallback: text-based (case-insensitive regex on backend)
      params.append("city", locationInput.split(",")[0].trim());
    }

    if (dateInput) params.append("date", dateInput);
    setIsSearching(false);
    router.push(`/search?${params.toString()}`);
  };

  const handleSuggestionSelection = (item: any) => {
    if (item.type === "category") {
      setSelectedCategoryId(item._id);
      setServiceInput(item.name);
    } else if (item.type === "salon") {
      setServiceInput(item.name);
      setSelectedCategoryId("");
    } else {
      setServiceInput(item.name);
      setSelectedCategoryId("");
    }
    setIsServiceFocused(false);
  };

  const marqueeCategories = useMemo(() => {
    if (!categoriesData?.categories) return [];
    const iconMap: Record<string, any> = {
      hair: Scissors,
      nail: Scissors,
      spa: Sparkles,
      makeup: Sparkles,
      skin: Sparkles,
    };
    return categoriesData.categories.map((category: any) => {
      const name = category.name.toLowerCase();
      let icon = Sparkles;
      for (const [key, Icon] of Object.entries(iconMap)) {
        if (name.includes(key)) { icon = Icon; break; }
      }
      return { id: category._id, icon, label: category.name };
    });
  }, [categoriesData]);

  return (
    <div className="relative w-full min-h-[420px] sm:min-h-[520px] md:h-auto lg:h-[650px] overflow-hidden">
      {/* Solid dark maroon base */}
      <div className="absolute inset-0" style={{ backgroundColor: "#422A3C" }} />

      {/* Full-width image background */}
      {/* Mobile/Desktop: absolute fill. Tablet(md): natural width=100% height=auto, drives section height */}
      <div className="absolute inset-0 md:relative md:inset-auto lg:absolute lg:inset-0">
        <img
          src="/images/hero-salon-bg.png"
          alt="Products"
          className="absolute inset-0 h-full w-full pointer-events-none select-none object-cover object-center md:relative md:inset-auto md:h-auto md:object-fill lg:absolute lg:inset-0 lg:h-full lg:object-cover"
        />
      </div>

      {/* Content — relative on mobile/desktop, absolute overlay on tablet */}
      <div className="relative z-10 md:absolute md:inset-0 lg:relative lg:inset-auto container mx-auto px-4 sm:px-6 md:px-8 lg:px-8 h-full flex flex-col justify-evenly gap-4 sm:gap-3 md:gap-0 py-8 sm:py-10 md:py-6 lg:py-0 max-w-7xl">

        {/* Welcome tag */}
        <h3 className="text-amber-100 text-[10px] sm:text-xs md:text-xs lg:text-sm font-medium tracking-[0.2em] sm:tracking-[0.25em] md:tracking-[0.3em] uppercase">
          WELCOME TO GLOWVITA SALON
        </h3>

        {/* Main heading */}
        <h1
          className="text-[34px] sm:text-[44px] md:text-[56px] lg:text-[70px] leading-[115%] font-bold max-w-full sm:max-w-[85%] md:max-w-[70%] lg:max-w-[510px]"
          style={{
            fontFamily: "'Playfair Display', serif",
            letterSpacing: "-0.01em",
            color: "#F7E5C1",
          }}
        >
          Find a service
          <br />
          close to you
        </h1>

        {/* Sub-description */}
        <p
          className="text-sm sm:text-[15px] md:text-base lg:text-[18px] leading-[170%] text-white max-w-full sm:max-w-[85%] md:max-w-[65%] lg:max-w-[508px]"
          style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 400 }}
        >
          Experience convenience by discovering salons and
          specialists in your area, ready to provide excellent self-care
          services.
        </p>

        {/* ── Search Bar ─────────────────────────────────────────────────── */}
        <div
          className="bg-white shadow-2xl w-full max-w-[865px] flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-0 rounded-2xl md:rounded-full px-4 md:pl-10 md:pr-3.5 py-3 md:py-3"
        >
          {/* Service + Address inputs wrapper */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center flex-1 gap-3 md:gap-6 md:border-r md:border-gray-200 md:pr-6">

            {/* Service Input */}
            <div className="relative flex-1 flex items-center gap-3">
              <div className="flex flex-col flex-1">
                {!serviceInput && (
                  <label className="text-xs font-medium mb-0.5" style={{ color: "#BA7894" }}>
                    Service Name
                  </label>
                )}
                <input
                  type="text"
                  placeholder="Book your services..."
                  value={serviceInput}
                  onChange={(e) => {
                    setServiceInput(e.target.value);
                    if (selectedCategoryId) {
                      const trimmed = e.target.value.toLowerCase().trim();
                      const stillMatches = categoriesData?.categories?.find(
                        (c: any) => c._id === selectedCategoryId && c.name?.toLowerCase().trim() === trimmed
                      );
                      if (!stillMatches) {
                        setSelectedCategoryId("");
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  onFocus={() => setIsServiceFocused(true)}
                  onBlur={() => setTimeout(() => setIsServiceFocused(false), 200)}
                  className="outline-none text-gray-800 placeholder-gray-400 text-sm w-full"
                />
              </div>
              <Scissors className="w-4 h-4 text-gray-400 flex-shrink-0" />

              {/* Service Suggestions */}
              {isServiceFocused && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 md:right-auto md:w-[400px] mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 max-h-60 overflow-y-auto no-scrollbar">
                  {suggestions.map((item: any) => (
                    <button
                      key={item._id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSuggestionSelection(item);
                      }}
                      className="w-full text-left px-4 sm:px-5 py-3 hover:bg-amber-50 flex items-center justify-between group transition-colors"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div
                          className={cn(
                            "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 flex-shrink-0",
                            item.type === "category" ? "bg-purple-100/50" : "bg-amber-100/50"
                          )}
                        >
                          {item.type === "category" ? (
                            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
                          ) : item.type === "salon" ? (
                            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                          ) : (
                            <Scissors className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-gray-900 font-bold text-xs sm:text-sm tracking-tight truncate">
                            {item.name}
                          </span>
                          <span className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            {item.type}
                          </span>
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Divider between inputs on mobile/tablet-portrait */}
            <div className="block md:hidden h-px w-full bg-gray-100" />

            {/* Location Input */}
            <div className="relative flex-1 flex items-center gap-3">
              <div className="flex flex-col flex-1">
                {!locationInput && (
                  <label className="text-xs font-medium mb-0.5" style={{ color: "#BA7894" }}>
                    Address
                  </label>
                )}
                <input
                  type="text"
                  placeholder="Neighbourhood, city or area…"
                  value={locationInput}
                  onChange={(e) => handleLocationInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  onFocus={() => setIsLocationFocused(true)}
                  onBlur={() => setTimeout(() => setIsLocationFocused(false), 200)}
                  className="outline-none text-gray-800 placeholder-gray-400 text-sm w-full"
                />
              </div>

              {/* Green dot = coords resolved */}
              {selectedLat != null ? (
                <div className="relative flex-shrink-0">
                  <MapPin className="w-4 h-4 text-green-500" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                </div>
              ) : (
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}

              {/* Location Dropdown */}
              {isLocationFocused && (locationPredictions.length > 0 || !locationInput) && (
                <div className="absolute top-full left-0 right-0 md:right-auto md:w-[380px] mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 max-h-64 overflow-y-auto no-scrollbar">
                  {/* Current Location */}
                  {!locationInput && (
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleCurrentLocation();
                        setIsLocationFocused(false);
                      }}
                      className="w-full text-left px-4 sm:px-5 py-3 hover:bg-amber-50 flex items-center gap-2 sm:gap-3 transition-colors group"
                    >
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-100 group-hover:bg-amber-200 transition-colors flex items-center justify-center flex-shrink-0">
                        <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-gray-900 font-bold text-xs sm:text-sm tracking-tight truncate">
                          {isLocating ? "Locating…" : "Use Current Location"}
                        </span>
                        <span className="text-[8px] sm:text-[9px] text-gray-400 font-black uppercase">
                          Instant Search
                        </span>
                      </div>
                    </button>
                  )}

                  {locationPredictions.map((prediction, i) => (
                    <button
                      key={i}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectPrediction(prediction);
                      }}
                      className="w-full text-left px-4 sm:px-5 py-3 hover:bg-amber-50 flex items-center gap-2 sm:gap-3 transition-colors group"
                    >
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-100 group-hover:bg-amber-100 transition-colors flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 group-hover:text-amber-600" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-gray-800 font-bold text-xs sm:text-sm tracking-tight truncate">
                          {prediction.structured_formatting?.main_text || prediction.description}
                        </span>
                        <span className="text-[9px] text-gray-400 truncate">
                          {prediction.structured_formatting?.secondary_text || ""}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="text-white font-medium transition-all duration-300 flex items-center justify-center gap-2 flex-shrink-0 disabled:opacity-70 w-full md:w-[127px] h-11 md:h-[44px] lg:h-[35px] rounded-full md:rounded-[21px] mt-1 md:mt-0 md:ml-3 text-sm md:text-base"
            style={{ backgroundColor: "#BA7894" }}
          >
            {isSearching ? "Searching…" : "Search"}
            <Sparkles className="w-4 h-4" />
          </button>
        </div>

        {/* Service Categories Marquee */}
        <div className="max-w-4xl overflow-hidden relative rounded-full py-1">
          <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-r from-[rgba(45,28,48,0.95)] via-[rgba(45,28,48,0.7)] to-transparent z-10 pointer-events-none"></div>
          <div className="flex gap-3 animate-marquee hover:[animation-play-state:paused]">
            {categoriesLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  style={{ width: 113, height: 36, opacity: 1 }}
                  className="bg-white bg-opacity-10 backdrop-blur-sm border border-white rounded-full flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0 animate-pulse"
                >
                  <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-gray-300 rounded-full" />
                  <div className="h-3.5 sm:h-4 bg-gray-300 rounded w-12 sm:w-16" />
                </div>
              ))
              : [...marqueeCategories, ...marqueeCategories].map((cat: any, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    setServiceInput(cat.label);
                  }}
                  style={{
                    width: 113,
                    height: 36,
                    border: "1px solid #FFFFFF",
                    opacity: 1,
                  }}
                  className="bg-white bg-opacity-10 backdrop-blur-sm hover:bg-opacity-20 text-white rounded-full text-xs sm:text-sm font-medium transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0"
                >
                  <cat.icon style={{ width: 20, height: 20, opacity: 1 }} />
                  <span
                    style={{ width: 49, height: 18, opacity: 1 }}
                    className="overflow-hidden text-ellipsis inline-block leading-[18px]"
                  >
                    {cat.label}
                  </span>
                </button>
              ))}
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-l from-[rgba(45,28,48,0.95)] via-[rgba(45,28,48,0.7)] to-transparent z-10 pointer-events-none"></div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection2;