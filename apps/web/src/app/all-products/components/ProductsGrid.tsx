"use client";

import React, { useState } from "react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Search, Filter, Grid, List, MapPin, CheckCircle } from "lucide-react";
import ProductCard from "@/components/ProductCard";
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

interface ProductsGridProps {
  products: Product[];
  isLoading: boolean;
  apiError: any;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  viewMode: string;
  setViewMode: (mode: string) => void;
  filteblueProducts: Product[];
  setIsFilterModalOpen: (open: boolean) => void;
  noServiceArea?: boolean;
}

const ProductsGrid: React.FC<ProductsGridProps> = ({
  products,
  isLoading,
  apiError,
  searchTerm,
  setSearchTerm,
  viewMode,
  setViewMode,
  filteblueProducts,
  setIsFilterModalOpen,
  noServiceArea,
}) => {
  return (
    <section className="pt-8 pb-4 container mx-auto px-4 sm:px-6 lg:px-8 bg-background">
      {/* Section Header */}
      <div className="mb-2">
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@700&display=swap" />
        <div style={{ display: 'inline-block', maxWidth: '100%' }}>
          <h2
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 700,
              fontSize: '28px',
              lineHeight: '38px',
              color: '#000000',
              maxWidth: '237px',
              height: '38px',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            All Products
          </h2>
          <div
            style={{
              width: '100%',
              maxWidth: '237px',
              height: '3px',
              marginTop: '6px',
              background: 'linear-gradient(90deg, #422A3C 0%, #FFFFFF 100%)',
              border: 'none',
            }}
          />
        </div>
      </div>

      {/* Search Bar - New Design */}
      <div className="mb-4 p-4 rounded-md flex flex-col sm:flex-row gap-4 items-center shadow-sm">
        <div className="relative flex-1 w-full">
          <Input
            placeholder="Search for products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12 rounded-md w-full bg-background border focus:border-primary transition-all"
          />
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Results count */}

      <div className="mb-6 px-8">
        <p className="text-muted-foreground">
          Showing {filteblueProducts.length} products
          {searchTerm && ` for "${searchTerm}"`}
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading products...</p>
        </div>
      ) : apiError ? (
        <div className="text-center py-12">
          <p className="text-destructive">
            Failed to load products. Please try again later.
          </p>
        </div>
      ) : noServiceArea ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-border">
          <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-10 h-10 text-primary/30" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-3">We're not available here yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-8 font-medium">
            We are currently expanding our product delivery network and haven't reached your location yet.
            We’ll be available in your area soon—stay tuned!
          </p>
          <Button
            onClick={() => window.location.href = "/all-products"}
            className="rounded-full px-8"
          >
            Explore all products
          </Button>
        </div>
      ) : filteblueProducts.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-border">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">No products found matching your search or filters.</p>
          <Button
            variant="outline"
            className="mt-6 rounded-full"
            onClick={() => setSearchTerm("")}
          >
            Clear search
          </Button>
        </div>
      ) : (
        // <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-15 sm:gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3 sm:gap-4">

          {filteblueProducts.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      )}
    </section>
  );
};

export default ProductsGrid;
