"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Star, Check, Zap, RefreshCw, CreditCard, Smartphone, Landmark } from 'lucide-react';
import { cn } from "@repo/ui/cn";
import { Button } from "@repo/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from "@repo/ui/dialog";
import { toast } from 'sonner';
import { useDispatch, useSelector } from 'react-redux';
import {
  useGetCrmSubscriptionPlansQuery,
  useChangePlanMutation,
  useRenewPlanMutation,
} from '@repo/store/api';
import { updateCrmUser, selectCrmAuth } from '@repo/store';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface SubscriptionPlan {
  _id: string;
  name: string;
  duration: number;
  durationType: string;
  price: number;
  discountedPrice?: number;
  features: string[];
  isAvailableForPurchase: boolean;
  planType: 'trial' | 'regular';
  status: 'Active' | 'Inactive';
  isFeatured?: boolean;
}

interface Subscription {
  plan?: unknown;
  endDate: string;
}

interface SubscriptionPlansDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: Subscription;
  userType?: 'vendor' | 'supplier' | 'doctor';
}

/* ─── Razorpay script loader (cached) ───────────────────────────────────── */
let rzpScriptLoaded = false;
const loadRazorpayScript = (): Promise<boolean> =>
  new Promise((resolve) => {
    if (rzpScriptLoaded || (typeof window !== 'undefined' && (window as any).Razorpay)) {
      rzpScriptLoaded = true;
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => { rzpScriptLoaded = true; resolve(true); };
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

/* ─── Component ─────────────────────────────────────────────────────────── */
export function SubscriptionPlansDialog({
  open,
  onOpenChange,
  subscription,
  userType = 'vendor',
}: SubscriptionPlansDialogProps) {
  const dispatch = useDispatch();
  const { user } = useSelector(selectCrmAuth);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  // Keep a ref so Razorpay's async handler always reads the latest selected plan
  // even after the dialog closes (open → false) or React batches a re-render.
  const selectedPlanRef = useRef<SubscriptionPlan | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Sync ref whenever selectedPlan state changes
  useEffect(() => { selectedPlanRef.current = selectedPlan; }, [selectedPlan]);

  const { data: plansResponse, isLoading: plansLoading } = useGetCrmSubscriptionPlansQuery(undefined, { skip: !open });
  const [changePlan, { isLoading: changingPlan }] = useChangePlanMutation();
  const [renewPlan, { isLoading: renewingPlan }] = useRenewPlanMutation();

  const isExpired = subscription?.endDate ? new Date(subscription.endDate) < new Date() : true;
  const isLoading = plansLoading || changingPlan || renewingPlan || isProcessingPayment;

  // Preload Razorpay script when dialog opens
  useEffect(() => { if (open) loadRazorpayScript(); }, [open]);

  // Reset selection on open
  useEffect(() => { if (open) setSelectedPlan(null); }, [open]);

  const availablePlans = useMemo<SubscriptionPlan[]>(() => {
    const raw = Array.isArray(plansResponse)
      ? plansResponse
      : Array.isArray((plansResponse as any)?.data)
        ? (plansResponse as any).data
        : [];
    return (raw as SubscriptionPlan[])
      .filter(p => p.status === 'Active')
      .sort((a, b) => a.price - b.price);
  }, [plansResponse]);

  /* ─── Activate subscription in backend ───────────────────────────────── */
  const activateSubscription = useCallback(
    async (paymentId?: string, paymentOrderId?: string) => {
      // Always read from ref — survives dialog close / async Razorpay callback
      const plan = selectedPlanRef.current;
      if (!plan) return;
      try {
        const payload = {
          planId: plan._id,
          userType,
          amount: plan.discountedPrice ?? plan.price,
          ...(paymentId && { paymentId, paymentOrderId, paymentMethod: 'online' }),
        };

        let response: any;
        if (isExpired) {
          response = await renewPlan(payload).unwrap();
        } else {
          response = await changePlan(payload).unwrap();
        }

        if (response?.success) {
          if (response.user) dispatch(updateCrmUser(response.user));
          if (response.data) dispatch(updateCrmUser({ subscription: response.data }));
          toast.success(response.message || (isExpired ? 'Subscription renewed!' : 'Plan changed successfully!'));
          onOpenChange(false);
        } else {
          throw new Error(response?.message || 'Subscription update failed');
        }
      } catch (err: any) {
        const msg =
          err?.data?.message || err?.error || err?.message ||
          (isExpired ? 'Failed to renew subscription' : 'Failed to change plan');
        toast.error(msg);
      }
    },
    [isExpired, userType, renewPlan, changePlan, dispatch, onOpenChange]
  );

  /* ─── Main handler ───────────────────────────────────────────────────── */
  const handleConfirm = async () => {
    const plan = selectedPlanRef.current;
    if (!plan) return;

    const planAmount = plan.discountedPrice ?? plan.price;

    // Free plan — skip gateway
    if (planAmount <= 0) {
      setIsProcessingPayment(true);
      try { await activateSubscription(); } finally { setIsProcessingPayment(false); }
      return;
    }

    setIsProcessingPayment(true);
    try {
      // Step 1 — load Razorpay JS
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Payment gateway failed to load. Please refresh and try again.');
        return;
      }

      // Step 2 — create order on CRM backend
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: planAmount,
          currency: 'INR',
          receipt: `sub_${plan._id}_${Date.now()}`,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.id) {
        throw new Error(orderData.message || 'Failed to create payment order');
      }

      // **CRITICAL FIX: Close dialog to escape focus trap**
      onOpenChange(false);

      // Step 3 — open Razorpay checkout
      await new Promise<void>((resolve, reject) => {
        const rzp = new (window as any).Razorpay({
          key: orderData.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_SLBxzQHGTzUTCO',
          amount: Math.round(planAmount * 100),
          currency: 'INR',
          order_id: orderData.id,
          name: 'GlowVita CRM',
          description: `${plan.name} – ${plan.duration} ${plan.durationType}`,
          image: 'https://glowvita.com/logo.png',
          theme: { color: '#7c3aed' },
          prefill: {
            name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
            email: user?.emailAddress || '',
            contact: user?.mobileNo || '',
          },
          retry: { enabled: true, max_count: 3 },
          // Simplified config
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
              // Re-open dialog on cancel
              onOpenChange(true);
              reject(new Error('Payment cancelled by user'));
            },
            escape: true,
            backdropClose: false,
          },
          handler: async (response: any) => {
            try {
              // Step 4 — verify signature
              const verifyRes = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(response),
              });
              const verifyData = await verifyRes.json();
              if (!verifyData.success) throw new Error('Payment verification failed.');

              // Step 5 — activate subscription
              await activateSubscription(response.razorpay_payment_id, response.razorpay_order_id);
              resolve();
            } catch (err: any) {
              onOpenChange(true); // Re-open on error
              reject(err);
            }
          },
        });
        rzp.open();
      });
    } catch (err: any) {
      if (err?.message === 'Payment cancelled by user') {
        toast.info('Payment cancelled.');
      } else {
        toast.error(err?.message || 'Payment failed.');
        onOpenChange(true); // Ensure dialog comes back on generic error
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  /* ─── Render ─────────────────────────────────────────────────────────── */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isExpired ? 'Renew Subscription' : 'Change Plan'}</DialogTitle>
          <DialogDescription>Choose a plan that suits your business needs</DialogDescription>
        </DialogHeader>

        {/* Plans grid */}
        <div className="py-6 px-1">
          {plansLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="ml-3 text-muted-foreground">Loading plans…</p>
            </div>
          ) : availablePlans.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No plans available at the moment.</p>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {availablePlans.map((plan) => {
                const effectivePrice = plan.discountedPrice ?? plan.price;
                const isSelected = selectedPlan?._id === plan._id;

                return (
                  <div
                    key={plan._id}
                    onClick={() => setSelectedPlan(plan)}
                    className={cn(
                      'relative p-6 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md',
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    {plan.isFeatured && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                          <Star className="h-3 w-3" fill="currentColor" /> Most Popular
                        </span>
                      </div>
                    )}

                    <div className="text-center">
                      <h3 className="text-lg font-bold mb-2">{plan.name}</h3>
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-3xl font-bold">
                          {effectivePrice === 0 ? 'Free' : `₹${effectivePrice}`}
                        </span>
                        {plan.discountedPrice !== undefined && plan.price > plan.discountedPrice && (
                          <span className="text-sm text-muted-foreground line-through">₹{plan.price}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        per {plan.duration} {plan.durationType}
                      </p>
                    </div>

                    <ul className="mt-5 space-y-2">
                      {plan.features?.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {isSelected && (
                      <div className="absolute top-2 right-2 p-1 bg-primary text-white rounded-full">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment method row */}
        {selectedPlan && (selectedPlan.discountedPrice ?? selectedPlan.price) > 0 && (
          <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground border-t pt-3">
            <span className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Card</span>
            <span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> UPI</span>
            <span className="flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5" /> Net Banking</span>
            <span className="opacity-60 text-[10px]">Secured by Razorpay</span>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedPlan || isLoading}
            className="min-w-[160px]"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Processing…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {isExpired ? <Zap className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                {selectedPlan
                  ? (selectedPlan.discountedPrice ?? selectedPlan.price) > 0
                    ? `Pay ₹${selectedPlan.discountedPrice ?? selectedPlan.price} & ${isExpired ? 'Renew' : 'Switch'}`
                    : isExpired ? 'Renew Now' : 'Confirm Change'
                  : isExpired ? 'Renew Subscription' : 'Change Plan'}
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
