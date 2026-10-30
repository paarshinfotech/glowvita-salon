"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { useGetPublicProductsQuery } from "@repo/store/api";
import { useSalonFilter } from "@/components/landing/SalonFilterContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import {
  DollarSign,
  RotateCcw,
  Globe,
  Leaf,
  Search,
  Filter,
  Grid,
  List,
  Star,
  TrendingUp,
  Package,
  Shield,
  CheckCircle,
  Users,
  ChevronRight,
  ChevronLeft,
  Lightbulb,
  Heart,
} from "lucide-react";
import { PageContainer } from "@repo/ui/page-container";
import { Badge } from "@repo/ui/badge";
import { Dialog, DialogContent } from "@repo/ui/dialog";
import { Label } from "@repo/ui/label";
import ProductCard from "@/components/ProductCard";
import HeroSection from "./components/HeroSection";
import ProductsGrid from "./components/ProductsGrid";
import FilterComponent from "./components/FilterComponent";
import RecentlyAddedProducts from "./components/RecentlyAddedProducts";
import Testimonials from "./components/Testimonials";
import { ChevronDown } from "lucide-react";
import DownloadApp from "@/components/landing/DownloadApp";

// Product type definition
interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  hint: string;
  rating: number;
  reviewCount: number;
  vendorName: string;
  vendorId: string;
  isNew?: boolean;
  description: string;
  category: string;
  forBodyPart?: string;
  brand?: string;
  bodyPartType?: string;
  salePrice?: number;
  stock?: number;
  productImages?: string[];
}

const ProductHighlightCard = ({
  title,
  products,
  className = "",
  isLarge = false,
}: {
  title: string;
  products: Product[];
  className?: string;
  isLarge?: boolean;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHoveblue, setIsHoveblue] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(() => {
    resetTimeout();
    if (!isHoveblue) {
      timeoutRef.current = setTimeout(
        () => setCurrentIndex((prevIndex) => (prevIndex + 1) % products.length),
        3000
      );
    }
    return () => resetTimeout();
  }, [currentIndex, isHoveblue, products.length]);

  const nextProduct = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prevIndex) => (prevIndex + 1) % products.length);
  };

  const prevProduct = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(
      (prevIndex) => (prevIndex - 1 + products.length) % products.length
    );
  };

  if (!products || products.length === 0) return null;

  return (
    <div
      className={`relative rounded-md md:rounded-2xl flex flex-col justify-between group transition-all duration-300 ease-in-out bg-background/50 backdrop-blur-sm ${className}`}
      onMouseEnter={() => setIsHoveblue(true)}
      onMouseLeave={() => setIsHoveblue(false)}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="relative z-10 h-full flex flex-col">
        <h3
          className={`font-bold mb-2 md:mb-2 ${isLarge ? "text-xl sm:text-2xl lg:text-3xl" : "text-base sm:text-lg md:text-xl"}`}
        >
          {title}
        </h3>
        <div className="relative flex-1 rounded-lg md:rounded-md overflow-hidden">
          {products.map((product: Product, index: number) => (
            <img
              key={product.id}
              src={product.image}
              alt={product.name}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${index === currentIndex ? "opacity-100" : "opacity-0"}`}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

          <div
            className={`absolute bottom-0 left-0 right-0 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isLarge ? "p-3 md:p-4 lg:p-5" : "p-2 md:p-3"}`}
          >
            <h4
              className={`font-bold truncate ${isLarge ? "text-base sm:text-lg md:text-xl" : "text-sm md:text-base"}`}
            >
              {products[currentIndex]?.name}
            </h4>
            <p
              className={`truncate opacity-90 ${isLarge ? "text-sm md:text-base" : "text-xs md:text-sm"}`}
            >
              {products[currentIndex]?.vendorName}
            </p>
            <div className="flex justify-between items-center mt-1 md:mt-2">
              <div className="flex items-center gap-2">
                {products[currentIndex]?.salePrice && products[currentIndex]?.salePrice > 0 ? (
                  <>
                    <p className={`font-bold ${isLarge ? "text-sm md:text-base lg:text-lg" : "text-xs md:text-sm"}`}>
                      ₹{products[currentIndex]?.salePrice.toFixed(2)}
                    </p>
                    <p className="text-[10px] md:text-xs text-white/70 line-through">
                      ₹{products[currentIndex]?.price.toFixed(2)}
                    </p>
                    <span className="text-[9px] md:text-[10px] font-bold text-green-400 bg-green-400/10 px-1 py-0.5 rounded">
                      {Math.round(((products[currentIndex]?.price - products[currentIndex]?.salePrice) / products[currentIndex]?.price) * 100)}% OFF
                    </span>
                  </>
                ) : (
                  <p className={`font-bold ${isLarge ? "text-sm md:text-base lg:text-lg" : "text-xs md:text-sm"}`}>
                    ₹{products[currentIndex]?.price.toFixed(2)}
                  </p>
                )}
              </div>
              {isLarge && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full text-xs md:text-sm px-3 py-1 md:px-4 md:py-2"
                >
                  View
                </Button>
              )}
            </div>
          </div>

          <div
            className={`absolute flex gap-1 md:gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isLarge ? "top-3 right-3 md:top-4 md:right-4" : "top-2 right-2 md:top-3 md:right-3"}`}
          >
            <Button
              size="icon"
              variant="ghost"
              className={`bg-white/20 text-white rounded-full hover:bg-white/30 backdrop-blur-sm transition-all duration-200 ${isLarge ? "h-7 w-7 md:h-8 md:w-8 lg:h-9 lg:w-9" : "h-6 w-6 md:h-7 md:w-7"}`}
              onClick={prevProduct}
            >
              <ChevronLeft
                className={`${isLarge ? "h-3 w-3 md:h-4 md:w-4" : "h-3 w-3"}`}
              />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={`bg-white/20 text-white rounded-full hover:bg-white/30 backdrop-blur-sm transition-all duration-200 ${isLarge ? "h-7 w-7 md:h-8 md:w-8 lg:h-9 lg:w-9" : "h-6 w-6 md:h-7 md:w-7"}`}
              onClick={nextProduct}
            >
              <ChevronRight
                className={`${isLarge ? "h-3 w-3 md:h-4 md:w-4" : "h-3 w-3"}`}
              />
            </Button>
          </div>

          {/* Product indicators for mobile */}
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1 md:hidden">
            {products.map((_, index) => (
              <div
                key={index}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${index === currentIndex ? "bg-white" : "bg-white/40"
                  }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AllProductsPage() {
  const { userLat, userLng, locationLabel } = useSalonFilter();

  // Fetch approved products from API
  const {
    data: productsApiData,
    isLoading,
    error: apiError,
  } = useGetPublicProductsQuery({
    lat: userLat || undefined,
    lng: userLng || undefined,
  });

  console.log("Products on all products page : ", productsApiData);

  const [products, setProducts] = useState<Product[]>([]);
  const [filteblueProducts, setFilteblueProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid");

  // New state for filters
  const [selectedBodyParts, setSelectedBodyParts] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [sortBy, setSortBy] = useState("featured");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Extract unique body parts, brands from products data
  const allBodyParts = React.useMemo(() => {
    if (!productsApiData?.products) return [];
    const uniqueBodyParts = new Set<string>();
    productsApiData.products.forEach((product: Product) => {
      if (product.forBodyPart) {
        uniqueBodyParts.add(product.forBodyPart);
      }
    });
    return Array.from(uniqueBodyParts);
  }, [productsApiData]);

  const allBrands = React.useMemo(() => {
    if (!productsApiData?.products) return [];
    const uniqueBrands = new Set<string>();
    productsApiData.products.forEach((product: Product) => {
      if (product.brand) {
        uniqueBrands.add(product.brand);
      }
    });
    return Array.from(uniqueBrands);
  }, [productsApiData]);

  // Initialize products with API data -- deduplicate by id to prevent double entries
  useEffect(() => {
    if (productsApiData?.products) {
      const seen = new Set<string>();
      const unique = (productsApiData.products as Product[]).filter((p) => {
        const key = String(p.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setProducts(unique);
      setFilteblueProducts(unique);
    }
  }, [productsApiData]);

  // Filter and sort products
  useEffect(() => {
    // Global filter: Only show products with stock > 0
    let result = products.filter(p => (p.stock || 0) > 0);

    // Apply search filter
    if (searchTerm) {
      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply body part filter
    if (selectedBodyParts.length > 0) {
      result = result.filter((product) =>
        selectedBodyParts.includes(product.forBodyPart || "")
      );
    }

    // Apply brand filter
    if (selectedBrand.length > 0) {
      result = result.filter((product) =>
        selectedBrand.includes(product.brand || "")
      );
    }

    // Apply rating filter
    if (ratingFilter === "high-to-low") {
      result = result.sort((a, b) => b.rating - a.rating);
    } else if (ratingFilter === "low-to-high") {
      result = result.sort((a, b) => a.rating - b.rating);
    }

    // Apply price range filter
    result = result.filter(
      (product) => {
        const effectivePrice = (product.salePrice && product.salePrice > 0) ? product.salePrice : product.price;
        return effectivePrice >= priceRange[0] && effectivePrice <= priceRange[1];
      }
    );

    // Apply sorting
    switch (sortBy) {
      case "newest":
        result = result.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
      case "price-low":
        result = result.sort((a, b) => {
          const priceA = (a.salePrice && a.salePrice > 0) ? a.salePrice : a.price;
          const priceB = (b.salePrice && b.salePrice > 0) ? b.salePrice : b.price;
          return priceA - priceB;
        });
        break;
      case "price-high":
        result = result.sort((a, b) => {
          const priceA = (a.salePrice && a.salePrice > 0) ? a.salePrice : a.price;
          const priceB = (b.salePrice && b.salePrice > 0) ? b.salePrice : b.price;
          return priceB - priceA;
        });
        break;
      case "rating":
        result = result.sort((a, b) => b.rating - a.rating);
        break;
      case "featured":
      default:
        // Keep original order for featured
        break;
    }

    setFilteblueProducts(result);
  }, [
    searchTerm,
    products,
    selectedBodyParts,
    selectedBrand,
    ratingFilter,
    priceRange,
    sortBy,
  ]);

  // Calculate dynamic stats
  const uniqueVendors = new Set(filteblueProducts.map((p) => p.vendorId)).size;
  const totalProducts = filteblueProducts.length;
  const averageRating =
    filteblueProducts.length > 0
      ? (
        filteblueProducts.reduce((acc, p) => acc + p.rating, 0) /
        filteblueProducts.length
      ).toFixed(1)
      : "0.0";

  const bentoGridProducts = {
    newArrivals: filteblueProducts.slice(0, 3),
    topRated: filteblueProducts.slice(3, 6),
    bestSellers: filteblueProducts.slice(6, 9),
  };

  const resetFilters = () => {
    setSelectedBodyParts([]);
    setSelectedBrand([]);
    setRatingFilter("all");
    setSortBy("featured");
  };

  // Flash sale auto-scroll
  const flashScrollRef = useRef<HTMLDivElement>(null);
  const flashScrollPaused = useRef(false);

  useEffect(() => {
    const el = flashScrollRef.current;
    if (!el) return;
    let animId: number;
    const speed = 0.6; // px per frame

    const step = () => {
      if (!flashScrollPaused.current && el) {
        el.scrollLeft += speed;
        // Reset to start when reached the end
        if (el.scrollLeft + el.clientWidth >= el.scrollWidth) {
          el.scrollLeft = 0;
        }
      }
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [products]);

  return (
    <PageContainer padding="none">
      <Suspense fallback={<div className="min-h-screen bg-background animate-pulse" />}>
        <HeroSection onSearch={setSearchTerm} />
        {/* <RecentlyAddedProducts /> */}

        {/* Shared background: Filter + Flash Sale */}
        <div className="w-full overflow-hidden" style={{ background: "linear-gradient(3.99deg, #EBF3FD 46.89%, #FFFFFF 96.85%)" }}>

          {/* Filters Row */}
          <FilterComponent
            allBodyParts={allBodyParts}
            allBrands={allBrands}
            selectedBodyParts={selectedBodyParts}
            setSelectedBodyParts={setSelectedBodyParts}
            selectedBrand={selectedBrand}
            setSelectedBrand={setSelectedBrand}
            ratingFilter={ratingFilter}
            setRatingFilter={setRatingFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            resetFilters={resetFilters}
            priceRange={priceRange as [number, number]}
            setPriceRange={(r) => setPriceRange(r)}
          />

          {/* Flash Sale Section */}
          {products.filter(p => p.salePrice && p.salePrice < p.price).length > 0 && (
            <div className="w-full pt-3 pb-0">

              <style dangerouslySetInnerHTML={{
                __html: `
              .flash-sale-scroll::-webkit-scrollbar { display: none; }
              .flash-sale-title { font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 28px; line-height: 38px; letter-spacing: 0; color: #000; display: flex; align-items: center; gap: 0; }
              .flash-bolt { display: inline-flex; align-items: center; justify-content: center; color: #111; background: none; padding: 0; margin: 0 2px; width: 26px; height: 26px; }
              .flash-word-gap { display: inline-block; width: 10px; }
              .flash-sale-underline { width: 190px; height: 3px; background: linear-gradient(90deg, #422A3C 0%, #FFFFFF 100%); margin-top: 6px; border: none; }
            `}} />
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                {/* Heading row */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="flash-sale-title">
                      <span>FLA</span>
                      <span className="flash-bolt">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '26px', height: '26px', display: 'block' }}>
                          <path d="M13 2L4.09 13.5H11L10 22L20.91 10.5H14L13 2Z" />
                        </svg>
                      </span>
                      <span>H</span>
                      <span className="flash-word-gap" />
                      <span>SALE</span>
                    </div>
                    <div className="flash-sale-underline" />
                  </div>
                </div>

                {/* Horizontal scroll row — infinite auto-scroll */}
                <div
                  ref={flashScrollRef}
                  className="flash-sale-scroll flex w-full overflow-x-auto gap-4 pb-4"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none", overflowX: "hidden" }}
                  onMouseEnter={() => { flashScrollPaused.current = true; }}
                  onMouseLeave={() => { flashScrollPaused.current = false; }}
                >
                  {/* Render each sale product exactly once */}
                  {products.filter(p => p.salePrice && p.salePrice < p.price)
                    .map((product, idx) => (
                      <div
                        key={`${product.id}-${idx}`}
                        className="shrink-0"
                        style={{ width: "260px" }}
                      >
                        <ProductCard {...product} />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>{/* end shared background wrapper */}

        <div className="pb-8 pt-0">
          {/* 5. Product Grid */}
          <ProductsGrid
            products={filteblueProducts}
            isLoading={isLoading}
            apiError={apiError}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            viewMode={viewMode}
            setViewMode={setViewMode}
            filteblueProducts={filteblueProducts}
            setIsFilterModalOpen={setIsFilterModalOpen}
            noServiceArea={productsApiData?.noServiceArea}
          />
        </div>

        <div className="pb-8 pt-0">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            <main className="lg:col-span-12">
              {/* 8. Testimonials Section */}
              <Testimonials />
            </main>
          </div>
        </div>
        <DownloadApp />
      </Suspense>
    </PageContainer>
  );

}

// Separator Component for local use
const Separator = ({
  orientation = "horizontal",
  className = "",
}: {
  orientation?: "horizontal" | "vertical";
  className?: string;
}) => (
  <div
    className={`bg-border ${orientation === "horizontal" ? "h-px w-full" : "h-full w-px"} ${className}`}
  />
);
