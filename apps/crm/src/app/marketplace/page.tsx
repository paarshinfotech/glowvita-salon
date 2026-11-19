"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Input } from '@repo/ui/input';
import { Search, ShoppingCart, Info, X, Heart, Eye, Minus, Plus, Building, Mail, MapPin, Star, Zap, Package, Truck, Tag, ArrowRight, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { useGetSupplierProductsQuery, useGetSupplierProfileQuery, useCreateCrmOrderMutation } from '@repo/store/api';
import { useCrmAuth } from '@/hooks/useCrmAuth';
import { toast } from 'sonner';
import { useAppDispatch } from '@repo/store/hooks';
import { Skeleton } from '@repo/ui/skeleton';
import { Label } from '@repo/ui/label';
import { Badge } from '@repo/ui/badge';
import { useAddToCartMutation } from '@repo/store/api';
import { ProductCard } from '@/components/marketplace/ProductCard';

// Load Razorpay script dynamically
const loadRazorpayScript = (): Promise<boolean> =>
  new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

// Import new components
import { MarketplaceHeader } from './components/MarketplaceHeader';
import { MarketplaceFiltersToolbar } from './components/MarketplaceFiltersToolbar';
import { MarketplaceStatsCards } from './components/MarketplaceStatsCards';
import { MarketplaceProductsSection } from './components/MarketplaceProductsSection';
import { MarketplaceSuppliersSection } from './components/MarketplaceSuppliersSection';
import { ProductDetailModal } from './components/ProductDetailModal';
import { BuyNowModal } from './components/BuyNowModal';
import { SupplierModal } from './components/SupplierModal';
import PaginationControls from './components/PaginationControls';

type Product = {
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
  supplierBusinessRegistrationNo?: string;
  supplierCity?: string;
  supplierState?: string;
  supplierCountry?: string;
  description: string;
  discount?: number;
  rating?: number;
  minOrderValue?: number;
};

interface MarketplaceStats {
  totalProducts: number;
  totalSuppliers: number;
  totalValue: number;
  averageRating: number;
}

type Supplier = {
  _id: string;
  shopName: string;
  email: string;
  country?: string;
  city?: string;
  state?: string;
  description?: string;
  profileImage?: string;
  productCount: number;
  totalStock: number;
  averagePrice?: number;
  rating?: number;
  products?: Product[];
  businessRegistrationNo?: string;
};

type ViewMode = 'suppliers' | 'products';

export default function MarketplacePage() {
  const { data: productsData, isLoading, isError, refetch } = useGetSupplierProductsQuery(undefined);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');
  const [viewMode, setViewMode] = useState<ViewMode>('suppliers');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isBuyNowModalOpen, setIsBuyNowModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [buyNowQuantity, setBuyNowQuantity] = useState(1);
  const { user } = useCrmAuth();
  const [shippingAddress, setShippingAddress] = useState(user?.address || '');

  const { data: supplierData, isLoading: isSupplierLoading } = useGetSupplierProfileQuery(selectedSupplierId, { skip: !selectedSupplierId });

  const [addToCart, { isLoading: isAddingToCart }] = useAddToCartMutation();
  const [createOrder] = useCreateCrmOrderMutation();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Extract the products array from the API response
  const productsArray = useMemo(() => {
    if (!productsData) return [];
    if (Array.isArray(productsData)) return productsData;
    if (productsData.data && Array.isArray(productsData.data)) return productsData.data;
    return [];
  }, [productsData]);

  // Derive unique suppliers from products - ensure no duplicates
  const suppliers = useMemo(() => {

    // Group products by supplier identity (shopName + businessRegistrationNo)
    const supplierIdentityMap = new Map<string, Product[]>();

    productsArray.forEach((product: Product) => {

      // Create a unique identity key for the supplier
      const identityKey = `${product.supplierName || 'Unknown'}_${product.supplierBusinessRegistrationNo || 'no-reg'}`;

      if (!supplierIdentityMap.has(identityKey)) {
        supplierIdentityMap.set(identityKey, []);
      }
      supplierIdentityMap.get(identityKey)!.push(product);
    });


    // Create supplier objects from grouped products
    const suppliers: Supplier[] = [];
    supplierIdentityMap.forEach((products, identityKey) => {
      const firstProduct = products[0];
      const totalStock = products.reduce((sum: number, p: Product) => sum + p.stock, 0);
      const totalPrice = products.reduce((sum: number, p: Product) => sum + (p.salePrice || p.price), 0);

      // For display purposes, we'll use the first product's vendorId as the identifier
      // This allows the supplier card to work with the existing click handler
      suppliers.push({
        _id: firstProduct.vendorId, // Use first product's vendorId for UI interaction
        shopName: firstProduct.supplierName || 'Unknown Supplier',
        email: firstProduct.supplierEmail || '',
        city: firstProduct.supplierCity,
        state: firstProduct.supplierState,
        country: firstProduct.supplierCountry,
        productCount: products.length,
        totalStock: totalStock,
        products: products,
        rating: 4.5,
        averagePrice: products.length > 0 ? totalPrice / products.length : 0,
        businessRegistrationNo: firstProduct.supplierBusinessRegistrationNo,
      });
    });

    suppliers.forEach(supplier => {
    });
    return suppliers;
  }, [productsArray]);

  // Filter suppliers based on search
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier: Supplier) =>
      supplier.shopName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.country?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [suppliers, searchTerm]);

  // Filter products when a supplier is selected
  const supplierProducts = useMemo(() => {
    if (!selectedSupplier) return [];

    // Filter by supplier identity (shopName + businessRegistrationNo) instead of just vendorId
    // This ensures we show all products from the same supplier business
    return productsArray.filter((product: Product) =>
      product.supplierName === selectedSupplier.shopName &&
      product.supplierBusinessRegistrationNo === selectedSupplier.businessRegistrationNo
    );
  }, [selectedSupplier, productsArray]);

  const filteredProducts = useMemo(() => {
    const baseProducts = viewMode === 'suppliers' ? productsArray : supplierProducts;
    return baseProducts.filter((product: any) =>
      (product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.supplierName?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === 'all' ||
        (statusFilter === 'in_stock' && product.stock > 10) ||
        (statusFilter === 'low_stock' && product.stock > 0 && product.stock <= 10) ||
        (statusFilter === 'out_of_stock' && product.stock === 0))
    );
  }, [viewMode, productsArray, supplierProducts, searchTerm, statusFilter]);

  const paginatedSuppliers = useMemo(() => {
    const firstItemIndex = (currentPage - 1) * itemsPerPage;
    return filteredSuppliers.slice(
      firstItemIndex,
      firstItemIndex + itemsPerPage
    );
  }, [filteredSuppliers, currentPage, itemsPerPage]);

  const paginatedProducts = useMemo(() => {
    const firstItemIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(
      firstItemIndex,
      firstItemIndex + itemsPerPage
    );
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = Math.max(
    1,
    Math.ceil((viewMode === 'suppliers' ? filteredSuppliers.length : filteredProducts.length) / itemsPerPage)
  );

  const productStats = useMemo(() => {
    if (viewMode === 'suppliers') {
      // Stats for suppliers view
      return {
        totalProducts: productsArray.length,
        totalSuppliers: suppliers.length,
        totalValue: productsArray.reduce(
          (sum: number, p: Product) => sum + (p.salePrice || p.price) * p.stock,
          0
        ),
        averageRating: 4.5,
      };
    } else {
      // Stats for individual supplier's products
      const supplierProds = selectedSupplier?.products || [];
      return {
        totalProducts: supplierProds.length,
        totalSuppliers: 1,
        totalValue: supplierProds.reduce(
          (sum: number, p: Product) => sum + (p.salePrice || p.price) * p.stock,
          0
        ),
        averageRating: selectedSupplier?.rating || 4.5,
      };
    }
  }, [viewMode, productsArray, suppliers, selectedSupplier]);

  const handleSupplierClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setViewMode('products');
    setSearchTerm('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const handleBackToSuppliers = () => {
    setSelectedSupplier(null);
    setViewMode('suppliers');
    setSearchTerm('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const handleViewDetails = (product: any) => {
    setSelectedProduct(product);
    setQuantity(1);
    setIsDetailModalOpen(true);
  };

  const handleViewSupplier = (e: React.MouseEvent, supplierId: string) => {
    e.stopPropagation();
    setSelectedSupplierId(supplierId);
    setIsSupplierModalOpen(true);
  };

  const handleAddToCart = async (product: any, qty: number) => {
    if (!product.stock || product.stock <= 0) {
      toast.error("This product is currently out of stock.");
      return;
    }
    try {
      await addToCart({
        productId: product._id,
        productName: product.productName,
        price: product.salePrice || product.price,
        quantity: qty,
        productImage: product.productImage,
        vendorId: product.vendorId, // This is the supplier's ID
        supplierName: product.supplierName,
        minOrderValue: product.minOrderValue || 0,
      }).unwrap();
      toast.success(`${qty} x ${product.productName} added to cart.`);
      setIsDetailModalOpen(false);
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to add to cart.");
    }
  };

  const handleBuyNow = (product: any) => {
    if (!product.stock || product.stock <= 0) {
      toast.error("This product is currently out of stock.");
      return;
    }
    setSelectedProduct(product);
    setBuyNowQuantity(1);
    setShippingAddress(user?.address || '');
    setIsBuyNowModalOpen(true);
  };

  const handleQuickAddToCart = async (product: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.stock || product.stock <= 0) {
      toast.error("This product is currently out of stock.");
      return;
    }
    try {
      await addToCart({
        productId: product._id,
        productName: product.productName,
        price: product.salePrice || product.price,
        quantity: 1,
        productImage: product.productImage,
        vendorId: product.vendorId,
        supplierName: product.supplierName,
        minOrderValue: product.minOrderValue || 0,
      }).unwrap();
      toast.success(`${product.productName} added to cart!`);
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to add to cart.");
    }
  };

  const handlePlaceOrder = async () => {
    if (!shippingAddress.trim()) {
      toast.error("Shipping address is required.");
      return;
    }
    if (!selectedProduct) return;
    if (!selectedProduct.stock || selectedProduct.stock <= 0) {
      toast.error("This product is out of stock and cannot be purchased.");
      return;
    }

    const finalPrice = selectedProduct.salePrice || selectedProduct.price;
    const totalAmount = finalPrice * buyNowQuantity;

    const minOrder = selectedProduct.minOrderValue || 1000;
    // Minimum order validation (from supplier)
    if (totalAmount < minOrder) {
      toast.error(`Minimum order amount for this supplier is ₹${minOrder.toLocaleString()}.`, {
        description: `Current total: ₹${totalAmount.toLocaleString()}. Please increase the quantity to proceed.`,
      });
      return;
    }

    const supplierId = typeof selectedProduct.vendorId === 'object' && (selectedProduct.vendorId as any)._id
      ? (selectedProduct.vendorId as any)._id
      : selectedProduct.vendorId;

    setIsProcessingPayment(true);
    try {
      // Step 1: Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Payment gateway failed to load. Please refresh and try again.');
        return;
      }

      // Step 2: Create Razorpay order on the CRM server
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount,
          currency: 'INR',
          receipt: `mrkt_${selectedProduct._id}_${Date.now()}`,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.id) {
        throw new Error(orderData.message || 'Failed to initiate payment');
      }

      // **CRITICAL FIX: Close BuyNowModal to escape focus trap**
      setIsBuyNowModalOpen(false);

      // Step 3: Open Razorpay checkout
      await new Promise<void>((resolve, reject) => {
        const rzp = new (window as any).Razorpay({
          key: orderData.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_SLBxzQHGTzUTCO',
          amount: Math.round(totalAmount * 100),
          currency: 'INR',
          order_id: orderData.id,
          name: 'GlowVita Marketplace',
          description: `${selectedProduct.productName} × ${buyNowQuantity}`,
          image: 'https://glowvita.com/logo.png',
          theme: { color: '#7c3aed' },
          prefill: {
            name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
            email: user?.emailAddress || '',
            contact: user?.mobileNo || '',
          },
          retry: { enabled: true, max_count: 3 },
          config: {
            display: {
              blocks: {
                upi: {
                  name: 'UPI / QR',
                  instruments: [
                    { method: 'upi', vpa: true }, // UPI ID entry
                    { method: 'upi', qr: true }   // QR Code
                  ],
                },
              },
              sequence: ['block.upi', 'card', 'netbanking'],
            },
          },
          modal: {
            ondismiss: () => {
              setIsBuyNowModalOpen(true);
              reject(new Error('Payment cancelled by user'));
            },
            escape: true,
            backdropClose: false,
          },
          handler: async (response: any) => {
            try {
              // Step 4: Verify payment signature
              const verifyRes = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(response),
              });
              const verifyData = await verifyRes.json();
              if (!verifyData.success) throw new Error('Payment verification failed. Please contact support.');

              // Step 5: Create the CRM order with payment proof
              await createOrder({
                items: [{
                  productId: selectedProduct._id,
                  productName: selectedProduct.productName,
                  quantity: buyNowQuantity,
                  price: finalPrice,
                }],
                supplierId,
                totalAmount,
                shippingAddress,
                paymentId: response.razorpay_payment_id,
                paymentOrderId: response.razorpay_order_id,
                paymentMethod: 'online',
                paymentStatus: 'completed',
              }).unwrap();

              toast.success('Order placed successfully! Payment received.');
              setIsBuyNowModalOpen(false);
              resolve();
            } catch (err: any) {
              reject(err);
            }
          },
        });
        rzp.open();
      });
    } catch (error: any) {
      if (error?.message !== 'Payment cancelled by user') {
        console.error('Order payment error:', error);
        toast.error(error?.data?.message || error?.message || 'Failed to place order. Please try again.');
      } else {
        toast.info('Payment cancelled.');
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">

        <div className="relative p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-6">
              <Skeleton className="h-20 w-20 rounded-2xl" />
              <div className="space-y-3">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-5 w-96" />
              </div>
            </div>
          </div>

          <Card className="bg-card border border-border rounded-lg">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                  <Skeleton className="w-full h-12 rounded-lg" />
                </div>
                <div className="flex gap-3">
                  <Skeleton className="w-32 h-12 rounded-lg" />
                  <Skeleton className="w-32 h-12 rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border border-border rounded-lg">
            <CardHeader className="pb-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <Skeleton className="h-6 w-6 rounded" />
                    </div>
                    <Skeleton className="h-8 w-48" />
                  </div>
                  <div className="space-y-3 mt-2">
                    <Skeleton className="h-4 w-80" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-32 rounded-full" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <Card key={i} className="overflow-hidden rounded-2xl bg-card border border-border/30">
                    <div className="relative aspect-[4/3]">
                      <Skeleton className="h-full w-full rounded-t-2xl" />
                    </div>
                    <div className="p-5 space-y-4">
                      <Skeleton className="h-6 w-3/4" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl">
                        <Skeleton className="h-6 w-1/3" />
                        <div className="flex gap-2">
                          <Skeleton className="h-5 w-12 rounded-full" />
                          <Skeleton className="h-5 w-12 rounded-full" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-10 flex-1 rounded-xl" />
                        <Skeleton className="h-10 flex-1 rounded-xl" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isError) {
    return <div className="p-8 text-center text-destructive">Failed to load products from marketplace. Please try again later.</div>
  }

  return (
    <div className="min-h-screen bg-background">

      <div className="relative p-4 sm:p-6 lg:p-8 space-y-6">
        {viewMode === 'suppliers' && (
          <>
            <MarketplaceHeader
              viewMode={viewMode}
              selectedSupplier={selectedSupplier}
              onBack={handleBackToSuppliers}
            />

            <MarketplaceStatsCards
              stats={productStats}
              viewMode={viewMode}
              selectedSupplier={selectedSupplier}
            />
          </>
        )}

        <MarketplaceFiltersToolbar
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          viewMode={displayMode}
          onSearchChange={setSearchTerm}
          onStatusChange={setStatusFilter}
          onViewModeChange={setDisplayMode}
          pageViewMode={viewMode}
          onBack={handleBackToSuppliers}
        />

        {viewMode === 'suppliers' ? (
          <MarketplaceSuppliersSection
            filteredSuppliers={paginatedSuppliers}
            isLoading={isLoading}
            searchTerm={searchTerm}
            viewMode={displayMode}
            onSupplierClick={handleSupplierClick}
          />
        ) : (
          <MarketplaceProductsSection
            filteredProducts={paginatedProducts}
            isLoading={isLoading}
            searchTerm={searchTerm}
            viewMode={displayMode}
            onSearchClear={() => setSearchTerm('')}
            onQuickAddToCart={handleQuickAddToCart}
            onViewDetails={handleViewDetails}
            onBuyNow={handleBuyNow}
            onViewSupplier={handleViewSupplier}
          />
        )}

        {(viewMode === 'suppliers' ? filteredSuppliers.length : filteredProducts.length) > 0 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={setItemsPerPage}
            totalItems={viewMode === 'suppliers' ? filteredSuppliers.length : filteredProducts.length}
          />
        )}
      </div>

      <ProductDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        product={selectedProduct}
        quantity={quantity}
        onQuantityChange={setQuantity}
        onAddToCart={(product, qty) => handleAddToCart(product, qty)}
        isAddingToCart={isAddingToCart}
        onBuyNow={(product) => handleBuyNow(product)}
      />

      <BuyNowModal
        isOpen={isBuyNowModalOpen}
        onClose={() => setIsBuyNowModalOpen(false)}
        product={selectedProduct}
        quantity={buyNowQuantity}
        onQuantityChange={setBuyNowQuantity}
        shippingAddress={shippingAddress}
        onShippingAddressChange={setShippingAddress}
        onPlaceOrder={handlePlaceOrder}
        isCreatingOrder={isProcessingPayment}
      />

      <SupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        supplier={supplierData}
        isLoading={isSupplierLoading}
      />
    </div>
  );
}