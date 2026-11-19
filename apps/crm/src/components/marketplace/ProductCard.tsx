"use client";

import Image from "next/image";
import { Card } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { ShoppingCart, Star, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@repo/ui/cn";
import { useAddToCartMutation } from "@repo/store/api";
import { toast } from "sonner";
import { getMarketplaceProductImage, MARKETPLACE_PRODUCT_PLACEHOLDER_IMAGE } from "@/app/marketplace/components/productImage";

interface ProductCardProps {
  product: {
    _id: string;
    productImage: string;
    productName: string;
    price: number;
    salePrice?: number;
    category?: string | { name: string; _id?: string };
    stock: number;
    vendorId: string;
    supplierName: string;
    supplierEmail: string;
    description: string;
    discount?: number;
    rating?: number;
    reviewCount?: number;
  };
  onQuickAddToCart: (product: any, e: React.MouseEvent) => void;
  onViewDetails: (product: any) => void;
  onBuyNow: (product: any, e: React.MouseEvent) => void;
  onViewSupplier: (e: React.MouseEvent, supplierId: string) => void;
}

export function ProductCard({
  product,
  onQuickAddToCart,
  onViewDetails,
  onBuyNow,
  onViewSupplier
}: ProductCardProps) {
  const [addToCart] = useAddToCartMutation();
  
  const rating = product.rating || 0;
  const reviewCount = product.reviewCount || 0;
  const [productImageSrc, setProductImageSrc] = useState(getMarketplaceProductImage(product.productImage));

  useEffect(() => {
    setProductImageSrc(getMarketplaceProductImage(product.productImage));
  }, [product.productImage]);

  const isOutOfStock = !product.stock || product.stock <= 0;
  const categoryName = typeof product.category === 'string' 
    ? product.category 
    : (product.category?.name || 'Uncategorized');

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) {
      toast.error('This product is currently out of stock.');
      return;
    }
    onQuickAddToCart(product, e);
  };

  const handleBuyNowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) {
      toast.error('This product is currently out of stock.');
      return;
    }
    onBuyNow(product, e);
  };

  const handleViewDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewDetails(product);
  };

  const calculateDiscountPercentage = () => {
    if (product.salePrice && product.price > product.salePrice) {
      return Math.round(((product.price - product.salePrice) / product.price) * 100);
    }
    return 0;
  };

  const discountPercentage = calculateDiscountPercentage();

  return (
    <Card
      className="group overflow-hidden hover:shadow-md transition-shadow flex flex-col text-left cursor-pointer"
      onClick={handleViewDetailsClick}
    >
      <div className="relative aspect-square overflow-hidden rounded-md m-3">
        <Image
          src={productImageSrc}
          alt={product.productName}
          fill
          className="group-hover:scale-105 transition-transform duration-300 object-cover"
          onError={() => setProductImageSrc(MARKETPLACE_PRODUCT_PLACEHOLDER_IMAGE)}
        />
        
        {/* Out of Stock Badge */}
        {isOutOfStock && (
          <div className="absolute top-2 left-2 text-xs">
            <Badge 
              variant="destructive"
              className="text-xs font-medium bg-red-100 text-red-800 border-red-200"
            >
              Out of stock
            </Badge>
          </div>
        )}
        
        {/* Discount Badge */}
        {discountPercentage > 0 && (
          <div className="absolute top-2 right-2">
            <div className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">
              {discountPercentage}% OFF
            </div>
          </div>
        )}

        {/* View Details Button */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button 
            size="sm" 
            variant="secondary" 
            className="h-8 w-8 p-0 rounded-full"
            onClick={handleViewDetailsClick}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="p-3 flex flex-col flex-grow">
        <p className="text-xs font-bold text-primary mb-1">
          {categoryName}
        </p>
        <h4 className="text-sm font-semibold flex-grow mb-2">
          {product.productName}
        </h4>
        

        <div className="flex justify-between items-center mt-auto">
          <div>
            {product.salePrice && product.salePrice < product.price ? (
              <>
                <p className="font-bold text-primary">
                  ₹{product.salePrice.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground line-through">
                  ₹{product.price.toFixed(2)}
                </p>
              </>
            ) : (
              <p className="font-bold text-primary">
                ₹{product.price.toFixed(2)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-2">
          {/* Dynamic Reviews */}
          <div className="flex items-center gap-1 shrink-0">
            <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-semibold">{rating > 0 ? rating : '0'}</span>
            <span className="text-[10px] text-muted-foreground">({reviewCount})</span>
          </div>

          <div className="flex justify-end gap-2 w-full">
            <Button
              size="sm"
              variant="outline"
              className="text-xs px-2"
              onClick={handleBuyNowClick}
              disabled={isOutOfStock}
            >
              Buy Now
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="w-fit text-xs px-2"
              onClick={handleAddToCart}
              disabled={isOutOfStock}
            >
              <ShoppingCart className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
