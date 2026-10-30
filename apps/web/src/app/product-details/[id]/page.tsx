"use client"

import React, { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Poppins } from 'next/font/google';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});
import { Button } from '@repo/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/card';
import { Star, Plus, Minus, Heart, Shield, Truck, ThumbsUp, ThumbsDown, Droplets, Leaf, FlaskConical, Loader2, PackageCheck, AlertCircle, Store, ChevronDown, ChevronLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PageContainer } from '@repo/ui/page-container';
import { Input } from '@repo/ui/input';
import { Label } from '@repo/ui/label';
import { Textarea } from '@repo/ui/textarea';
import { useGetPublicProductByIdQuery, useAddToClientCartMutation, useGetProductQuestionsQuery, useSubmitProductQuestionMutation, useGetProductReviewsQuery, useSubmitProductReviewMutation, useGetPublicVendorProductsQuery, useGetClientCartQuery, useGetPublicVendorByIdQuery } from '@repo/store/api';
import { Skeleton } from '@repo/ui/skeleton';
import { useAppDispatch, useAppSelector } from "@repo/store/hooks";
import { addToCart as addToLocalCart } from "@repo/store/slices/cartSlice";
import { useAuth } from '@/hooks/useAuth';
import { useCartSync } from "@/hooks/useCartSync";
import { toast } from 'sonner';
import ProductRatingsReviews from '../components/ProductRatingsReviews';
import DiscountBanner from '../components/DiscountBanner';
import RelevantProducts from '../components/RelevantProducts';
import ProductPurchaseActions from '../components/ProductPurchaseActions';

interface Product {
  origin?: 'Vendor' | 'Supplier' | string;
  id: string;
  name: string;
  description: string;
  price: number;
  salePrice?: number;
  image: string;
  vendorId: string;
  vendorName: string;
  category: string;
  stock: number;
  rating: number;
  hint: string;
  images?: string[];
  size?: number | string | null;
  sizeMetric?: string | null;
  keyIngredients?: string[];
  forBodyPart?: string | null;
  bodyPartType?: string | null;
  productForm?: string | null;
  brand?: string | null;
}

// Define type for vendor products
interface VendorProduct {
  id: string;
  name: string;
  image: string;
  images?: string[];
  vendorId: string;
  vendorName: string;
  price: number;
  salePrice?: number;
  category: string;
  stock: number;
  rating: number;
  description: string;
}

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAuth();

  const [quantity, setQuantity] = useState(1);
  const [mainImage, setMainImage] = useState('');
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isWishlistLoading, setIsWishlistLoading] = useState(true);

  // Review states
  const [reviewRating, setReviewRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Timer state for deal
  const [timeLeft, setTimeLeft] = useState({ hours: 1, minutes: 21, seconds: 42 });

  useEffect(() => {
    // Check local storage for existing timer to keep it consistent
    const savedEndTime = localStorage.getItem('discountEndTime');
    let endTime: number;

    if (savedEndTime) {
      endTime = parseInt(savedEndTime);
    } else {
      endTime = Date.now() + (1 * 60 * 60 * 1000) + (21 * 60 * 1000) + (42 * 1000);
      localStorage.setItem('discountEndTime', endTime.toString());
    }

    const timer = setInterval(() => {
      const remaining = endTime - Date.now();

      if (remaining <= 0) {
        clearInterval(timer);
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const h = Math.floor((remaining / (1000 * 60 * 60)) % 24);
      const m = Math.floor((remaining / (1000 * 60)) % 60);
      const s = Math.floor((remaining / 1000) % 60);

      setTimeLeft({ hours: h, minutes: m, seconds: s });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch product data
  const { data: productResponse, isLoading, error } = useGetPublicProductByIdQuery(id as string);
  const [addToCartAPI] = useAddToClientCartMutation();

  const localCartItems = useAppSelector((state) => state.cart.items);
  const { data: cartData } = useGetClientCartQuery(undefined, {
    skip: !isAuthenticated || !user?._id,
  });

  const cartItems = isAuthenticated && user?._id ? (cartData?.data?.items || []) : localCartItems;

  // Fetch product questions
  const { data: questionsResponse, refetch: refetchQuestions } = useGetProductQuestionsQuery(id as string);
  const [submitQuestion] = useSubmitProductQuestionMutation();

  // Fetch product reviews
  const { data: reviewsResponse, refetch: refetchReviews } = useGetProductReviewsQuery(id as string);
  const [submitReview] = useSubmitProductReviewMutation();

  const productQuestions = questionsResponse?.questions || [];
  const productReviews = reviewsResponse?.reviews || [];

  console.log("Product Response:", productResponse);

  // Initialize cart sync
  useCartSync();

  const product = productResponse?.product;
  const vendorId = product?.vendorId;
  const isSupplierProduct = (product?.origin || '').toLowerCase() === 'supplier';
  const isVendorProduct = !isSupplierProduct;

  // Fetch vendor data to check subscription
  const { data: vendorResponse } = useGetPublicVendorByIdQuery(vendorId, {
    skip: !vendorId || isSupplierProduct,
  });

  const vendorData = vendorResponse?.vendor;

  const isSubscriptionExpired = useMemo(() => {
    if (isSupplierProduct) return false;
    if (!vendorData) return false;

    const subscription = vendorData.subscription;
    if (!subscription) return false;

    const now = new Date();
    const endDate = subscription.endDate ? new Date(subscription.endDate) : null;
    const status = (subscription.status || '').toLowerCase().trim();

    const isStatusActive = status === 'active';
    const expiredStatuses = ['expired', 'expaired', 'inactive', 'suspended', 'cancelled', 'canceled'];
    const isStatusExpired = expiredStatuses.includes(status);
    const isDateExpired = endDate ? endDate < now : false;

    if (isStatusActive && !isDateExpired) return false;
    return isStatusExpired || isDateExpired;
  }, [vendorData]);

  const availableStock = product?.stock || 0;
  const isOutOfStock = availableStock === 0;

  // Check if product is in wishlist
  useEffect(() => {
    const checkWishlistStatus = async () => {
      if (isAuthenticated && user?._id && id) {
        try {
          const response = await fetch(`/api/client/wishlist/${id}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            setIsWishlisted(data.isInWishlist);
          }
        } catch (error) {
          console.error('Error checking wishlist status:', error);
        }
      }
      setIsWishlistLoading(false);
    };

    checkWishlistStatus();
  }, [id, isAuthenticated, user]);

  // Handle wishlist toggle
  const handleWishlistToggle = async () => {
    if (!isAuthenticated) {
      toast.error("Please login to add items to wishlist");
      router.push("/client-login");
      return;
    }

    try {
      setIsWishlistLoading(true);
      const url = isWishlisted ? `/api/client/wishlist/${id}/remove` : '/api/client/wishlist';
      const method = isWishlisted ? 'DELETE' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId: id }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsWishlisted(!isWishlisted);
        toast.success(isWishlisted ? "Removed from Wishlist" : "Added to Wishlist", {
          description: isWishlisted ? "Product removed from your wishlist" : "Product added to your wishlist"
        });
      } else {
        const errorData = await response.json();
        toast.error("Wishlist Update Failed", {
          description: errorData.message || "Failed to update wishlist"
        });
      }
    } catch (error) {
      console.error("Failed to update wishlist:", error);
      toast.error("Wishlist Update Failed", {
        description: "Failed to update wishlist. Please try again."
      });
    } finally {
      setIsWishlistLoading(false);
    }
  };

  // Update main image when product loads
  React.useEffect(() => {
    if (product?.images && product.images.length > 0) {
      setMainImage(product.images[0]);
    }
  }, [product]);

  // Handle quantity increase with stock validation
  const handleIncreaseQuantity = () => {
    if (quantity < availableStock) {
      setQuantity(quantity + 1);
    } else {
      toast.warning(`Only ${availableStock} units available in stock.`);
    }
  };

  // Handle quantity decrease
  const handleDecreaseQuantity = () => {
    setQuantity(Math.max(1, quantity - 1));
  };

  // Handle add to cart with stock validation
  const handleAddToCart = async (selectedProduct?: any) => {
    // Check if subscription is expired
    if (isSubscriptionExpired) {
      toast.error('Purchase Unavailable', {
        description: 'This salon is currently not available for product purchases. Please check back later.',
      });
      return;
    }

    const prod = selectedProduct || product;
    const qty = selectedProduct ? 1 : quantity; // Use 1 for related products

    // Check if cart already has items from a different vendor
    if (cartItems.length > 0) {
      const firstItem = cartItems[0];
      const currentVendorId = firstItem.vendorId;
      const currentVendorName = firstItem.vendorName || firstItem.supplierName || "another vendor";

      if (prod.vendorId && currentVendorId && prod.vendorId !== currentVendorId) {
        toast.error("Cannot add products from different vendors", {
          description: `Your cart already contains products from ${currentVendorName}. Please checkout or remove existing items first.`,
          duration: 5000,
        });
        return;
      }
    }

    // Validate product data is available
    if (!prod) {
      toast.error("Product data not available. Please try again.");
      return;
    }

    // Validate required fields
    const productId = prod.id || prod._id || id;
    const productPrice = prod.salePrice || prod.price;

    if (!productId) {
      toast.error("Product ID is missing. Please refresh the page.");
      return;
    }

    if (!productPrice || productPrice === 0) {
      toast.error("Product price is not available.");
      return;
    }

    if (!qty || qty < 1) {
      toast.error("Please select a valid quantity.");
      return;
    }

    const availableStock = prod.stock || 0;
    if (availableStock === 0 && !selectedProduct) {
      toast.error("This product is currently out of stock.");
      return;
    }

    if (qty > availableStock && !selectedProduct) {
      toast.error(`Only ${availableStock} units available. Please adjust the quantity.`);
      return;
    }

    const isAddingToCartState = selectedProduct ? false : isAddingToCart;
    const setIsAddingToCartState = selectedProduct ? () => { } : setIsAddingToCart;

    setIsAddingToCartState(true as any);
    try {
      if (isAuthenticated && user?._id) {
        // User is authenticated - use API
        const effectivePrice = (prod.salePrice && prod.salePrice > 0) ? prod.salePrice : prod.price;
        const cartItem = {
          productId: productId,
          productName: prod.name || "Product",
          productImage: Array.isArray(prod.images) && prod.images.length > 0
            ? prod.images[0]
            : "",
          quantity: qty,
          price: effectivePrice,
          originalPrice: prod.price, // original price for display
          hasSale: prod.salePrice > 0, // sale flag
          vendorId: prod.vendorId || "",
          supplierName: prod.vendorName || "Unknown Vendor",
        };

        console.log("Adding to cart (API):", cartItem); // Debug log

        await addToCartAPI(cartItem).unwrap();

        // Show success toast
        toast.success(`${prod.name} added to cart!`, {
          description: `${qty} ${qty > 1 ? 'items' : 'item'} added to your cart.`,
          action: {
            label: "View Cart",
            onClick: () => router.push("/profile/cart"),
          },
        });
      } else {
        // User is not authenticated - use local storage
        const effectivePrice = (prod.salePrice && prod.salePrice > 0) ? prod.salePrice : prod.price;
        const cartItem = {
          _id: productId,
          productId: productId,
          productName: prod.name || "Product",
          price: effectivePrice,
          originalPrice: prod.price,
          hasSale: prod.salePrice > 0,
          quantity: qty,
          productImage: Array.isArray(prod.images) && prod.images.length > 0
            ? prod.images[0]
            : "",
          vendorId: prod.vendorId || "",
          supplierName: prod.vendorName || "Unknown Vendor",
          // Additional details for better cart management
          category: prod.category,
          stock: prod.stock,
          hint: prod.description,
        };

        console.log("Adding to cart (Local):", cartItem); // Debug log

        // Dispatch to Redux store (will also save to localStorage)
        dispatch(addToLocalCart(cartItem));

        // Show success toast
        toast.success(`${prod.name} added to cart!`, {
          description: `${qty} ${qty > 1 ? 'items' : 'item'} added to your cart.`,
          action: {
            label: "View Cart",
            onClick: () => router.push("/profile/cart"),
          },
        });
      }
    } catch (error: any) {
      console.error("Failed to add item to cart:", error);
      toast.error(error?.data?.message || "Failed to add item to cart. Please try again.");
    } finally {
      if (!selectedProduct) {
        setIsAddingToCart(false);
      }
    }
  };

  // Handle buy now with stock validation
  const handleBuyNow = (selectedProduct?: any) => {
    // Check if subscription is expired
    if (isSubscriptionExpired) {
      toast.error('Purchase Unavailable', {
        description: 'This salon is currently not available for product purchases. Please check back later.',
      });
      return;
    }

    const prod = selectedProduct || product;
    if (!prod) {
      toast.error("Product data not available. Please try again.");
      return;
    }

    if (!isAuthenticated) {
      router.push(`/client-login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    // Check if cart already has items from a different vendor
    if (cartItems.length > 0) {
      const firstItem = cartItems[0];
      const currentVendorId = firstItem.vendorId;
      const currentVendorName = firstItem.vendorName || firstItem.supplierName || "another vendor";

      if (prod.vendorId && currentVendorId && prod.vendorId !== currentVendorId) {
        toast.error("Cannot proceed with mixed vendors", {
          description: `Your cart already contains products from ${currentVendorName}. Please checkout or remove existing items first.`,
          duration: 5000,
        });
        return;
      }
    }

    if (isOutOfStock && !selectedProduct) {
      toast.error("This product is currently out of stock.");
      return;
    }

    const availableStock = prod.stock || 0;
    if (quantity > availableStock && !selectedProduct) {
      toast.error(`Only ${availableStock} units available. Please adjust the quantity.`);
      return;
    }

    setIsBuyingNow(true);
    try {
      // Store product details in local storage for checkout
      // Match the structure used in salon-details page
      const effectivePrice = (prod.salePrice && prod.salePrice > 0) ? prod.salePrice : prod.price;
      const productForCheckout = {
        id: prod.id || id, // Product ID (MongoDB ObjectId)
        name: prod.name,
        price: effectivePrice, // Use sale price if available
        originalPrice: prod.price,
        hasSale: prod.salePrice > 0,
        image: Array.isArray(prod.images) && prod.images.length > 0
          ? prod.images[0]
          : "/images/product-placeholder.png",
        vendorId: prod.vendorId,
        vendorName: prod.vendorName || "Unknown Vendor",
        quantity: selectedProduct ? 1 : quantity, // Use 1 for related products
        // Additional fields that might be useful
        description: prod.description || "",
        category: prod.category || "Beauty Products",
        stock: prod.stock,
      };

      console.log("Buy Now - Product for checkout:", productForCheckout); // Debug log

      localStorage.setItem("buyNowProduct", JSON.stringify(productForCheckout));

      // Redirect to checkout page
      router.push("/checkout");
    } catch (error) {
      console.error("Failed to save to localStorage", error);
      toast.error("Could not process your request. Please ensure you are not in private browsing mode.");
      setIsBuyingNow(false);
    }
  };

  // Handle question submission
  const handleSubmitQuestion = async () => {
    // Check if user is logged in
    if (!isAuthenticated || !user) {
      toast.error("Please log in to ask a question", {
        action: {
          label: "Log In",
          onClick: () => router.push("/client-login"),
        },
      });
      return;
    }

    // Validate question
    if (!questionText.trim()) {
      toast.error("Please enter a question");
      return;
    }

    if (questionText.trim().length < 10) {
      toast.error("Question must be at least 10 characters long");
      return;
    }

    setIsSubmittingQuestion(true);
    try {
      await submitQuestion({
        productId: id as string,
        question: questionText.trim(),
      }).unwrap();

      toast.success("Question submitted successfully!", {
        description: "The vendor will answer your question soon.",
      });

      setQuestionText('');
      refetchQuestions();
    } catch (error: any) {
      console.error("Failed to submit question:", error);
      toast.error(error?.data?.message || "Failed to submit question. Please try again.");
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  // Handle review submission
  const handleSubmitReview = async () => {
    // Check if user is logged in
    if (!isAuthenticated || !user) {
      toast.error("Please log in to write a review", {
        action: {
          label: "Log In",
          onClick: () => router.push("/client-login"),
        },
      });
      return;
    }

    // Validate rating
    if (!reviewRating || reviewRating < 1) {
      toast.error("Please select a rating");
      return;
    }

    // Validate comment
    if (!reviewComment.trim()) {
      toast.error("Please write a review");
      return;
    }

    if (reviewComment.trim().length < 10) {
      toast.error("Review must be at least 10 characters long");
      return;
    }

    setIsSubmittingReview(true);
    try {
      await submitReview({
        productId: id as string,
        rating: reviewRating,
        comment: reviewComment.trim(),
      }).unwrap();

      toast.success("Review submitted successfully!", {
        description: "Your review will be visible in your profile after approval by the product owner.",
      });

      // Reset form
      setReviewRating(0);
      setHoveredRating(0);
      setReviewComment('');
      refetchReviews();
    } catch (error: any) {
      console.error("Failed to submit review:", error);
      toast.error(error?.data?.message || "Failed to submit review. Please try again.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Fetch other products from the same vendor
  const { data: vendorProductsResponse, isLoading: vendorProductsLoading } = useGetPublicVendorProductsQuery(product?.vendorId || '', {
    skip: !product?.vendorId
  });

  const vendorProducts = vendorProductsResponse?.products?.filter((prod: any) => prod.id !== id) || [];

  if (isLoading) {
    return (
      <PageContainer className={`max-w-7xl ${poppins.className}`}>
        <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start py-12">
          <div className="space-y-4">
            <Skeleton className="w-full h-96" />
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="w-20 h-20" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error || !product) {
    return (
      <PageContainer className={`max-w-7xl ${poppins.className}`}>
        <div className="py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
          <p className="text-muted-foreground mb-6">The product you're looking for doesn't exist or is no longer available.</p>
          <Button onClick={() => router.push('/')}>Go Back Home</Button>
        </div>
      </PageContainer>
    );
  }

  const details = [
    ...(product.size ? [{ title: 'Size', content: `${product.size}${product.sizeMetric ? ' ' + product.sizeMetric : ''}` }] : []),
    ...(product.keyIngredients && product.keyIngredients.length > 0 ? [{ title: 'Key Ingredients', content: product.keyIngredients.join(', ') }] : []),
  ];

  const specifications = {
    ...(product.productForm ? { 'Form': product.productForm } : {}),
    ...(product.brand ? { 'Brand': product.brand } : {}),
    ...(product.forBodyPart ? { 'Body Part': product.forBodyPart } : {}),
    ...(product.bodyPartType ? { 'Body Part Type': product.bodyPartType } : {}),
    // ...(product.category ? { 'Category': product.category } : {}),
    // ...(product.size && product.sizeMetric ? { 'Volume': `${product.size} ${product.sizeMetric}` } : {}),
  };

  return (
    <PageContainer className={`max-w-7xl ${poppins.className}`}>

      {product.salePrice && product.salePrice > 0 && product.salePrice < product.price ? (
        <DiscountBanner
          discountPercentage={Math.round(((product.price - product.salePrice) / product.price) * 100)}
          timeLeft={timeLeft}
        />
      ) : null}

      {/* Subscription Expired Banner */}
      {isSubscriptionExpired && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-6 flex items-center gap-3">
          <div className="flex-shrink-0">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-800">Salon Currently Unavailable</h3>
            <p className="text-sm text-red-700 mt-1">
              This salon is not available for product purchases at the moment. Please check back later.
            </p>
          </div>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start py-8">
        {/* Left Column: Image Gallery (Sticky) */}
        <div className="lg:sticky top-24">

          <button onClick={() => router.back()} className="mb-4 text-gray-800 hover:text-black">
            <ChevronLeft className="h-6 w-6 font-bold" />
          </button>

          <div className="flex flex-col-reverse sm:flex-row gap-4">
            {/* Vertical/Horizontal Thumbnails */}
            <div className="flex flex-row sm:flex-col gap-3 overflow-x-auto sm:overflow-y-auto max-w-full sm:max-h-[450px] py-1">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {product.images?.map((img: any, index: any) => (
                <div
                  key={index}
                  className={`relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden cursor-pointer border ${mainImage === img ? 'border-gray-700 p-0.5' : 'border-gray-200 hover:border-gray-400'}`}
                  onClick={() => setMainImage(img)}
                >
                  <img
                    src={img}
                    alt={`${product.name} thumbnail ${index + 1}`}
                    onError={(e) => { (e.target as HTMLImageElement).src = "/images/product-placeholder.png"; }}
                    className="w-full h-full object-cover rounded-[3px]"
                    data-ai-hint="product photo"
                  />
                </div>
              ))}
            </div>

            {/* Main Image */}
            <div className="flex-1 h-[300px] sm:h-[450px] relative rounded-md overflow-hidden border border-gray-200 bg-white">
              <img
                src={mainImage || "/images/product-placeholder.png"}
                alt={product.name}
                onError={(e) => { (e.target as HTMLImageElement).src = "/images/product-placeholder.png"; }}
                className="w-full h-full object-contain"
                data-ai-hint="skincare product"
              />
            </div>
          </div>

          {/* Product Purchase Actions - Below Main Image */}
          <ProductPurchaseActions
            handleWishlistToggle={handleWishlistToggle}
            isWishlisted={isWishlisted}
            isWishlistLoading={isWishlistLoading}
            handleBuyNow={handleBuyNow}
            handleAddToCart={handleAddToCart}
            isOutOfStock={isOutOfStock}
            isBuyingNow={isBuyingNow}
            isAddingToCart={isAddingToCart}
            isSubscriptionExpired={isSubscriptionExpired}
          />

          {/* Similar Products Section */}
          {vendorProducts.length > 0 && (
            <div className="mt-12 border-t pt-6 border-gray-100">
              <h3 className="text-[13px] font-semibold text-gray-800 mb-4">Similar Products</h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {(vendorProducts as any[]).slice(0, 4).map((prod: any) => (
                  <div
                    key={prod.id}
                    className="flex-shrink-0 w-20 h-20 cursor-pointer border border-transparent hover:border-gray-200 rounded-sm overflow-hidden"
                    onClick={() => router.push(`/product-details/${prod.id}`)}
                  >
                    <img
                      src={Array.isArray(prod.images) && prod.images.length > 0
                        ? prod.images[0]
                        : prod.image || "/images/product-placeholder.png"}
                      alt={prod.name}
                      onError={(e) => { (e.target as HTMLImageElement).src = "/images/product-placeholder.png"; }}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Product Details (Scrollable) */}
        <div className="mt-8 lg:mt-0 space-y-4">

          {/* Card 1: Main Product Info */}
          <Card className="rounded-xl border border-gray-200 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <h1 className="text-lg sm:text-xl font-medium text-gray-800 mb-3 leading-snug">{product.name}</h1>

              {/* Price Display */}
              <div className="flex items-center gap-3 mb-4">
                {product.salePrice && product.salePrice > 0 && product.salePrice < product.price ? (
                  <>
                    <span className="text-2xl font-bold text-gray-900">₹{product.salePrice.toFixed(0)}</span>
                    <span className="text-sm text-gray-500 line-through">₹{product.price.toFixed(0)}</span>
                    <span className="text-sm font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                      {Math.round(((product.price - product.salePrice) / product.price) * 100)}% off
                    </span>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-gray-900">₹{product.price.toFixed(0)}</span>
                )}
              </div>

              {/* Deal Timer */}
              {product.salePrice && product.salePrice > 0 && product.salePrice < product.price && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-gray-800 font-medium">Deal ends in</span>
                  <div className="flex items-center gap-1">
                    <span className="bg-[#382638] text-white text-xs px-1.5 py-0.5 rounded">{String(timeLeft.hours).padStart(2, '0')}</span>
                    <span className="text-[#382638] font-bold">:</span>
                    <span className="bg-[#382638] text-white text-xs px-1.5 py-0.5 rounded">{String(timeLeft.minutes).padStart(2, '0')}</span>
                    <span className="text-[#382638] font-bold">:</span>
                    <span className="bg-[#382638] text-white text-xs px-1.5 py-0.5 rounded">{String(timeLeft.seconds).padStart(2, '0')}</span>
                  </div>
                </div>
              )}

              {/* Rating */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center bg-green-700 text-white px-2 py-0.5 rounded text-xs font-bold gap-1">
                  {typeof product.rating === "number" ? product.rating.toFixed(1) : "0.0"} <Star className="h-3 w-3 fill-white text-white" />
                </div>
                <span className="text-xs text-gray-500">({product.reviewCount ? product.reviewCount.toLocaleString() : productReviews.length.toLocaleString()} Ratings)</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Product Highlights */}
          <Card className="rounded-xl border border-gray-200 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Product Highlights</h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(product.description || product.name);
                    toast.success("Copied to clipboard");
                  }}
                  className="text-[10px] uppercase font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1 tracking-wider"
                >
                  COPY
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Stock</p>
                  <p className="text-sm font-medium text-gray-800">{product.stock ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Brand</p>
                  <p className="text-sm font-medium text-gray-800">{product.brand || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Product Form</p>
                  <p className="text-sm font-medium text-gray-800">{product.productForm || "-"}</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 mt-2">
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold text-gray-800">
                    Additional Details
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-4 text-sm text-gray-600 space-y-4">
                    <p>{product.description}</p>

                    {/* Add specifications if they exist */}
                    {Object.keys(specifications).length > 0 && (
                      <div className="mt-4 border border-gray-100 rounded-lg overflow-hidden">
                        <div className="grid grid-cols-2 bg-gray-50 p-2 font-medium text-gray-700 text-xs border-b border-gray-100">
                          <div>Specification</div>
                          <div>Value</div>
                        </div>
                        {Object.entries(specifications).map(([key, value]) => (
                          <div key={key} className="grid grid-cols-2 p-2 text-xs border-b border-gray-100 last:border-0">
                            <div className="text-gray-500">{key}</div>
                            <div className="font-medium text-gray-800">{String(value)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Sold by */}
          <Card className="rounded-xl border border-gray-200 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Sold by</h3>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-gray-100 flex flex-shrink-0 items-center justify-center border border-gray-200 overflow-hidden">
                    <Store className="h-4 w-4 text-gray-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mt-1 mb-3">{vendorData?.name || product.vendorName || "GlowVita Partner"}</h4>
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center bg-green-700 text-white px-1.5 py-0.5 rounded text-[10px] font-bold gap-1 mb-1">
                          {typeof vendorData?.rating === 'number' ? vendorData.rating.toFixed(1) : "0.0"} <Star className="h-2.5 w-2.5 fill-white text-white" />
                        </div>
                        <span className="text-[10px] text-gray-500">{vendorData?.ratingCount ? vendorData.ratingCount.toLocaleString() : "0"} Ratings</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-gray-800 leading-tight mb-1">{vendorProducts.length}</span>
                        <span className="text-[10px] text-gray-500">Products</span>
                      </div>
                    </div>
                  </div>
                </div>
                {isVendorProduct && (
                  <Button
                  variant="outline"
                  className="border-[#6a4c6a] text-[#6a4c6a] hover:bg-[#fcf8fc] text-xs px-3 h-8 rounded-md"
                  onClick={() => product.vendorId && router.push(`/salon-details/${product.vendorId}`)}
                >
                  View Salon
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <ProductRatingsReviews
            averageRating={product.rating || 0}
            totalRatings={product.reviewCount || 0}
            totalReviews={product.reviewCount || 0}
            productReviews={productReviews}
            productQuestions={productQuestions}
            productId={id}
            onRefetchReviews={refetchReviews}
            onRefetchQuestions={refetchQuestions}
            onSubmitReview={async (reviewData: { productId: string; rating: number; comment: string }) => {
              await submitReview(reviewData).unwrap();
            }}
            onSubmitQuestion={async (questionData: { productId: string; question: string }) => {
              await submitQuestion(questionData).unwrap();
            }}
          />
        </div>
      </div>

      {/* Relevant Products Section */}
      <RelevantProducts
        currentProductId={product.id || id}
        vendorId={product.vendorId || ''}
        vendorName={product.vendorName || ''}
        category={product.category || ''}
        categoryId={product.categoryId || ''}
        onBuyNow={handleBuyNow}
        onAddToCart={handleAddToCart}
        isSubscriptionExpired={isSubscriptionExpired}
      />
    </PageContainer>
  );
}
