"use client";

import { Separator } from '@repo/ui/separator';
import { Button } from '@repo/ui/button';
import Image from 'next/image';
import { ArrowRight, Tag, Scissors, User, Calendar, Clock, MapPin, ChevronUp, ChevronDown, X } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@repo/ui/cn';
import { Service, StaffMember, SalonInfo, ServiceStaffAssignment, convertDurationToMinutes } from '@/hooks/useBookingData';
import { useParams } from 'next/navigation';
import { useGetPublicVendorStaffQuery } from '@repo/store/api';

interface PriceBreakdown {
  subtotal: number;
  discountAmount: number;
  amountAfterDiscount: number;
  platformFee: number;
  serviceTax: number; // This will be GST
  vendorServiceTax: number;
  totalTax: number;
  finalTotal: number;
  couponCode?: string | null;
  taxFeeSettings?: any;
}

interface BookingSummaryProps {
  selectedServices: Service[];
  selectedStaff: StaffMember | null;
  selectedDate: Date;
  selectedTime: string | null;
  onNextStep: () => void;
  currentStep: number;
  isMobileFooter?: boolean;
  salonInfo?: SalonInfo | null;
  serviceStaffAssignments?: ServiceStaffAssignment[]; // For multi-service bookings
  priceBreakdown?: PriceBreakdown | null;
  weddingPackage?: any;
  weddingPackageMode?: 'default' | 'customized' | null;
  customizedPackageServices?: Service[];
  onEditPackage?: () => void; // New prop for editing wedding package
  onRemoveAddon?: (serviceId: string, addonId: string) => void; // New prop for removing addons
  couponCode?: string | null;
  isHomeService?: boolean; // New prop to indicate home service booking
  serviceLocation?: unknown | null;
  weddingVenueType?: 'salon' | 'venue' | null;
}

export function BookingSummary({
  selectedServices,
  selectedStaff,
  selectedDate,
  selectedTime,
  onNextStep,
  currentStep,
  isMobileFooter = false,
  salonInfo,
  serviceStaffAssignments = [],
  priceBreakdown,
  weddingPackage,
  weddingPackageMode,
  customizedPackageServices,
  onEditPackage,
  onRemoveAddon,
  couponCode: propCouponCode,
  isHomeService = false,
  serviceLocation = null,
  weddingVenueType
}: BookingSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const params = useParams();
  const vendorId = (params?.salonId as string) || salonInfo?.id;

  // Fetch staff data for the vendor to resolve staff IDs to names
  const { data: staffData } = useGetPublicVendorStaffQuery(vendorId, {
    skip: !vendorId,
  });

  // Create a staff lookup map for quick ID to name resolution
  const staffLookup = useMemo(() => {
    if (!staffData) return {};
    const lookup: { [key: string]: string } = {};
    let staffArray: any[] = [];
    if (Array.isArray(staffData)) {
      staffArray = staffData;
    } else if ((staffData as any)?.data && Array.isArray((staffData as any).data)) {
      staffArray = (staffData as any).data;
    } else if ((staffData as any)?.staff && Array.isArray((staffData as any).staff)) {
      staffArray = (staffData as any).staff;
    }

    if (staffArray.length > 0) {
      staffArray.forEach((staff: any) => {
        if (staff) {
          const rawId = staff._id || staff.id || staff.staffId;
          const staffId = rawId && typeof rawId === 'object' && rawId.$oid ? rawId.$oid : rawId;
          const staffName = staff.fullName || staff.name || staff.staffName || staff.firstName
            || (staff.firstName && staff.lastName ? `${staff.firstName} ${staff.lastName}` : null);
          if (staffId && staffName) {
            lookup[String(staffId)] = staffName;
          }
        }
      });
    }
    return lookup;
  }, [staffData]);

  // Helper function to get staff name from ID/object with fallback
  const getStaffName = (staff: any): string => {
    if (!staff) return 'Staff Member';

    let idStr = '';
    if (typeof staff === 'string') {
      idStr = staff;
    } else if (staff && typeof staff === 'object') {
      if (staff.$oid) {
        idStr = staff.$oid;
      } else {
        const rawId = staff._id || staff.id || staff.staffId;
        idStr = rawId && typeof rawId === 'object' && rawId.$oid ? rawId.$oid : String(rawId || '');
      }
    }

    if (idStr && staffLookup[idStr]) {
      return staffLookup[idStr];
    }

    if (staff && typeof staff === 'object' && !staff.$oid) {
      const name = staff.fullName || staff.name || staff.staffName || staff.firstName
        || (staff.firstName && staff.lastName ? `${staff.firstName} ${staff.lastName}` : null);
      if (name) return name;
    }

    const isMongoId = /^[0-9a-fA-F]{24}$/.test(idStr);
    if (idStr && !isMongoId) {
      return idStr;
    }

    return 'Wedding Specialist';
  };

  // Calculate totals - handle wedding package pricing
  // For wedding packages: totalServicesPrice = raw price, packageDiscount = built-in pkg discount,
  // subtotal = after-package-discount price (what fees/GST are calculated on)
  const totalServicesPrice = weddingPackage
    ? (weddingPackageMode === 'customized' && customizedPackageServices && customizedPackageServices.length > 0
      ? customizedPackageServices.reduce((acc, service) => {
        const servicePrice = parseFloat(String(service.price || '0'));
        const quantity = (service as any).quantity || 1;
        return acc + (servicePrice * quantity);
      }, 0)
      : (weddingPackage.totalPrice || 0))
    : null;

  // Built-in package discount amount (NOT the offer code discount)
  const packageInherentDiscount = weddingPackage
    ? (() => {
      if (weddingPackageMode === 'customized' && customizedPackageServices && customizedPackageServices.length > 0) {
        const baseSum = totalServicesPrice!;
        if (weddingPackage.discountedPrice != null && weddingPackage.totalPrice > 0) {
          const discountPercent = (weddingPackage as any).discountPercent != null
            ? (weddingPackage as any).discountPercent / 100
            : (weddingPackage.totalPrice - weddingPackage.discountedPrice) / weddingPackage.totalPrice;
          return baseSum * discountPercent;
        }
        return 0;
      } else {
        // Non-customized: discount = totalPrice - discountedPrice
        const total = weddingPackage.totalPrice || 0;
        const discounted = weddingPackage.discountedPrice != null ? weddingPackage.discountedPrice : total;
        return Math.max(0, total - discounted);
      }
    })()
    : 0;

  const subtotal = weddingPackage
    ? (priceBreakdown?.subtotal != null
      ? priceBreakdown.subtotal
      : (() => {
        if (weddingPackageMode === 'customized' && customizedPackageServices && customizedPackageServices.length > 0) {
          const baseSum = totalServicesPrice!;
          if (weddingPackage.discountedPrice != null && weddingPackage.totalPrice > 0) {
            const discountPercent = (weddingPackage as any).discountPercent != null
              ? (weddingPackage as any).discountPercent / 100
              : (weddingPackage.totalPrice - weddingPackage.discountedPrice) / weddingPackage.totalPrice;
            return baseSum * (1 - discountPercent);
          }
          return baseSum;
        } else {
          // Non-customized: use discountedPrice (the actual price after pkg discount)
          return weddingPackage.discountedPrice != null
            ? weddingPackage.discountedPrice
            : (weddingPackage.totalPrice || 0);
        }
      })())
    : (priceBreakdown?.subtotal ?? selectedServices.reduce((acc, service) => {
      const servicePrice = service.discountedPrice !== null && service.discountedPrice !== undefined
        ? parseFloat(String(service.discountedPrice))
        : parseFloat(String(service.price || '0'));

      const addonsPrice = service.selectedAddons
        ? service.selectedAddons.reduce((sum, addon) => {
          const price = typeof addon.price === 'string' ? parseFloat(addon.price) : (addon.price || 0);
          return sum + price;
        }, 0)
        : 0;

      return acc + servicePrice + addonsPrice;
    }, 0));

  // Calculate total duration dynamically, accounting for customized wedding packages
  const totalDuration = useMemo(() => {
    if (weddingPackage) {
      if (weddingPackageMode === 'customized' && customizedPackageServices && customizedPackageServices.length > 0) {
        return customizedPackageServices.reduce((acc, service) => {
          const serviceDuration = convertDurationToMinutes(service.duration);
          const quantity = (service as any).quantity || 1;
          return acc + (serviceDuration * quantity);
        }, 0);
      }
      return weddingPackage.duration || 0;
    }
    return selectedServices.reduce((acc, service) => {
      let serviceDuration = convertDurationToMinutes(service.duration);
      if (service.selectedAddons && service.selectedAddons.length > 0) {
        const addonsDuration = service.selectedAddons.reduce((sum, addon) => {
          return sum + (Number(addon.duration) || 0);
        }, 0);
        serviceDuration += addonsDuration;
      }
      return acc + serviceDuration;
    }, 0);
  }, [weddingPackage, weddingPackageMode, customizedPackageServices, selectedServices]);

  const total = priceBreakdown?.finalTotal ?? subtotal;

  // Use provided salon info or fallback
  const currentSalonInfo = salonInfo || {
    name: "Salon",
    rating: "4.5",
    reviews: 0,
    address: "Loading address...",
    image: "/images/salon-placeholder.png"
  };

  const isWeddingPackage = !!weddingPackage;

  const stepDetails = isWeddingPackage
    ? [
      { label: 'Select Package', completed: !!weddingPackage },
      {
        label: 'Select Location',
        completed: weddingVenueType === 'salon' || (weddingVenueType === 'venue' && !!(serviceLocation as any)?.address)
      },
      { label: 'Select Date & Time', completed: !!selectedTime },
      { label: 'Confirm Booking', completed: false }
    ]
    : isHomeService
      ? [
        {
          step: 1,
          label: 'Select Staff',
          enabled: selectedServices.length > 0
        },
        {
          step: 2,
          label: 'Select Location',
          enabled: serviceStaffAssignments && serviceStaffAssignments.length > 0
            ? serviceStaffAssignments.every(a => a.staff !== undefined)
            : !!selectedStaff
        },
        {
          step: 3,
          label: 'Select Time Slot',
          enabled: !!serviceLocation
        },
        {
          step: 4,
          label: 'Confirm Booking Details',
          enabled: !!selectedTime
        }
      ]
      : [
        {
          step: 1,
          label: 'Select Staff',
          enabled: selectedServices.length > 0
        },
        {
          step: 2,
          label: 'Select Time Slot',
          enabled: serviceStaffAssignments && serviceStaffAssignments.length > 0
            ? serviceStaffAssignments.every(a => a.staff !== undefined)
            : !!selectedStaff
        },
        { step: 3, label: 'Confirm Booking Details', enabled: !!selectedTime }
      ];

  const nextStepInfo = isWeddingPackage
    ? stepDetails[Math.min(currentStep - 1, stepDetails.length - 1)]
    : stepDetails.find(s => (s as any).step === currentStep);

  const buttonLabel = isWeddingPackage
    ? (currentStep === 1 ? 'Select Location' : currentStep === 3 ? 'Select Time Slot' : currentStep === 4 ? 'Confirm Booking' : 'Continue')
    : (nextStepInfo?.label || 'Continue');

  // Helper function to check if venue location is valid
  const isVenueLocationValid = () => {
    if (!serviceLocation) return false;
    const loc = serviceLocation as any;
    // Check multiple possible address structures
    const hasAddress = !!loc.address || !!loc.formatted_address;
    const hasCoordinates = (!!loc.lat && !!loc.lng) || (!!loc.coordinates?.lat && !!loc.coordinates?.lng);
    return hasAddress || hasCoordinates;
  };

  const isButtonEnabled = isWeddingPackage
    ? (currentStep === 1 ? !!weddingPackage :
      currentStep === 3 ? (weddingVenueType === 'salon' || (weddingVenueType === 'venue' && isVenueLocationValid())) :
        currentStep === 4 ? !!selectedTime : false)
    : !!(nextStepInfo as any)?.enabled;

  // Debug wedding venue button state
  if (isWeddingPackage && currentStep === 3 && weddingVenueType === 'venue') {
    console.log('[BookingSummary] Wedding Venue - Button Check:', {
      weddingVenueType,
      serviceLocation,
      serviceLocationKeys: serviceLocation ? Object.keys(serviceLocation) : [],
      hasAddress: !!(serviceLocation as any)?.address,
      addressValue: (serviceLocation as any)?.address,
      isVenueLocationValid: isVenueLocationValid(),
      isButtonEnabled
    });
  }

  if (isMobileFooter) {
    return (
      <div className={cn(
        "bg-white border-t shadow-lg transition-all duration-300 fixed bottom-0 left-0 right-0 z-50",
        isExpanded ? "h-[80vh]" : "h-24"
      )}>
        <div className="flex flex-col h-full">
          {/* Expanded Details Panel */}
          {isExpanded && (
            <div className="overflow-y-auto flex-1 p-4 space-y-3 pb-2">
              {/* Header */}
              <div className="flex items-center gap-3 pb-2 border-b">
                <div className="relative w-10 h-10 flex-shrink-0">
                  <Image
                    src={currentSalonInfo.image || "/images/salon-placeholder.png"}
                    alt={currentSalonInfo.name}
                    fill
                    className="rounded-lg shadow-md object-cover"
                    data-ai-hint="salon exterior"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-base truncate">{currentSalonInfo.name}</h4>
                  {/* Star Rating */}
                  {(() => {
                    const rating = parseFloat(String(currentSalonInfo.rating || '0'));
                    const full = Math.floor(rating);
                    const half = rating - full >= 0.25 && rating - full < 0.75;
                    const empty = 5 - full - (half ? 1 : 0);
                    return (
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: full }).map((_, i) => (
                            <svg key={`f${i}`} className="h-3 w-3 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                          {half && (
                            <svg key="half" className="h-3 w-3" viewBox="0 0 20 20">
                              <defs><linearGradient id="mobileHalfStar"><stop offset="50%" stopColor="#facc15" /><stop offset="50%" stopColor="#6b7280" stopOpacity="0.4" /></linearGradient></defs>
                              <path fill="url(#mobileHalfStar)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          )}
                          {Array.from({ length: Math.max(0, empty) }).map((_, i) => (
                            <svg key={`e${i}`} className="h-3 w-3 text-gray-300 fill-gray-300" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-xs text-black">({currentSalonInfo.reviews} reviews)</span>
                      </div>
                    );
                  })()}
                </div>
              </div>


              {/* Services */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-black uppercase tracking-wide">Services</p>
                {serviceStaffAssignments && serviceStaffAssignments.length > 0 ? (
                  serviceStaffAssignments.map((assignment: ServiceStaffAssignment) => (
                    <div key={assignment.service.id} className="flex justify-between items-center text-sm">
                      <span className="flex-1 pr-2">{assignment.service.name}</span>
                      <span className="font-medium">₹{assignment.service.price}</span>
                    </div>
                  ))
                ) : (
                  selectedServices.map((service: Service) => (
                    <div key={service.id} className="space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="flex-1 pr-2">{service.name}</span>
                        <span className="font-medium">₹{service.price}</span>
                      </div>
                      {service.selectedAddons && service.selectedAddons.length > 0 && (
                        <div className="pl-3 border-l-2 border-primary/20 space-y-1">
                          {service.selectedAddons.map((addon) => (
                            <div key={addon._id} className="flex justify-between items-center text-xs text-black group">
                              <span>+ {addon.name}</span>
                              <div className="flex items-center gap-1">
                                <span>₹{addon.price}</span>
                                {onRemoveAddon && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRemoveAddon(service.id, addon._id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/10 rounded"
                                    title="Remove addon"
                                  >
                                    <X className="h-3 w-3 text-destructive" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <Separator />

              {/* Staff */}
              {currentStep > 1 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-black uppercase tracking-wide">Professional</p>
                  {serviceStaffAssignments && serviceStaffAssignments.length > 0 ? (
                    serviceStaffAssignments.map((assignment: ServiceStaffAssignment) => (
                      <p key={assignment.service.id} className="text-sm">With: <span className="font-medium">{assignment.staff?.name || 'Any Professional'}</span></p>
                    ))
                  ) : (
                    selectedStaff && <p className="text-sm">With: <span className="font-medium">{selectedStaff.name}</span></p>
                  )}
                </div>
              )}

              {/* Date & Time */}
              {selectedTime && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-black uppercase tracking-wide">Date & Time</p>
                  <p className="text-sm font-medium">{format(selectedDate, 'MMM d, yyyy')} at {selectedTime}</p>
                </div>
              )}

              <Separator />

              {/* Price summary */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-black">Subtotal</span>
                  <span className="font-medium">₹{Math.round(subtotal)}</span>
                </div>
                {priceBreakdown?.discountAmount != null && priceBreakdown.discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-black">Discount</span>
                    <span className="font-medium text-green-600">-₹{Math.round(priceBreakdown.discountAmount)}</span>
                  </div>
                )}
                {priceBreakdown?.totalTax != null && priceBreakdown.totalTax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-black">Tax & Fees</span>
                    <span className="font-medium">₹{Math.round(priceBreakdown.totalTax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t pt-2 mt-1">
                  <span>Total</span>
                  <span>₹{Math.round(total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-t bg-white flex-shrink-0">
            <div>
              <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1">
                <span className="text-lg font-bold">₹{Math.round(total)}</span>
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
              <p className="text-xs text-black">Total (incl. tax)</p>
            </div>
            <Button
              className="w-36 sm:w-40 h-11"
              size="lg"
              disabled={!isButtonEnabled}
              onClick={onNextStep}
            >
              {buttonLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full shadow-lg rounded-2xl overflow-hidden bg-white border border-gray-100 flex flex-col max-h-[calc(100vh-8rem)]">
      {/* Gradient Header Section */}
      <div
        className="pt-4 px-4 pb-4 text-white flex flex-col relative flex-shrink-0"
        style={{ background: 'linear-gradient(179.56deg, #422A3C 0.38%, #A86B99 131.62%)' }}
      >
        <div className="flex justify-center mb-4">
          <div className="text-lg font-bold border-b border-white pb-0.5 inline-block text-white">
            Your Booking Details
          </div>
        </div>

        <div className="flex flex-col w-full relative z-10">
          <div className="flex items-center gap-2 w-full">
            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
              <Image
                src={currentSalonInfo.image || "/images/salon-placeholder.png"}
                alt={currentSalonInfo.name}
                width={40}
                height={40}
                className="object-cover h-full w-full"
                data-ai-hint="salon exterior"
              />
            </div>
            <h3 className="font-bold text-xl truncate flex-1 text-left text-white">{currentSalonInfo.name}</h3>
          </div>
          <div className="flex items-center gap-1.5 mt-0 ml-[50px]">
            {(() => {
              const rating = parseFloat(String(currentSalonInfo.rating || '0'));
              const full = Math.floor(rating);
              const half = rating - full >= 0.25 && rating - full < 0.75;
              const empty = 5 - full - (half ? 1 : 0);
              return (
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: full }).map((_, i) => (
                    <svg key={`f${i}`} className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  {half && (
                    <svg key="half" className="h-3.5 w-3.5" viewBox="0 0 20 20">
                      <defs>
                        <linearGradient id="halfStarGrad">
                          <stop offset="50%" stopColor="#facc15" />
                          <stop offset="50%" stopColor="#6b7280" stopOpacity="0.4" />
                        </linearGradient>
                      </defs>
                      <path fill="url(#halfStarGrad)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  )}
                  {Array.from({ length: Math.max(0, empty) }).map((_, i) => (
                    <svg key={`e${i}`} className="h-3.5 w-3.5 text-gray-400/40 fill-gray-400/40" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="text-sm opacity-90 text-white ml-1">
                    ({currentSalonInfo.reviews} reviews)
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col">
        <div className="p-5 space-y-3 flex-grow">
          <div className="space-y-3">

            {/* Show Wedding Package or Regular Services */}
            {weddingPackage ? (
              <div className="p-3 rounded-xl" style={{ background: '#EBF3FD' }}>
                <div className="w-full">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-black mb-1">Wedding Package</p>
                    {weddingPackageMode === 'customized' && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md font-medium">Customized</span>
                    )}
                  </div>
                  <p className="font-semibold text-base text-black truncate mb-3">{weddingPackage.name}</p>

                  <div className="h-[1px] w-full bg-black mb-3"></div>


                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-black">Services Included :</span>
                      <span className="font-medium">
                        {weddingPackageMode === 'customized' && customizedPackageServices
                          ? customizedPackageServices.length
                          : weddingPackage.services?.length || 0}
                      </span>
                    </div>
                    {weddingPackage.staffCount && (
                      <div className="flex justify-between text-sm">
                        <span className="text-black">Staff Required :</span>
                        <span className="font-medium">
                          {weddingPackage.staffCount} {weddingPackage.staffCount === 1 ? 'Professional' : 'Professionals'}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-black">Total Duration :</span>
                      <span className="font-medium">{totalDuration} min</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t border-black pt-2 mt-2">
                      <span>Package Price</span>
                      <span className="text-primary">₹{subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl" style={{ background: '#EBF3FD' }}>
                <div className="flex items-start gap-3">
                  {/* Scissors image instead of icon */}
                  <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 mt-0.5">
                    <Image src="/images/customer-review (10).png" alt="Service" width={24} height={24} className="object-contain" />
                  </div>
                  <div className="w-full">
                    <p className="text-sm font-semibold text-black mb-1">Service</p>
                    {selectedServices.length > 0 ? (
                      <div className="space-y-3">
                        {selectedServices.map((service) => (
                          <div key={service.id} className="space-y-1">
                            <div className="flex justify-between items-center gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className="font-semibold text-base text-black truncate">{service.name}</p>
                                {service.duration && (
                                  <span className="flex items-center gap-0.5 text-xs text-black shrink-0">
                                    <Clock className="h-3.5 w-3.5" />
                                    {convertDurationToMinutes(service.duration)} min
                                  </span>
                                )}
                              </div>
                              <span className="text-base font-semibold text-black shrink-0">₹{service.discountedPrice || service.price}</span>
                            </div>

                            {/* Addons */}
                            {service.selectedAddons && service.selectedAddons.length > 0 && (
                              <div className="pl-3 border-l-2 border-primary/20 space-y-1">
                                {service.selectedAddons.map((addon) => (
                                  <div key={addon._id} className="flex justify-between items-center text-sm text-black group">
                                    <span>+ {addon.name}</span>
                                    <div className="flex items-center gap-1">
                                      <span>₹{addon.price}</span>
                                      {onRemoveAddon && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveAddon(service.id, addon._id);
                                          }}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/10 rounded"
                                          title="Remove addon"
                                        >
                                          <X className="h-3 w-3 text-destructive" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}


                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="font-medium text-sm">No services selected</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Professionals List - Step 2+ */}
            {!isWeddingPackage && currentStep > 1 && (serviceStaffAssignments?.length > 0 || selectedStaff) && (
              <div className="p-3 rounded-xl mt-3" style={{ background: '#EBF3FD' }}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 mt-0.5">
                    <Image src="/images/customer 11.png" alt="Professional" width={24} height={24} className="object-contain" />
                  </div>
                  <div className="w-full">
                    <p className="text-sm font-semibold text-black mb-1">Professional(s)</p>
                    <div className="space-y-1">
                      {serviceStaffAssignments && serviceStaffAssignments.length > 0 ? (
                        serviceStaffAssignments.map(a => (
                          <div key={a.service.id} className="text-black text-sm">
                            <span className="font-medium text-black">{a.service.name}</span>: {a.staff?.name || 'Any Professional'}
                          </div>
                        ))
                      ) : (
                        <div className="text-black text-sm">
                          {selectedStaff?.name || 'Any Professional'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}



            {/* Wedding Location Display */}
            {currentStep >= 3 && isWeddingPackage && (weddingVenueType === 'salon' || (weddingVenueType === 'venue' && (serviceLocation as any)?.address)) && (
              <div className="p-3 rounded-xl mt-3" style={{ background: '#EBF3FD' }}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 mt-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/uploads/MapPin.png" alt="Location" className="h-6 w-6 object-contain opacity-80" />
                  </div>
                  <div className="w-full">
                    <p className="text-sm font-semibold text-black mb-1">Location</p>
                    {weddingVenueType === 'salon' ? (
                      <p className="font-semibold text-base text-black truncate">At Salon</p>
                    ) : (
                      <div className="text-black text-sm">
                        <p className="font-semibold text-base text-black truncate">Wedding Venue</p>
                        <p className="text-xs text-black mt-1 line-clamp-2">
                          {(serviceLocation as any).address}
                          {(serviceLocation as any).city && `, ${(serviceLocation as any).city}`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Regular or Home Service Location Display */}
            {currentStep >= 3 && !isWeddingPackage && isHomeService && (
              <div className="p-3 rounded-xl mt-3" style={{ background: '#EBF3FD' }}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 mt-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/uploads/MapPin.png" alt="Location" className="h-6 w-6 object-contain opacity-80" />
                  </div>
                  <div className="w-full">
                    <p className="text-sm font-semibold text-black mb-1">Location</p>
                    {serviceLocation && (serviceLocation as any).address ? (
                      <div>
                        <p className="font-semibold text-base text-black truncate">Home Service</p>
                        <p className="text-xs text-black mt-1 line-clamp-2">
                          {(serviceLocation as any).address}
                          {(serviceLocation as any).city && `, ${(serviceLocation as any).city}`}
                        </p>
                      </div>
                    ) : (
                      <p className="font-semibold text-base text-black">Not selected</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Date & Time - only show when time is selected */}
            {currentStep >= (isWeddingPackage || isHomeService ? 4 : 3) && selectedTime && (
              <div className="p-3 rounded-xl mt-3" style={{ background: '#EBF3FD' }}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 mt-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/Appointment (10).png" alt="Date & Time" className="h-7 w-7 object-contain opacity-80" />
                  </div>
                  <div className="w-full">
                    <p className="text-sm font-semibold text-black mb-1">Date &amp; Time</p>
                    <p className="font-semibold text-base text-black">
                      {format(selectedDate, 'EEEE, MMM d')} at {selectedTime}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Price Breakdown Section */}
          <div className="space-y-1 mt-2">
            <h4 className="font-semibold text-sm text-black flex items-center gap-2">
              <Tag className="h-4 w-4" />Price Breakdown
            </h4>

            <div className="bg-white rounded-lg p-4 space-y-2 text-black">
              {/* Itemized Services and Addons (regular services only) */}
              {!weddingPackage && selectedServices.length > 0 && (
                <div className="space-y-2 pb-2 border-b border-black">
                  {selectedServices.map((service) => {
                    const servicePrice = service.discountedPrice !== null && service.discountedPrice !== undefined
                      ? parseFloat(String(service.discountedPrice))
                      : parseFloat(String(service.price || '0'));

                    return (
                      <div key={service.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-black">{service.name}</span>
                          <span className="font-medium text-black">₹{Math.round(servicePrice)}</span>
                        </div>
                        {service.selectedAddons && service.selectedAddons.length > 0 && (
                          <div className="pl-3 space-y-1">
                            {service.selectedAddons.map((addon) => (
                              <div key={addon._id} className="flex justify-between text-xs text-black">
                                <span>+ {addon.name}</span>
                                <span>₹{Math.round(typeof addon.price === 'string' ? parseFloat(addon.price) : (addon.price || 0))}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Wedding Package: show Total Services → Package Discount → Subtotal */}
              {weddingPackage && totalServicesPrice != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-black">Total Services</span>
                  <span className="text-black">₹{totalServicesPrice.toFixed(2)}</span>
                </div>
              )}

              {weddingPackage && packageInherentDiscount > 0 && (() => {
                const totalP = totalServicesPrice || 0;
                const discountPct = totalP > 0 ? Math.round((packageInherentDiscount / totalP) * 100) : 0;
                return (
                  <div className="flex justify-between text-sm text-green-600 font-medium">
                    <span className="text-black">
                      Package Discount{discountPct > 0 ? ` (${discountPct}%)` : ''}
                    </span>
                    <span>-₹{packageInherentDiscount.toFixed(2)}</span>
                  </div>
                );
              })()}

              <div className="flex justify-between text-sm">
                <span className="text-black">Subtotal</span>
                <span className="text-black">₹{subtotal.toFixed(2)}</span>
              </div>

              {priceBreakdown && priceBreakdown.platformFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-black">Platform Fee {
                    priceBreakdown.taxFeeSettings?.platformFeeEnabled !== false
                      ? (priceBreakdown.taxFeeSettings?.platformFeeType === 'fixed'
                          ? `(₹${priceBreakdown.taxFeeSettings.platformFee})`
                          : priceBreakdown.taxFeeSettings?.platformFee != null
                            ? `(${priceBreakdown.taxFeeSettings.platformFee}%)`
                            : '')
                      : ''
                  }</span>
                  <span className="text-black">₹{priceBreakdown.platformFee.toFixed(2)}</span>
                </div>
              )}

              {priceBreakdown && priceBreakdown.serviceTax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-black">GST {
                    priceBreakdown.taxFeeSettings?.serviceTaxEnabled !== false
                      ? (priceBreakdown.taxFeeSettings?.serviceTaxType === 'fixed'
                          ? `(₹${priceBreakdown.taxFeeSettings.serviceTax})`
                          : priceBreakdown.taxFeeSettings?.serviceTax != null
                            ? `(${priceBreakdown.taxFeeSettings.serviceTax}%)`
                            : '')
                      : ''
                  }</span>
                  <span className="text-black">₹{priceBreakdown.serviceTax.toFixed(2)}</span>
                </div>
              )}

              {priceBreakdown && priceBreakdown.vendorServiceTax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-black">Vendor Service Tax</span>
                  <span className="text-black">₹{priceBreakdown.vendorServiceTax.toFixed(2)}</span>
                </div>
              )}

              {/* Offer code discount (separate from package's built-in discount) */}
              {priceBreakdown && priceBreakdown.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600 font-medium">
                  <span className="text-black">
                    Discount {propCouponCode || priceBreakdown.couponCode ? `(${propCouponCode || priceBreakdown.couponCode})` : ''}
                  </span>
                  <span>-₹{priceBreakdown.discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t border-black my-2"></div>

              <div className="flex justify-between font-semibold">
                <span className="text-black">Total Amount</span>
                <span className="text-black">₹{Math.round(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Button */}
      <div className="flex-shrink-0 p-5 border-t bg-white">
        {weddingPackage && currentStep === 1 ? (
          <div className="w-full space-y-3 flex flex-col items-center">
            {onEditPackage && (
              <button
                className="w-[85%] text-black bg-white border border-gray-300 text-sm font-semibold py-2.5 rounded-xl transition-opacity hover:bg-gray-50 disabled:opacity-50"
                onClick={onEditPackage}
              >
                <div className="flex items-center justify-center">
                  <Scissors className="mr-2 h-4 w-4" />
                  Edit Package
                </div>
              </button>
            )}
            <button
              className="w-[85%] text-white text-sm font-semibold py-2.5 rounded-xl mt-1 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: '#422A3C' }}
              disabled={!isButtonEnabled}
              onClick={onNextStep}
            >
              {buttonLabel}
            </button>
          </div>
        ) : (
          <div className="flex justify-center w-full">
            <button
              className="w-[85%] text-white text-sm font-semibold py-2.5 rounded-xl mt-1 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: '#422A3C' }}
              disabled={!isButtonEnabled}
              onClick={onNextStep}
            >
              {buttonLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
