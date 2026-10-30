
"use client";

import { Button } from '@repo/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@repo/ui/dialog';
import { X, ShoppingCart, Plus, Minus, Trash2, CreditCard, Smartphone, Landmark, Banknote, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { useGetCartQuery, useUpdateCartItemMutation, useRemoveFromCartMutation, useCreateCrmOrderMutation } from '@repo/store/api';
import { useCrmAuth } from '@/hooks/useCrmAuth';
import { toast } from 'sonner';
import { useState, useCallback, useEffect } from 'react';
import { Input } from '@repo/ui/input';
import { Label } from '@repo/ui/label';
import { Skeleton } from '@repo/ui/skeleton';
import { useDispatch } from 'react-redux';
import { clearCart } from '@repo/store/slices/cartSlice';
import { useRouter } from 'next/navigation';
import { getMarketplaceProductImage, MARKETPLACE_PRODUCT_PLACEHOLDER_IMAGE } from '@/app/marketplace/components/productImage';

interface CartItem {
  _id: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  productImage?: string;
  vendorId: string;
  supplierName?: string;
  minOrderValue?: number;
}

interface OrderItem {
  productId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  price: number;
}

interface CartProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

type PaymentMethod = 'online' | 'cod';

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

function CartItemImage({ item }: { item: CartItem }) {
  const [imageSrc, setImageSrc] = useState(getMarketplaceProductImage(item.productImage));

  useEffect(() => {
    setImageSrc(getMarketplaceProductImage(item.productImage));
  }, [item.productImage]);

  return (
    <Image
      src={imageSrc}
      alt={item.productName}
      width={60}
      height={60}
      className="rounded-lg object-cover border border-border sm:w-[72px] sm:h-[72px]"
      onError={() => setImageSrc(MARKETPLACE_PRODUCT_PLACEHOLDER_IMAGE)}
    />
  );
}

export function Cart({ isOpen, onOpenChange }: CartProps) {
  const { user, isCrmAuthenticated } = useCrmAuth();
  const dispatch = useDispatch();
  const router = useRouter();

  const { data: cartData, isLoading: isCartLoading, refetch } = useGetCartQuery(user?._id, {
    skip: !isCrmAuthenticated || !user?._id,
  });

  const cartItems: CartItem[] = cartData?.data?.items || [];

  const [updateCartItem] = useUpdateCartItemMutation();
  const [removeFromCart] = useRemoveFromCartMutation();

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [shippingAddress, setShippingAddress] = useState(user?.address || '');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('online');
  const [createOrder] = useCreateCrmOrderMutation();

  const subtotal = cartItems.reduce((acc: number, item: CartItem) => acc + item.price * item.quantity, 0);

  const handleUpdateQuantity = async (productId: string, quantity: number) => {
    try {
      if (quantity > 0) {
        await updateCartItem({ productId, quantity }).unwrap();
      } else {
        await removeFromCart(productId).unwrap();
      }
    } catch (error) {
      toast.error('Failed to update quantity.');
    }
  };

  const handleRemoveFromCart = async (productId: string) => {
    try {
      await removeFromCart(productId).unwrap();
      toast.success('Item removed from cart.');
    } catch {
      toast.error('Failed to remove item.');
    }
  };

  /** Groups cart items by supplier and creates one order per supplier (with payment proof). */
  const placeOrdersWithPayment = useCallback(
    async (paymentId: string, paymentOrderId: string) => {
      const ordersBySupplier = cartItems.reduce(
        (acc: Record<string, OrderItem[]>, item: CartItem) => {
          const supplierId =
            typeof item.vendorId === 'object' && (item.vendorId as any)._id
              ? (item.vendorId as any)._id
              : item.vendorId;
          if (!acc[supplierId]) acc[supplierId] = [];
          acc[supplierId].push({
            productId: item.productId,
            productName: item.productName,
            productImage: item.productImage,
            quantity: item.quantity,
            price: item.price,
          });
          return acc;
        },
        {} as Record<string, OrderItem[]>
      );

      const orderPromises = Object.entries(ordersBySupplier).map(([supplierId, items]) => {
        const totalAmount = items.reduce(
          (sum: number, item: OrderItem) => sum + item.price * item.quantity,
          0
        );
        return createOrder({
          items,
          supplierId,
          totalAmount,
          shippingAddress,
          vendorId: user?._id,
          paymentId,
          paymentOrderId,
          paymentMethod: 'online',
          paymentStatus: 'completed',
        }).unwrap();
      });

      await Promise.all(orderPromises);
    },
    [cartItems, createOrder, shippingAddress, user?._id]
  );

  /** Creates COD orders for each supplier — no Razorpay involved. */
  const placeOrdersWithCOD = useCallback(async () => {
    const ordersBySupplier = cartItems.reduce(
      (acc: Record<string, OrderItem[]>, item: CartItem) => {
        const supplierId =
          typeof item.vendorId === 'object' && (item.vendorId as any)._id
            ? (item.vendorId as any)._id
            : item.vendorId;
        if (!acc[supplierId]) acc[supplierId] = [];
        acc[supplierId].push({
          productId: item.productId,
          productName: item.productName,
          productImage: item.productImage,
          quantity: item.quantity,
          price: item.price,
        });
        return acc;
      },
      {} as Record<string, OrderItem[]>
    );

    const orderPromises = Object.entries(ordersBySupplier).map(([supplierId, items]) => {
      const totalAmount = items.reduce(
        (sum: number, item: OrderItem) => sum + item.price * item.quantity,
        0
      );
      return createOrder({
        items,
        supplierId,
        totalAmount,
        shippingAddress,
        vendorId: user?._id,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
      }).unwrap();
    });

    await Promise.all(orderPromises);
  }, [cartItems, createOrder, shippingAddress, user?._id]);

  /** Clears cart from DB and Redux after a successful order. */
  const clearCartAfterOrder = useCallback(async () => {
    const removePromises = cartItems.map((item) => removeFromCart(item.productId).unwrap().catch(() => {}));
    await Promise.all(removePromises);
    dispatch(clearCart());
    await refetch();
  }, [cartItems, removeFromCart, dispatch, refetch]);

  /** Validates common pre-checkout conditions. Returns false if invalid. */
  const validateCheckout = () => {
    if (!shippingAddress.trim()) {
      toast.error('Shipping address is required.');
      return false;
    }
    if (cartItems.length === 0) return false;

    // Minimum order validation (dynamic per supplier)
    const ordersBySupplier = cartItems.reduce((acc: Record<string, { total: number; name: string; minOrder: number }>, item: CartItem) => {
      const supplierId = typeof item.vendorId === 'object' && (item.vendorId as any)._id
        ? (item.vendorId as any)._id
        : item.vendorId;

      if (!acc[supplierId]) acc[supplierId] = { total: 0, name: item.supplierName || 'Supplier', minOrder: item.minOrderValue || 1000 };
      acc[supplierId].total += item.price * item.quantity;
      return acc;
    }, {});

    const lowValueSuppliers = Object.values(ordersBySupplier).filter(s => s.total < s.minOrder);

    if (lowValueSuppliers.length > 0) {
      const issues = lowValueSuppliers.map(s => `${s.name}: min ₹${s.minOrder.toLocaleString()}`).join(', ');
      toast.error(`One or more suppliers have a minimum order requirement.`, {
        description: `Issues: ${issues}. Please add more items to proceed.`,
      });
      return false;
    }

    return true;
  };

  /** Handle COD order placement */
  const handleCODOrder = async () => {
    if (!validateCheckout()) return;

    setIsProcessingPayment(true);
    try {
      await placeOrdersWithCOD();
      await clearCartAfterOrder();
      setIsCheckoutModalOpen(false);
      toast.success('Order placed successfully! Pay on delivery.');
    } catch (error: any) {
      console.error('COD order error:', error);
      toast.error(error?.data?.message || error?.message || 'Failed to place order. Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  /** Handle Online payment via Razorpay */
  const handlePlaceOrder = async () => {
    if (!validateCheckout()) return;

    setIsProcessingPayment(true);
    try {
      // Step 1: Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Payment gateway failed to load. Please refresh and try again.');
        return;
      }

      // Step 2: Create Razorpay order on the server
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: subtotal,
          currency: 'INR',
          receipt: `cart_${user?._id}_${Date.now()}`,
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to initiate payment');
      }

      const razorpayOrder = await orderRes.json();
      if (!razorpayOrder.id) throw new Error('Invalid payment order response');

      // **CRITICAL FIX: Close parent drawers/modals to escape focus trap**
      setIsCheckoutModalOpen(false);
      onOpenChange(false);

      // Step 3: Open Razorpay checkout
      await new Promise<void>((resolve, reject) => {
        const rzp = new (window as any).Razorpay({
          key: razorpayOrder.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_SLBxzQHGTzUTCO',
          amount: Math.round(subtotal * 100),
          currency: 'INR',
          order_id: razorpayOrder.id,
          name: 'GlowVita Marketplace',
          description: `${cartItems.length} item${cartItems.length > 1 ? 's' : ''} from your cart`,
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
                    { method: 'upi', vpa: true },
                    { method: 'upi', qr: true },
                  ],
                },
              },
              sequence: ['block.upi', 'card', 'netbanking'],
            },
          },
          modal: {
            ondismiss: () => {
              // Restore UI state on cancellation
              setIsCheckoutModalOpen(true);
              onOpenChange(true);
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
              if (!verifyData.success) throw new Error('Payment verification failed.');

              // Step 5: Create orders for each supplier
              await placeOrdersWithPayment(
                response.razorpay_payment_id,
                response.razorpay_order_id
              );

              // Step 6: Clear cart
              await clearCartAfterOrder();

              toast.success('Orders placed successfully! Payment received.');
              resolve();
            } catch (err: any) {
              setIsCheckoutModalOpen(true);
              onOpenChange(true);
              reject(err);
            }
          },
        });
        rzp.open();
      });
    } catch (error: any) {
      if (error?.message !== 'Payment cancelled by user') {
        console.error('Cart checkout error:', error);
        toast.error(error?.data?.message || error?.message || 'Failed to place orders. Please try again.');
      } else {
        toast.info('Payment cancelled.');
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed top-16 left-0 right-0 bottom-0 bg-black/40 backdrop-blur-sm z-40 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => onOpenChange(false)}
      />

      {/* Cart Drawer */}
      <div className={`fixed top-0 right-0 h-screen w-full sm:max-w-md md:max-w-lg lg:max-w-[420px] bg-background sm:border-l border-border z-50 transform transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex-shrink-0 h-14 sm:h-16 border-b border-border flex items-center justify-between px-3 sm:px-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold tracking-tight">Shopping Cart</h2>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {cartItems.length} item{cartItems.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="group rounded-md transition-all duration-300 text-muted-foreground hover:text-primary hover:bg-accent h-8 w-8 sm:h-9 sm:w-9"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-300 group-hover:rotate-90" />
            </Button>
          </div>

          {/* Body */}
          {isCartLoading ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <Skeleton className="h-12 w-12 rounded-full" />
            </div>
          ) : cartItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-8">
              <div className="p-4 sm:p-6 bg-muted border border-border rounded-lg mb-4 sm:mb-6">
                <ShoppingCart className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2">Your cart is empty</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mb-4 sm:mb-6 max-w-xs px-4">
                Start adding products to see them here
              </p>
              <Button
                className="px-6 sm:px-8 py-2 rounded-lg transition-all duration-300 text-sm"
                onClick={() => {
                  onOpenChange(false);
                  router.push('/marketplace');
                }}
              >
                Continue Shopping
              </Button>
            </div>
          ) : (
            <>
              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto no-scrollbar p-2 sm:p-3 md:p-4 space-y-2 sm:space-y-3">
                {cartItems.map((item: CartItem) => (
                  <div
                    key={item.productId}
                    className="bg-card rounded-lg p-2 sm:p-3 border border-border transition-all duration-300 hover:bg-accent"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="relative flex-shrink-0">
                        <CartItemImage item={item} />
                        <div className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 w-4 h-4 sm:w-5 sm:h-5 bg-primary text-primary-foreground text-[10px] sm:text-xs font-medium rounded-full flex items-center justify-center">
                          {item.quantity}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-xs sm:text-sm line-clamp-2 mb-0.5 sm:mb-1">{item.productName}</h4>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mb-1.5 sm:mb-2">
                          ₹{item.price.toFixed(2)} each
                        </p>

                        <div className="flex items-center justify-between gap-1 sm:gap-0">
                          <div className="flex items-center gap-0.5 sm:gap-1 bg-muted border border-border rounded-lg p-0.5 sm:p-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-md hover:bg-accent transition-all duration-300"
                              onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            </Button>
                            <span className="font-medium text-xs sm:text-sm w-5 sm:w-7 text-center">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-md hover:bg-accent transition-all duration-300"
                              onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-1 sm:gap-2">
                            <p className="font-semibold text-xs sm:text-sm text-primary">
                              ₹{(item.price * item.quantity).toFixed(2)}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-muted-foreground hover:text-destructive rounded-md transition-all duration-300"
                              onClick={() => handleRemoveFromCart(item.productId)}
                            >
                              <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 border-t border-border p-3 sm:p-4">
                <div className="bg-card rounded-lg p-2.5 sm:p-3 mb-2 sm:mb-3 border border-border">
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                      <span className="text-muted-foreground">
                        Subtotal ({cartItems.reduce((acc, i) => acc + i.quantity, 0)} items)
                      </span>
                      <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="text-green-600 font-medium">Free</span>
                    </div>
                    <div className="border-t border-border pt-1.5 sm:pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm sm:text-base font-semibold">Total</span>
                        <span className="text-base sm:text-lg font-bold text-primary">₹{subtotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full rounded-lg h-9 sm:h-10 text-sm sm:text-base font-medium transition-all duration-300"
                  onClick={() => setIsCheckoutModalOpen(true)}
                >
                  <ShoppingCart className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Proceed to Checkout
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Checkout Confirmation Modal */}
      <Dialog open={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md sm:max-w-lg no-scrollbar mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-0.5 sm:space-y-1">
            <DialogTitle className="text-base sm:text-lg font-semibold">Quick Checkout</DialogTitle>
            <DialogDescription className="text-[10px] sm:text-xs">
              Review your order and choose a payment method
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 sm:space-y-3 py-1.5 sm:py-2">
            {/* Shipping Address */}
            <div className="space-y-1 sm:space-y-1.5">
              <Label className="text-xs sm:text-sm font-medium">Shipping Address</Label>
              <Input
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Enter your complete address"
                className="h-8 sm:h-9 text-xs sm:text-sm rounded-lg border-border transition-all duration-300"
              />
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-xs sm:text-sm font-medium">Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {/* Online Payment option */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('online')}
                  className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all duration-200 text-left
                    ${selectedPaymentMethod === 'online'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:bg-accent'
                    }`}
                >
                  {selectedPaymentMethod === 'online' && (
                    <CheckCircle2 className="absolute top-2 right-2 h-3.5 w-3.5 text-primary" />
                  )}
                  <CreditCard className="h-5 w-5" />
                  <span className="text-xs font-semibold">Online Payment</span>
                  <span className="text-[10px] leading-tight text-center opacity-70">Card / UPI / Net Banking</span>
                </button>

                {/* Cash on Delivery option */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('cod')}
                  className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all duration-200 text-left
                    ${selectedPaymentMethod === 'cod'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:bg-accent'
                    }`}
                >
                  {selectedPaymentMethod === 'cod' && (
                    <CheckCircle2 className="absolute top-2 right-2 h-3.5 w-3.5 text-primary" />
                  )}
                  <Banknote className="h-5 w-5" />
                  <span className="text-xs font-semibold">Cash on Delivery</span>
                  <span className="text-[10px] leading-tight text-center opacity-70">Pay when you receive</span>
                </button>
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-muted border border-border rounded-lg p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
              <h4 className="font-medium text-xs sm:text-sm mb-1.5 sm:mb-2">Order Summary</h4>
              <div className="space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Subtotal ({cartItems.reduce((acc, i) => acc + i.quantity, 0)} items)
                  </span>
                  <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-green-600 font-medium">FREE</span>
                </div>
                <div className="border-t border-border pt-1.5">
                  <div className="flex justify-between font-semibold text-sm">
                    <span>Total</span>
                    <span className="text-primary">₹{subtotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment method info strip */}
            {selectedPaymentMethod === 'online' ? (
              <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground pt-1">
                <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Card</span>
                <span className="flex items-center gap-1"><Smartphone className="h-3 w-3" /> UPI</span>
                <span className="flex items-center gap-1"><Landmark className="h-3 w-3" /> Net Banking</span>
                <span className="opacity-60">Secured by Razorpay</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground pt-1">
                <Banknote className="h-3 w-3" />
                <span>Pay in cash when your order is delivered</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-1.5 sm:gap-2 pt-1 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setIsCheckoutModalOpen(false)}
              disabled={isProcessingPayment}
              className="w-full sm:w-auto px-3 sm:px-4 h-8 sm:h-9 text-xs sm:text-sm rounded-lg transition-all duration-300"
            >
              Cancel
            </Button>

            {selectedPaymentMethod === 'online' ? (
              <Button
                onClick={handlePlaceOrder}
                disabled={isProcessingPayment || !shippingAddress.trim()}
                className="w-full sm:w-auto px-4 sm:px-6 h-8 sm:h-9 text-xs sm:text-sm rounded-lg transition-all duration-300"
              >
                {isProcessingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-2 border-white border-t-transparent mr-1.5 sm:mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Pay ₹{subtotal.toFixed(2)}
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleCODOrder}
                disabled={isProcessingPayment || !shippingAddress.trim()}
                className="w-full sm:w-auto px-4 sm:px-6 h-8 sm:h-9 text-xs sm:text-sm rounded-lg transition-all duration-300 bg-green-600 hover:bg-green-700 text-white"
              >
                {isProcessingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-2 border-white border-t-transparent mr-1.5 sm:mr-2" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    <Banknote className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Place COD Order
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
