import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Search, Package, X, ShoppingCart, Star } from 'lucide-react';
import NextImage from 'next/image';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { useEffect, useState } from 'react';
import { getMarketplaceProductImage, MARKETPLACE_PRODUCT_PLACEHOLDER_IMAGE } from './productImage';



interface Product {
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
}

interface MarketplaceProductsSectionProps {
  filteredProducts: Product[];
  isLoading: boolean;
  searchTerm: string;
  viewMode: 'grid' | 'list';
  onSearchClear: () => void;
  onQuickAddToCart: (product: Product, e: React.MouseEvent) => void;
  onViewDetails: (product: Product) => void;
  onBuyNow: (product: Product, e: React.MouseEvent) => void;
  onViewSupplier: (e: React.MouseEvent, supplierId: string) => void;
}

const ProductListImage = ({ product }: { product: Product }) => {
  const [imageSrc, setImageSrc] = useState(getMarketplaceProductImage(product.productImage));

  useEffect(() => {
    setImageSrc(getMarketplaceProductImage(product.productImage));
  }, [product.productImage]);

  return (
    <NextImage
      src={imageSrc}
      alt={product.productName}
      fill
      className="object-cover"
      onError={() => setImageSrc(MARKETPLACE_PRODUCT_PLACEHOLDER_IMAGE)}
    />
  );
};

export const MarketplaceProductsSection = ({
  filteredProducts,
  isLoading,
  searchTerm,
  viewMode,
  onSearchClear,
  onQuickAddToCart,
  onViewDetails,
  onBuyNow,
  onViewSupplier
}: MarketplaceProductsSectionProps) => {
  return (
    <Card className="bg-card border border-border rounded-lg">
      <CardContent className="p-6">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product: Product, index: number) => (
              <ProductCard
                key={product._id}
                product={product}
                onQuickAddToCart={onQuickAddToCart}
                onViewDetails={onViewDetails}
                onBuyNow={(product, e) => {
                  e.stopPropagation();
                  onBuyNow(product, e);
                }}
                onViewSupplier={(e, supplierId) => {
                  e.stopPropagation();
                  onViewSupplier(e, supplierId);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product: Product, index: number) => (
              <Card
                key={product._id}
                className="border border-border bg-card rounded-lg transition-all duration-200 hover:shadow-md cursor-pointer"
                onClick={() => onViewDetails(product)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-md overflow-hidden border border-border/30 flex-shrink-0">
                      <ProductListImage product={product} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 space-y-1">
                          <h3 className="font-medium text-foreground">
                            {product.productName}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {typeof product.category === 'string' ? product.category : product.category?.name || 'Uncategorized'}
                            </Badge>
                            {(!product.stock || product.stock <= 0) && (
                              <Badge
                                variant="destructive"
                                className="text-xs bg-red-100 text-red-800 border-red-200"
                              >
                                Out of stock
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="mb-2">
                            {product.salePrice && product.salePrice < product.price ? (
                              <>
                                <span className="font-semibold text-primary">
                                  ₹{product.salePrice.toFixed(0)}
                                </span>
                                <span className="text-xs text-muted-foreground line-through ml-2">
                                  ₹{product.price.toFixed(0)}
                                </span>
                              </>
                            ) : (
                              <span className="font-semibold text-primary">
                                ₹{product.price.toFixed(0)}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2 items-center">
                            {/* Dynamic Reviews */}
                            <div className="flex items-center gap-1 shrink-0 mr-auto">
                              <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                              <span className="text-xs font-semibold">{product.rating && product.rating > 0 ? product.rating : '0'}</span>
                              <span className="text-[10px] text-muted-foreground">({product.reviewCount || 0})</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!product.stock || product.stock <= 0) return;
                                onBuyNow(product, e);
                              }}
                              className="h-7 px-3 text-xs"
                              disabled={!product.stock || product.stock <= 0}
                            >
                              Buy Now
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!product.stock || product.stock <= 0) return;
                                onQuickAddToCart(product, e);
                              }}
                              className="h-7 px-3 text-xs"
                              disabled={!product.stock || product.stock <= 0}
                            >
                              <ShoppingCart className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {filteredProducts.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 mb-4 bg-muted/20 rounded-xl flex items-center justify-center border border-border">
              <Search className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">No products found</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6">
              No products match your search criteria.
            </p>
          </div>
        )}

        {filteredProducts.length > 20 && (
          <div className="text-center mt-12">
            <Button
              variant="outline"
              size="lg"
              className="px-10 py-4 rounded-lg border-dashed border-2 border-border hover:border-primary hover:bg-primary/5 transition-all duration-300 bg-background h-14 text-base"
              onClick={() => {
              }}
            >
              <Package className="h-5 w-5 mr-3" />
              Load More Products
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
