"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import {
  ChevronLeft,
  X,
  Scissors,
  User,
  Calendar,
  CalendarDays,
  Clock,
  MapPin,
  Star,
  ChevronUp,
  ChevronDown,
  Wallet,
  CreditCard,
  Hourglass,
  Loader2,
  AlertCircle,
  Search,
  Home,
  List,
  UserCircle,
  Phone,
  CheckCircle,
  Info,
  ChevronRight,
  Heart,
  Plus,
  Tag,
  Check,
  Store,
  Mail,
  ChevronsLeft,
  ChevronsRight,
  CircleDot,
  Dot
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { BookingSummary } from "@/components/booking/BookingSummary";
import { Step1_Services } from "@/components/booking/Step1_Services";
import { Step1_WeddingPackageCustomizer } from "@/components/booking/Step1_WeddingPackageCustomizer";
import { Step2_Staff } from "@/components/booking/Step2_Staff";
import { Step3_TimeSlot as TimeSlotSelector } from "@/components/booking/Step3_TimeSlot_Optimized";
import { Step2_MultiService } from "@/components/booking/Step2_MultiService";
import { Step3_MultiServiceTimeSlot } from "@/components/booking/Step3_MultiServiceTimeSlot";
import { Step3_LocationSelection } from "@/components/booking/Step3_LocationSelection";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@repo/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@repo/ui/card';
import { Separator } from '@repo/ui/separator';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@repo/ui/select';
import { Label } from '@repo/ui/label';
import { Input } from '@repo/ui/input';
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';
import { useBookingData, Service, StaffMember, ServiceStaffAssignment, calculateTotalDuration, convertDurationToMinutes, WeddingPackage } from '@/hooks/useBookingData';
import {
  useCreatePublicAppointmentMutation, useGetPublicVendorOffersQuery, useGetPublicAllOffersQuery,
  useAcquireSlotLockMutation, useConfirmBookingMutation,
  useLockWeddingPackageMutation
} from '@repo/store/api';
import { useAuth } from '@/hooks/useAuth';
// Add import for payment calculator - use cleaner @repo alias
import { calculateBookingAmount, validateOfferCode, isOfferApplicable } from '@repo/lib/utils';
import { toast } from 'sonner';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { GoogleMapSelector } from '@/components/GoogleMapSelector';
import { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY } from "@repo/config/config";
import { MarketingHeader } from "@/components/MarketingHeader";

// Load Razorpay checkout.js dynamically
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

type BookingStepBannerProps = {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  bookingMode: 'salon' | 'home';
  isWeddingPackage?: boolean;
};

const getBookingStepItems = (bookingMode: 'salon' | 'home', isWeddingPackage = false) => {
  if (isWeddingPackage) {
    return [
      { step: 1, label: 'Select Package' },
      { step: 3, label: 'Location' },
      { step: 4, label: 'Time Slot' },
    ];
  }

  if (bookingMode === 'home') {
    return [
      { step: 1, label: 'Services' },
      { step: 2, label: 'Select Professionals' },
      { step: 3, label: 'Location' },
      { step: 4, label: 'Time Slot' },
    ];
  }

  return [
    { step: 1, label: 'Services' },
    { step: 2, label: 'Select Professionals' },
    { step: 3, label: 'Time Slot' },
  ];
};

const BookingStepBanner = ({
  currentStep,
  setCurrentStep,
  bookingMode,
  isWeddingPackage = false,
}: BookingStepBannerProps) => {
  const steps = getBookingStepItems(bookingMode, isWeddingPackage);

  return (
    <nav className="flex items-center text-xs sm:text-sm font-medium text-white/70 flex-wrap justify-start gap-y-2">
      {steps.map((item, index) => {
        const isCompleted = currentStep > item.step;
        const isActive = currentStep === item.step;

        return (
          <React.Fragment key={item.step}>
            <button
              type="button"
              onClick={() => isCompleted && setCurrentStep(item.step)}
              className={[
                "transition-colors rounded-md px-2 py-0.5",
                isCompleted ? "text-white hover:bg-white/10 hover:text-white" : "cursor-default",
                isActive ? "text-white font-bold" : "",
              ].filter(Boolean).join(" ")}
            >
              {item.label}
            </button>
            {index < steps.length - 1 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/images/next (1) 3.png"
                alt="arrow"
                className="h-3 w-3 mx-0.5 sm:mx-1 flex-shrink-0 opacity-70"
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

// Add a custom hook to fetch tax fee settings
const useTaxFeeSettings = () => {
  const [taxFeeSettings, setTaxFeeSettings] = useState<null | any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<null | Error>(null);

  useEffect(() => {
    const fetchTaxFeeSettings = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/tax-fees', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          setTaxFeeSettings(data);
        } else {
          setError(new Error('Failed to fetch tax fee settings'));
        }
      } catch (err: any) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTaxFeeSettings();
  }, []);

  return { taxFeeSettings, isLoading, error };
};

// Add interface for home service location
interface HomeServiceLocation {
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  landmark?: string;
  lat?: number;
  lng?: number;
  coordinates?: { lat: number; lng: number };
}

function BookingPageContent() {
  // Helper function to calculate end time
  const calculateEndTime = (startTime: string, duration: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { salonId } = params;

  // State for tracking the selected service
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // State for tracking the selected wedding package
  const [selectedWeddingPackage, setSelectedWeddingPackage] = useState<WeddingPackage | null>(null);
  const [isCustomizingPackage, setIsCustomizingPackage] = useState(false);
  const [customizedPackageServices, setCustomizedPackageServices] = useState<Service[]>([]);
  const [weddingPackageMode, setWeddingPackageMode] = useState<'default' | 'customized' | null>(null);
  const [weddingVenueType, setWeddingVenueType] = useState<'salon' | 'venue' | null>(null);

  // State declarations
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [serviceStaffAssignments, setServiceStaffAssignments] = useState<ServiceStaffAssignment[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookingMode, setBookingMode] = useState<'salon' | 'home'>('salon'); // Global booking mode
  const [serviceSchedule, setServiceSchedule] = useState<Array<{
    service: Service;
    staff: StaffMember | null;
    startTime: string;
    endTime: string;
    duration: number;
  }>>([]);

  // Load selected service or wedding package from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPackage = sessionStorage.getItem("selectedWeddingPackage");
      const storedService = sessionStorage.getItem("selectedService");

      if (storedPackage) {
        try {
          const parsedPackage = JSON.parse(storedPackage);
          if (parsedPackage && !parsedPackage.services && parsedPackage.servicesList) {
            parsedPackage.services = parsedPackage.servicesList;
          }
          console.log("Initializing booking page with wedding package:", parsedPackage);
          setSelectedWeddingPackage(parsedPackage);
          setSelectedServices([]);
          setSelectedService(null);
          setServiceStaffAssignments([]);
          // Clear sessionStorage so it doesn't persist on refresh
          sessionStorage.removeItem("selectedWeddingPackage");
        } catch (e) {
          console.error("Failed to parse selectedWeddingPackage from sessionStorage:", e);
        }
      } else if (storedService) {
        try {
          const parsedService = JSON.parse(storedService);
          console.log("Initializing booking page with service:", parsedService);
          setSelectedServices([parsedService]);
          setSelectedService(parsedService);
          setSelectedWeddingPackage(null);
          setServiceStaffAssignments([{ service: parsedService, staff: null }]);
          // Clear sessionStorage
          sessionStorage.removeItem("selectedService");
        } catch (e) {
          console.error("Failed to parse selectedService from sessionStorage:", e);
        }
      }
    }
  }, []);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [serviceLocation, setServiceLocation] = useState<HomeServiceLocation | null>(null);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [locationForm, setLocationForm] = useState<HomeServiceLocation>({
    address: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    lat: undefined,
    lng: undefined
  });

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<string>('Pay at Salon');

  // Booking confirmation loading state to prevent double-clicks
  const [isConfirmingBooking, setIsConfirmingBooking] = useState(false);

  // Defensive: Ensure location is cleared if mode is salon (catches state inconsistencies)
  // BUT: Exclude wedding packages as they manage location separately via weddingVenueType
  useEffect(() => {
    if (bookingMode === 'salon' && serviceLocation && !selectedWeddingPackage) {
      console.log("Defensive Cleanup: Clearing serviceLocation because mode is salon (non-wedding)");
      setServiceLocation(null);
    }
  }, [bookingMode, serviceLocation, selectedWeddingPackage]);



  // Wrapper to handle mode switching with cleanup
  const handleBookingModeChange = (mode: 'salon' | 'home') => {
    console.log(`=== Switching booking mode to: ${mode} at step ${currentStep} ===`);

    setBookingMode(mode);

    if (mode === 'salon') {
      // Clear home service location when switching to salon mode
      setServiceLocation(null);
      setLocationForm({
        address: '',
        city: '',
        state: '',
        pincode: '',
        landmark: '',
        lat: undefined,
        lng: undefined
      });
    } else if (mode === 'home') {
      // For home mode, we only open the map automatically if we are already at the location step (Step 4 for weddings)
      // For regular services, the location modal is triggered by an effect in Step 3
      if (currentStep === 4 && selectedWeddingPackage) {
        console.log('Opening map selector for wedding venue');
        setShowMapSelector(true);
      }
    }
  };

  // Fetch dynamic data using our custom hook
  const {
    services,
    servicesByCategory,
    categories,
    staff,
    workingHours,
    salonInfo,
    weddingPackages,
    isLoading,
    error
  } = useBookingData(salonId as string);

  // Fetch all offers (Admin)
  const { data: adminOffersData, isLoading: isAdminOffersLoading } = useGetPublicAllOffersQuery({
    vendorId: salonId as string,
    regionId: (salonInfo as any)?.regionId
  }, {
    skip: !salonId
  });

  // Fetch CRM offers
  const { data: crmOffersData, isLoading: isCrmOffersLoading } = useGetPublicVendorOffersQuery(salonId as string, {
    skip: !salonId
  });

  const vendorOffers = useMemo(() => {
    const adminOffers = Array.isArray(adminOffersData) ? adminOffersData : (adminOffersData?.data || []);
    const crmOffers = Array.isArray(crmOffersData) ? crmOffersData : (crmOffersData?.data || []);
    return [...adminOffers, ...crmOffers];
  }, [adminOffersData, crmOffersData]);

  const isOffersLoading = isAdminOffersLoading || isCrmOffersLoading;

  // Debug log for offers
  useEffect(() => {
    if (vendorOffers.length > 0) {
      console.log('✅ Fetched Offers:', {
        count: vendorOffers.length,
        adminOffers: vendorOffers.filter((o: any) => o.businessType === 'admin').length,
        crmOffers: vendorOffers.filter((o: any) => o.businessType === 'vendor' || o.businessType === 'salon').length
      });
    }
  }, [vendorOffers]);

  // Fetch tax fee settings using our custom hook
  const { taxFeeSettings, isLoading: isTaxFeeSettingsLoading } = useTaxFeeSettings();

  // State for offer dropdown
  const [isOfferDropdownOpen, setIsOfferDropdownOpen] = useState(false);
  const [offerSearchTerm, setOfferSearchTerm] = useState('');
  const [showOfferDropdown, setShowOfferDropdown] = useState(false);

  // Add useEffect to handle click outside of offer dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdown = document.getElementById('offer-dropdown');
      const input = document.getElementById('offer-input');
      if (dropdown && input &&
        !dropdown.contains(event.target as Node) &&
        !input.contains(event.target as Node)) {
        setShowOfferDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter offers based on search term
  const filteredOffers = useMemo(() => {
    if (!vendorOffers || vendorOffers.length === 0) {
      return [];
    }

    if (!offerSearchTerm) {
      return vendorOffers;
    }

    const filtered = vendorOffers.filter((offer: { code: string; type: string; value: number }) =>
      offer.code.toLowerCase().includes(offerSearchTerm.toLowerCase()) ||
      (offer.type === 'percentage' && `${offer.value}%`.includes(offerSearchTerm)) ||
      (offer.type === 'fixed' && `₹${offer.value}`.includes(offerSearchTerm))
    );

    return filtered;
  }, [vendorOffers, offerSearchTerm]);

  // Fetch service-specific staff data when a service is selected
  const serviceStaffData = useBookingData(salonId as string, selectedService?.id || (selectedServices.length > 0 ? selectedServices[0]?.id : undefined));


  // Make sure currentStep is always a valid number (allow up to step 5 for wedding packages)
  if (typeof currentStep !== 'number' || currentStep < 1 || currentStep > 5) {
    console.warn('Invalid currentStep value, resetting to 1:', currentStep);
    setCurrentStep(1);
  }

  // Mutations for booking flow
  const [createAppointment, { isLoading: isCreatingAppointment }] = useCreatePublicAppointmentMutation();
  const [acquireSlotLock] = useAcquireSlotLockMutation();
  const [confirmBooking] = useConfirmBookingMutation();
  const [lockWeddingPackage] = useLockWeddingPackageMutation();

  // Get authentication state from the useAuth hook
  const { isAuthenticated, user } = useAuth();
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isServiceScheduleOpen, setIsServiceScheduleOpen] = useState(false);

  // Add missing state variables
  const [isStaffScheduleOpen, setIsStaffScheduleOpen] = useState(false);
  const [isLocationFormOpen, setIsLocationFormOpen] = useState(false);
  const [isCustomerInfoFormOpen, setIsCustomerInfoFormOpen] = useState(false);
  const [isStaffSelectionOpen, setIsStaffSelectionOpen] = useState(false);
  const [isTimeSelectionOpen, setIsTimeSelectionOpen] = useState(false);
  const [isDateSelectionOpen, setIsDateSelectionOpen] = useState(false);
  const [isServiceSelectionOpen, setIsServiceSelectionOpen] = useState(false);
  const [isVendorSelectionOpen, setIsVendorSelectionOpen] = useState(false);

  // Add state to store lock token from Step3 for wedding packages and regular bookings
  const [slotLockToken, setSlotLockToken] = useState<string | null>(null);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);

  // Add missing form state variables
  const [customerInfoForm, setCustomerInfoForm] = useState({
    name: '',
    phone: ''
  });

  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');

  // Mock data for missing components
  const staffList = staff || [];
  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  const vendors: any[] = [];
  const staffSchedule: any[] = [];

  // State for offer code and price breakdown
  const [offerCode, setOfferCode] = useState('');
  const [priceBreakdown, setPriceBreakdown] = useState<any>(null);
  const [offer, setOffer] = useState<any>(null);
  const [appliedOffer, setAppliedOffer] = useState<any>(null);
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [appointmentDate, setAppointmentDate] = useState(new Date());
  const [appointmentTime, setAppointmentTime] = useState(new Date());
  const [totalAmount, setTotalAmount] = useState(0);

  // Update totalAmount when selectedServices or wedding package change
  useEffect(() => {
    if (selectedWeddingPackage) {
      if (weddingPackageMode === 'customized' && customizedPackageServices && customizedPackageServices.length > 0) {
        const amount = customizedPackageServices.reduce((sum, service) => {
          const servicePrice = parseFloat(service.price || '0');
          const quantity = (service as any).quantity || 1;
          return sum + (servicePrice * quantity);
        }, 0);
        setTotalAmount(amount);
      } else {
        const packagePrice = selectedWeddingPackage.discountedPrice || selectedWeddingPackage.totalPrice || 0;
        setTotalAmount(packagePrice);
      }
    } else if (priceBreakdown?.subtotal) {
      setTotalAmount(priceBreakdown.subtotal);
    } else {
      const amount = selectedServices.reduce((sum, service) => {
        const servicePrice = service.discountedPrice !== null && service.discountedPrice !== undefined ?
          parseFloat(service.discountedPrice) :
          parseFloat(service.price || '0');

        const addonsPrice = service.selectedAddons?.reduce((addonSum, addon) => {
          const addonPriceValue = addon.price !== null && addon.price !== undefined ? (typeof addon.price === 'string' ? parseFloat(addon.price) : addon.price) : 0;
          return addonSum + addonPriceValue;
        }, 0) || 0;

        return sum + servicePrice + addonsPrice;
      }, 0);
      setTotalAmount(amount);
    }
  }, [selectedServices, selectedWeddingPackage, priceBreakdown, weddingPackageMode, customizedPackageServices]);

  // Reset wedding venue type when wedding package changes or is cleared
  useEffect(() => {
    if (!selectedWeddingPackage) {
      setWeddingVenueType(null);
    }
  }, [selectedWeddingPackage]);

  // Keep a ref to vendorOffers so the auto-apply effect can read them without re-triggering
  const vendorOffersRef = React.useRef<any[]>([]);
  useEffect(() => { vendorOffersRef.current = vendorOffers; }, [vendorOffers]);

  // Auto-apply offer code from URL search params (runs once when salonId + offers are ready)
  const autoApplyRanRef = React.useRef(false);
  useEffect(() => {
    const codeFromUrl = searchParams.get('offerCode');
    // Guard: only run once and only when the offer code exists in URL
    if (!codeFromUrl || autoApplyRanRef.current || isOffersLoading || !salonId) return;
    autoApplyRanRef.current = true;
    console.log('Detected offerCode in URL:', codeFromUrl);
    setOfferCode(codeFromUrl);
    const validateAndApply = async () => {
      try {
        const response = await fetch('/api/validate-offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offerCode: codeFromUrl.toUpperCase().trim(),
            vendorId: salonId
          }),
        });
        const result = await response.json();
        if (result.success) {
          // Prefer the full offer from vendorOffers (has applicableServices/Categories restriction
          // fields). The validate-offer API often returns a stripped-down object without them,
          // which causes isOfferApplicable to return true for ALL services (no restrictions seen).
          const codeNorm = codeFromUrl.toUpperCase().trim();
          const vendorOffer = vendorOffersRef.current?.find(
            (o: any) => (o?.code || o?.offerCode || '')?.toUpperCase().trim() === codeNorm
          );
          const offerToApply = vendorOffer
            ? { ...result.data, ...vendorOffer } // merge: validate data + full restriction fields
            : result.data;
          setOffer(offerToApply);
          setAppliedOffer(offerToApply);
          // No toast — the offer-mode banner in Step1_Services already informs the user
        }
      } catch (err) {
        console.error('Error auto-applying offer:', err);
      }
    };
    validateAndApply();
  }, [searchParams, salonId, isOffersLoading]);


  // Handle map click to select location
  const handleMapClick = () => {
    // This function is for the div click handler
    // The actual map click handling is done by the GoogleMap component
  };

  // Handle map marker position change
  const handleMapMarkerChange = (lat: number, lng: number) => {
    setLocationForm(prev => ({
      ...prev,
      lat: lat,
      lng: lng
    }));
  };

  // Get current location using Geolocation API
  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocationForm(prev => ({
            ...prev,
            lat: latitude,
            lng: longitude
          }));
          toast.success('Current location detected successfully');
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Unable to get your current location. Please try again or enter manually.');
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser');
    }
  };

  // Handle home service location form changes
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocationForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle location form submission
  const handleLocationFormSubmit = () => {
    // Use the existing handleLocationSubmit function
    handleLocationSubmit();
  };

  // Handle customer info form submission
  const handleCustomerInfoFormSubmit = () => {
    // Set customer info from form
    setCustomerInfo(customerInfoForm);
    setIsCustomerInfoFormOpen(false);
  };

  // Handle staff selection
  const handleStaffSelection = () => {
    // Find selected staff member
    const staffMember = staffList.find((staff: any) => staff.id === selectedStaffId);
    if (staffMember) {
      setSelectedStaff(staffMember);
    }
    setIsStaffSelectionOpen(false);
  };

  // Handle time selection
  const handleTimeSelection = () => {
    setIsTimeSelectionOpen(false);
  };

  // Handle date selection
  const handleDateSelection = () => {
    setIsDateSelectionOpen(false);
  };

  // Handle service selection
  const handleServiceSelection = () => {
    // Find selected services
    const selectedServices = services.filter((service: any) =>
      selectedServiceIds.includes(service.id)
    );
    setSelectedServices(selectedServices);
    setIsServiceSelectionOpen(false);
  };

  // Handle addon removal
  const handleRemoveAddon = (serviceId: string, addonId: string) => {
    setSelectedServices(prev =>
      prev.map(service =>
        service.id === serviceId
          ? {
            ...service,
            selectedAddons: service.selectedAddons?.filter(addon => addon._id !== addonId) || []
          }
          : service
      )
    );
    toast.success('Add-on removed successfully');
  };

  // Handle vendor selection
  const handleVendorSelection = () => {
    setIsVendorSelectionOpen(false);
  };

  // Handle home service location submission
  const handleLocationSubmit = () => {
    console.log("=== LOCATION SUBMISSION DEBUG ===");
    console.log("Location form data:", locationForm);
    console.log("Required fields check:");
    console.log("- lat:", !!locationForm.lat);
    console.log("- lng:", !!locationForm.lng);
    console.log("- address:", !!locationForm.address);
    console.log("- city:", !!locationForm.city);
    console.log("- state:", !!locationForm.state);
    console.log("- pincode:", !!locationForm.pincode);

    if (!locationForm.lat || !locationForm.lng) {
      toast.error('Please select a location on the map');
      console.log("❌ Validation failed - no location selected");
      return;
    }

    // Convert lat/lng to numbers and create proper structure with coordinates object
    const locationData = {
      address: locationForm.address,
      city: locationForm.city,
      state: locationForm.state,
      pincode: locationForm.pincode,
      landmark: locationForm.landmark || '',
      lat: Number(locationForm.lat),
      lng: Number(locationForm.lng),
      coordinates: {
        lat: Number(locationForm.lat),
        lng: Number(locationForm.lng)
      }
    };

    console.log("✅ Validation passed - setting location data");
    console.log("Setting serviceLocation to:", locationData);
    setServiceLocation(locationData as any);
    setShowLocationModal(false);
    setShowMapSelector(false); // Reset map selector state

    toast.success('Location saved successfully!');

    // After setting location, if we have a time selected, try to proceed
    if (selectedTime) {
      if (isAuthenticated) {
        setIsConfirmationModalOpen(true);
      } else {
        // Save booking data to sessionStorage before redirecting to login
        const bookingData = {
          selectedServices,
          serviceStaffAssignments,
          selectedStaff,
          selectedDate: selectedDate.toISOString(),
          selectedTime,
          salonId,
          serviceLocation: locationData,
          bookingMode,
          currentStep,
          appliedOffer,
          slotLockToken,
          pendingAppointmentId,
          weddingVenueType,
          weddingPackageMode,
          customizedPackageServices,
          selectedWeddingPackage
        };
        sessionStorage.setItem('pendingBooking', JSON.stringify(bookingData));
        router.push(`/client-login?redirect=/book/${salonId}`);
      }
    }

  };

  const handleAddressDetailsFetched = (locationData: HomeServiceLocation) => {
    console.log("✅ Address details fetched - setting location data");
    console.log("Setting serviceLocation to:", locationData);

    // Ensure coordinates are present before setting state
    let finalLocation = locationData;
    if (locationData.lat !== undefined && locationData.lng !== undefined) {
      finalLocation = {
        ...locationData,
        coordinates: {
          lat: Number(locationData.lat),
          lng: Number(locationData.lng)
        }
      };
      setServiceLocation(finalLocation as any);
    } else {
      setServiceLocation(locationData as any);
    }
    setShowLocationModal(false);
    setShowMapSelector(false); // Reset map selector state

    // After setting location, if we have a time selected, try to proceed
    if (selectedTime) {
      if (isAuthenticated) {
        setIsConfirmationModalOpen(true);
      } else {
        // Save booking data to sessionStorage before redirecting to login
        const bookingData = {
          selectedServices,
          serviceStaffAssignments,
          selectedStaff,
          selectedDate: selectedDate.toISOString(),
          selectedTime,
          salonId,
          serviceLocation: finalLocation,
          bookingMode,
          currentStep,
          appliedOffer,
          slotLockToken,
          pendingAppointmentId,
          weddingVenueType,
          weddingPackageMode,
          customizedPackageServices,
          selectedWeddingPackage
        };
        sessionStorage.setItem('pendingBooking', JSON.stringify(bookingData));
        router.push(`/client-login?redirect=/book/${salonId}`);
      }
    }

    console.log("=== LOCATION SUBMISSION COMPLETE ===");
  };

  // Add a new function to fetch address details
  const fetchAddressDetails = async (lat: number, lng: number) => {
    try {
      console.log("Fetching address details for:", { lat, lng });

      // Check if we have the Google Maps API key
      const apiKey = NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        toast.error('Google Maps API key is not configured. Please contact support.');
        console.error('Google Maps API key is missing');
        return;
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
      );
      const data = await response.json();
      console.log("Google Maps API response:", data);

      if (data.results && data.results.length > 0) {
        const addressComponents = data.results[0].address_components;
        const addressData: Partial<HomeServiceLocation> = {
          address: data.results[0].formatted_address,
          lat,
          lng
        };

        // Extract address components
        addressComponents.forEach((component: any) => {
          if (component.types.includes('locality')) {
            addressData.city = component.long_name;
          } else if (component.types.includes('administrative_area_level_1')) {
            addressData.state = component.long_name;
          } else if (component.types.includes('postal_code')) {
            addressData.pincode = component.long_name;
          }
        });

        console.log("Extracted address data:", addressData);

        // Update the location form with the fetched data
        setLocationForm(prev => ({
          ...prev,
          ...addressData
        }));

        // If we now have all required data, proceed with submission
        if (addressData.address && addressData.city && addressData.state && addressData.pincode) {
          const locationData = {
            ...addressData,
            lat: Number(lat),
            lng: Number(lng),
            coordinates: {
              lat: Number(lat),
              lng: Number(lng)
            }
          };

          console.log("✅ Address details fetched - setting location data");
          console.log("Setting serviceLocation to:", locationData);
          setServiceLocation(locationData as any);
          setShowLocationModal(false);
          setShowMapSelector(false); // Reset map selector state

          // After setting location, if we have a time selected, try to proceed
          if (selectedTime) {
            if (isAuthenticated) {
              setIsConfirmationModalOpen(true);
            } else {
              // Save booking data to sessionStorage before redirecting to login
              const bookingData = {
                selectedServices,
                serviceStaffAssignments,
                selectedStaff,
                selectedDate: selectedDate.toISOString(),
                selectedTime,
                salonId,
                serviceLocation: locationData,
                bookingMode,
                currentStep,
                appliedOffer,
                slotLockToken,
                pendingAppointmentId,
                weddingVenueType,
                weddingPackageMode,
                customizedPackageServices,
                selectedWeddingPackage
              };
              sessionStorage.setItem('pendingBooking', JSON.stringify(bookingData));
              router.push(`/client-login?redirect=/book/${salonId}`);
            }
          }
        } else {
          toast.error('Could not fetch complete address details. Please try again or enter manually.');
          console.log("❌ Incomplete address data fetched:", addressData);
        }
      } else {
        toast.error('Could not fetch address details. Please enter manually.');
      }
    } catch (error) {
      console.error('Error fetching address:', error);
      toast.error('Could not fetch address details. Please enter manually.');
    }
  };

  // Add useEffect to monitor serviceLocation changes
  useEffect(() => {
    console.log("serviceLocation state updated:", serviceLocation);
  }, [serviceLocation]);

  // Set customer info when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      setCustomerInfo({
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Guest User',
        phone: user.mobileNo || user.phone || 'Not provided'
      });
    }
  }, [isAuthenticated, user]);

  // Handle offer code application
  const handleApplyOffer = async () => {
    if (!offerCode) return;

    try {
      // Correctly validate the offer using the validate-offer API
      console.log("Validating offer code:", offerCode, "for vendor:", salonId);
      const response = await fetch('/api/validate-offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          offerCode: offerCode.toUpperCase().trim(),
          vendorId: salonId
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Validate applicability for selected services
        if (!isOfferApplicable(result.data, selectedServices)) {
          toast.error(`Offer ${result.data.code} is not applicable for your selected services.`);
          return;
        }

        setOffer(result.data); // Set the offer data directly
        setAppliedOffer(result.data); // Also set the applied offer

        // Calculate savings for the message
        const savings = result.data.type === 'percentage'
          ? Math.round(totalAmount * result.data.value / 100)
          : Math.round(result.data.value);

        toast.success(`Offer ${result.data.code} applied successfully! You saved ₹${savings}.`);
        // Hide the dropdown after successful application
        setShowOfferDropdown(false);
      } else {
        toast.error(result.message || 'Invalid or expired offer code');
      }
    } catch (error) {
      console.error('Error applying offer:', error);
      toast.error('Failed to validate offer code. Please try again.');
    }
  };

  // Handle offer selection from dropdown
  const handleSelectOffer = (selectedOffer: any) => {
    // Double check applicability
    if (!isOfferApplicable(selectedOffer, selectedServices)) {
      toast.error(`Offer ${selectedOffer.code} is not applicable for the selected services.`);
      return;
    }

    setOfferCode(selectedOffer.code);
    setOffer(selectedOffer);
    setAppliedOffer(selectedOffer);
    setShowOfferDropdown(false);
    setOfferSearchTerm('');

    // Calculate preview savings
    const savings = selectedOffer.type === 'percentage'
      ? Math.round(totalAmount * selectedOffer.value / 100)
      : Math.round(selectedOffer.value);

    toast.success(`Offer ${selectedOffer.code} applied successfully!`);
  };

  // Clear applied offer
  const handleClearOffer = () => {
    setOfferCode('');
    setOffer(null);
    setAppliedOffer(null);
    toast.success('Offer code removed');
  };

  const persistServiceLocation = async (location: HomeServiceLocation | null) => {
    if (!isAuthenticated || !location) return;
    if (!location.city || !location.state || !location.pincode) return;

    const lat = Number(location.coordinates?.lat ?? location.lat);
    const lng = Number(location.coordinates?.lng ?? location.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    try {
      // Determine label based on context
      const label = selectedWeddingPackage && weddingVenueType === 'venue'
        ? 'Wedding Venue'
        : 'Home Service';

      await fetch('/api/client/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          address: location.address,
          city: location.city,
          state: location.state,
          pincode: location.pincode,
          landmark: location.landmark || '',
          lat,
          lng,
          fullName: user ? `${user.firstName} ${user.lastName}`.trim() : 'Guest User',
          mobileNo: user?.mobileNo || '0000000000',
          label: label,
          isPrimary: false
        })
      });
    } catch (error) {
      console.error('Error saving address for next booking:', error);
    }
  };

  // Handle confirm appointment
  const handleConfirmAppointment = async () => {
    // Create the appointment
    try {
      await handleFinalBookingConfirmation();
      setIsConfirmationModalOpen(false);
      router.push('/profile/appointments');
    } catch (error) {
      console.error("Error confirming appointment:", error);
      toast.error("Failed to confirm appointment. Please try again.");
    }
  };

  // Handle navigation between steps
  const handleNextStep = () => {
    // Validate Step 1 (Services or Wedding Package) transition
    if (currentStep === 1) {
      // Wedding package selected - skip to time/date selection
      if (selectedWeddingPackage) {
        if (!weddingPackageMode) {
          setWeddingPackageMode('default');
        }

        // Logic check: Require login BEFORE selecting time slot
        if (!isAuthenticated) {
          console.log("Wedding Package: Redirecting to login before Step 3");
          toast.info("Please login to choose a date and time");
          const bookingData = {
            selectedServices,
            serviceStaffAssignments,
            selectedStaff,
            selectedDate: selectedDate.toISOString(),
            selectedTime,
            salonId,
            serviceLocation,
            bookingMode,
            currentStep: 3, // Set to 3 so they return to time selection
            appliedOffer,
            slotLockToken,
            pendingAppointmentId,
            weddingVenueType,
            weddingPackageMode,
            customizedPackageServices,
            selectedWeddingPackage
          };
          sessionStorage.setItem('pendingBooking', JSON.stringify(bookingData));
          router.push(`/client-login?redirect=/book/${salonId}`);
          return;
        }

        setCurrentStep(3); // Skip staff selection, go directly to time/date
        return;
      }

      // Check if user selected at least one service (only for regular service bookings)
      if (selectedServices.length === 0) {
        toast.error("Please select at least one service to continue.");
        return;
      }

      // For regular services: Check for incompatible services based on Booking Mode
      if (selectedServices.length > 0 && bookingMode === 'home') {
        const incompatibleServices = selectedServices.filter(service =>
          !service.homeService?.available && !service.serviceHomeService?.available
        );

        if (incompatibleServices.length > 0) {
          const names = incompatibleServices.map(s => s.name).join(", ");
          toast.error(`Some services are not available for Home Service: ${names}. Please remove them or switch to Salon mode.`);
          return;
        }
      }

      // OPTIONAL: Check for Salon-only services? 
      // Current logic assumes if it's NOT home service, it works in salon.
      // But if we wanted to enforce strict Salon-only vs Home-only, we could add checks here.
    }
    // For multi-service bookings, validate assignments before proceeding
    const isMultiService = selectedServices.length > 1 || serviceStaffAssignments.length > 0;

    // Check if any selected service is a home service
    const hasHomeService = selectedServices.some(service =>
      service.homeService?.available || service.serviceHomeService?.available
    );

    console.log("hasHomeService", hasHomeService)
    if (currentStep < 3) {
      // For step 2, we validate and check for authentication before going to Step 3
      if (currentStep === 2) {
        if (isMultiService) {
          // Check if all services have staff assigned
          const allAssigned = serviceStaffAssignments.every(assignment => assignment.staff !== undefined);
          if (!allAssigned) {
            toast.error('Please assign staff to all services or select "Any Professional".');
            return;
          }
        }

        // AUTH CHECK: Before moving from Step 2 (Professional) to Step 3 (Date/Time)
        if (!isAuthenticated) {
          console.log("Step 2: Redirecting to login before Step 3");
          toast.info("Please login to choose a date and time");
          const bookingData = {
            selectedServices,
            serviceStaffAssignments,
            selectedStaff,
            selectedDate: selectedDate.toISOString(),
            selectedTime,
            salonId,
            serviceLocation,
            bookingMode,
            currentStep: 3, // Set to 3 so they return to time selection
            appliedOffer,
            slotLockToken,
            pendingAppointmentId,
            weddingVenueType,
            weddingPackageMode,
            customizedPackageServices,
            selectedWeddingPackage
          };
          sessionStorage.setItem('pendingBooking', JSON.stringify(bookingData));
          router.push(`/client-login?redirect=/book/${salonId}`);
          return;
        }
      }

      // Proceed to next step
      setCurrentStep(currentStep + 1);
    } else {
      // We're at step 3 or higher
      // For home services: Step 3 is location, Step 4 is time slot
      // For salon services: Step 3 is time slot

      if (currentStep === 3) {
        // At step 3

        // WEDDING PACKAGE LOCATION VALIDATION
        if (selectedWeddingPackage) {
          // Check if venue type is selected
          if (!weddingVenueType) {
            toast.error('Please select whether wedding will be at salon or venue');
            return;
          }

          // If venue selected, validate address
          if (weddingVenueType === 'venue') {
            if (!serviceLocation || !serviceLocation.address || !serviceLocation.city) {
              toast.error('Please provide the wedding venue address');
              return;
            }
          }

          // Proceed to Step 4 (time slot selection)
          setCurrentStep(4);
          return;
        }

        if (bookingMode === 'home' && !selectedWeddingPackage) {
          // For home services (non-wedding), step 3 is location selection
          // Validate location and proceed to step 4 (time slot)
          if (!serviceLocation) {
            console.log("Blocking next step: Home mode without location");
            toast.error("Please select a location for home service");
            setShowLocationModal(true);
            return;
          }
          // Location confirmed, proceed to time slot (step 4)
          setCurrentStep(4);
          return;
        } else {
          // For salon services, step 3 is time slot
          // Check if time is selected and proceed to confirmation
          if (!selectedTime) {
            toast.error("Please select a time slot");
            return;
          }
          // Time selected, open confirmation modal
          console.log("Step 3 Next: Checking Auth...", { isAuthenticated });
          if (isAuthenticated) {
            console.log("User authenticated, opening confirmation modal");
            setIsConfirmationModalOpen(true);
          } else {
            console.log("User NOT authenticated, redirecting to login");
            toast.info("Please login to complete your booking");
            // Save booking data to sessionStorage before redirecting to login
            const bookingData = {
              selectedServices,
              serviceStaffAssignments,
              selectedStaff,
              selectedDate: selectedDate.toISOString(),
              selectedTime,
              salonId,
              serviceLocation,
              bookingMode,
              currentStep,
              appliedOffer,
              slotLockToken,
              pendingAppointmentId,
              weddingVenueType,
              weddingPackageMode,
              customizedPackageServices,
              selectedWeddingPackage
            };
            sessionStorage.setItem('pendingBooking', JSON.stringify(bookingData));
            router.push(`/client-login?redirect=/book/${salonId}`);
          }
          return;
        }
      }

      if (currentStep === 4) {
        // At step 4
        if (bookingMode === 'home' && !selectedWeddingPackage) {
          // For home services, step 4 is time slot
          // Check if time is selected and proceed to confirmation
          if (!selectedTime) {
            toast.error("Please select a time slot");
            return;
          }
          // Time selected, open confirmation modal
          console.log("Step 4 Next: Checking Auth...", { isAuthenticated });
          if (isAuthenticated) {
            console.log("User authenticated, opening confirmation modal");
            setIsConfirmationModalOpen(true);
          } else {
            console.log("User NOT authenticated, redirecting to login");
            toast.info("Please login to complete your booking");
            // Save booking data to sessionStorage before redirecting to login
            const bookingData = {
              selectedServices,
              serviceStaffAssignments,
              selectedStaff,
              selectedDate: selectedDate.toISOString(),
              selectedTime,
              salonId,
              serviceLocation,
              bookingMode,
              currentStep,
              appliedOffer,
              slotLockToken,
              pendingAppointmentId,
              weddingVenueType,
              weddingPackageMode,
              customizedPackageServices,
              selectedWeddingPackage
            };
            sessionStorage.setItem('pendingBooking', JSON.stringify(bookingData));
            router.push(`/client-login?redirect=/book/${salonId}`);
          }
          return;
        } else if (selectedWeddingPackage) {
          // Wedding package flow at step 4 (location selection for weddings)
          // After location is selected for weddings, maybe proceed or show confirmation?
          // This depends on your wedding package flow
        }
      }

      // Default fallback: For any unhandled case at steps 3 or higher
      // Only require location if we are in 'home' mode
      if (bookingMode === 'home' && !serviceLocation) {
        console.log("Blocking next step: Home mode without location");
        toast.error("Please select a location for home service");
        setShowLocationModal(true); // Force show location modal
        return;
      }

      console.log("Step 3 Next: Checking Auth...", { isAuthenticated });
      if (isAuthenticated) {
        console.log("User authenticated, opening confirmation modal");
        // toast.info("Reviewing appointment details..."); // Optional status update
        setIsConfirmationModalOpen(true);
      } else {
        console.log("User NOT authenticated, redirecting to login");
        toast.info("Please login to complete your booking");
        // Save booking data to sessionStorage before redirecting to login
        const bookingData = {
          selectedServices,
          serviceStaffAssignments,
          selectedStaff,
          selectedDate: selectedDate.toISOString(),
          selectedTime,
          salonId,
          serviceLocation,
          bookingMode,
          currentStep,
          appliedOffer,
          slotLockToken,
          pendingAppointmentId,
          weddingVenueType,
          weddingPackageMode,
          customizedPackageServices,
          selectedWeddingPackage
        };
        sessionStorage.setItem('pendingBooking', JSON.stringify(bookingData));
        router.push(`/client-login?redirect=/book/${salonId}`);
      }
    }
  };


  const handlePrevStep = () => {
    if (currentStep > 1) {
      // Reset venue type when going back to package selection from location step
      if (selectedWeddingPackage && currentStep === 3) {
        setWeddingVenueType(null);
        setCurrentStep(1);
      } else if (selectedWeddingPackage && currentStep === 4) {
        // Going back from time slot to location for wedding packages
        setCurrentStep(3);
      } else {
        setCurrentStep(currentStep - 1);
      }
    } else {
      window.history.back();
    }
  };

  // Check if an appointment was just created and clear the flag
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('appointmentJustCreated') === 'true') {
      sessionStorage.removeItem('appointmentJustCreated');
    }
  }, []);

  // Restore pending booking data after login
  useEffect(() => {
    if (isAuthenticated && typeof window !== 'undefined') {
      const pendingBooking = sessionStorage.getItem('pendingBooking');
      if (pendingBooking) {
        try {
          const bookingData = JSON.parse(pendingBooking);
          // Only restore if it's for the current salon
          if (bookingData.salonId === salonId) {
            setSelectedServices(bookingData.selectedServices || []);
            setServiceStaffAssignments(bookingData.serviceStaffAssignments || []);
            setSelectedStaff(bookingData.selectedStaff || null);
            setSelectedDate(new Date(bookingData.selectedDate));
            setSelectedTime(bookingData.selectedTime || null);
            setServiceLocation(bookingData.serviceLocation || null);

            // Restore missing state fields
            if (bookingData.bookingMode) setBookingMode(bookingData.bookingMode);
            if (bookingData.currentStep) setCurrentStep(bookingData.currentStep);
            if (bookingData.appliedOffer) {
              setAppliedOffer(bookingData.appliedOffer);
              setOffer(bookingData.appliedOffer);
              if (bookingData.appliedOffer.code) setOfferCode(bookingData.appliedOffer.code);
            }
            if (bookingData.slotLockToken) setSlotLockToken(bookingData.slotLockToken);
            if (bookingData.pendingAppointmentId) setPendingAppointmentId(bookingData.pendingAppointmentId);
            if (bookingData.weddingVenueType) setWeddingVenueType(bookingData.weddingVenueType);
            if (bookingData.weddingPackageMode) setWeddingPackageMode(bookingData.weddingPackageMode);
            if (bookingData.customizedPackageServices) setCustomizedPackageServices(bookingData.customizedPackageServices);
            if (bookingData.selectedWeddingPackage) {
              const pkg = bookingData.selectedWeddingPackage;
              if (pkg && !pkg.services && pkg.servicesList) {
                pkg.services = pkg.servicesList;
              }
              setSelectedWeddingPackage(pkg);
            }
            if (bookingData.paymentMethod) setPaymentMethod(bookingData.paymentMethod);

            // Clear the pending booking data
            sessionStorage.removeItem('pendingBooking');

            // Re-open confirmation modal only if we already have a time slot selected
            if (bookingData.currentStep >= 3 && bookingData.selectedTime) {
              setIsConfirmationModalOpen(true);
            }
          }
        } catch (error) {
          console.error('Failed to restore pending booking data:', error);
          sessionStorage.removeItem('pendingBooking');
        }
      }
    }
  }, [isAuthenticated, salonId]);

  // Check if any selected service is a home service and show location modal if needed
  useEffect(() => {
    // Disabled auto-trigger for location modal in Step 3.
    // Location is now requested when clicking 'Continue' from Step 3 for better UX.
    /*
    if (selectedWeddingPackage) {
      return;
    }

    const requiresLocation = bookingMode === 'home';

    if (requiresLocation && currentStep === 3 && !serviceLocation) {
      setShowLocationModal(true);
    }
    */
  }, [selectedServices, currentStep, serviceLocation, bookingMode, selectedWeddingPackage]);

  // Ensure service-staff assignments are properly initialized when selectedServices change
  useEffect(() => {
    console.log('useEffect - Ensuring service-staff assignments', { selectedServicesLength: selectedServices.length, serviceStaffAssignmentsLength: serviceStaffAssignments.length });
    if (selectedServices.length > 0) {
      // Create service-staff assignments for all selected services if they don't exist
      const newAssignments = selectedServices.map(service => {
        // Validate service data
        if (!service || !service.id) {
          console.warn('Invalid service data found:', service);
          return null;
        }

        // Check if this service already has an assignment
        const existingAssignment = serviceStaffAssignments.find(assignment => assignment.service.id === service.id);
        if (existingAssignment) {
          // IMPORTANT: Re-use the staff but UPDATE the service object to include latest addons/duration
          return { ...existingAssignment, service };
        }
        // Create a new assignment with no staff selected
        return { service, staff: null };
      }).filter(Boolean) as ServiceStaffAssignment[]; // Filter out any null values

      // Only update if there are changes
      if (newAssignments.length !== serviceStaffAssignments.length ||
        newAssignments.some((newAssignment, index) =>
          newAssignment?.service?.id !== serviceStaffAssignments[index]?.service?.id)) {
        console.log('useEffect - Updating service-staff assignments', { newAssignments, serviceStaffAssignments });
        setServiceStaffAssignments(newAssignments);
      }
    } else if (serviceStaffAssignments.length > 0) {
      // If no services are selected but we have assignments, clear them
      console.log('useEffect - Clearing service-staff assignments');
      setServiceStaffAssignments([]);
    }
  }, [selectedServices, serviceStaffAssignments]);

  // Calculate service schedule when selectedTime or selectedStaff changes
  useEffect(() => {
    if (selectedTime) {
      try {
        console.log("Recalculating service schedule...");
        console.log("Selected time:", selectedTime);
        console.log("Service staff assignments:", serviceStaffAssignments);
        console.log("Selected services:", selectedServices);
        console.log("Selected staff:", selectedStaff);
        console.log("Is single service?", selectedServices.length === 1);

        // Validate inputs
        if (!selectedTime || !selectedServices || selectedServices.length === 0) {
          console.warn("Missing required data for service schedule calculation");
          setServiceSchedule([]);
          return;
        }

        // Calculate the detailed schedule for each service
        const totalDuration = calculateTotalDuration(selectedServices);
        console.log("Total duration:", totalDuration);

        // Calculate start and end times for each service
        const newServiceSchedule: Array<{
          service: Service;
          staff: StaffMember | null;
          startTime: string;
          endTime: string;
          duration: number;
        }> = [];

        let currentTimeMinutes = parseInt(selectedTime?.split(':')[0] || '0') * 60 + parseInt(selectedTime?.split(':')[1] || '0');

        // Check if this is a single service booking
        const isMultiService = selectedServices.length > 1 || serviceStaffAssignments.length > 0;

        if (!isMultiService) {
          console.log("Processing SINGLE SERVICE booking");
          const service = selectedServices[0];

          // Validate service
          if (!service || !service.duration) {
            console.error("Invalid service data for single service booking:", service);
            setServiceSchedule([]);
            return;
          }

          const serviceDuration = convertDurationToMinutes(service.duration);
          const startTime = `${Math.floor(currentTimeMinutes / 60).toString().padStart(2, '0')}:${(currentTimeMinutes % 60).toString().padStart(2, '0')}`;
          const endTimeMinutes = currentTimeMinutes + serviceDuration;
          const endTime = `${Math.floor(endTimeMinutes / 60).toString().padStart(2, '0')}:${(endTimeMinutes % 60).toString().padStart(2, '0')}`;

          newServiceSchedule.push({
            service,
            staff: selectedStaff, // Use the selectedStaff from Step2
            startTime,
            endTime,
            duration: serviceDuration
          });

          console.log("Single service schedule created:", newServiceSchedule);
        } else {
          // Multi-service flow - use service-staff assignments
          console.log("Processing MULTI-SERVICE booking");

          // Validate service-staff assignments
          if (!serviceStaffAssignments || serviceStaffAssignments.length === 0) {
            console.warn("No service-staff assignments found for multi-service booking");
            setServiceSchedule([]);
            return;
          }

          // Process services in the order they were assigned
          serviceStaffAssignments.forEach(assignment => {
            // Validate assignment
            if (!assignment || !assignment.service) {
              console.warn("Invalid assignment found:", assignment);
              return;
            }

            const service = assignment.service;

            // Validate service
            if (!service || !service.duration) {
              console.warn("Invalid service data:", service);
              return;
            }

            const serviceDuration = convertDurationToMinutes(service.duration);
            const startTime = `${Math.floor(currentTimeMinutes / 60).toString().padStart(2, '0')}:${(currentTimeMinutes % 60).toString().padStart(2, '0')}`;
            currentTimeMinutes += serviceDuration;
            const endTime = `${Math.floor(currentTimeMinutes / 60).toString().padStart(2, '0')}:${(currentTimeMinutes % 60).toString().padStart(2, '0')}`;

            newServiceSchedule.push({
              service,
              staff: assignment.staff, // Use the staff from the assignment
              startTime,
              endTime,
              duration: serviceDuration
            });
          });
        }

        console.log("Final service schedule:", newServiceSchedule);
        setServiceSchedule(newServiceSchedule);
      } catch (error) {
        console.error("Error calculating service schedule:", error);
        setServiceSchedule([]); // Set empty schedule on error to prevent blank screen
      }
    }
  }, [selectedTime, serviceStaffAssignments, selectedServices, selectedStaff]);

  // Auto-advance wedding package booking flow after time selection - always go to location
  useEffect(() => {
    if (selectedWeddingPackage && currentStep === 3 && selectedTime) {
      console.log('Wedding package time selected, moving to location selection');

      // Automatically move to location selection after a brief delay (for UX)
      // Weddings are typically done at the wedding venue, so location is always required
      const timer = setTimeout(() => {
        console.log('Moving to step 4 (location selection) for wedding package');
        setCurrentStep(4);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [selectedWeddingPackage, currentStep, selectedTime, weddingPackageMode, customizedPackageServices, isAuthenticated, salonId, router]);

  // Handle wedding package booking submission
  const handleSubmit = async () => {
    if (!selectedWeddingPackage) {
      toast.error("No wedding package selected");
      return;
    }

    if (!selectedTime) {
      toast.error("Please select a time slot");
      return;
    }

    if (!isAuthenticated) {
      // Save booking data to sessionStorage
      const bookingData = {
        salonId,
        selectedWeddingPackage,
        weddingPackageMode,
        customizedPackageServices,
        selectedStaff,
        selectedDate: selectedDate.toISOString(),
        selectedTime,
        bookingMode,
        serviceLocation,
        paymentMethod,
        currentStep,
        appliedOffer,
        slotLockToken,
        pendingAppointmentId,
        weddingVenueType,
        selectedServices,
        serviceStaffAssignments
      };
      sessionStorage.setItem('pendingBooking', JSON.stringify(bookingData));

      // Redirect to login
      router.push(`/client-login?redirect=/book/${salonId}`);
      return;
    }

    try {
      const isCustomized = weddingPackageMode === 'customized';
      const packageDuration = isCustomized
        ? customizedPackageServices.reduce((total, service) => {
          const qty = (service as any).quantity || 1;
          return total + (convertDurationToMinutes(service.duration) * qty);
        }, 0)
        : selectedWeddingPackage.duration || 0;
      const endTime = calculateEndTime(selectedTime, packageDuration);

      const firstServiceId = isCustomized
        ? (customizedPackageServices[0]?.id || (customizedPackageServices[0] as any)?._id)
        : (selectedWeddingPackage.services[0]?.serviceId || (selectedWeddingPackage.services[0] as any)?._id || selectedWeddingPackage.id);

      // Create appointment data for wedding package
      const appointmentData = {
        vendorId: salonId,
        client: user?._id || user?.id,
        clientName: user ? (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer') : 'Customer',
        clientEmail: user?.emailAddress || user?.email || '',
        clientPhone: user?.mobileNo || user?.phone || '',
        // For wedding package, use the first service as primary
        service: firstServiceId,
        serviceName: selectedWeddingPackage.name,
        staff: selectedStaff?.id || null,
        staffName: selectedStaff?.name || "Any Professional",
        date: selectedDate instanceof Date ? selectedDate.toISOString() : new Date(selectedDate).toISOString(),
        startTime: selectedTime,
        endTime: endTime,
        duration: packageDuration,
        amount: Math.round(totalAmount),
        totalAmount: Math.round(totalAmount),
        platformFee: 0,
        serviceTax: 0,
        discountAmount: isCustomized ? 0 : Math.round(selectedWeddingPackage.totalPrice - (selectedWeddingPackage.discountedPrice || selectedWeddingPackage.totalPrice)),
        finalAmount: Math.round(totalAmount),
        paymentMethod: paymentMethod,
        paymentStatus: 'pending',
        status: 'scheduled',
        notes: `Wedding Package: ${selectedWeddingPackage.name} (${weddingPackageMode === 'customized' ? 'Customized' : 'Default'})`,
        serviceItems: (isCustomized ? customizedPackageServices : selectedWeddingPackage.services).map((service: any) => {
          const qty = isCustomized ? (service.quantity || 1) : 1;
          const singleDuration = convertDurationToMinutes(service.duration || selectedWeddingPackage.duration / (selectedWeddingPackage.services?.length || 1));
          const singleAmount = isCustomized
            ? Number(service.price || 0)
            : (service.discountedPrice !== null && service.discountedPrice !== undefined ?
              Number(service.discountedPrice) :
              Number(service.price || (selectedWeddingPackage.discountedPrice || selectedWeddingPackage.totalPrice) / (selectedWeddingPackage.services?.length || 1)));
          return {
            service: service.id || service.serviceId || service._id,
            serviceName: service.name || service.serviceName,
            staff: selectedStaff?.id || null,
            staffName: selectedStaff?.name || "Any Professional",
            startTime: selectedTime,
            endTime: endTime,
            duration: singleDuration * qty,
            amount: singleAmount * qty
          };
        }),
        isMultiService: true,
        isHomeService: bookingMode === 'home' && !!serviceLocation,
        isWeddingService: true,
        weddingPackageId: selectedWeddingPackage.id || selectedWeddingPackage._id,
        weddingPackageMode: weddingPackageMode,
        ...(bookingMode === 'home' && serviceLocation ? {
          homeServiceLocation: {
            address: serviceLocation.address,
            city: serviceLocation.city || '',
            state: serviceLocation.state || '',
            pincode: serviceLocation.pincode || '',
            landmark: serviceLocation.landmark || '',
            lat: serviceLocation.coordinates?.lat || 0,
            lng: serviceLocation.coordinates?.lng || 0
          }
        } : {}),
        bufferBefore: 0,
        bufferAfter: 0,
        blockingWindows: [],
        blockedTravelWindows: []
      };

      console.log("Creating wedding package booking:", appointmentData);

      // Create the appointment using the API
      const response = await fetch('/api/appointments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(appointmentData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create booking');
      }

      const result = await response.json();

      toast.success("Wedding package booking confirmed!");

      // Mark that an appointment was just created
      sessionStorage.setItem('appointmentJustCreated', 'true');

      // Redirect to success page or appointments page
      router.push(`/appointments/${result.appointment._id}`);

    } catch (error: any) {
      console.error('Error creating wedding package booking:', error);
      toast.error(error.message || 'Failed to confirm booking. Please try again.');
    }
  };

  // Update the handleFinalBookingConfirmation function to use enhanced booking
  const handleFinalBookingConfirmation = async () => {
    console.log('=== handleFinalBookingConfirmation Called ===');
    console.log('Selected Services:', selectedServices);
    console.log('Selected Services Count:', selectedServices.length);
    console.log('Service Staff Assignments:', serviceStaffAssignments);
    console.log('Selected Time:', selectedTime);
    console.log('Selected Wedding Package:', selectedWeddingPackage);
    console.log('Service Location:', serviceLocation);
    console.log('Payment Method:', paymentMethod);
    console.log('Is Authenticated:', isAuthenticated);

    // Prevent double-clicks
    if (isConfirmingBooking) {
      console.log('Booking already in progress, ignoring duplicate click');
      return;
    }

    if (!selectedTime) {
      toast.error("Please select a time slot");
      return;
    }

    if (!isAuthenticated) {
      // Save booking data to sessionStorage
      const bookingData = {
        salonId,
        selectedServices,
        serviceStaffAssignments,
        selectedStaff,
        selectedDate: selectedDate.toISOString(),
        selectedTime,
        serviceLocation,
        bookingMode,
        currentStep,
        appliedOffer,
        slotLockToken,
        pendingAppointmentId,
        weddingVenueType,
        weddingPackageMode,
        customizedPackageServices,
        selectedWeddingPackage
      };
      sessionStorage.setItem('pendingBooking', JSON.stringify(bookingData));

      // Redirect to login
      router.push(`/client-login?redirect=/book/${salonId}`);
      return;
    }

    // Validate that we have at least one service or wedding package
    if (selectedServices.length === 0 && !selectedWeddingPackage) {
      toast.error("Please select at least one service");
      return;
    }

    // Set loading state to prevent double-clicks
    setIsConfirmingBooking(true);

    // Check if this is a multi-service booking
    const isMultiService = selectedServices.length > 1 || serviceStaffAssignments.length > 0;

    let staffId, staffName;

    if (isMultiService) {
      // For multi-service, use the first service assignment
      const firstAssignment = serviceStaffAssignments[0];
      if (firstAssignment) {
        staffId = firstAssignment.staff ? firstAssignment.staff.id : null;
        staffName = firstAssignment.staff ? firstAssignment.staff.name : "Any Professional";
      } else {
        staffId = null;
        staffName = "Any Professional";
      }
    } else {
      // For single service, use the selectedStaff
      staffId = selectedStaff?.id || null;
      staffName = selectedStaff?.name || "Any Professional";
    }

    // Get the primary service - either from selected services or wedding package
    let primaryService;
    if (selectedWeddingPackage) {
      let rawServicesTotal = selectedWeddingPackage.totalPrice || 0;
      let discountedSubtotal = selectedWeddingPackage.discountedPrice != null ? selectedWeddingPackage.discountedPrice : rawServicesTotal;

      if (weddingPackageMode === 'customized' && customizedPackageServices && customizedPackageServices.length > 0) {
        rawServicesTotal = customizedPackageServices.reduce((acc, service) => {
          const servicePrice = parseFloat(String(service.price || '0'));
          const quantity = (service as any).quantity || 1;
          return acc + (servicePrice * quantity);
        }, 0);

        const packageOriginalPrice = selectedWeddingPackage.totalPrice || 0;
        const packageDiscountedPrice = selectedWeddingPackage.discountedPrice != null ? selectedWeddingPackage.discountedPrice : packageOriginalPrice;
        const discountPercent = (selectedWeddingPackage as any).discountPercent != null
          ? (selectedWeddingPackage as any).discountPercent / 100
          : (packageOriginalPrice > 0 ? (packageOriginalPrice - packageDiscountedPrice) / packageOriginalPrice : 0);

        discountedSubtotal = rawServicesTotal * (1 - discountPercent);
      }

      const customizedDuration = weddingPackageMode === 'customized' && customizedPackageServices && customizedPackageServices.length > 0
        ? customizedPackageServices.reduce((acc, service) => {
          const serviceDuration = convertDurationToMinutes(service.duration);
          const quantity = (service as any).quantity || 1;
          return acc + (serviceDuration * quantity);
        }, 0)
        : selectedWeddingPackage.duration;

      // Create a service-like object from wedding package
      primaryService = {
        id: selectedWeddingPackage.id || selectedWeddingPackage._id,
        name: selectedWeddingPackage.name,
        price: rawServicesTotal,
        discountedPrice: discountedSubtotal,
        duration: customizedDuration,
        category: 'Wedding Package',
        description: selectedWeddingPackage.description
      };
    } else {
      // Use the first selected service
      primaryService = selectedServices[0];
    }

    // Validate primary service has required fields
    if (!primaryService || !primaryService.id || !primaryService.name) {
      toast.error("Invalid service data. Please try again.");
      return;
    }

    // Calculate total duration including add-ons for ALL selected services
    let totalDuration = 0;
    if (selectedWeddingPackage) {
      totalDuration = convertDurationToMinutes(primaryService.duration);
    } else {
      totalDuration = selectedServices.reduce((acc, service) => {
        const serviceDuration = convertDurationToMinutes(service.duration);
        const addOnsDuration = service.selectedAddons?.reduce(
          (sum, addon) => sum + (addon.duration || 0), 0
        ) || 0;
        return acc + serviceDuration + addOnsDuration;
      }, 0);
    }

    const endTime = calculateEndTime(selectedTime, totalDuration);

    // Check if any selected service is a home service or if wedding package is for wedding venue
    const isHomeService = (bookingMode === 'home' || !!selectedWeddingPackage) && !!serviceLocation;

    // Check if this is a wedding service (either wedding package or wedding service)
    const isWeddingService = !!selectedWeddingPackage || selectedServices.some(service =>
      service.weddingService?.available || service.serviceWeddingService?.available
    );

    // Log home service location data
    console.log("Service location data:", {
      isHomeService,
      serviceLocation,
      locationForm,
      hasLocationData: !!serviceLocation,
      locationData: serviceLocation
    });

    // Update the appointment data creation to properly set service type flags

    // DEBUG: Log home service detection and location data
    console.log("=== HOME SERVICE DEBUG INFO ===");
    console.log("isHomeService:", isHomeService);
    console.log("serviceLocation:", serviceLocation);
    console.log("serviceLocation type:", typeof serviceLocation);
    if (serviceLocation) {
      console.log("serviceLocation keys:", Object.keys(serviceLocation));
      console.log("serviceLocation values:", serviceLocation);
    }
    console.log("===============================");

    // Create appointment data with all required fields
    const appointmentData = {
      vendorId: salonId,
      client: user?._id || user?.id, // Try both _id and id
      clientName: user ? (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer') : (customerInfo?.name || 'Customer'),
      clientEmail: user?.emailAddress || user?.email || customerInfo?.email || '',
      clientPhone: user?.mobileNo || user?.phone || customerInfo?.phone || '',
      service: primaryService.id,
      serviceName: primaryService.name,
      staff: staffId, // Use the properly determined staffId
      staffName: staffName, // Use the properly determined staffName
      date: selectedDate instanceof Date ? selectedDate.toISOString() : new Date(selectedDate).toISOString(),
      startTime: selectedTime,
      endTime: endTime,
      duration: totalDuration,
      amount: primaryService.discountedPrice !== null && primaryService.discountedPrice !== undefined ?
        Math.round(Number(primaryService.discountedPrice)) :
        Math.round(Number(primaryService.price)),
      totalAmount: Math.round(((() => {
        // Calculate subtotal including add-ons
        const servicesSubtotal = selectedServices.reduce((total, service) => {
          const servicePrice = service.discountedPrice !== null && service.discountedPrice !== undefined ?
            Number(service.discountedPrice) :
            Number(service.price);

          const addonsPrice = service.selectedAddons
            ? service.selectedAddons.reduce((sum, addon) => sum + (addon.price || 0), 0)
            : 0;

          return total + servicePrice + addonsPrice;
        }, 0);

        // Add wedding package price if applicable
        if (selectedWeddingPackage) {
          return servicesSubtotal + Number(selectedWeddingPackage.totalPrice || primaryService.price || 0);
        }

        return servicesSubtotal;
      })())),
      platformFee: Math.round(priceBreakdown?.platformFee || 0),
      serviceTax: Math.round(priceBreakdown?.serviceTax || 0),
      taxRate: priceBreakdown?.taxFeeSettings?.serviceTax || 0,
      discountAmount: Math.round(priceBreakdown?.discountAmount || 0),
      finalAmount: Math.round(priceBreakdown?.finalTotal || (() => {
        // Fallback calculation if priceBreakdown is not available
        const subtotal = selectedServices.reduce((total, service) => {
          const servicePrice = service.discountedPrice !== null && service.discountedPrice !== undefined ?
            Number(service.discountedPrice) :
            Number(service.price);

          const addonsPrice = service.selectedAddons
            ? service.selectedAddons.reduce((sum, addon) => sum + (addon.price || 0), 0)
            : 0;

          return total + servicePrice + addonsPrice;
        }, 0);

        const discount = priceBreakdown?.discountAmount || 0;
        const fee = priceBreakdown?.platformFee || 0;
        const tax = priceBreakdown?.serviceTax || 0;

        return (subtotal + fee + tax) - discount;
      })()),
      paymentMethod: paymentMethod, // Use selected payment method
      paymentStatus: 'pending',
      status: 'scheduled',
      notes: selectedWeddingPackage
        ? `Wedding Package: ${selectedWeddingPackage.name}`
        : isMultiService ? "Multi-service appointment" : "Single service appointment",
      serviceItems: selectedWeddingPackage
        ? // For wedding packages, create service items from package services (including customized)
        (customizedPackageServices.length > 0 ? customizedPackageServices : selectedWeddingPackage.services).map((pkgService: any) => ({
          service: pkgService.serviceId || pkgService.id || pkgService._id,
          serviceName: pkgService.serviceName || pkgService.name,
          staff: staffId,
          staffName: staffName,
          startTime: selectedTime,
          endTime: endTime,
          duration: convertDurationToMinutes(pkgService.duration || selectedWeddingPackage.duration),
          amount: Number(pkgService.price || 0)
        }))
        : // For regular services (including single service)
        (() => {
          let currentStartTime = selectedTime;
          return selectedServices.map(service => {
            console.log('Processing service for serviceItems:', service.name, 'Add-ons:', service.selectedAddons);
            // For multi-service, find the specific staff assignment for this service
            let serviceStaffId = null;
            let serviceStaffName = "Any Professional";

            if (isMultiService) {
              const assignment = serviceStaffAssignments.find(a => a.service.id === service.id);
              if (assignment) {
                serviceStaffId = assignment.staff ? assignment.staff.id : null;
                serviceStaffName = assignment.staff ? assignment.staff.name : "Any Professional";
              }
            } else {
              // For single service, use the selectedStaff
              serviceStaffId = selectedStaff?.id || null;
              serviceStaffName = selectedStaff?.name || "Any Professional";
            }

            const serviceDuration = convertDurationToMinutes(service.duration);
            const addOnsDuration = service.selectedAddons ?
              service.selectedAddons.reduce((sum, addon) => sum + (addon.duration || 0), 0) : 0;
            const totalServiceDuration = serviceDuration + addOnsDuration;

            const itemStartTime = currentStartTime;
            const itemEndTime = calculateEndTime(itemStartTime, totalServiceDuration);

            // Update currentStartTime for the next service
            currentStartTime = itemEndTime;

            return {
              service: service.id,
              serviceName: service.name,
              staff: serviceStaffId,
              staffName: serviceStaffName,
              startTime: itemStartTime,
              endTime: itemEndTime,
              duration: serviceDuration,
              amount: service.discountedPrice !== null && service.discountedPrice !== undefined ?
                Math.round(Number(service.discountedPrice)) :
                Math.round(Number(service.price)),
              addOns: service.selectedAddons ? service.selectedAddons.map(addon => ({
                name: addon.name,
                price: Math.round(addon.price || 0),
                duration: addon.duration || 0,
                _id: addon._id || (addon as any).id
              })) : []
            };
          });
        })(),
      isMultiService: isMultiService,
      isHomeService: isHomeService,
      isWeddingService: isWeddingService,
      // Add home service location if it's a home service - ensure proper structure
      ...(isHomeService && serviceLocation ? {
        serviceLocation: {
          address: serviceLocation.address || locationForm.address || '',
          city: serviceLocation.city || locationForm.city || '',
          state: serviceLocation.state || locationForm.state || '',
          pincode: serviceLocation.pincode || locationForm.pincode || '',
          landmark: serviceLocation.landmark || locationForm.landmark || '',
          lat: serviceLocation.coordinates?.lat || serviceLocation.lat || Number(locationForm.lat) || 0,
          lng: serviceLocation.coordinates?.lng || serviceLocation.lng || Number(locationForm.lng) || 0
        }
      } : {}),
      // Add travel time fields with default values if not already present
      // Let backend calculate travel time based on location data
      bufferBefore: 0,
      bufferAfter: 0,
      blockingWindows: [],
      blockedTravelWindows: []
    };

    // DEBUG: Log the complete appointment data being sent
    console.log("=== COMPLETE APPOINTMENT DATA ===");
    console.log("Full appointment data:", JSON.stringify(appointmentData, null, 2));
    console.log("serviceItems count:", appointmentData.serviceItems?.length);
    console.log("serviceItems:", appointmentData.serviceItems);
    console.log("isHomeService flag:", appointmentData.isHomeService);
    console.log("serviceLocation in data:", appointmentData.serviceLocation);
    console.log("================================");
    try {
      // CRITICAL FIX: Recalculate price breakdown right before appointment creation
      // This ensures we have the latest fees and taxes
      let finalPriceBreakdown = priceBreakdown;

      if (!finalPriceBreakdown || finalPriceBreakdown.platformFee === 0) {
        console.log('⚠️ Price breakdown missing or incomplete, recalculating...');

        // Determine services to calculate
        let servicesToCalculate = [];
        if (selectedWeddingPackage) {
          if (weddingPackageMode === 'customized' && customizedPackageServices && customizedPackageServices.length > 0) {
            // If customized, use the individual services to calculate amount
            const packageOriginalPrice = selectedWeddingPackage.totalPrice || 0;
            // Use != null so discountedPrice=0 is respected, not skipped
            const packageDiscountedPrice = selectedWeddingPackage.discountedPrice != null
              ? selectedWeddingPackage.discountedPrice
              : packageOriginalPrice;
            const discountPercent = (selectedWeddingPackage as any).discountPercent != null
              ? (selectedWeddingPackage as any).discountPercent / 100
              : (packageOriginalPrice > 0 ? (packageOriginalPrice - packageDiscountedPrice) / packageOriginalPrice : 0);

            servicesToCalculate = customizedPackageServices.map((s: any) => {
              const rawPrice = parseFloat(s.price || 0);
              const discountedPrice = rawPrice * (1 - discountPercent);
              return {
                ...s,
                id: s.id || s._id,
                selectedAddons: s.selectedAddons || [],
                discountedPrice: discountedPrice
              };
            });
          } else {
            servicesToCalculate = [{
              id: (selectedWeddingPackage as any).id || (selectedWeddingPackage as any)._id,
              name: selectedWeddingPackage.name,
              price: selectedWeddingPackage.totalPrice,
              // Use != null so discountedPrice=0 is passed correctly
              discountedPrice: selectedWeddingPackage.discountedPrice != null
                ? selectedWeddingPackage.discountedPrice
                : null,
              selectedAddons: []
            }];
          }
        } else {
          servicesToCalculate = selectedServices;
        }

        // Recalculate with current offer and tax settings
        finalPriceBreakdown = await calculateBookingAmount(servicesToCalculate, appliedOffer || offer, taxFeeSettings);
        console.log('✅ Recalculated price breakdown:', finalPriceBreakdown);
      }

      console.log('=== PRICE BREAKDOWN VALIDATION ===');
      console.log('Platform Fee:', finalPriceBreakdown?.platformFee);
      console.log('Service Tax (GST):', finalPriceBreakdown?.serviceTax);
      console.log('Tax Rate:', finalPriceBreakdown?.taxFeeSettings?.serviceTax);
      console.log('Discount Amount:', finalPriceBreakdown?.discountAmount);
      console.log('Final Total:', finalPriceBreakdown?.finalTotal);
      console.log('==================================');

      // Payment method should NOT affect whether it's a home service or not
      const finalIsHomeService = isHomeService;

      console.log("=== FINAL BOOKING DECISION ===");
      console.log("Booking Mode:", bookingMode);
      console.log("Payment Method:", paymentMethod);
      console.log("Home Service Location exists:", !!serviceLocation);
      console.log("FINAL isHomeService:", finalIsHomeService);
      console.log("==============================");
      console.log("Has Location:", !!serviceLocation);
      console.log("Computed isHomeService:", finalIsHomeService);
      console.log("==============================");

      if (isWeddingService && selectedWeddingPackage) {
        // Handle wedding package booking
        console.log("=== WEDDING PACKAGE BOOKING START ===");
        console.log("Package ID:", selectedWeddingPackage._id || selectedWeddingPackage.id);
        console.log("Existing lock token from Step3:", slotLockToken);
        console.log("Selected Slot:", {
          date: selectedDate,
          startTime: selectedTime,
          endTime: endTime,
          location: finalIsHomeService ? serviceLocation : null,
        });

        let lockId = slotLockToken;

        // Only acquire lock if we don't already have one from Step3
        if (!lockId) {
          console.log("No existing lock found, acquiring new lock...");
          const lockResult = await lockWeddingPackage({
            packageId: selectedWeddingPackage._id || selectedWeddingPackage.id,
            selectedSlot: {
              date: selectedDate,
              startTime: selectedTime,
              endTime: endTime,
              location: finalIsHomeService ? serviceLocation : null,
              teamMembers: [], // Will be populated by the backend
              totalAmount: appointmentData.totalAmount,
              depositAmount: (selectedWeddingPackage as any).depositAmount || 0
            },
            clientId: user?._id || user?.id,
            clientName: `${user?.firstName} ${user?.lastName}`,
            customerDetails: {
              name: `${user?.firstName} ${user?.lastName}`,
              phone: user?.mobileNo || user?.phone
            }
          }).unwrap();

          console.log("=== LOCK RESULT ===", lockResult);

          if (!lockResult.success || !lockResult.lockId) {
            throw new Error(lockResult.message || "Failed to acquire lock");
          }

          lockId = lockResult.lockId;
        } else {
          console.log("Using existing lock token from Step3");
        }

        // --- For 'Pay Online': collect payment via Razorpay BEFORE confirming ---
        let razorpayPaymentId: string | undefined;
        let razorpayOrderId_: string | undefined;

        if (paymentMethod === 'Pay Online' && (finalPriceBreakdown?.finalTotal ?? 0) > 0) {
          const paymentAmount = finalPriceBreakdown!.finalTotal;
          const loaded = await loadRazorpayScript();
          if (!loaded) {
            toast.error('Payment gateway failed to load. Please try again.');
            setIsConfirmingBooking(false);
            return;
          }

          // Create Razorpay order
          const orderRes = await fetch('/api/payments/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: paymentAmount,
              currency: 'INR',
              receipt: `wedding_${lockId}_${Date.now()}`,
            }),
          });

          if (!orderRes.ok) {
            const err = await orderRes.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to create payment order');
          }

          const rzpOrder = await orderRes.json();
          const rzpOrderId = rzpOrder.id || rzpOrder.order?.id;
          if (!rzpOrderId) throw new Error('Invalid payment order response');

          // Close parent modals to escape focus trap
          const wasPaymentOpen = isPaymentModalOpen;
          const wasConfirmationOpen = isConfirmationModalOpen;
          setIsPaymentModalOpen(false);
          setIsConfirmationModalOpen(false);

          // Open Razorpay checkout
          try {
            await new Promise<void>((resolve, reject) => {
              const rzp = new (window as any).Razorpay({
                key: rzpOrder.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_SLBxzQHGTzUTCO',
                amount: Math.round(paymentAmount * 100),
                currency: 'INR',
                order_id: rzpOrderId,
                name: 'GlowVita Salon',
                description: `Wedding Booking – ${selectedWeddingPackage.name}`,
                image: 'https://glowvita.com/logo.png',
                theme: { color: '#7c3aed' },
                prefill: {
                  name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
                  email: user?.emailAddress || '',
                  contact: user?.mobileNo || user?.phone || '',
                },
                retry: { enabled: true, max_count: 3 },
                config: {
                  display: {
                    blocks: {
                      upi: {
                        name: 'UPI / QR',
                        instruments: [
                          { method: 'upi', omnichannel: true }, // UPI ID entry / VPA
                          { method: 'upi', intent: true },      // UPI Apps (GPay, PhonePe, etc.)
                          { method: 'upi', qr: true }          // QR Code
                        ],
                      },
                    },
                    sequence: ['block.upi', 'card', 'netbanking'],
                  },
                },
                modal: {
                  ondismiss: () => {
                    if (wasPaymentOpen) setIsPaymentModalOpen(true);
                    if (wasConfirmationOpen) setIsConfirmationModalOpen(true);
                    reject(new Error('Payment cancelled by user'));
                  },
                  escape: true,
                  backdropClose: false,
                },
                handler: async (response: any) => {
                  try {
                    const verifyRes = await fetch('/api/payments/verify', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(response),
                    });
                    const verifyData = await verifyRes.json();
                    if (!verifyData.success) throw new Error('Payment verification failed. Contact support.');
                    razorpayPaymentId = response.razorpay_payment_id;
                    razorpayOrderId_ = response.razorpay_order_id;
                    resolve();
                  } catch (err: any) { reject(err); }
                },
              });
              rzp.open();
            });
          } catch (payErr: any) {
            if (payErr?.message === 'Payment cancelled by user') {
              toast.info('Payment cancelled.');
            } else {
              toast.error(payErr?.message || 'Payment failed. Please try again.');
            }
            setIsConfirmingBooking(false);
            return;
          }
        }

        // Now confirm the booking with the lock ID
        console.log("=== CONFIRMING WEDDING PACKAGE BOOKING ===");
        console.log("Lock ID:", lockId);
        console.log("Appointment ID (if any):", pendingAppointmentId);

        // Call the wedding package specific endpoint
        const response = await fetch('/api/scheduling/wedding-package', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            packageId: selectedWeddingPackage._id || selectedWeddingPackage.id,
            lockId: lockId,
            selectedSlot: {
              date: selectedDate,
              startTime: selectedTime,
              endTime: endTime,
              location: weddingVenueType === 'venue' ? serviceLocation : null,
              totalAmount: appointmentData.totalAmount,
              couponCode: appliedOffer?.code || offerCode || null,
              discountAmount: finalPriceBreakdown?.discountAmount || 0,
              platformFee: finalPriceBreakdown?.platformFee || 0,
              serviceTax: finalPriceBreakdown?.serviceTax || 0,
              taxRate: finalPriceBreakdown?.taxFeeSettings?.serviceTax || 0,
            },
            weddingVenueType: weddingVenueType,
            clientName: `${user?.firstName} ${user?.lastName}`,
            customerDetails: {
              userId: user?._id || user?.id,
              name: `${user?.firstName} ${user?.lastName}`,
              phone: user?.mobileNo || user?.phone,
              email: user?.emailAddress || user?.email
            },
            paymentDetails: {
              method: paymentMethod,
              status: paymentMethod === 'Pay at Salon' ? 'pending' : 'completed',
              ...(razorpayPaymentId && { razorpayPaymentId }),
              ...(razorpayOrderId_ && { razorpayOrderId: razorpayOrderId_ })
            },
            customizedPackageServices: ((customizedPackageServices && customizedPackageServices.length > 0) ? customizedPackageServices : selectedWeddingPackage.services).map((svc: any) => {
              // Enrich with full service info to get price and duration if missing
              const fullServiceInfo = services.find((s: any) => s.id === (svc.serviceId || svc.id || svc._id));

              let svcAmount = svc.amount;
              if (svcAmount === undefined && fullServiceInfo) {
                svcAmount = fullServiceInfo.price ? parseFloat(fullServiceInfo.price as any) : 0;
              }

              return {
                ...svc,
                amount: svcAmount || 0,
                duration: svc.duration || fullServiceInfo?.duration || "0 min",
                staffId: staffId || null
              };
            })
          })
        });

        const confirmResult = await response.json();
        console.log("=== CONFIRM RESULT ===", confirmResult);

        if (confirmResult.success) {
          toast.success("Wedding package booking confirmed!");
          setIsConfirmationModalOpen(false);
          setIsPaymentModalOpen(false);
          await persistServiceLocation(weddingVenueType === 'venue' ? serviceLocation : null);
          if (typeof window !== 'undefined' && confirmResult.appointment?.id) {
            sessionStorage.setItem('newlyBookedAppointmentId', confirmResult.appointment.id);
          }
          router.push('/profile/appointments');
        } else {
          throw new Error(confirmResult.message || "Failed to confirm booking");
        }
      } else {
        // Handle regular booking with enhanced slot locking
        let appointmentIdToConfirm = pendingAppointmentId;
        let currentLockId = slotLockToken;

        // If we don't have an appointmentId from Step 3, we must acquire a lock now
        if (!appointmentIdToConfirm) {
          console.log("No existing appointment found from Step 3, acquiring lock now...");
          const lockResult = await acquireSlotLock({
            vendorId: salonId,
            staffId: staffId,
            serviceId: primaryService.id,
            serviceName: primaryService.name,
            date: selectedDate,
            startTime: selectedTime,
            endTime: endTime,
            clientId: user?._id || user?.id,
            clientName: `${user?.firstName} ${user?.lastName}`,
            clientEmail: user?.emailAddress || user?.email,
            clientPhone: user?.mobileNo || user?.phone,
            staffName: staffName,
            isHomeService: finalIsHomeService,
            isWeddingService: isWeddingService,
            location: finalIsHomeService && serviceLocation ? {
              address: serviceLocation.address || locationForm.address || '',
              city: serviceLocation.city || locationForm.city || '',
              state: serviceLocation.state || locationForm.state || '',
              pincode: serviceLocation.pincode || locationForm.pincode || '',
              landmark: serviceLocation.landmark || locationForm.landmark || '',
              lat: Number(serviceLocation.coordinates?.lat || serviceLocation.lat || locationForm.lat || 0),
              lng: Number(serviceLocation.coordinates?.lng || serviceLocation.lng || locationForm.lng || 0)
            } : null,
            duration: totalDuration,
            amount: appointmentData.amount,
            totalAmount: appointmentData.totalAmount,
            finalAmount: finalPriceBreakdown?.finalTotal || appointmentData.finalAmount,
            platformFee: finalPriceBreakdown?.platformFee || 0,
            serviceTax: finalPriceBreakdown?.serviceTax || 0,
            taxRate: finalPriceBreakdown?.taxFeeSettings?.serviceTax || 0,
            couponCode: appliedOffer?.code || offerCode,
            discountAmount: finalPriceBreakdown?.discountAmount || 0,
            serviceItems: appointmentData.serviceItems,
            addOnIds: appointmentData.serviceItems.flatMap((item: any) =>
              item.addOns?.map((a: any) => a._id) || []
            ),
            selectedAddOns: appointmentData.serviceItems.flatMap((item: any) =>
              item.addOns?.map((a: any) => a._id) || []
            ),
            isMultiService: isMultiService,
          }).unwrap();

          if (!lockResult.success) {
            throw new Error(lockResult.message || "Failed to acquire lock");
          }

          appointmentIdToConfirm = lockResult.appointmentId;
          currentLockId = lockResult.lockId;
        } else {
          console.log("Using existing appointment ID from Step 3 lock:", appointmentIdToConfirm);
        }

        if (appointmentIdToConfirm) {
          // --- For 'Pay Online': collect payment via Razorpay BEFORE confirming ---
          let razorpayPaymentId: string | undefined;
          let razorpayOrderId_: string | undefined;

          if (paymentMethod === 'Pay Online' && (finalPriceBreakdown?.finalTotal ?? 0) > 0) {
            const paymentAmount = finalPriceBreakdown!.finalTotal;
            const loaded = await loadRazorpayScript();
            if (!loaded) {
              toast.error('Payment gateway failed to load. Please try again.');
              setIsConfirmingBooking(false);
              return;
            }

            // Create Razorpay order
            const orderRes = await fetch('/api/payments/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount: paymentAmount,
                currency: 'INR',
                receipt: `salon_${appointmentIdToConfirm}_${Date.now()}`,
              }),
            });

            if (!orderRes.ok) {
              const err = await orderRes.json().catch(() => ({}));
              throw new Error(err.message || 'Failed to create payment order');
            }

            const rzpOrder = await orderRes.json();
            const rzpOrderId = rzpOrder.id || rzpOrder.order?.id;
            if (!rzpOrderId) throw new Error('Invalid payment order response');

            // **CRITICAL FIX: Close parent modals to escape focus trap**
            // Store current states to restore on cancellation
            const wasPaymentOpen = isPaymentModalOpen;
            const wasConfirmationOpen = isConfirmationModalOpen;
            setIsPaymentModalOpen(false);
            setIsConfirmationModalOpen(false);

            // Open Razorpay checkout — wait for success before confirming booking
            try {
              await new Promise<void>((resolve, reject) => {
                const rzp = new (window as any).Razorpay({
                  key: rzpOrder.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_SLBxzQHGTzUTCO',
                  amount: Math.round(paymentAmount * 100),
                  currency: 'INR',
                  order_id: rzpOrderId,
                  name: 'GlowVita Salon',
                  description: `Booking – ${appointmentData.serviceName || 'Service'}`,
                  image: 'https://glowvita.com/logo.png', // Fallback logo
                  theme: { color: '#7c3aed' },
                  prefill: {
                    name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
                    email: user?.emailAddress || '',
                    contact: user?.mobileNo || user?.phone || '',
                  },
                  retry: { enabled: true, max_count: 3 },
                  // Simplified config to prevent interaction lag
                  config: {
                    display: {
                      blocks: {
                        upi: {
                          name: 'UPI / QR',
                          instruments: [
                            { method: 'upi', omnichannel: true }, // UPI ID entry / VPA
                            { method: 'upi', intent: true },      // UPI Apps (GPay, PhonePe, etc.)
                            { method: 'upi', qr: true }          // QR Code
                          ],
                        },
                      },
                      sequence: ['block.upi', 'card', 'netbanking'],
                    },
                  },
                  modal: {
                    ondismiss: () => {
                      // Restore modals if user cancels
                      if (wasPaymentOpen) setIsPaymentModalOpen(true);
                      if (wasConfirmationOpen) setIsConfirmationModalOpen(true);
                      reject(new Error('Payment cancelled by user'));
                    },
                    escape: true,
                    backdropClose: false, // Prevent accidental exit
                  },
                  handler: async (response: any) => {
                    try {
                      const verifyRes = await fetch('/api/payments/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(response),
                      });
                      const verifyData = await verifyRes.json();
                      if (!verifyData.success) throw new Error('Payment verification failed. Contact support.');
                      razorpayPaymentId = response.razorpay_payment_id;
                      razorpayOrderId_ = response.razorpay_order_id;
                      resolve();
                    } catch (err: any) { reject(err); }
                  },
                });
                rzp.open();
              });
            } catch (payErr: any) {
              if (payErr?.message === 'Payment cancelled by user') {
                toast.info('Payment cancelled.');
              } else {
                toast.error(payErr?.message || 'Payment failed. Please try again.');
              }
              setIsConfirmingBooking(false);
              return;
            }
          }

          // Confirm the booking (payment already collected, or pay-at-salon)
          await confirmBooking({
            appointmentId: appointmentIdToConfirm,
            lockId: currentLockId,
            paymentMethod: paymentMethod,
            paymentStatus: paymentMethod === 'Pay at Salon' ? 'pending' : 'completed',
            couponCode: appliedOffer?.code || offerCode,
            discountAmount: finalPriceBreakdown?.discountAmount || 0,
            finalAmount: finalPriceBreakdown?.finalTotal || 0,
            platformFee: finalPriceBreakdown?.platformFee || 0,
            serviceTax: finalPriceBreakdown?.serviceTax || 0,
            taxRate: finalPriceBreakdown?.taxFeeSettings?.serviceTax || 0,
            ...(razorpayPaymentId && { razorpayPaymentId }),
            ...(razorpayOrderId_ && { razorpayOrderId: razorpayOrderId_ }),
          }).unwrap();

          toast.success("Booking confirmed!");
          setIsConfirmationModalOpen(false);
          setIsPaymentModalOpen(false);
          await persistServiceLocation(finalIsHomeService ? serviceLocation : null);
          if (typeof window !== 'undefined' && appointmentIdToConfirm) {
            sessionStorage.setItem('newlyBookedAppointmentId', appointmentIdToConfirm);
          }
          router.push('/profile/appointments');
        } else {
          throw new Error("Failed to acquire slot lock or session expired.");
        }
      }

      // Set a flag in sessionStorage to indicate that an appointment was just created
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('appointmentJustCreated', 'true');
      }

    } catch (error: any) {
      console.error("Error creating appointment:", error);
      toast.error(error?.data?.message || error?.message || "Failed to create appointment. Please try again.");
    } finally {
      // Reset loading state to allow future bookings
      setIsConfirmingBooking(false);
    }
  };

  const handlePaymentMethodSelection = async (method: string) => {
    console.log("=== PAYMENT METHOD SELECTION ===");
    console.log("Selected payment method:", method);

    // Check if this is a home service booking based on mode
    // We strictly use the bookingMode state, NOT service capabilities
    const isHomeService = bookingMode === 'home';

    console.log(`Payment selection - Booking Mode: ${bookingMode}, Is Home Service: ${isHomeService}`);

    // Check if any selected service is a wedding service
    const isWeddingService = selectedServices.some(service =>
      service.weddingService?.available || service.serviceWeddingService?.available
    );

    // If it's a home service, we need to go through the slot-lock process first
    // STRICTER CHECK: Must have mode=home AND a valid location
    if (isHomeService && selectedTime && serviceLocation) {
      console.log("Processing home service booking through slot-lock process");

      // Get the first service as the primary service
      const primaryService = selectedServices[0];

      // Validate primary service has required fields
      if (!primaryService.id || !primaryService.name) {
        toast.error("Invalid service data. Please try again.");
        return;
      }

      // Check if any selected service is a wedding service
      const isWeddingService = selectedServices.some(service =>
        service.weddingService?.available || service.serviceWeddingService?.available
      );

      try {
        // Acquire slot lock for home service
        const lockData = {
          vendorId: bookingMode === 'home' ? salonId : (Array.isArray(salonId) ? salonId[0] : salonId), // Ensure vendorId is string
          staffId: selectedStaff?.id || null,
          serviceId: primaryService.id,
          serviceName: primaryService.name,
          date: selectedDate,
          startTime: selectedTime,
          endTime: calculateEndTime(selectedTime, convertDurationToMinutes(primaryService.duration)),
          clientId: user?._id || user?.id,
          clientName: `${user?.firstName} ${user?.lastName}`,
          clientEmail: user?.emailAddress || user?.email,
          clientPhone: user?.mobileNo || user?.phone,
          staffName: selectedStaff?.name || "Any Professional",
          isHomeService: true,
          isWeddingService: isWeddingService,
          location: serviceLocation ? {
            address: serviceLocation.address,
            city: serviceLocation.city,
            state: serviceLocation.state,
            pincode: serviceLocation.pincode,
            landmark: serviceLocation.landmark || '',
            lat: Number(serviceLocation.coordinates?.lat || serviceLocation.lat || 0),
            lng: Number(serviceLocation.coordinates?.lng || serviceLocation.lng || 0)
          } : null,
          duration: convertDurationToMinutes(primaryService.duration),
          amount: primaryService.discountedPrice !== null && primaryService.discountedPrice !== undefined ?
            Math.round(Number(primaryService.discountedPrice)) :
            Math.round(Number(primaryService.price)),
          totalAmount: Math.round(priceBreakdown?.subtotal || (primaryService.discountedPrice !== null && primaryService.discountedPrice !== undefined ?
            Number(primaryService.discountedPrice) :
            Number(primaryService.price))),
          finalAmount: Math.round(priceBreakdown?.finalTotal || (primaryService.discountedPrice !== null && primaryService.discountedPrice !== undefined ?
            Number(primaryService.discountedPrice) :
            Number(primaryService.price))),
          platformFee: Math.round(priceBreakdown?.platformFee || 0),
          serviceTax: Math.round(priceBreakdown?.serviceTax || 0),
          taxRate: priceBreakdown?.taxFeeSettings?.serviceTax || 0,
          couponCode: appliedOffer?.code || offerCode,
          discountAmount: priceBreakdown?.discountAmount || 0
        };

        console.log("Acquiring slot lock with data:", lockData);
        const lockResult = await acquireSlotLock(lockData).unwrap();

        if (lockResult.success) {
          // Confirm the booking
          const confirmResult = await confirmBooking({
            appointmentId: lockResult.appointmentId,
            lockId: lockResult.lockId,
            couponCode: appliedOffer?.code || offerCode,
            discountAmount: priceBreakdown?.discountAmount || 0,
            finalAmount: priceBreakdown?.finalTotal || 0
          }).unwrap();

          // Handle online payment via Razorpay
          if (method === 'Pay Online' && (confirmResult.appointment?.finalAmount ?? 0) > 0) {
            const paymentAmount = confirmResult.appointment.finalAmount;
            try {
              const loaded = await loadRazorpayScript();
              if (!loaded) {
                toast.error('Payment gateway failed to load. Please try again.');
                return;
              }

              // Create Razorpay order on the server
              const orderRes = await fetch('/api/payments/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  amount: paymentAmount,
                  currency: 'INR',
                  receipt: `booking_${confirmResult.appointment._id || Date.now()}`,
                }),
              });

              if (!orderRes.ok) {
                const err = await orderRes.json().catch(() => ({}));
                throw new Error(err.message || 'Failed to create payment order');
              }

              const razorpayOrder = await orderRes.json();
              // Support both { id } and { order: { id } } response shapes
              const razorpayOrderId = razorpayOrder.id || razorpayOrder.order?.id;
              if (!razorpayOrderId) throw new Error('Invalid payment order response');

              // Open Razorpay checkout
              await new Promise<void>((resolve, reject) => {
                const rzp = new (window as any).Razorpay({
                  key: razorpayOrder.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                  amount: Math.round(paymentAmount * 100),
                  currency: 'INR',
                  order_id: razorpayOrderId,
                  name: 'GlowVita Salon',
                  description: `Booking - ${primaryService.name}`,
                  theme: { color: '#7c3aed' },
                  modal: {
                    ondismiss: () => reject(new Error('Payment cancelled by user')),
                  },
                  handler: async (response: any) => {
                    try {
                      // Verify payment signature
                      const verifyRes = await fetch('/api/payments/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(response),
                      });
                      const verifyData = await verifyRes.json();
                      if (!verifyData.success) {
                        throw new Error('Payment verification failed. Please contact support.');
                      }
                      console.log('Booking payment verified:', response.razorpay_payment_id);
                      resolve();
                    } catch (err: any) {
                      reject(err);
                    }
                  },
                });
                rzp.open();
              });
            } catch (paymentError: any) {
              if (paymentError?.message === 'Payment cancelled by user') {
                toast.info('Payment cancelled. Your booking is saved but unpaid.');
              } else {
                console.error('Payment processing error:', paymentError);
                toast.error(paymentError?.message || 'Payment failed. Please try again or pay at the salon.');
              }
              return;
            }
          }

          // Close the payment modal
          setIsPaymentModalOpen(false);

          // Show confirmation message with toast
          toast.success("Booking Confirmed! Payment Method: " + method);

          // Set a flag in sessionStorage to indicate that an appointment was just created
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('appointmentJustCreated', 'true');
          }

          // Clear the selected time to ensure the time slot component refetches data
          setSelectedTime(null);

          // Redirect to the appointments page after a short delay
          setTimeout(() => {
            router.push('/profile/appointments');
          }, 2000);
        } else {
          throw new Error(lockResult.message || "Failed to acquire slot lock");
        }
      } catch (error: any) {
        console.error("Error creating home service appointment:", error);
        if (error?.data?.message) {
          toast.error(`Failed to create appointment: ${error.data.message}`);
        } else {
          toast.error("Failed to create appointment. Please try again.");
        }
      }
    } else {
      // Handle regular (non-home service) appointments as before
      console.log("Processing regular appointment (step check passed or fallback)");

      // FALLBACK LOG: If bookingMode is home but we are here, it means location was missing
      if (bookingMode === 'home' && !serviceLocation) {
        console.warn("Booking Mode is Home but no location found. Falling back to Salon booking.");
        // Optional: toast.warning("Missing home location details. Proceeding as salon booking.");
      }

      // Prevent multiple calls
      if (isCreatingAppointment) {
        console.log("Appointment creation already in progress, skipping...");
        return;
      }

      // Validate that we have at least one service or a wedding package
      if (selectedServices.length === 0 && !selectedWeddingPackage) {
        toast.error("Please select at least one service or a wedding package");
        return;
      }

      // Check if this is a multi-service booking or wedding package
      const isMultiService = selectedServices.length > 1 || serviceStaffAssignments.length > 0;
      const isWeddingPackageBooking = !!selectedWeddingPackage;

      // For wedding packages, use package data; otherwise use first service
      let primaryService;
      if (isWeddingPackageBooking && selectedWeddingPackage) {
        // Create a service-like object from wedding package
        const packageServices = weddingPackageMode === 'customized' ? customizedPackageServices : selectedWeddingPackage.services;
        // Calculate customized subtotal and duration if applicable
        let rawServicesTotal = selectedWeddingPackage.totalPrice || 0;
        let discountedSubtotal = selectedWeddingPackage.discountedPrice != null ? selectedWeddingPackage.discountedPrice : rawServicesTotal;

        if (weddingPackageMode === 'customized' && customizedPackageServices && customizedPackageServices.length > 0) {
          rawServicesTotal = customizedPackageServices.reduce((acc, service) => {
            const servicePrice = parseFloat(String(service.price || '0'));
            const quantity = (service as any).quantity || 1;
            return acc + (servicePrice * quantity);
          }, 0);

          const packageOriginalPrice = selectedWeddingPackage.totalPrice || 0;
          const packageDiscountedPrice = selectedWeddingPackage.discountedPrice != null ? selectedWeddingPackage.discountedPrice : packageOriginalPrice;
          const discountPercent = (selectedWeddingPackage as any).discountPercent != null
            ? (selectedWeddingPackage as any).discountPercent / 100
            : (packageOriginalPrice > 0 ? (packageOriginalPrice - packageDiscountedPrice) / packageOriginalPrice : 0);

          discountedSubtotal = rawServicesTotal * (1 - discountPercent);
        }

        const customizedDuration = weddingPackageMode === 'customized' && customizedPackageServices && customizedPackageServices.length > 0
          ? customizedPackageServices.reduce((acc, service) => {
            const serviceDuration = convertDurationToMinutes(service.duration);
            const quantity = (service as any).quantity || 1;
            return acc + (serviceDuration * quantity);
          }, 0)
          : selectedWeddingPackage.duration;

        primaryService = {
          id: selectedWeddingPackage.id || selectedWeddingPackage._id,
          name: selectedWeddingPackage.name,
          price: rawServicesTotal,
          discountedPrice: discountedSubtotal,
          duration: customizedDuration,
          category: 'Wedding Package',
          description: selectedWeddingPackage.description
        };
      } else {
        primaryService = selectedServices[0];
      }

      // Validate primary service has required fields
      if (!primaryService.id || !primaryService.name) {
        toast.error("Invalid service data. Please try again.");
        return;
      }

      try {
        // Check if we have a service schedule or need to create one
        let finalServiceSchedule = serviceSchedule;

        // If no service schedule exists, create one based on whether it's single or multi-service
        if (serviceSchedule.length === 0 && selectedTime) {
          console.log("Creating service schedule - is multi-service:", isMultiService);

          if (isMultiService && serviceStaffAssignments.length > 0) {
            // MULTI-SERVICE: Create sequential schedule with proper start/end times
            console.log("Creating MULTI-service schedule with sequential times");
            let currentStartTime = selectedTime;

            finalServiceSchedule = serviceStaffAssignments.map((assignment, index) => {
              const serviceDuration = convertDurationToMinutes(assignment.service.duration);
              const endTime = calculateEndTime(currentStartTime, serviceDuration);

              console.log(`\n📝 Creating Service ${index + 1} Schedule Entry:`);
              console.log(`   Service: ${assignment.service.name}`);
              console.log(`   Duration: ${serviceDuration} minutes`);
              console.log(`   Current Start Time (BEFORE this service): ${currentStartTime}`);
              console.log(`   Calculated End Time: ${endTime}`);

              const scheduleEntry = {
                service: assignment.service,
                staff: assignment.staff,
                startTime: currentStartTime,  // This service starts at currentStartTime
                endTime: endTime,              // This service ends at endTime
                duration: serviceDuration
              };

              console.log(`   ✅ Service ${index + 1} will run: ${currentStartTime} - ${endTime}\n`);

              // CRITICAL: Update start time for next service (sequential)
              const previousStartTime = currentStartTime;
              currentStartTime = endTime;  // Next service starts where this one ends
              console.log(`   🔄 Next service will start at: ${currentStartTime}\n`);

              return scheduleEntry;
            });

            console.log("Created multi-service schedule with sequential times:", finalServiceSchedule);
          } else if (selectedServices.length === 1) {
            // SINGLE-SERVICE: Create simple schedule
            console.log("Creating service schedule for single service appointment");
            const service = selectedServices[0];
            console.log("Service for schedule:", service);
            console.log("Service properties:", {
              service: service,
              serviceType: typeof service,
              serviceKeys: service ? Object.keys(service) : null,
              hasId: !!(service && service.id),
              hasName: !!(service && service.name),
              hasPrice: !!(service && service.price),
              id: service?.id,
              name: service?.name,
              price: service?.price
            });

            // Validate service has required properties
            if (!service) {
              console.error("No service selected for schedule creation");
              toast.error("No service selected. Please try again.");
              return;
            }

            if (!service.id) {
              console.error("Service missing ID:", service);
              toast.error("Invalid service data - missing ID. Please try again.");
              return;
            }

            if (!service.name) {
              console.error("Service missing name:", service);
              toast.error("Invalid service data - missing name. Please try again.");
              return;
            }

            // Determine staff for single service
            let staffForSchedule = selectedStaff;
            if (isMultiService && serviceStaffAssignments.length > 0) {
              const assignment = serviceStaffAssignments.find(a => a.service.id === service.id);
              if (assignment) {
                staffForSchedule = assignment.staff;
              }
            }

            const serviceDuration = convertDurationToMinutes(service.duration);
            console.log("Service duration:", serviceDuration);

            // Create a service schedule entry for the single service
            finalServiceSchedule = [{
              service,
              staff: staffForSchedule, // Use the properly determined staff
              startTime: selectedTime,
              endTime: calculateEndTime(selectedTime, serviceDuration),
              duration: serviceDuration
            }];

            console.log("Created single service schedule:", finalServiceSchedule);
            console.log("Created schedule service details:", {
              service: finalServiceSchedule[0].service,
              staff: finalServiceSchedule[0].staff,
              staffType: typeof finalServiceSchedule[0].staff,
              staffKeys: finalServiceSchedule[0].staff ? Object.keys(finalServiceSchedule[0].staff) : null,
              hasStaff: !!finalServiceSchedule[0].staff,
              hasStaffId: finalServiceSchedule[0].staff && finalServiceSchedule[0].staff.id,
              hasStaffName: finalServiceSchedule[0].staff && finalServiceSchedule[0].staff.name,
              staffId: finalServiceSchedule[0].staff?.id,
              staffName: finalServiceSchedule[0].staff?.name,
              startTime: finalServiceSchedule[0].startTime,
              endTime: finalServiceSchedule[0].endTime,
              duration: finalServiceSchedule[0].duration
            });
          }
        }

        console.log("Final service schedule:", finalServiceSchedule);

        // For multiple services or single service with schedule, create appointment
        if (finalServiceSchedule.length > 0) {
          console.log("Creating appointment with method:", method);

          // Use the first service as the primary service for the appointment
          const primarySchedule = finalServiceSchedule[0];
          console.log("Primary schedule:", primarySchedule);
          console.log("Primary schedule service details:", {
            service: primarySchedule.service,
            serviceType: typeof primarySchedule.service,
            serviceKeys: primarySchedule.service ? Object.keys(primarySchedule.service) : null,
            hasService: !!primarySchedule.service,
            hasServiceId: primarySchedule.service && primarySchedule.service.id,
            hasServiceName: primarySchedule.service && primarySchedule.service.name,
            serviceId: primarySchedule.service?.id,
            serviceName: primarySchedule.service?.name
          });

          // Validate that we have all required service data
          if (!primarySchedule.service || !primarySchedule.service.id || !primarySchedule.service.name) {
            console.error("Missing required service data:", primarySchedule.service);
            toast.error("Invalid service data. Please try again.");
            return;
          }

          // Validate that we have all required staff data (staff can be null for "Any Professional")
          console.log("Primary schedule staff details:", {
            staff: primarySchedule.staff,
            staffType: typeof primarySchedule.staff,
            staffKeys: primarySchedule.staff ? Object.keys(primarySchedule.staff) : null,
            hasStaff: !!primarySchedule.staff,
            hasStaffId: primarySchedule.staff && primarySchedule.staff.id,
            hasStaffName: primarySchedule.staff && primarySchedule.staff.name,
            staffId: primarySchedule.staff?.id,
            staffName: primarySchedule.staff?.name
          });

          if (primarySchedule.staff && (!primarySchedule.staff.id || !primarySchedule.staff.name)) {
            console.error("Invalid staff data:", primarySchedule.staff);
            toast.error("Invalid staff data. Please try again.");
            return;
          }

          console.log("Primary service data:", {
            id: primarySchedule.service.id,
            name: primarySchedule.service.name,
            hasId: !!primarySchedule.service.id,
            hasName: !!primarySchedule.service.name
          });

          console.log("Primary staff data:", {
            id: primarySchedule.staff ? primarySchedule.staff.id : null,
            name: primarySchedule.staff ? primarySchedule.staff.name : "Any Professional",
            hasId: primarySchedule.staff ? !!primarySchedule.staff.id : true, // Can be null
            hasName: primarySchedule.staff ? !!primarySchedule.staff.name : true
          });

          // Format the appointment date with the correct time
          const appointmentDate = selectedDate instanceof Date ? new Date(selectedDate) : new Date(selectedDate);
          const [hours, minutes] = primarySchedule.startTime.split(':').map(Number);
          appointmentDate.setHours(hours, minutes, 0, 0);
          console.log("Appointment date:", appointmentDate);

          // Create service items for all services
          const serviceItems = finalServiceSchedule.map(schedule => {
            // Validate service data
            if (!schedule.service || !schedule.service.id || !schedule.service.name) {
              console.error("Missing required service data in schedule:", schedule.service);
              throw new Error("Invalid service data in schedule");
            }

            // Validate staff data (staff can be null for "Any Professional")
            if (schedule.staff && (!schedule.staff.id || !schedule.staff.name)) {
              console.error("Invalid staff data in schedule:", schedule.staff);
              throw new Error("Invalid staff data in schedule");
            }

            console.log("Creating service item:", {
              serviceId: schedule.service.id,
              serviceName: schedule.service.name,
              staffId: schedule.staff ? schedule.staff.id : null,
              staffName: schedule.staff ? schedule.staff.name : "Any Professional",
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              duration: schedule.duration,
              amount: schedule.service.discountedPrice !== null && schedule.service.discountedPrice !== undefined ?
                parseFloat(schedule.service.discountedPrice) :
                parseFloat(schedule.service.price)
            });

            return {
              service: schedule.service.id,
              serviceName: schedule.service.name,
              staff: schedule.staff ? schedule.staff.id : null,
              staffName: schedule.staff ? schedule.staff.name : "Any Professional",
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              duration: schedule.duration,
              amount: schedule.service.discountedPrice !== null && schedule.service.discountedPrice !== undefined ?
                parseFloat(schedule.service.discountedPrice) :
                parseFloat(schedule.service.price),
              // Include selected add-ons for this service item, preserving original add-on IDs
              addOns: Array.isArray((schedule.service as any).selectedAddons)
                ? (schedule.service as any).selectedAddons.map((addon: any) => ({
                  name: addon.name,
                  price: Number(addon.price) || 0,
                  duration: addon.duration ? Number(addon.duration) : 0,
                  _id: addon._id || (addon as any).id
                }))
                : []
            };
          });

          console.log("Service items:", serviceItems);

          // Calculate total amount for all services including add-ons
          const totalAmount = finalServiceSchedule.reduce((sum, schedule) => {
            const basePrice = schedule.service.discountedPrice !== null && schedule.service.discountedPrice !== undefined ?
              parseFloat(schedule.service.discountedPrice) :
              parseFloat(schedule.service.price);
            const addonsTotal = Array.isArray((schedule.service as any).selectedAddons)
              ? (schedule.service as any).selectedAddons.reduce((addonSum: number, addon: any) => addonSum + (Number(addon.price) || 0), 0)
              : 0;
            return sum + basePrice + addonsTotal;
          }, 0);

          console.log("Total amount:", totalAmount);

          // Calculate total duration
          const totalDuration = finalServiceSchedule.reduce((sum, schedule) => sum + schedule.duration, 0);
          console.log("Total duration:", totalDuration);

          // Use the last service's end time as the appointment end time
          const endTime = finalServiceSchedule[finalServiceSchedule.length - 1].endTime ||
            calculateEndTime(primarySchedule.startTime, totalDuration);

          console.log("\n🕐 === APPOINTMENT TIME DETAILS ===");
          console.log("Start time:", primarySchedule.startTime);
          console.log("End time:", endTime);
          console.log("Total duration:", totalDuration, "minutes");
          console.log("Service schedule breakdown:");
          finalServiceSchedule.forEach((sched, idx) => {
            console.log(`  Service ${idx + 1}: ${sched.service.name}`);
            console.log(`    Staff: ${sched.staff ? sched.staff.name : 'Any Professional'}`);
            console.log(`    Time: ${sched.startTime} - ${sched.endTime} (${sched.duration} min)`);
          });
          console.log("=================================\n");

          // Handle staff field - it can now be null for "Any Professional"
          let staffId = primarySchedule.staff ? primarySchedule.staff.id : null;
          let staffName = primarySchedule.staff ? primarySchedule.staff.name : "Any Professional";
          let clientName = user.firstName + " " + user.lastName;
          let clientId = user._id || user.id; // Try both _id and id
          console.log("Client Name:", clientName)
          console.log("Client ID:", clientId);
          console.log("Staff ID:", staffId, "Staff Name:", staffName);
          console.log("User object:", user);
          console.log("User properties:", {
            hasFirstName: !!user.firstName,
            hasLastName: !!user.lastName,
            hasId: !!clientId,
            firstName: user.firstName,
            lastName: user.lastName,
            id: clientId
          });

          // Fix salonId if it's an array
          const vendorId = Array.isArray(salonId) ? salonId[0] : salonId;
          console.log("Vendor ID check:", {
            salonId: salonId,
            vendorId: vendorId,
            salonIdType: typeof salonId,
            isSalonIdArray: Array.isArray(salonId)
          });

          // Update the appointment data creation to properly set service type flags
          // STRICT FIX: Only set isHomeService to true if the user explicitly chose 'home' mode AND provided location
          // This serves as the final safety net against phantom home bookings
          const isHomeService = bookingMode === 'home' && !!serviceLocation;

          // Check if any selected service is a wedding service
          const isWeddingService = selectedServices.some(service =>
            service.weddingService?.available || service.serviceWeddingService?.available
          );

          const appointmentData = {
            vendorId: vendorId, // Use the fixed vendorId
            client: clientId, // Use the fixed client ID
            clientName: clientName,
            clientEmail: user?.emailAddress || user?.email || '',
            clientPhone: user?.mobileNo || user?.phone || '',
            service: primarySchedule.service.id,
            serviceName: primarySchedule.service.name,
            staff: staffId, // This can now be null for "Any Professional"
            staffName: staffName,
            date: appointmentDate.toISOString(), // Ensure date is in ISO format
            startTime: primarySchedule.startTime,
            endTime: endTime,
            duration: totalDuration,
            amount: totalAmount,
            totalAmount: totalAmount,
            // Add payment details
            platformFee: priceBreakdown?.platformFee || 0,
            serviceTax: priceBreakdown?.serviceTax || 0,
            taxRate: priceBreakdown?.taxFeeSettings?.serviceTax || 0,
            couponCode: appliedOffer?.code || offerCode,
            discountAmount: priceBreakdown?.discountAmount || 0,
            finalAmount: priceBreakdown?.finalTotal || totalAmount,
            paymentMethod: method,
            paymentStatus: method === 'Pay Online' ? 'pending' : 'pending',
            status: "scheduled",
            notes: finalServiceSchedule.length > 1 ? "Multi-service appointment" : "Single service appointment",
            serviceItems: serviceItems,
            isMultiService: isMultiService,
            isHomeService: isHomeService, // Keeping strict mode consistency
            isWeddingService: isWeddingService,
            // Add home service location if applicable
            // CRITICAL: Send as both 'homeServiceLocation' and 'location' to ensure backend compatibility
            ...(isHomeService && serviceLocation && {
              homeServiceLocation: {
                address: serviceLocation.address,
                city: serviceLocation.city,
                state: serviceLocation.state,
                pincode: serviceLocation.pincode,
                landmark: serviceLocation.landmark || '',
                lat: Number(serviceLocation.lat),
                lng: Number(serviceLocation.lng)
              },
              location: {
                address: serviceLocation.address,
                city: serviceLocation.city,
                state: serviceLocation.state,
                pincode: serviceLocation.pincode,
                landmark: serviceLocation.landmark || '',
                lat: Number(serviceLocation.lat),
                lng: Number(serviceLocation.lng)
              }
            }),
            // Add travel time fields -- Pass null/undefined to let backend calculate if not available
            travelTime: undefined,
            bufferBefore: 0,
            bufferAfter: 0,
            blockingWindows: []
          };

          // DEBUG: Log the complete appointment data being sent
          console.log("\n🚀 === ABOUT TO CREATE APPOINTMENT ===");
          console.log("Appointment Data:", {
            startTime: appointmentData.startTime,
            endTime: appointmentData.endTime,
            duration: appointmentData.duration,
            isMultiService: appointmentData.isMultiService,
            serviceItemsCount: serviceItems.length,
            serviceItems: serviceItems.map(si => ({
              serviceName: si.serviceName,
              staffName: si.staffName,
              startTime: si.startTime,
              endTime: si.endTime,
              duration: si.duration
            })),
            isHomeService: appointmentData.isHomeService
            // serviceLocation is added conditionally to appointmentData but not logged here due to type constraints
          });
          console.log("========================================\n");

          // Log all required fields to make sure they're present
          console.log("Required fields check:", {
            vendorId: appointmentData.vendorId,
            client: appointmentData.client,
            clientName: appointmentData.clientName,
            service: appointmentData.service,
            serviceName: appointmentData.serviceName,
            staff: appointmentData.staff,
            staffName: appointmentData.staffName,
            date: appointmentData.date,
            booking_mode: bookingMode
          });

          // Create the appointment using the mutation
          console.log("Creating appointment via mutation...");

          try {
            const result = await createAppointment(appointmentData).unwrap();
            console.log("Appointment created successfully:", result);

            // Handle online payment trigger if needed
            if (method === 'Pay Online' && result.data?.finalAmount > 0) {
              try {
                // In a real implementation, you would integrate with Razorpay or another payment gateway here
                // For now, we'll simulate this
                console.log("Processing online payment...");

                // Simulate payment processing
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Update payment status to completed
                // In a real implementation, you would call an API to update the appointment
                console.log("Payment processed successfully");
              } catch (paymentError) {
                console.error("Payment processing error:", paymentError);
                // Update payment status to failed
                // In a real implementation, you would call an API to update the appointment
                toast.error("Payment failed. Please try again or pay at the salon.");
                return;
              }
            }
          } catch (error) {
            console.error("Error during appointment creation mutation:", error);
            throw error;
          }

          // Close the payment modal
          setIsPaymentModalOpen(false);

          // Show confirmation message with toast
          toast.success(`Booking Confirmed! Payment Method: ${method}\nAppointment created successfully with ${finalServiceSchedule.length} services.`);

          // Set a flag in sessionStorage to indicate that an appointment was just created
          // This will help the time slot component know to refetch data when it mounts again
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('appointmentJustCreated', 'true');
          }

          // Clear the selected time to ensure the time slot component refetches data
          // This will help ensure that the newly created appointment is reflected in the available time slots
          setSelectedTime(null);

          // Redirect to the appointments page after a short delay
          setTimeout(() => {
            router.push('/profile/appointments');
          }, 2000);
        } else {
          console.log("No service schedule found and unable to create one, skipping appointment creation");
          toast.error("Unable to create appointment. Please try again.");
        }
      } catch (error: any) {
        console.error("Error creating appointment:", error);
        // Check if it's a validation error from the API
        if (error?.data?.message) {
          toast.error(`Failed to create appointment: ${error.data.message}`);
        } else {
          toast.error("Failed to create appointment. Please try again.");
        }
      }
    }
  };
  // Add a function to refetch appointment data after creation
  const refetchAppointments = async () => {
    // This function can be called after appointment creation to ensure data is refreshed
    console.log("Refetching appointment data...");
  };

  // Handle service selection
  const handleSelectService = (service: Service) => {
    // Validate service data before processing
    if (!service || !service.id) {
      console.error('Invalid service data:', service);
      return;
    }

    // Ensure service has all required properties
    if (!service.name) {
      console.error('Service missing name property:', service);
      return;
    }

    console.log('handleSelectService called with:', service);
    console.log('Service properties:', {
      id: service.id,
      name: service.name,
      price: service.price,
      hasId: !!service.id,
      hasName: !!service.name,
      hasPrice: !!service.price,
      serviceKeys: Object.keys(service)
    });

    setSelectedServices(prev => {
      const isSelected = prev.some(s => s.id === service.id);
      console.log('Service is already selected:', isSelected);

      if (isSelected) {
        // If deselecting the service, clear the selected service if it matches
        if (selectedService?.id === service.id) {
          setSelectedService(null);
        }
        // Also remove the service from service-staff assignments
        setServiceStaffAssignments(prevAssignments =>
          prevAssignments.filter(assignment => assignment.service.id !== service.id)
        );
        return prev.filter(s => s.id !== service.id);
      } else {
        // When selecting a service, update the selected service state
        setSelectedService(service);
        console.log('Updated selectedService state to:', service);

        // Clear wedding package selection when individual service is selected
        setSelectedWeddingPackage(null);

        // Add a new service-staff assignment with no staff selected initially
        setServiceStaffAssignments(prevAssignments => {
          // Check if this service is already in assignments to prevent duplicates
          const isAlreadyAssigned = prevAssignments.some(assignment => assignment.service.id === service.id);
          if (isAlreadyAssigned) {
            // Update the existing assignment
            return prevAssignments.map(assignment =>
              assignment.service.id === service.id ? { ...assignment, service } : assignment
            );
          }
          const newAssignment = { service, staff: null };
          console.log('Adding new service-staff assignment:', newAssignment);
          return [
            ...prevAssignments,
            newAssignment
          ];
        });
        return [...prev, service];
      }
    });
  };

  // Handle wedding package selection
  const handleSelectWeddingPackage = (pkg: WeddingPackage | null) => {
    console.log('handleSelectWeddingPackage called with:', pkg);
    setSelectedWeddingPackage(pkg);

    if (pkg) {
      // Package selected - keep on step 1 to show decision modal
      // Don't auto-advance, let the rendering logic show the decision modal
      setWeddingPackageMode(null); // Reset mode to trigger decision modal
    }

    // Clear individual service selection when package is selected
    setSelectedServices([]);
    setSelectedService(null);
    setServiceStaffAssignments([]);
    setIsCustomizingPackage(false);
    setCustomizedPackageServices([]);
  };

  // Handle wedding package customization start
  const handleCustomizePackage = () => {
    if (selectedWeddingPackage) {
      setIsCustomizingPackage(true);
      setWeddingPackageMode('customized');
      // Initialize customized services from package
      const packageServices = selectedWeddingPackage.services.map(pkgSvc => {
        const service = services.find(s => s.id === pkgSvc.serviceId);
        return service;
      }).filter(Boolean) as Service[];
      setCustomizedPackageServices(packageServices);
    }
  };

  // Handle proceeding with default package
  const handleProceedWithDefault = () => {
    if (selectedWeddingPackage) {
      setWeddingPackageMode('default');
      setIsCustomizingPackage(false);

      // Skip staff selection and enforce login before time slot
      if (!isAuthenticated) {
        console.log("Wedding Package Default: Redirecting to login before Step 3");
        toast.info("Please login to choose a date and time");
        const bookingData = {
          selectedServices,
          serviceStaffAssignments,
          selectedStaff,
          selectedDate: selectedDate.toISOString(),
          selectedTime,
          salonId,
          serviceLocation,
          bookingMode,
          currentStep: 3, // Set to 3 so they return to time selection
          appliedOffer,
          slotLockToken,
          pendingAppointmentId,
          weddingVenueType,
          weddingPackageMode: 'default',
          customizedPackageServices,
          selectedWeddingPackage
        };
        sessionStorage.setItem('pendingBooking', JSON.stringify(bookingData));
        router.push(`/client-login?redirect=/book/${salonId}`);
        return;
      }

      // Skip staff selection for wedding packages - go directly to time slots
      setCurrentStep(3);
    }
  };

  // Handle customization complete
  const handleCustomizationComplete = (customServices: Service[]) => {
    setCustomizedPackageServices(customServices);
    setIsCustomizingPackage(false);

    // Skip staff selection and enforce login before time slot
    if (!isAuthenticated) {
      console.log("Wedding Package Customized: Redirecting to login before Step 3");
      toast.info("Please login to choose a date and time");
      const bookingData = {
        selectedServices,
        serviceStaffAssignments,
        selectedStaff,
        selectedDate: selectedDate.toISOString(),
        selectedTime,
        salonId,
        serviceLocation,
        bookingMode,
        currentStep: 3, // Set to 3 so they return to time selection
        appliedOffer,
        slotLockToken,
        pendingAppointmentId,
        weddingVenueType,
        weddingPackageMode: 'customized',
        customizedPackageServices: customServices,
        selectedWeddingPackage
      };
      sessionStorage.setItem('pendingBooking', JSON.stringify(bookingData));
      router.push(`/client-login?redirect=/book/${salonId}`);
      return;
    }

    // Skip staff selection for wedding packages - go directly to time slots
    setCurrentStep(3);
  };

  // Handle back from customization
  const handleBackFromCustomization = () => {
    setIsCustomizingPackage(false);
    setWeddingPackageMode(null);
    setCustomizedPackageServices([]);
  };

  // Handle staff selection with automatic navigation to Step 3
  const handleSelectStaff = (staff: StaffMember | null) => {
    setSelectedStaff(staff);
    // Note: Navigation to Step 3 is now handled in Step2_Staff component
  };

  const renderStepContent = () => {
    try {
      // Use multi-service flow if more than one service is selected
      // Also use multi-service flow if there are service-staff assignments (which indicates we're in multi-service workflow)
      const isMultiService = selectedServices.length > 1 || serviceStaffAssignments.length > 0;

      // Add debugging
      console.log('renderStepContent - Current state:', {
        currentStep,
        isMultiService,
        selectedServicesLength: selectedServices.length,
        serviceStaffAssignmentsLength: serviceStaffAssignments.length,
        selectedService: selectedService?.id,
        serviceStaffDataLoading: serviceStaffData?.isLoading,
        serviceStaffDataError: serviceStaffData?.error,
        serviceStaffData: serviceStaffData
      });

      // Add a simple test to ensure we always return something (allow up to step 5 for wedding packages)
      if (currentStep < 1 || currentStep > 5) {
        console.warn('Invalid currentStep value:', currentStep);
        return <div className="w-full py-12 text-center">Invalid step: {currentStep}</div>;
      }

      // Add a simple test to see if we're getting to this point
      console.log('renderStepContent - About to render step:', currentStep);

      // Show skeleton loader while services are being fetched
      if (isLoading) {
        return (
          <div className="w-full space-y-6">
            {/* Skeleton for service categories */}
            <div className="space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/4 animate-pulse"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center space-x-4">
                      <div className="h-16 w-16 bg-gray-200 rounded animate-pulse"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                      </div>
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skeleton for continue button */}
            <div className="flex justify-end">
              <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        );
      }

      // Check if we have services data
      if (!services || services.length === 0) {
        return (
          <div className="w-full py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-muted-foreground">No services available at this salon.</p>
              <Button onClick={() => window.location.reload()}>Reload</Button>
            </div>
          </div>
        );
      }

      switch (currentStep) {
        case 1:
          console.log('Rendering Step1_Services');

          // If wedding package selected and customization started, show customizer
          if (selectedWeddingPackage && isCustomizingPackage) {
            const liveServicesCount = customizedPackageServices && customizedPackageServices.length > 0
              ? customizedPackageServices.length
              : (selectedWeddingPackage.services?.length || 0);

            const liveDuration = customizedPackageServices && customizedPackageServices.length > 0
              ? customizedPackageServices.reduce((sum, s) => {
                const durStr = String(s.duration || '0').replace(/[^0-9]/g, '');
                const dur = parseInt(durStr, 10) || 0;
                const qty = (s as any).quantity || 1;
                return sum + (dur * qty);
              }, 0)
              : (selectedWeddingPackage.duration || 0);

            const liveBasePrice = customizedPackageServices && customizedPackageServices.length > 0
              ? customizedPackageServices.reduce((sum, s) => {
                const prStr = String(s.price || '0').replace(/[^0-9.]/g, '');
                const pr = parseFloat(prStr) || 0;
                const qty = (s as any).quantity || 1;
                return sum + (pr * qty);
              }, 0)
              : (selectedWeddingPackage.totalPrice || 0);

            const discountPercent = selectedWeddingPackage.totalPrice && selectedWeddingPackage.discountedPrice
              ? (selectedWeddingPackage.totalPrice - selectedWeddingPackage.discountedPrice) / selectedWeddingPackage.totalPrice
              : 0;
            const liveDiscountedPrice = liveBasePrice * (1 - discountPercent);

            return (
              <div className="w-full max-w-4xl mx-auto space-y-6">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <button
                    onClick={() => handleBackFromCustomization()}
                    className="hover:text-primary transition-colors"
                  >
                    Packages
                  </button>
                  <ChevronRight className="h-4 w-4" />
                  <span className="text-primary font-medium">Customize Package</span>
                </div>

                {/* Package Header */}
                <Card className="border-2 border-primary/20">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-rose-100 rounded-full">
                        <Heart className="h-6 w-6 text-rose-600" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold">{selectedWeddingPackage.name}</h2>
                        <p className="text-muted-foreground mt-1">{selectedWeddingPackage.description}</p>
                        <div className="flex items-center gap-4 mt-4">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{liveDuration} min</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Scissors className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{liveServicesCount} services</span>
                          </div>
                          <div className="flex items-center gap-2 ml-auto">
                            <span className="text-2xl font-bold text-primary">
                              ₹{Math.round(liveDiscountedPrice)}
                            </span>
                            {discountPercent > 0 && (
                              <span className="text-sm text-muted-foreground line-through">
                                ₹{Math.round(liveBasePrice)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Customization Interface */}
                <Step1_WeddingPackageCustomizer
                  weddingPackage={selectedWeddingPackage}
                  allServices={services}
                  onPackageUpdate={(updatedPackage, customServices) => {
                    setSelectedWeddingPackage(updatedPackage as any);
                    handleCustomizationComplete(customServices);
                  }}
                  onLiveUpdate={setCustomizedPackageServices}
                  onBack={handleBackFromCustomization}
                  currentStep={1}
                  setCurrentStep={setCurrentStep}
                />
              </div>
            );
          }

          // Wedding package is handled inline in Step1_Services component
          // No separate modal or screen needed

          // Default: Show service selection with wedding packages
          return (
            <Step1_Services
              selectedServices={selectedServices}
              onSelectService={handleSelectService}
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              services={services}
              servicesByCategory={servicesByCategory}
              categories={categories}
              isLoading={isLoading}
              error={error}
              onServiceSelect={handleSelectService}
              weddingPackages={weddingPackages}
              onWeddingPackageSelect={handleSelectWeddingPackage}
              selectedWeddingPackage={selectedWeddingPackage}
              weddingPackageMode={weddingPackageMode}
              bookingMode={bookingMode}
              setBookingMode={handleBookingModeChange}
              initialViewMode={selectedWeddingPackage || searchParams?.get('tab') === 'packages' ? 'packages' : 'services'}
              priceBreakdown={priceBreakdown}
              taxFeeSettings={taxFeeSettings}
              onClearServices={() => setSelectedServices([])}
              appliedOffer={appliedOffer}
              vendorOffers={vendorOffers}
              offerCodeFromUrl={searchParams?.get('offerCode')}
            />
          );
        case 2:
          console.log('Rendering Step2 - Wedding Package Mode:', weddingPackageMode);

          // Wedding Package Flow - Skip staff selection and go directly to time/date
          if (selectedWeddingPackage && weddingPackageMode) {
            // Automatically advance to step 3 for wedding packages
            setCurrentStep(3);
            return null;
          }


          // Regular service flow
          console.log('Rendering Step2 - isMultiService:', isMultiService);
          if (isMultiService) {
            // Multi-service flow
            console.log('Rendering Step2_MultiService');
            // Check if we have staff data
            if (!staff || staff.length === 0) {
              return (
                <div className="w-full py-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <p className="text-muted-foreground">No staff available at this salon.</p>
                    <Button onClick={() => window.location.reload()}>Reload</Button>
                  </div>
                </div>
              );
            }
            return (
              <Step2_MultiService
                serviceStaffAssignments={serviceStaffAssignments}
                onUpdateAssignment={(serviceId: string, staff: StaffMember | null) => {
                  setServiceStaffAssignments(prev =>
                    prev.map(assignment =>
                      assignment.service.id === serviceId
                        ? { ...assignment, staff }
                        : assignment
                    )
                  );
                }}
                currentStep={currentStep}
                setCurrentStep={setCurrentStep}
                staff={staff}
                isLoading={false}
                error={null}
                onNext={handleNextStep}
                bookingMode={bookingMode}
              />
            );
          } else {
            // Single service flow
            console.log('Rendering Step2_Staff');

            // Check if serviceStaffData is still loading
            if (serviceStaffData?.isLoading) {
              return (
                <div className="w-full space-y-6">
                  {/* Skeleton for staff selection */}
                  <div className="space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center space-x-4">
                            <div className="h-12 w-12 bg-gray-200 rounded-full animate-pulse"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                              <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            // Check if there's an error with serviceStaffData
            if (serviceStaffData?.error) {
              return (
                <div className="w-full">
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-4">
                      <AlertCircle className="h-8 w-8 text-destructive" />
                      <p className="text-muted-foreground">Unable to load staff members. Please try again.</p>
                      <Button onClick={() => window.location.reload()}>Reload</Button>
                    </div>
                  </div>
                </div>
              );
            }

            // Check if we have staff data
            const staffData = serviceStaffData.staff || [];
            if (!staffData || staffData.length === 0) {
              return (
                <div className="w-full py-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <p className="text-muted-foreground">No staff available for this service.</p>
                    <Button onClick={() => window.location.reload()}>Reload</Button>
                  </div>
                </div>
              );
            }

            return (
              <Step2_Staff
                selectedStaff={selectedStaff}
                onSelectStaff={handleSelectStaff}
                currentStep={currentStep}
                setCurrentStep={setCurrentStep}
                staff={staffData}
                isLoading={serviceStaffData.isLoading || false}
                error={serviceStaffData.error}
                selectedService={selectedService}
                onStaffSelect={setSelectedStaff}
                onNext={handleNextStep}
                bookingMode={bookingMode}
              />
            );
          }
          break;

        case 3:
          console.log('Rendering Step3 - Wedding Package:', selectedWeddingPackage, 'isMultiService:', isMultiService, 'bookingMode:', bookingMode);

          // For home services (non-wedding) OR wedding packages, show location selection at step 3
          if ((bookingMode === 'home' && !selectedWeddingPackage) || selectedWeddingPackage) {
            return (
              <Step3_LocationSelection
                currentStep={currentStep}
                setCurrentStep={setCurrentStep}
                serviceLocation={serviceLocation}
                onLocationConfirm={(location: HomeServiceLocation) => {
                  console.log('[page.tsx] Location confirmed:', location);
                  console.log('[page.tsx] Current weddingVenueType:', weddingVenueType);
                  setServiceLocation(location);
                  // Don't auto-advance - let user review and use summary button
                }}
                user={user}
                isAuthenticated={isAuthenticated}
                selectedWeddingPackage={selectedWeddingPackage}
                weddingVenueType={weddingVenueType}
                onVenueTypeChange={setWeddingVenueType}
              />
            );
          }

          // Check if we have working hours data
          if (!workingHours || workingHours.length === 0) {
            return (
              <div className="w-full py-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <p className="text-muted-foreground">Working hours not configured for this salon.</p>
                  <Button onClick={() => window.location.reload()}>Reload</Button>
                </div>
              </div>
            );
          }

          // CENTRALIZED TIME SLOT GENERATION FOR ALL SERVICE TYPES
          // Determine service data for time slot generation
          let serviceForTimeSlot;
          let totalDuration = 0;

          if (selectedWeddingPackage) {
            // Wedding package
            const weddingPkg = selectedWeddingPackage as any;
            const packageServices = weddingPackageMode === 'customized' ? customizedPackageServices : (weddingPkg.services || weddingPkg.servicesList || []);
            totalDuration = weddingPkg.duration || packageServices.reduce((total: number, service: any) => {
              const dur = service.duration || service.serviceDuration || 0;
              const duration = convertDurationToMinutes(dur);
              return total + (duration || 0);
            }, 0);

            serviceForTimeSlot = {
              id: weddingPkg.id || weddingPkg._id || 'wedding-package',
              name: weddingPkg.name,
              duration: `${totalDuration} min`,
              price: (weddingPkg.discountedPrice || weddingPkg.totalPrice).toString(),
              category: 'Wedding Package',
              description: weddingPkg.description
            } as any;
          } else if (isMultiService) {
            // Multi-service
            totalDuration = selectedServices.reduce((total, service) => {
              const duration = convertDurationToMinutes(service.duration);
              return total + (duration || 0);
            }, 0);

            serviceForTimeSlot = {
              id: 'multi-service',
              name: selectedServices.map(s => s.name).join(', '),
              duration: `${totalDuration} min`,
              price: selectedServices.reduce((total, s) => total + Number(s.discountedPrice || s.price || 0), 0).toString(),
              category: 'Multi-Service',
              description: selectedServices.map(s => s.name).join(', ')
            } as any;
          } else {
            // Single service
            if (selectedServices.length === 0) {
              console.warn('Step3 Rendering: No services selected for single service flow');
              return (
                <div className="w-full py-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <p className="text-muted-foreground">No services selected. Please go back and select a service.</p>
                    <Button onClick={() => setCurrentStep(1)}>Go to Step 1</Button>
                  </div>
                </div>
              );
            }
            const service = selectedServices[0];
            const duration = convertDurationToMinutes(service?.duration || 0);
            totalDuration = duration || 0;
            serviceForTimeSlot = service;
          }

          // UNIFIED TIME SLOT SELECTOR - Same UI for all service types
          return isMultiService ? (
            <Step3_MultiServiceTimeSlot
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              selectedTime={selectedTime}
              onSelectTime={setSelectedTime}
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              serviceStaffAssignments={serviceStaffAssignments}
              staff={staff}
              workingHours={workingHours}
              isLoading={false}
              error={null}
              selectedServices={selectedServices}
              vendorId={salonId as string}
              onLockAcquired={(token, appId) => {
                setSlotLockToken(token);
                if (appId) setPendingAppointmentId(appId);
              }}
              platformFee={priceBreakdown?.platformFee}
              serviceTax={priceBreakdown?.serviceTax}
              taxRate={priceBreakdown?.taxFeeSettings?.serviceTax}
              couponCode={appliedOffer?.code || offerCode}
              discountAmount={priceBreakdown?.discountAmount || 0}
              user={user}
              isHomeService={bookingMode === 'home'}
              homeServiceLocation={serviceLocation as any}
              isWeddingService={selectedServices.some(service =>
                service.weddingService?.available || service.serviceWeddingService?.available
              )}
            />
          ) : (
            <TimeSlotSelector
              selectedServices={selectedServices}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              selectedTime={selectedTime}
              onSelectTime={setSelectedTime}
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              selectedStaff={selectedStaff}
              onSelectStaff={setSelectedStaff}
              staff={selectedStaff ? [selectedStaff] : staff}
              workingHours={workingHours}
              isLoading={false}
              error={null}
              salonId={salonId as string}
              service={serviceForTimeSlot}
              isWeddingPackage={!!selectedWeddingPackage}
              weddingPackage={selectedWeddingPackage}
              weddingPackageServices={selectedWeddingPackage ? (weddingPackageMode === 'customized' ? customizedPackageServices : (selectedWeddingPackage as any).services) : undefined}
              onLockAcquired={(token, appId) => {
                setSlotLockToken(token);
                if (appId) setPendingAppointmentId(appId);
              }}
              platformFee={priceBreakdown?.platformFee}
              serviceTax={priceBreakdown?.serviceTax}
              taxRate={priceBreakdown?.taxFeeSettings?.serviceTax}
              couponCode={appliedOffer?.code || offerCode}
              discountAmount={priceBreakdown?.discountAmount || 0}
              user={user}
              isHomeService={bookingMode === 'home'}
              homeServiceLocation={serviceLocation}
              isWeddingService={selectedServices.some(service =>
                service.weddingService?.available || service.serviceWeddingService?.available
              )}
            />
          );
          break;

        case 4:
          // Step 4: Time Slot selection for home services OR wedding packages
          console.log('Rendering Step4 - Wedding Package Time Slot or Home Service Time Slot, bookingMode:', bookingMode);

          // For home services (non-wedding), show time slot at step 4
          if (bookingMode === 'home' && !selectedWeddingPackage) {
            // Check if we have working hours data
            if (!workingHours || workingHours.length === 0) {
              return (
                <div className="w-full py-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <p className="text-muted-foreground">Working hours not configured for this salon.</p>
                    <Button onClick={() => window.location.reload()}>Reload</Button>
                  </div>
                </div>
              );
            }

            // Determine service data for time slot generation (copied from case 3)
            const isMultiService = selectedServices.length > 1 || serviceStaffAssignments.length > 0;
            let serviceForTimeSlot;
            let totalDuration = 0;

            if (isMultiService) {
              totalDuration = selectedServices.reduce((total, service) => {
                const duration = convertDurationToMinutes(service.duration);
                return total + (duration || 0);
              }, 0);

              serviceForTimeSlot = {
                id: 'multi-service',
                name: selectedServices.map(s => s.name).join(', '),
                duration: `${totalDuration} min`,
                price: selectedServices.reduce((total, s) => total + Number(s.discountedPrice || s.price || 0), 0).toString(),
                category: 'Multi-Service',
                description: selectedServices.map(s => s.name).join(', ')
              } as any;
            } else {
              if (selectedServices.length === 0) {
                return (
                  <div className="w-full py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <AlertCircle className="h-8 w-8 text-destructive" />
                      <p className="text-muted-foreground">No services selected. Please go back and select a service.</p>
                      <Button onClick={() => setCurrentStep(1)}>Go to Step 1</Button>
                    </div>
                  </div>
                );
              }
              const service = selectedServices[0];
              const duration = convertDurationToMinutes(service?.duration || 0);
              totalDuration = duration || 0;
              serviceForTimeSlot = service;
            }

            // Render time slot selector for home services at step 4
            return isMultiService ? (
              <Step3_MultiServiceTimeSlot
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                selectedTime={selectedTime}
                onSelectTime={setSelectedTime}
                currentStep={currentStep}
                setCurrentStep={setCurrentStep}
                serviceStaffAssignments={serviceStaffAssignments}
                staff={staff}
                workingHours={workingHours}
                isLoading={false}
                error={null}
                selectedServices={selectedServices}
                vendorId={salonId as string}
                onLockAcquired={(token, appId) => {
                  setSlotLockToken(token);
                  if (appId) setPendingAppointmentId(appId);
                }}
                platformFee={priceBreakdown?.platformFee}
                serviceTax={priceBreakdown?.serviceTax}
                taxRate={priceBreakdown?.taxFeeSettings?.serviceTax}
                couponCode={appliedOffer?.code || offerCode}
                discountAmount={priceBreakdown?.discountAmount || 0}
                user={user}
                isHomeService={true}
                homeServiceLocation={serviceLocation as any}
                isWeddingService={selectedServices.some(service =>
                  service.weddingService?.available || service.serviceWeddingService?.available
                )}
              />
            ) : (
              <TimeSlotSelector
                selectedServices={selectedServices}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                selectedTime={selectedTime}
                onSelectTime={setSelectedTime}
                currentStep={currentStep}
                setCurrentStep={setCurrentStep}
                selectedStaff={selectedStaff}
                onSelectStaff={setSelectedStaff}
                staff={selectedStaff ? [selectedStaff] : staff}
                workingHours={workingHours}
                isLoading={false}
                error={null}
                salonId={salonId as string}
                service={serviceForTimeSlot}
                isWeddingPackage={false}
                weddingPackage={null}
                weddingPackageServices={undefined}
                onLockAcquired={(token, appId) => {
                  setSlotLockToken(token);
                  if (appId) setPendingAppointmentId(appId);
                }}
                platformFee={priceBreakdown?.platformFee}
                serviceTax={priceBreakdown?.serviceTax}
                taxRate={priceBreakdown?.taxFeeSettings?.serviceTax}
                couponCode={appliedOffer?.code || offerCode}
                discountAmount={priceBreakdown?.discountAmount || 0}
                user={user}
                isHomeService={true}
                homeServiceLocation={serviceLocation}
                isWeddingService={selectedServices.some(service =>
                  service.weddingService?.available || service.serviceWeddingService?.available
                )}
              />
            );
          }

          // Wedding package time slot selection
          if (selectedWeddingPackage) {
            // Check if we have working hours data
            if (!workingHours || workingHours.length === 0) {
              return (
                <div className="w-full py-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <p className="text-muted-foreground">Working hours not configured for this salon.</p>
                    <Button onClick={() => window.location.reload()}>Reload</Button>
                  </div>
                </div>
              );
            }

            // Prepare wedding package data for time slot
            const weddingPkg = selectedWeddingPackage as any;
            const packageServices = weddingPackageMode === 'customized' ? customizedPackageServices : (weddingPkg.services || weddingPkg.servicesList || []);

            // [NEW] Normalize services to ensure they have 'id' property and prepare assignments
            const normalizedPackageServices = packageServices.map((s: any) => ({
              ...s,
              id: s.serviceId || s.id || s._id,
              name: s.serviceName || s.name,
              duration: s.duration || s.serviceDuration
            }));

            const weddingAssignments = normalizedPackageServices.map((s: any) => ({
              service: s,
              staff: selectedStaff || undefined
            }));

            return (
              <TimeSlotSelector
                selectedServices={normalizedPackageServices}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                selectedTime={selectedTime}
                onSelectTime={setSelectedTime}
                currentStep={currentStep}
                setCurrentStep={setCurrentStep}
                selectedStaff={selectedStaff}
                onSelectStaff={setSelectedStaff}
                staff={selectedStaff ? [selectedStaff] : staff}
                workingHours={workingHours}
                isLoading={false}
                error={null}
                salonId={salonId as string}
                service={null}
                isWeddingPackage={true}
                weddingPackage={selectedWeddingPackage}
                weddingPackageServices={normalizedPackageServices}
                onLockAcquired={(token, appId) => {
                  setSlotLockToken(token);
                  if (appId) setPendingAppointmentId(appId);
                }}
                platformFee={priceBreakdown?.platformFee}
                serviceTax={priceBreakdown?.serviceTax}
                taxRate={priceBreakdown?.taxFeeSettings?.serviceTax}
                couponCode={appliedOffer?.code || offerCode}
                discountAmount={priceBreakdown?.discountAmount || 0}
                user={user}
                isHomeService={weddingVenueType === 'venue'}
                homeServiceLocation={weddingVenueType === 'venue' ? serviceLocation : null}
                isWeddingService={true}
              />
            );
          }

          // Fallback
          return <div className="w-full py-12 text-center">Step 4 content</div>;

        default:
          console.log('Rendering default case - step not found');
          return <div className="w-full py-12 text-center">Step not found: {currentStep}</div>;
      }
    } catch (error) {
      console.error('Error rendering step content:', error);
      return (
        <div className="w-full">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-muted-foreground">Unable to load booking step. Please try again.</p>
              <Button onClick={() => window.location.reload()}>Reload Page</Button>
            </div>
          </div>
        </div>
      );
    }
  };

  // Calculate price breakdown when selected services or wedding package changes
  useEffect(() => {
    // If an offer is applied, check if it's still valid for the current selection
    if (appliedOffer && selectedServices.length > 0) {
      if (!isOfferApplicable(appliedOffer, selectedServices)) {
        toast.info(`Offer ${appliedOffer.code} is no longer applicable for the current selection.`);
        setAppliedOffer(null);
        setOffer(null);
        setOfferCode('');
        return;
      }
    }

    const calculatePrices = async () => {
      // Handle wedding package pricing with offer code support
      if (selectedWeddingPackage) {
        // Calculate base package price (with customization if applicable) for fallback
        const packagePrice = weddingPackageMode === 'customized' && customizedPackageServices && customizedPackageServices.length > 0
          ? customizedPackageServices.reduce((sum, service: any) => {
            const servicePrice = parseFloat(service.price || '0');
            const quantity = service.quantity || 1;
            return sum + (servicePrice * quantity);
          }, 0)
          // Use discountedPrice if explicitly set (even 0), else fall back to totalPrice
          : (selectedWeddingPackage.discountedPrice != null ? selectedWeddingPackage.discountedPrice : (selectedWeddingPackage.totalPrice || 0));

        // Use customized services if available, otherwise use package defaults
        let servicesForCalculation = [];
        if (weddingPackageMode === 'customized' && customizedPackageServices && customizedPackageServices.length > 0) {
          const packageOriginalPrice = selectedWeddingPackage.totalPrice || 0;
          // Use != null so discountedPrice=0 is respected, not skipped
          const packageDiscountedPrice = selectedWeddingPackage.discountedPrice != null
            ? selectedWeddingPackage.discountedPrice
            : packageOriginalPrice;
          const discountPercent = (selectedWeddingPackage as any).discountPercent != null
            ? (selectedWeddingPackage as any).discountPercent / 100
            : (packageOriginalPrice > 0 ? (packageOriginalPrice - packageDiscountedPrice) / packageOriginalPrice : 0);

          servicesForCalculation = customizedPackageServices.map(s => {
            const rawPrice = parseFloat(s.price ?? '0');
            return {
              ...s,
              discountedPrice: rawPrice * (1 - discountPercent)
            };
          });
        } else {
          servicesForCalculation = [{
            id: (selectedWeddingPackage as any).id || (selectedWeddingPackage as any)._id,
            name: selectedWeddingPackage.name,
            // price = MRP (used only if discountedPrice is null/undefined)
            price: selectedWeddingPackage.totalPrice,
            // Use != null so discountedPrice=0 is passed correctly, not skipped
            discountedPrice: selectedWeddingPackage.discountedPrice != null
              ? selectedWeddingPackage.discountedPrice
              : null,
            selectedAddons: []
          }];
        }

        try {
          // Call calculateBookingAmount WITH offer support (pass offer and taxFeeSettings)
          const breakdown = await calculateBookingAmount(servicesForCalculation, offer, taxFeeSettings);
          console.log('Wedding package price breakdown with offer:', breakdown);
          setPriceBreakdown(breakdown);
        } catch (error) {
          console.error('Error calculating wedding package prices:', error);
          // Fallback to default breakdown if calculation fails
          const defaultBreakdown = {
            subtotal: packagePrice,
            discountAmount: 0,
            amountAfterDiscount: packagePrice,
            platformFee: 0,
            serviceTax: 0,
            vendorServiceTax: 0,
            totalTax: 0,
            finalTotal: packagePrice,
            taxFeeSettings: null
          };
          setPriceBreakdown(defaultBreakdown);
        }
        return;
      }

      // Validate that we have valid services before calculating prices
      if (selectedServices && selectedServices.length > 0) {
        // Filter out any invalid services
        const validServices = selectedServices.filter(service =>
          service && service.id && (service.price !== undefined && service.price !== null) && !isNaN(parseFloat(String(service.price)))
        );

        if (validServices.length === 0) {
          console.warn('No valid services found for price calculation');
          setPriceBreakdown(null);
          return;
        }

        try {
          console.log('Calculating prices for services:', validServices);
          console.log('Current offer:', offer);
          console.log('Tax fee settings:', taxFeeSettings);
          // Call calculateBookingAmount and await the result
          const breakdown = await calculateBookingAmount(validServices, offer, taxFeeSettings);
          console.log('Price breakdown calculated:', breakdown);
          setPriceBreakdown(breakdown);
        } catch (error) {
          console.error('Error calculating prices:', error);
          // Set a default price breakdown to prevent blank screen
          const breakdown = await calculateBookingAmount(validServices, offer, taxFeeSettings);
          const subtotal = selectedServices.reduce((acc, service) => {
            const servicePrice = service.discountedPrice !== undefined && service.discountedPrice !== null
              ? parseFloat(String(service.discountedPrice))
              : parseFloat(String(service.price || '0'));

            const addonsPrice = service.selectedAddons?.reduce((addonSum, addon) => {
              const addonPriceValue = addon.price !== null && addon.price !== undefined ? parseFloat(String(addon.price)) : 0;
              return addonSum + addonPriceValue;
            }, 0) || 0;

            return acc + servicePrice + addonsPrice;
          }, 0);

          const defaultBreakdown = {
            subtotal: subtotal,
            discountAmount: 0,
            amountAfterDiscount: subtotal,
            platformFee: 0,
            serviceTax: 0,
            vendorServiceTax: 0,
            totalTax: 0,
            finalTotal: subtotal,
            taxFeeSettings: null
          };
          setPriceBreakdown(defaultBreakdown);
        }
      } else {
        setPriceBreakdown(null);
      }
    };

    calculatePrices();
  }, [selectedServices, selectedWeddingPackage, weddingPackageMode, customizedPackageServices, offer, taxFeeSettings]);

  // Check for pre-selected service or wedding package from salon details page
  useEffect(() => {
    console.log('Pre-selected service/package useEffect running with:', {
      hasWindow: typeof window !== 'undefined',
      servicesLength: services?.length,
      weddingPackagesLength: weddingPackages?.length,
      isLoading,
      hasStoredService: typeof window !== 'undefined' ? sessionStorage.getItem('selectedService') : null,
      hasStoredWeddingPackage: typeof window !== 'undefined' ? !!sessionStorage.getItem('selectedWeddingPackage') : false,
      currentStep
    });

    if (typeof window !== 'undefined' && services && services.length > 0 && !isLoading) {
      const storedService = sessionStorage.getItem('selectedService');
      const storedWeddingPackage = sessionStorage.getItem('selectedWeddingPackage');

      // ── Wedding Package pre-selection (takes priority if present) ──────────
      if (storedWeddingPackage && !storedService) {
        try {
          const pkgData = JSON.parse(storedWeddingPackage);
          console.log('Found pre-selected wedding package in sessionStorage:', pkgData);

          // Try to find the matching package in the loaded weddingPackages list
          const matchedPkg = weddingPackages?.find((p: any) =>
            p.id === (pkgData.id || pkgData._id) ||
            p._id === (pkgData.id || pkgData._id) ||
            p.name === pkgData.name
          );

          if (matchedPkg) {
            console.log('Found matching wedding package in loaded packages:', matchedPkg);
            handleSelectWeddingPackage(matchedPkg as any);
          } else {
            // Fall back to the stored data directly — it already has all required fields
            console.warn('Could not find matching wedding package, using stored data directly');
            handleSelectWeddingPackage(pkgData as any);
          }

          // Ensure we're on step 1 (package decision modal)
          if (currentStep !== 1) {
            setCurrentStep(1);
          }

          // Clean up
          sessionStorage.removeItem('selectedWeddingPackage');
        } catch (error) {
          console.error('Error parsing selected wedding package from sessionStorage:', error);
          sessionStorage.removeItem('selectedWeddingPackage');
        }
        return; // Don't process selectedService when a package was stored
      }

      console.log('Checking for stored service:', storedService);

      if (storedService) {
        try {
          const serviceData = JSON.parse(storedService);
          console.log('Found pre-selected service in sessionStorage:', serviceData);
          console.log('Available services:', services);

          // Find the corresponding service in the loaded services
          // Check multiple possible ID fields since the data might have different structures
          let service = services.find(s =>
            s.id === (serviceData.id || serviceData._id) ||
            s.id === serviceData._id ||
            s.id === serviceData.id
          );

          console.log('Found service match by ID:', service);

          // If we still haven't found a match, try matching by name as a fallback
          if (!service) {
            service = services.find(s => s.name === serviceData.name);
            console.log('Fallback - Found service match by name:', service);
          }

          if (service) {
            console.log('Found matching service in loaded services:', service);
            // Select the service
            handleSelectService(service);
            // Make sure we're on step 1
            if (currentStep !== 1) {
              console.log('Setting current step to 1');
              setCurrentStep(1);
            }
          } else {
            console.warn('Could not find matching service in loaded services, creating new service object');
            console.log('Service data keys:', Object.keys(serviceData));
            // If we can't find the service by ID, try to create a service object from the stored data
            const newService: Service = {
              id: serviceData.id || serviceData._id || '',
              name: serviceData.name || '',
              duration: serviceData.duration || '60 min',
              price: String(serviceData.price || 0),
              discountedPrice: serviceData.discountedPrice !== undefined && serviceData.discountedPrice !== null ?
                String(serviceData.discountedPrice) : null,
              category: serviceData.category || 'General',
              image: serviceData.image,
              description: serviceData.description,
              staff: serviceData.staff || []
            };

            // Select the service
            handleSelectService(newService);
            // Make sure we're on step 1
            if (currentStep !== 1) {
              console.log('Setting current step to 1');
              setCurrentStep(1);
            }
          }

          // Remove the stored service to prevent it from being processed again
          sessionStorage.removeItem('selectedService');
        } catch (error) {
          console.error('Error parsing selected service from sessionStorage:', error);
          sessionStorage.removeItem('selectedService');
        }
      }
    }
  }, [salonId, services, weddingPackages, isLoading, currentStep]); // Run when salonId, services, weddingPackages, isLoading, or currentStep change

  // Additional useEffect to handle service selection when services are first loaded
  useEffect(() => {
    console.log('Services loaded useEffect running with:', {
      servicesLength: services?.length,
      isLoading,
      selectedServicesLength: selectedServices.length
    });

    // Only run this if we haven't already selected a service and there are services loaded
    if (services && services.length > 0 && !isLoading && selectedServices.length === 0) {
      const storedService = typeof window !== 'undefined' ? sessionStorage.getItem('selectedService') : null;
      console.log('Checking for stored service in services loaded effect:', storedService);

      if (storedService) {
        // Trigger the main useEffect by ensuring all conditions are met
        // This will cause the main useEffect to run again
        console.log('Services loaded and stored service found, will trigger selection in main useEffect');
      }
    }
  }, [services, isLoading, selectedServices.length]);

  const salonDetailsHref = salonId ? `/salon-details/${salonId}` : '/salons';

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Styled Banner Header */}
      <header className="flex-shrink-0 sticky top-0 z-20" style={{ background: '#422A3C' }}>
        <div className="flex items-center px-6 md:px-10 py-4">
          {/* Left: salon name + arrow + booking steps */}
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Link
              href={salonDetailsHref}
              className="text-sm font-semibold text-white truncate max-w-[120px] hover:text-white/90"
            >
              {salonInfo?.name || 'Salon'}
            </Link>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/next (1) 3.png"
              alt="arrow"
              className="h-3 w-3 flex-shrink-0 opacity-70"
            />
            <BookingStepBanner
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              bookingMode={bookingMode}
              isWeddingPackage={!!selectedWeddingPackage}
            />
          </div>
        </div>
      </header>
      <div className="flex-1 grid lg:grid-cols-12 gap-6 px-6 lg:px-8 py-2">
        <main className="lg:col-span-7 xl:col-span-8 overflow-y-auto no-scrollbar">
          <div className="max-w-4xl mx-auto pb-24 lg:pb-8 pt-8">
            {/* Debug info
                <div className="mb-4 p-3 bg-secondary/30 rounded-lg text-sm">
                  <div>Current step: {currentStep}</div>
                  <div>Is loading: {isLoading ? 'true' : 'false'}</div>
                  <div>Has error: {error ? 'true' : 'false'}</div>
                  <div>Services length: {services?.length || 0}</div>
                  <div>Staff length: {staff?.length || 0}</div>
                  <div>Selected services: {selectedServices.length}</div>
                </div> */}
            {renderStepContent()}
          </div>
        </main>

        <aside className="hidden lg:block lg:col-span-5 xl:col-span-4 py-8">
          <div className="sticky top-28">
            <BookingSummary
              selectedServices={selectedWeddingPackage ? [] : selectedServices}
              selectedStaff={selectedStaff}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              onNextStep={handleNextStep}
              currentStep={currentStep}
              salonInfo={salonInfo}
              serviceStaffAssignments={serviceStaffAssignments}
              priceBreakdown={priceBreakdown}
              weddingPackage={selectedWeddingPackage}
              weddingPackageMode={weddingPackageMode}
              customizedPackageServices={customizedPackageServices}
              onEditPackage={handleCustomizePackage}
              onRemoveAddon={handleRemoveAddon}
              couponCode={appliedOffer?.code || offerCode}
              isHomeService={bookingMode === 'home'}
              serviceLocation={serviceLocation}
              weddingVenueType={weddingVenueType}
            />
          </div>
        </aside>
      </div>

      <div className="block lg:hidden fixed bottom-0 left-0 right-0 z-30">
        <BookingSummary
          selectedServices={selectedServices}
          selectedStaff={selectedStaff}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onNextStep={handleNextStep}
          currentStep={currentStep}
          isMobileFooter={true}
          salonInfo={salonInfo}
          serviceStaffAssignments={serviceStaffAssignments}
          priceBreakdown={priceBreakdown}
          weddingPackage={selectedWeddingPackage}
          weddingPackageMode={weddingPackageMode}
          customizedPackageServices={customizedPackageServices}
          onEditPackage={handleCustomizePackage}
          onRemoveAddon={handleRemoveAddon}
          couponCode={appliedOffer?.code || offerCode}
          isHomeService={bookingMode === 'home'}
          serviceLocation={serviceLocation}
          weddingVenueType={weddingVenueType}
        />
      </div>

      {/* Home Service Location Modal */}
      <Dialog open={showLocationModal} onOpenChange={setShowLocationModal}>
        <DialogContent className="sm:max-w-2xl h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              Home Service Location
            </DialogTitle>
            <DialogDescription className="text-sm">
              Please provide your address for the home service appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="py-0 space-y-0 flex-grow flex flex-col">
            {/* Full screen map selector - only element in the modal */}
            <div className="space-y-3 flex flex-col flex-grow">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Select Location on Map</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                    onClick={handleGetCurrentLocation}
                  >
                    <MapPin className="h-3 w-3" />
                    Use Current
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-500 hover:underline"
                    onClick={() => {
                      setShowLocationModal(false);
                      setShowMapSelector(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <div className="flex-grow rounded-lg overflow-hidden border flex flex-col">
                <div className="flex-grow">
                  <GoogleMapSelector
                    onLocationSelect={async (lat: number, lng: number) => {
                      setLocationForm(prev => ({
                        ...prev,
                        lat,
                        lng
                      }));

                      // Automatically fetch address details from coordinates
                      fetchAddressDetails(lat, lng);
                    }}
                    initialLat={locationForm.lat}
                    initialLng={locationForm.lng}
                  />
                </div>
              </div>
              <div className="text-xs text-gray-500 flex justify-between items-center">
                <span className="truncate">
                  {locationForm.lat && locationForm.lng ? (
                    <span>Lat: {locationForm.lat.toFixed(6)}, Lng: {locationForm.lng.toFixed(6)}</span>
                  ) : (
                    <span>No location selected</span>
                  )}
                </span>
                {locationForm.lat && locationForm.lng && (
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    Selected
                  </span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              setShowLocationModal(false);
              setShowMapSelector(false);
            }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleLocationSubmit}>
              Save Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={isConfirmationModalOpen} onOpenChange={setIsConfirmationModalOpen}>
        <DialogContent
          className="sm:max-w-2xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl
               [&>button]:text-white [&>button]:opacity-90 [&>button]:hover:opacity-100 [&>button]:hover:bg-white/10 [&>button]:rounded-full [&>button]:top-5"
        >

          {/* Header */}
          <DialogHeader className="bg-[#422a3c] text-white text-center py-5 px-6 flex-shrink-0 rounded-t-xl">
            <DialogTitle className="text-xl text-center font-bold flex items-center justify-center gap-2">
              <img src="/uploads/calendar (2) 2.png" alt="calendar" className="h-5 w-5" />
              Appointment Confirmation
            </DialogTitle>
            <DialogDescription className="text-center mt-1 text-sm text-white/80">
              Please review and confirm your booking
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-5 space-y-4 bg-muted/20">

            {/* Salon Info */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <img src="/uploads/salon 1.png" alt="salon" className="h-4 w-4" />
                  Salon Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 pl-8 space-y-2">
                <div className="flex items-center gap-1 font-semibold text-sm">
                  <Dot /> {salonInfo?.name}
                </div>
                <div className="flex flex-nowrap items-center gap-x-6 text-sm text-muted-foreground overflow-x-auto no-scrollbar">
                  {salonInfo?.phone && (
                    <span className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                      <img src="/uploads/telephone (1) 1.png" alt="phone" className="h-3.5 w-3.5" /> {salonInfo.phone}
                    </span>
                  )}
                  {salonInfo?.email && (
                    <span className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                      <img src="/uploads/email (7) 1.png" alt="mail" className="h-3.5 w-3.5" /> {salonInfo.email}
                    </span>
                  )}
                  {salonInfo?.address && (
                    <span className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                      <img src="/uploads/pin (3) 2.png" alt="location" className="h-3.5 w-3.5" /> {salonInfo.address}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Selected Services */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <img src="/uploads/customer-review (2) 1.png" alt="services" className="h-4 w-4" />
                  {selectedWeddingPackage ? 'Selected Package' : 'Selected Services'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 pl-8">
                <div className="divide-y">
                  {selectedWeddingPackage ? (
                    <>
                      <div className="flex flex-nowrap items-center justify-between py-3 gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{selectedWeddingPackage.name}</div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {selectedWeddingPackage.duration || 'Variable duration'}
                          </div>
                        </div>
                        <div className="font-semibold text-primary whitespace-nowrap shrink-0">
                          ₹{weddingPackageMode === 'customized'
                            ? Math.round(totalAmount)
                            : (selectedWeddingPackage.discountedPrice || selectedWeddingPackage.totalPrice)}/-
                        </div>
                      </div>
                      {(weddingPackageMode === 'customized' ? customizedPackageServices : selectedWeddingPackage.services || []).map((service, idx) => {
                        const isFullService = 'id' in service;
                        const key = isFullService ? (service as any).id : (service as any).serviceId;
                        const displayName = isFullService ? (service as any).name : (service as any).serviceName;
                        const displayPrice = isFullService ? (service as any).price : undefined;
                        return (
                          <div key={key || idx} className="flex flex-nowrap items-center justify-between py-3 pl-2 gap-3">
                            <span className="text-sm truncate">{displayName}</span>
                            {displayPrice && <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">₹{displayPrice}/-</span>}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    selectedServices.map((service) => (
                      <div key={service.id}>
                        <div className="flex flex-nowrap items-center justify-between py-3 gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{service.name}</div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">{service.duration}</div>
                          </div>
                          <div className="font-semibold text-primary whitespace-nowrap shrink-0">₹{service.discountedPrice || service.price}/-</div>
                        </div>
                        {service.selectedAddons && service.selectedAddons.length > 0 && (
                          service.selectedAddons.map((addon) => (
                            <div key={addon._id} className="flex flex-nowrap items-center justify-between py-2 pl-4 text-sm text-muted-foreground gap-3">
                              <span className="flex items-center gap-1.5 truncate">
                                <img src="/uploads/discount-code 1.png" alt="addon" className="h-3 w-3 shrink-0" /> {addon.name}
                              </span>
                              <span className="flex items-center gap-2 whitespace-nowrap shrink-0">
                                ₹{addon.price}/-
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRemoveAddon(service.id, addon._id)}
                                >
                                  ×
                                </Button>
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Appointment Details */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <img src="/uploads/calendar (8) 1.png" alt="calendar" className="h-4 w-4" />
                  Appointment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 pl-8">
                <div className="flex flex-nowrap items-start justify-between gap-6">
                  <div className="flex items-start gap-2 min-w-0">
                    <img src="/uploads/calendar (2) 2.png" alt="calendar" className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm whitespace-nowrap">{format(selectedDate, 'd MMMM yyyy')}</div>
                      <div className="text-xs text-muted-foreground">Date</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 min-w-0">
                    <img src="/uploads/day-and-night 1.png" alt="day" className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm whitespace-nowrap">{format(selectedDate, 'EEEE')}</div>
                      <div className="text-xs text-muted-foreground">Day</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 min-w-0">
                    <img src="/uploads/clock (6) 1.png" alt="clock" className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm whitespace-nowrap">{selectedTime}</div>
                      <div className="text-xs text-muted-foreground">Time</div>
                    </div>
                  </div>
                </div>
                {selectedStaff && (
                  <div className="flex flex-nowrap items-center gap-2 mt-4 pt-3 border-t justify-start text-sm whitespace-nowrap">
                    <User className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium">{selectedStaff.name}</span>
                    <span className="text-muted-foreground">— Professional</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Customer Info */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <img src="/uploads/manager 1.png" alt="user" className="h-4 w-4" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 pl-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2 min-w-0">
                    <img src="/uploads/user 1.png" alt="user" className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate whitespace-nowrap">
                        {user ? (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer') : (customerInfo?.name || 'Guest')}
                      </div>
                      <div className="text-xs text-muted-foreground">Name</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 min-w-0">
                    <img src="/uploads/email (7) 1.png" alt="mail" className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate whitespace-nowrap">{user?.email || customerInfo?.email || 'N/A'}</div>
                      <div className="text-xs text-muted-foreground">Mail</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 min-w-0">
                    <img src="/uploads/telephone (1) 1.png" alt="phone" className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate whitespace-nowrap">{user?.mobileNo || user?.phone || customerInfo?.phone || 'N/A'}</div>
                      <div className="text-xs text-muted-foreground">Contact</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 min-w-0">
                    <img src="/uploads/pin (3) 2.png" alt="pin" className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate whitespace-nowrap">{serviceLocation?.address ? serviceLocation.address : 'At Salon'}</div>
                      <div className="text-xs text-muted-foreground">{serviceLocation ? 'Home Service Location' : 'Address'}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Summary */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <img src="/uploads/secure-payment 1.png" alt="payment" className="h-4 w-4" />
                  Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 pl-8 space-y-2">
                <div className="flex flex-nowrap items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="whitespace-nowrap"><img src="/uploads/rupee42.png" alt="rupee" className="inline-block h-4 w-4 mr-1 align-text-bottom" />{priceBreakdown?.subtotal ? priceBreakdown.subtotal.toFixed(2) : totalAmount.toFixed(2)}/-</span>
                </div>
                {priceBreakdown && priceBreakdown.platformFee > 0 && (
                  <div className="flex flex-nowrap items-center justify-between text-sm gap-3">
                    <span className="text-muted-foreground truncate">
                      Platform Fee {
                        priceBreakdown.taxFeeSettings?.platformFeeType === 'fixed'
                          ? `(₹${priceBreakdown.taxFeeSettings.platformFee})`
                          : priceBreakdown.taxFeeSettings?.platformFee != null
                            ? `(${priceBreakdown.taxFeeSettings.platformFee}%)`
                            : ''
                      }
                    </span>
                    <span className="whitespace-nowrap shrink-0"><img src="/uploads/rupee42.png" alt="rupee" className="inline-block h-4 w-4 mr-1 align-text-bottom" />{priceBreakdown.platformFee.toFixed(2)}/-</span>
                  </div>
                )}
                {priceBreakdown && priceBreakdown.serviceTax > 0 && (
                  <div className="flex flex-nowrap items-center justify-between text-sm gap-3">
                    <span className="text-muted-foreground truncate">
                      GST &amp; Other Taxes {
                        priceBreakdown.taxFeeSettings?.serviceTaxType === 'fixed'
                          ? `(₹${priceBreakdown.taxFeeSettings.serviceTax})`
                          : priceBreakdown.taxFeeSettings?.serviceTax != null
                            ? `(${priceBreakdown.taxFeeSettings.serviceTax}%)`
                            : ''
                      }
                    </span>
                    <span className="whitespace-nowrap shrink-0"><img src="/uploads/rupee42.png" alt="rupee" className="inline-block h-4 w-4 mr-1 align-text-bottom" />{priceBreakdown.serviceTax.toFixed(2)}/-</span>
                  </div>
                )}
                {appliedOffer && (
                  <div className="flex flex-nowrap items-center justify-between text-sm text-green-600 gap-3">
                    <span className="flex items-center gap-1 truncate">
                      <img src="/uploads/discount-code 1.png" alt="discount" className="h-3 w-3 shrink-0" /> Discount ({appliedOffer.code})
                    </span>
                    <span className="whitespace-nowrap shrink-0">-₹{(priceBreakdown?.discountAmount || (appliedOffer.type === 'percentage' ? (totalAmount * appliedOffer.value) / 100 : appliedOffer.value)).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex flex-nowrap items-center justify-between pt-3 border-t">
                  <span className="font-semibold text-green-600">Total Amount</span>
                  <span className="font-bold text-lg text-green-600 whitespace-nowrap">
                    <img src="/uploads/rupee42.png" alt="rupee" className="inline-block h-5 w-5 mr-1 align-text-bottom" />{priceBreakdown?.finalTotal
                      ? priceBreakdown.finalTotal.toFixed(2)
                      : (totalAmount + (priceBreakdown?.platformFee || 0) + (priceBreakdown?.serviceTax || 0) - (priceBreakdown?.discountAmount || (appliedOffer ? (appliedOffer.type === 'percentage' ? (totalAmount * appliedOffer.value) / 100 : appliedOffer.value) : 0))).toFixed(2)}/-
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Discount Code */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <img src="/uploads/discount-code 1.png" alt="star" className="h-4 w-4" />
                  Apply Discount Code
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 pl-8 space-y-3">
                <div className="flex flex-nowrap gap-2 relative">
                  <div className="flex-1 min-w-0">
                    <input
                      id="offer-input"
                      type="text"
                      placeholder="Enter discount code"
                      value={offerCode}
                      onChange={(e) => setOfferCode(e.target.value.toUpperCase())}
                      onFocus={() => filteredOffers && filteredOffers.length > 0 && setShowOfferDropdown(true)}
                      className="w-full px-4 py-2.5 border rounded-md text-sm bg-muted/30 focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                    {showOfferDropdown && filteredOffers && filteredOffers.length > 0 && (
                      <div id="offer-dropdown" className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto no-scrollbar">
                        {filteredOffers.map((offer) => {
                          const isApplicable = isOfferApplicable(offer, selectedServices);
                          return (
                            <div
                              key={offer._id}
                              className={`px-4 py-2.5 border-b last:border-b-0 flex flex-nowrap justify-between items-center gap-3 ${isApplicable ? "hover:bg-primary/5 cursor-pointer" : "opacity-60 bg-gray-50/50 cursor-not-allowed"
                                }`}
                              onClick={() => { if (isApplicable) { handleSelectOffer(offer); setShowOfferDropdown(false); } }}
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">{offer.code}</div>
                                <div className="text-xs text-muted-foreground whitespace-nowrap">
                                  {offer.type === 'percentage' ? `${offer.value}% off` : `₹${offer.value} off`}
                                </div>
                              </div>
                              <span className="text-xs font-medium text-primary whitespace-nowrap shrink-0">
                                {isApplicable ? 'Click to apply' : 'Disabled'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <Button onClick={handleApplyOffer} disabled={!offerCode.trim()} className="bg-primary hover:bg-primary/90 px-6 shrink-0">
                    {isOffersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>

                {appliedOffer && (
                  <div className="bg-primary/10 border border-primary p-3 rounded-md text-sm flex flex-nowrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-primary text-sm truncate">{appliedOffer.code}</div>
                      <div className="text-primary text-xs whitespace-nowrap">
                        {appliedOffer.type === 'percentage' ? `${appliedOffer.value}% off` : `₹${appliedOffer.value} off`}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleClearOffer} className="h-6 w-6 p-0 text-primary hover:bg-primary/20 shrink-0">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {!appliedOffer && vendorOffers && vendorOffers.length > 0 && (
                  vendorOffers.slice(0, 1).map((offer) => (
                    <div
                      key={offer._id}
                      className="flex flex-nowrap items-center justify-between px-4 py-2.5 border rounded-md cursor-pointer hover:bg-primary/5 gap-3"
                      onClick={() => handleSelectOffer(offer)}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{offer.code}</div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {offer.type === 'percentage' ? `${offer.value}% off` : `₹${offer.value} off`}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-primary whitespace-nowrap shrink-0">Click to apply</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          <DialogFooter className="flex-shrink-0 sm:justify-end gap-3 py-4 border-t px-6 bg-white">
            <Button variant="outline" onClick={() => setIsConfirmationModalOpen(false)} className="px-6">
              <ChevronsLeft className="h-4 w-4 mr-2" />
              Edit Details
            </Button>
            <Button
              onClick={() => { setIsConfirmationModalOpen(false); setIsPaymentModalOpen(true); }}
              className="bg-primary hover:bg-primary/90 px-6"
            >
              Confirm & Proceed
              <ChevronsRight className="h-4 w-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Schedule Dialog */}
      <Dialog open={isServiceScheduleOpen} onOpenChange={setIsServiceScheduleOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Service Schedule</DialogTitle>
            <DialogDescription className="text-center">
              Review your service schedule before confirming your appointment
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {/* Service Schedule Card */}
            <Card className="bg-background/80 border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Detailed Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {serviceSchedule.map((schedule, index) => (
                  <div key={index} className="flex justify-between items-start border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <div className="font-semibold text-lg">{schedule.service.name}</div>
                      <div className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
                        <User className="h-3 w-3" />
                        with {schedule.staff ? schedule.staff.name : 'Any Professional'}
                      </div>
                      <div className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {schedule.startTime} - {schedule.endTime} ({schedule.duration} min)
                      </div>
                    </div>
                    <div className="text-right">
                      {schedule.service.discountedPrice !== null && schedule.service.discountedPrice !== undefined && schedule.service.discountedPrice !== schedule.service.price ? (
                        <>
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-muted-foreground line-through text-sm">
                              ₹{Math.round(Number(schedule.service.price))}
                            </span>
                            <span className="font-semibold text-lg">
                              ₹{Math.round(Number(schedule.service.discountedPrice))}
                            </span>
                          </div>
                          <div className="text-xs text-green-600 font-medium mt-1">
                            {(() => {
                              const originalPrice = parseFloat(schedule.service.price);
                              const discountedPrice = parseFloat(schedule.service.discountedPrice || '0');
                              if (originalPrice > 0) {
                                return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
                              }
                              return 0;
                            })()}% OFF
                          </div>
                        </>
                      ) : (
                        <div className="font-semibold text-lg">
                          ₹{Math.round(Number(schedule.service.price))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-primary/80">Total Amount</div>
                    <div className="text-2xl font-bold text-primary">
                      ₹{priceBreakdown?.finalTotal ? Math.round(priceBreakdown.finalTotal) : Math.round(selectedServices.reduce((acc, s) => {
                        const price = s.discountedPrice !== null && s.discountedPrice !== undefined ?
                          parseFloat(s.discountedPrice) :
                          parseFloat(s.price || '0');
                        return acc + price;
                      }, 0))}
                    </div>
                  </div>
                  <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                    {serviceSchedule.length} {serviceSchedule.length === 1 ? 'Service' : 'Services'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsServiceScheduleOpen(false)} className="w-full">
              Continue to Confirmation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Schedule Dialog */}
      <Dialog open={isStaffScheduleOpen} onOpenChange={setIsStaffScheduleOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Staff Schedule</DialogTitle>
            <DialogDescription className="text-center">Review your staff schedule before confirming.</DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Staff Schedule Card */}
            <div>
              <Card className="bg-background/80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Staff Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {staffSchedule.map((schedule, index) => (
                    <div key={index} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                      <div>
                        <div className="font-semibold">{schedule.staff.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {schedule.startTime} - {schedule.endTime}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">Available</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsStaffScheduleOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Form */}
      <Dialog open={isLocationFormOpen} onOpenChange={setIsLocationFormOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Enter Home Service Location</DialogTitle>
            <DialogDescription className="text-center">Please enter the address where you would like the service to be provided.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="Enter your address"
                value={locationForm.address}
                onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="Enter your city"
                value={locationForm.city}
                onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                placeholder="Enter your pincode"
                value={locationForm.pincode}
                onChange={(e) => setLocationForm({ ...locationForm, pincode: e.target.value })}
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsLocationFormOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleLocationFormSubmit} className="bg-primary hover:bg-primary/90">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Info Form */}
      <Dialog open={isCustomerInfoFormOpen} onOpenChange={setIsCustomerInfoFormOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Enter Customer Information</DialogTitle>
            <DialogDescription className="text-center">Please enter the customer's details for the appointment.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Enter customer's name"
                value={customerInfoForm.name}
                onChange={(e) => setCustomerInfoForm({ ...customerInfoForm, name: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="Enter customer's phone number"
                value={customerInfoForm.phone}
                onChange={(e) => setCustomerInfoForm({ ...customerInfoForm, phone: e.target.value })}
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCustomerInfoFormOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCustomerInfoFormSubmit} className="bg-primary hover:bg-primary/90">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Selection Dialog */}
      <Dialog open={isStaffSelectionOpen} onOpenChange={setIsStaffSelectionOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Select Professional</DialogTitle>
            <DialogDescription className="text-center">Please select a professional for the appointment.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="staff">Professional</Label>
              <Select
                value={selectedStaffId}
                onValueChange={(value) => setSelectedStaffId(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a professional" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsStaffSelectionOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleStaffSelection} className="bg-primary hover:bg-primary/90">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Time Selection Dialog */}
      <Dialog open={isTimeSelectionOpen} onOpenChange={setIsTimeSelectionOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Select Time</DialogTitle>
            <DialogDescription className="text-center">Please select a time for the appointment.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="time">Time</Label>
              <Select
                value={selectedTime || undefined}
                onValueChange={(value) => setSelectedTime(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a time" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsTimeSelectionOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleTimeSelection} className="bg-primary hover:bg-primary/90">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Date Selection Dialog */}
      <Dialog open={isDateSelectionOpen} onOpenChange={setIsDateSelectionOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Select Date</DialogTitle>
            <DialogDescription className="text-center">Please select a date for the appointment.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="date">Date</Label>
              <DatePicker
                selected={selectedDate}
                onChange={(date: Date | null) => date && setSelectedDate(date)}
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsDateSelectionOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleDateSelection} className="bg-primary hover:bg-primary/90">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Selection Dialog */}
      <Dialog open={isServiceSelectionOpen} onOpenChange={setIsServiceSelectionOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Select Services</DialogTitle>
            <DialogDescription className="text-center">Please select the services for the appointment.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="services">Services</Label>
              <Select
                value={selectedServiceIds[0] || ''}
                onValueChange={(value) => setSelectedServiceIds([value])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select services" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsServiceSelectionOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleServiceSelection} className="bg-primary hover:bg-primary/90">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Selection Dialog */}
      <Dialog open={isVendorSelectionOpen} onOpenChange={setIsVendorSelectionOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Select Vendor</DialogTitle>
            <DialogDescription className="text-center">Please select a vendor for the appointment.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Select
                value={selectedVendorId}
                onValueChange={(value) => setSelectedVendorId(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsVendorSelectionOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleVendorSelection} className="bg-primary hover:bg-primary/90">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Google Map Selector Modal for Wedding Package Location */}
      <Dialog open={showMapSelector} onOpenChange={setShowMapSelector}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Select Wedding Venue Location</DialogTitle>
            <DialogDescription>
              Click on the map to select the exact location of your wedding venue.
            </DialogDescription>
          </DialogHeader>
          <div className="h-[500px] w-full">
            <GoogleMapSelector
              onLocationSelect={(lat, lng) => {
                console.log('Location selected from map:', { lat, lng });
                console.log('Is wedding package:', !!selectedWeddingPackage);
                console.log('Is authenticated:', isAuthenticated);

                // Fetch address from coordinates
                fetchAddressDetails(lat, lng);

                setServiceLocation({
                  address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, // Temporary, will be updated by fetchAddressDetails
                  coordinates: { lat, lng }
                });

                setLocationForm(prev => ({
                  ...prev,
                  lat,
                  lng
                }));
              }}
              initialLat={serviceLocation?.coordinates?.lat || locationForm.lat}
              initialLng={serviceLocation?.coordinates?.lng || locationForm.lng}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMapSelector(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                console.log('=== Location Confirm Button Clicked ===');
                console.log('Location Form:', locationForm);
                console.log('Selected Wedding Package:', selectedWeddingPackage);
                console.log('Selected Time:', selectedTime);
                console.log('Booking Mode:', bookingMode);

                if (!locationForm.lat || !locationForm.lng) {
                  toast.error('Please select a location on the map');
                  return;
                }

                if (!selectedTime) {
                  toast.error('Please select a time slot first');
                  setShowMapSelector(false);
                  setCurrentStep(3);
                  return;
                }

                // Set the home service location from the location form
                const newLocation = {
                  address: locationForm.address,
                  city: locationForm.city,
                  state: locationForm.state,
                  pincode: locationForm.pincode,
                  landmark: locationForm.landmark,
                  coordinates: {
                    lat: locationForm.lat,
                    lng: locationForm.lng
                  }
                };

                console.log('Setting serviceLocation to:', newLocation);
                setServiceLocation(newLocation);

                // Close map modal
                setShowMapSelector(false);
                toast.success('Location selected successfully. Click "Continue to Confirmation" to proceed.');

                console.log('Location saved. User can now click Continue to Confirmation button.');
              }}
              disabled={!locationForm.lat || !locationForm.lng}
            >
              Confirm Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Method Selection Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="text-center pb-4">
            <div className="mx-auto p-3 rounded-full mb-3" style={{ background: '#EBF3FD' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/secure-payment 1.png" alt="Payment" className="h-6 w-6 object-contain" />
            </div>
            <DialogTitle className="text-2xl text-center font-bold">Select Payment Method</DialogTitle>
            <DialogDescription className="text-center mt-2 text-muted-foreground">
              Choose how you'd like to pay for your appointment
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Display Total Amount */}
            <Card className="border-2 border-primary/20" style={{ background: '#EBF3FD' }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="text-2xl font-bold text-primary">
                    ₹{Math.round(priceBreakdown?.finalTotal || (totalAmount + (priceBreakdown?.platformFee || 0) + (priceBreakdown?.serviceTax || 0) - (priceBreakdown?.discountAmount || (appliedOffer ? (appliedOffer.type === 'percentage' ? (totalAmount * appliedOffer.value) / 100 : appliedOffer.value) : 0))))}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Payment Method Options */}
            <div className="grid grid-cols-2 gap-4">
              <Card
                className={`cursor-pointer transition-all ${paymentMethod === 'Pay at Salon' ? 'border-2 border-primary' : 'border-2 border-muted hover:border-primary/50'}`}
                style={paymentMethod === 'Pay at Salon' ? { background: '#EBF3FD' } : {}}
                onClick={() => setPaymentMethod('Pay at Salon')}
              >
                <CardContent className="p-6 text-center space-y-3">
                  <div className="mx-auto p-3 rounded-full w-fit" style={{ background: '#EBF3FD' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/Group 1000002556 (5).png" alt="Pay at Salon" className="h-6 w-6 object-contain" />
                  </div>
                  <div className="font-semibold text-lg">Pay at Salon</div>
                  <div className="text-muted-foreground text-sm">Pay with cash or card after your service</div>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all ${paymentMethod === 'Pay Online' ? 'border-2 border-primary' : 'border-2 border-muted hover:border-primary/50'}`}
                style={paymentMethod === 'Pay Online' ? { background: '#EBF3FD' } : {}}
                onClick={() => setPaymentMethod('Pay Online')}
              >
                <CardContent className="p-6 text-center space-y-3">
                  <div className="mx-auto p-3 rounded-full w-fit" style={{ background: '#EBF3FD' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/credit-card (3).png" alt="Pay Online" className="h-6 w-6 object-contain" />
                  </div>
                  <div className="font-semibold text-lg">Pay Online</div>
                  <div className="text-muted-foreground text-sm">Securely pay now using UPI, Card, or Netbanking</div>
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter className="sm:justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsPaymentModalOpen(false);
                setIsConfirmationModalOpen(true);
              }}
              className="px-6"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleFinalBookingConfirmation}
              className="bg-primary hover:bg-primary/90 px-6"
              disabled={isConfirmingBooking}
            >
              {isConfirmingBooking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  Confirm Booking
                  <Check className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Empty placeholder - modals are already defined above */}
    </div>
  );
}

export default function BookingPageWrapper() {
  console.log('BookingPageWrapper - Component rendered');
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BookingPageContent />
    </Suspense>
  );
}
