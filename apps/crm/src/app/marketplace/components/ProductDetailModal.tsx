import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@repo/ui/dialog';
import { Badge } from '@repo/ui/badge';
import { Button } from '@repo/ui/button';
import { Label } from '@repo/ui/label';
import { Input } from '@repo/ui/input';
import { Star, Building, ShoppingCart, Zap, Minus, Plus, Package, Tag } from 'lucide-react';
import Image from 'next/image';
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
}

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onAddToCart: (product: Product, quantity: number) => void;
  isAddingToCart: boolean;
  onBuyNow: (product: Product) => void;
}

export const ProductDetailModal = ({
  isOpen,
  onClose,
  product,
  quantity,
  onQuantityChange,
  onAddToCart,
  isAddingToCart,
  onBuyNow
}: ProductDetailModalProps) => {
  const [productImageSrc, setProductImageSrc] = useState(MARKETPLACE_PRODUCT_PLACEHOLDER_IMAGE);

  useEffect(() => {
    setProductImageSrc(getMarketplaceProductImage(product?.productImage));
  }, [product?.productImage]);

  if (!product) return null;

  const finalPrice = product.salePrice || product.price;
  const hasDiscount = product.salePrice && product.price > product.salePrice;
  const isOutOfStock = !product.stock || product.stock <= 0;

  const getCategoryName = (category: any) => {
    if (!category) return 'Uncategorized';
    if (typeof category === 'string') return category;
    if (typeof category === 'object' && category.name) return category.name;
    return 'Uncategorized';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-bold">{product.productName}</DialogTitle>
          <DialogDescription className="text-sm">
            Product details and specifications
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid md:grid-cols-2 gap-6 py-4">
          {/* Product Image */}
          <div>
            <div className="relative aspect-square rounded-lg overflow-hidden border border-border">
              <Image
                src={productImageSrc}
                alt={product.productName}
                fill
                className="object-cover"
                onError={() => setProductImageSrc(MARKETPLACE_PRODUCT_PLACEHOLDER_IMAGE)}
              />
              {/* Stock Badge */}
              <div className="absolute top-3 left-3">
                <Badge 
                  variant={isOutOfStock ? "destructive" : product.stock > 10 ? "secondary" : "outline"} 
                  className="rounded-full"
                >
                  {!isOutOfStock ? `${product.stock} in stock` : 'Out of stock'}
                </Badge>
              </div>
              {/* Discount Badge */}
              {hasDiscount && (
                <div className="absolute top-3 right-3">
                  <Badge className="rounded-full bg-primary">
                    Save ₹{(product.price - product.salePrice!).toFixed(0)}
                  </Badge>
                </div>
              )}
            </div>
          </div>
          
          {/* Product Details */}
          <div className="space-y-4">
            {/* Price & Stock */}
            <div className="pb-4 border-b">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-2xl font-bold text-primary">
                  ₹{finalPrice.toFixed(0)}
                </span>
                {hasDiscount && (
                  <span className="text-base text-muted-foreground line-through">
                    ₹{product.price.toFixed(0)}
                  </span>
                )}
              </div>
              <p className={`text-sm ${isOutOfStock ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                {isOutOfStock ? 'Out of stock' : `${product.stock} units available`}
              </p>
            </div>

            {/* Supplier */}
            <div className="flex items-center gap-2 pb-4 border-b">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{product.supplierName || 'Supplier'}</span>
            </div>

            {/* Category & Rating */}
            <div className="grid grid-cols-2 gap-4 pb-4 border-b">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Category</Label>
                <Badge variant="outline" className="rounded-full text-xs">
                  {getCategoryName(product.category)}
                </Badge>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Rating</Label>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="text-xs font-medium ml-1.5">4.5</span>
                </div>
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <div className="pb-4 border-b">
                <Label className="text-xs text-muted-foreground mb-2 block">Description</Label>
                <p className="text-sm text-foreground leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}
            
            {/* Quantity Selector */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Quantity</Label>
              {!isOutOfStock ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 rounded-none hover:bg-muted" 
                      onClick={() => onQuantityChange(Math.max(1, quantity-1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <div className="w-16 h-9 flex items-center justify-center border-x border-border">
                      <span className="text-sm font-semibold">{quantity}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 rounded-none hover:bg-muted" 
                      onClick={() => onQuantityChange(Math.min(product.stock, quantity+1))}
                      disabled={quantity >= product.stock}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold text-primary">
                      ₹{(finalPrice * quantity).toFixed(0)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium">
                  This product is currently out of stock and cannot be ordered.
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                className="flex-1 h-10 rounded-lg" 
                onClick={() => {
                  if (isOutOfStock) return;
                  onAddToCart(product, quantity);
                }}
                disabled={isOutOfStock || isAddingToCart}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {isOutOfStock ? 'Out of Stock' : isAddingToCart ? 'Adding...' : 'Add to Cart'}
              </Button>
              <Button 
                className="flex-1 h-10 rounded-lg bg-primary hover:bg-primary/90" 
                onClick={() => {
                  if (isOutOfStock) return;
                  onClose();
                  onBuyNow(product);
                }}
                disabled={isOutOfStock}
              >
                <Zap className="mr-2 h-4 w-4" />
                Buy Now
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
