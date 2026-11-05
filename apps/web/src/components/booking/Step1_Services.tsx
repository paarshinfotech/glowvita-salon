"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { Card } from '@repo/ui/card';
import { Button } from '@repo/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/select';
import { Plus, Check, Scissors, Loader2, AlertCircle, Heart, Users, X, Clock, List, User } from 'lucide-react';
import { cn } from '@repo/ui/cn';
import { ChevronRight } from 'lucide-react';
import { Service, WeddingPackage } from '@/hooks/useBookingData';
import { isOfferApplicable } from '@repo/lib/utils';
import { useParams } from 'next/navigation';
import { useGetPublicVendorStaffQuery } from '@repo/store/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/dialog';
import { Checkbox } from "@repo/ui/checkbox";
import { Label } from "@repo/ui/label";

const Breadcrumb = ({ currentStep, setCurrentStep, isWeddingPackage }: {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  isWeddingPackage?: boolean;
}) => {
  const steps = isWeddingPackage
    ? { 1: 'Select Package', 3: 'Select Date & Time', 4: 'Confirm Booking' }
    : { 1: 'Services', 2: 'Select Professional', 3: 'Time Slot' };

  const currentStepName = (steps as any)[currentStep] || 'Booking';

  return (
    <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 mb-6 shadow-sm">
      <nav className="flex items-center text-xs sm:text-sm font-medium text-muted-foreground flex-wrap gap-y-2">
        {Object.values(steps).map((step, index) => {
          const targetStep = isWeddingPackage
            ? (index === 0 ? 1 : index === 1 ? 3 : 4)
            : index + 1;

          return (
            <React.Fragment key={step as string}>
              <button
                onClick={() => currentStep > targetStep && setCurrentStep(targetStep)}
                className={cn(
                  "transition-colors",
                  currentStep > targetStep ? "hover:text-primary" : "cursor-default",
                  currentStep === targetStep && "text-primary font-bold bg-white px-2 py-0.5 rounded-md shadow-sm border border-primary/10"
                )}
              >
                {step as string}
              </button>
              {index < Object.keys(steps).length - 1 && <ChevronRight className="h-4 w-4 mx-1 sm:mx-2 text-muted-foreground/50" />}
            </React.Fragment>
          );
        })}
      </nav>
    </div>
  );
};

// Default categories as fallback
const defaultCategories = [
  { name: "All" },
  { name: "Hair" },
  { name: "Skin" },
  { name: "Nails" },
  { name: "Body" },
  { name: "Massage" },
  { name: "Waxing" },
  { name: "Facials" }
];

interface Step1ServicesProps {
  selectedServices: Service[];
  onSelectService: (service: Service) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  services: Service[];
  servicesByCategory: { [key: string]: Service[] };
  categories: { name: string }[];
  isLoading: boolean;
  error?: any;
  onServiceSelect?: (service: Service) => void;
  weddingPackages?: WeddingPackage[];
  onWeddingPackageSelect?: (pkg: WeddingPackage | null) => void;
  selectedWeddingPackage?: WeddingPackage | null;
  weddingPackageMode?: 'default' | 'customized' | null;
  bookingMode: 'salon' | 'home';
  setBookingMode: (mode: 'salon' | 'home') => void;
  /** Which tab to show on first render. Defaults to 'services'. Pass 'packages' when navigating from a wedding package Book button. */
  initialViewMode?: 'services' | 'packages';
  priceBreakdown?: any;
  taxFeeSettings?: any;
  onClearServices?: () => void;
  appliedOffer?: any;
  /** List of all vendor offers – used to find the matching offer by offerCodeFromUrl instantly */
  vendorOffers?: any[];
  /** Offer code from the URL query param (from Special Offer click) */
  offerCodeFromUrl?: string | null;
}

export function Step1_Services({
  selectedServices,
  onSelectService,
  currentStep,
  setCurrentStep,
  services,
  servicesByCategory,
  categories,
  isLoading,
  error,
  onServiceSelect,
  weddingPackages = [],
  onWeddingPackageSelect,
  selectedWeddingPackage,
  weddingPackageMode,
  bookingMode,
  setBookingMode,
  initialViewMode = 'services',
  priceBreakdown,
  taxFeeSettings,
  onClearServices,
  appliedOffer,
  vendorOffers,
  offerCodeFromUrl,
}: Step1ServicesProps) {
  // Get vendor ID from URL params
  const params = useParams();
  const vendorId = params?.salonId as string;

  // Fetch staff data for the vendor to resolve staff IDs to names
  const { data: staffData, isLoading: isStaffLoading } = useGetPublicVendorStaffQuery(vendorId, {
    skip: !vendorId,
  });

  console.log('Raw Staff Data:', staffData);
  console.log('Staff Data Structure:', {
    hasData: !!staffData,
    hasDataProperty: !!(staffData as any)?.data,
    isArray: Array.isArray(staffData),
    isDataArray: Array.isArray((staffData as any)?.data),
    keys: staffData ? Object.keys(staffData) : [],
    firstItem: staffData ? (Array.isArray(staffData) ? staffData[0] : (staffData as any)?.data?.[0]) : null
  });

  // Create a staff lookup map for quick ID to name resolution
  const staffLookup = useMemo(() => {
    console.log('Creating staff lookup from:', staffData);

    if (!staffData) {
      console.log('No staff data available');
      return {};
    }

    const lookup: { [key: string]: string } = {};

    // Try multiple data structure patterns
    let staffArray: any[] = [];

    if (Array.isArray(staffData)) {
      staffArray = staffData;
    } else if ((staffData as any)?.data && Array.isArray((staffData as any).data)) {
      staffArray = (staffData as any).data;
    } else if ((staffData as any)?.staff && Array.isArray((staffData as any).staff)) {
      staffArray = (staffData as any).staff;
    }

    console.log('Staff Array to process:', staffArray, 'Length:', staffArray.length);

    if (staffArray.length > 0) {
      staffArray.forEach((staff: any, index: number) => {
        console.log(`Processing staff ${index}:`, staff);

        if (staff) {
          // Try all possible ID fields
          const staffId = staff._id || staff.id || staff.staffId;
          // Try all possible name fields
          const staffName = staff.name || staff.fullName || staff.staffName || staff.firstName
            || (staff.firstName && staff.lastName ? `${staff.firstName} ${staff.lastName}` : null);

          console.log(`Staff ${index} - ID: ${staffId}, Name: ${staffName}`);

          if (staffId && staffName) {
            lookup[String(staffId)] = staffName;
          }
        }
      });
    }

    console.log('Final Staff Lookup Map:', lookup);
    return lookup;
  }, [staffData]);

  // Create a staff position lookup map for quick ID to position resolution
  const staffPositionLookup = useMemo(() => {
    if (!staffData) return {};

    const posLookup: { [key: string]: string } = {};
    let staffArray: any[] = [];

    if (Array.isArray(staffData)) {
      staffArray = staffData;
    } else if ((staffData as any)?.data && Array.isArray((staffData as any).data)) {
      staffArray = (staffData as any).data;
    } else if ((staffData as any)?.staff && Array.isArray((staffData as any).staff)) {
      staffArray = (staffData as any).staff;
    }

    staffArray.forEach((staff: any) => {
      if (staff) {
        const staffId = staff._id || staff.id || staff.staffId;
        // Try all possible position/role fields
        const staffPosition =
          staff.position ||
          staff.role ||
          staff.designation ||
          staff.specialization ||
          staff.jobTitle ||
          staff.title ||
          '';
        if (staffId) {
          posLookup[String(staffId)] = staffPosition;
        }
      }
    });

    return posLookup;
  }, [staffData]);

  // Helper function to get staff position from ID or object
  const getStaffPosition = (staff: any): string => {
    if (typeof staff === 'string') {
      return staffPositionLookup[staff] || '';
    }
    if (staff && typeof staff === 'object') {
      const staffId = staff._id || staff.id || staff.staffId;
      if (staffId && staffPositionLookup[String(staffId)]) {
        return staffPositionLookup[String(staffId)];
      }
      return (
        staff.position ||
        staff.role ||
        staff.designation ||
        staff.specialization ||
        staff.jobTitle ||
        staff.title ||
        ''
      );
    }
    return '';
  };

  // Helper function to get staff name from ID with fallback
  const getStaffName = (staff: any): string => {
    console.log('Getting staff name for:', staff);

    // If staff is already a string, treat it as an ID and look it up
    if (typeof staff === 'string') {
      const resolvedName = staffLookup[staff];
      console.log(`Resolved ID "${staff}" to name:`, resolvedName);
      return resolvedName || staff || 'Staff Member';
    }

    // If staff is an object, try to extract information
    if (staff && typeof staff === 'object') {
      // First try to get the ID and look it up
      const staffId = staff._id || staff.id || staff.staffId;
      if (staffId && staffLookup[String(staffId)]) {
        console.log(`Found staff name in lookup for ID ${staffId}:`, staffLookup[String(staffId)]);
        return staffLookup[String(staffId)];
      }

      // Try to get name directly from the object
      const directName = staff.name || staff.fullName || staff.staffName || staff.firstName
        || (staff.firstName && staff.lastName ? `${staff.firstName} ${staff.lastName}` : null);

      if (directName) {
        console.log('Found staff name directly from object:', directName);
        return directName;
      }
    }

    console.log('Falling back to default Staff Member');
    return 'Staff Member';
  };

  // Ensure weddingPackages is always an array and filter out nulls
  const safeWeddingPackages = Array.isArray(weddingPackages) ? weddingPackages.filter(Boolean) : [];

  // Additional check to ensure we have valid wedding packages
  // Relaxed validation: Allow packages that have EITHER id OR _id, and a name
  const validWeddingPackages = safeWeddingPackages.filter(pkg =>
    (pkg.id || pkg._id) && pkg.name
  );
  const [activeCategory, setActiveCategory] = useState("All");
  const [viewMode, setViewMode] = useState<'services' | 'packages'>(initialViewMode);

  // Sync viewMode with initialViewMode prop updates
  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  // Sync viewMode with selectedWeddingPackage prop updates
  useEffect(() => {
    if (selectedWeddingPackage) {
      setViewMode('packages');
    }
  }, [selectedWeddingPackage]);
  const [selectedPackageForDetails, setSelectedPackageForDetails] = useState<WeddingPackage | null>(null);
  const [packageToConfirm, setPackageToConfirm] = useState<WeddingPackage | null>(null);
  // Removed: showHomeServiceModal, selectedHomeService state - no longer needed with strictly enforced mode
  // Replaced: internal bookingMode with prop
  // const [bookingMode, setBookingMode] = useState<'salon' | 'home'>('salon');

  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [currentServiceForAddons, setCurrentServiceForAddons] = useState<Service | null>(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  // Use provided categories or fallback to default
  const displayCategories = categories?.length > 0 ? categories : defaultCategories;

  // Calculate services to display based on category
  const servicesToDisplay = activeCategory === "All"
    ? (services || [])
    : (servicesByCategory[activeCategory] || []);

  console.log('Step1_Services debug:', {
    servicesCount: services?.length,
    firstService: services?.[0],
    firstServiceAddons: services?.[0]?.addOns
  });

  // Use valid wedding packages
  const displayWeddingPackages = validWeddingPackages;

  // Resolve the active offer for per-service eligibility.
  // Prefer appliedOffer (already validated) — fall back to finding it in vendorOffers by code
  // so restrictions apply immediately when arriving from a Special Offer link.
  const activeOffer = useMemo(() => {
    if (appliedOffer) return appliedOffer;
    if (offerCodeFromUrl && vendorOffers && vendorOffers.length > 0) {
      const normalizedTarget = offerCodeFromUrl.toUpperCase().trim();
      const found = vendorOffers.find((o: any) => {
        // Support both 'code' and 'offerCode' field names used by different APIs
        const c = (o?.code || o?.offerCode || '')?.toUpperCase().trim();
        return c === normalizedTarget;
      });
      if (!found) {
        console.warn('[Step1_Services] No matching offer found for code:', offerCodeFromUrl,
          '| Available codes:', vendorOffers.map((o: any) => o?.code || o?.offerCode));
      }
      return found || null;
    }
    return null;
  }, [appliedOffer, offerCodeFromUrl, vendorOffers]);

  // Handle service selection
  const handleSelectService = (service: Service) => {
    // Check if service is available for home or wedding (support both formats)
    const isHomeService = service.homeService?.available || service.serviceHomeService?.available;
    const isWeddingService = service.weddingService?.available || service.serviceWeddingService?.available;

    // ENFORCED MODE LOGIC
    if (bookingMode === 'home') {
      // If in Home Mode, can ONLY select home-available services
      if (!isHomeService) {
        console.warn("Cannot select salon-only service in Home booking mode");
        return;
      }
    }

    // Prepare service with option based on mode
    const serviceWithOption = {
      ...service,
      selectedServiceOption: bookingMode === 'home' ? ('home' as const) : ('salon' as const)
    };

    // Check if service has add-ons and is not already selected (to allow toggling off)
    // If it's already selected, we just toggle it off (remove it), no need to show add-ons modal again
    // Unless we want to allow editing add-ons? For now, standard behavior is remove.
    const isSelected = selectedServices.some(s => s.id === service.id);

    if (!isSelected && service.addOns && service.addOns.length > 0) {
      setCurrentServiceForAddons(serviceWithOption);
      setSelectedAddonIds([]); // Reset selected add-ons
      setIsAddonModalOpen(true);
    } else {
      // If no add-ons or already selected (deselecting), proceed normally
      onSelectService(serviceWithOption);
    }
  };

  const confirmAddonSelection = () => {
    if (currentServiceForAddons) {
      const selectedAddonsList = currentServiceForAddons.addOns?.filter(addon =>
        selectedAddonIds.includes(addon._id)
      ) || [];

      const originalService = services.find(s => s.id === currentServiceForAddons.id);
      const baseDurationString = originalService ? (originalService.duration) : (currentServiceForAddons.duration);
      const baseDuration = parseInt(String(baseDurationString).match(/\d+/)?.[0] || '0', 10);

      const totalAddonsDuration = selectedAddonsList.reduce((total, addon) => total + (addon.duration || 0), 0);

      const serviceWithAddons = {
        ...currentServiceForAddons,
        selectedAddons: selectedAddonsList,
        duration: `${baseDuration + totalAddonsDuration} min`,
      };

      onSelectService(serviceWithAddons);
      setIsAddonModalOpen(false);
      setCurrentServiceForAddons(null);
      setSelectedAddonIds([]);
    }
  };

  const skipAddonSelection = () => {
    if (currentServiceForAddons) {
      onSelectService({ ...currentServiceForAddons, selectedAddons: [] }); // Add without add-ons
      setIsAddonModalOpen(false);
      setCurrentServiceForAddons(null);
      setSelectedAddonIds([]);
    }
  };

  const toggleAddon = (addonId: string) => {
    setSelectedAddonIds(prev =>
      prev.includes(addonId)
        ? prev.filter(id => id !== addonId)
        : [...prev, addonId]
    );
  };

  // Removed: handleHomeServiceOptionSelect, handleModalCancel - no longer needed

  // Handle wedding package selection with confirmation
  const handleSelectWeddingPackage = (pkg: WeddingPackage | null) => {
    const isCurrentlySelected = !!selectedWeddingPackage &&
      (selectedWeddingPackage.id === (pkg?.id || pkg?._id) || selectedWeddingPackage._id === (pkg?.id || pkg?._id));

    if (onWeddingPackageSelect) {
      if (isCurrentlySelected || pkg === null) {
        // Deselect without confirmation
        onWeddingPackageSelect(null);
      } else {
        // Show confirmation dialog before selecting
        setPackageToConfirm(pkg);
      }
    }
  };

  // Confirm package selection
  const confirmPackageSelection = () => {
    if (packageToConfirm && onWeddingPackageSelect) {
      onWeddingPackageSelect(packageToConfirm);
    }
    setPackageToConfirm(null);
  };

  // Check availability before any returns
  const hasServices = services && services.length > 0;
  const hasWeddingPackages = validWeddingPackages && validWeddingPackages.length > 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full">
        <Breadcrumb currentStep={currentStep} setCurrentStep={setCurrentStep} isWeddingPackage={!!selectedWeddingPackage} />
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-primary/10 rounded-full text-primary">
              <Scissors className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-bold font-headline">Select Your Services</h2>
          </div>
          <p className="text-muted-foreground">Choose one or more services you'd like to book.</p>
        </div>

        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading services...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full">
        <Breadcrumb currentStep={currentStep} setCurrentStep={setCurrentStep} isWeddingPackage={!!selectedWeddingPackage} />
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-primary/10 rounded-full text-primary">
              <Scissors className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-bold font-headline">Select Your Services</h2>
          </div>
          <p className="text-muted-foreground">Choose one or more services you'd like to book.</p>
        </div>

        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-muted-foreground">Unable to load services. Please try again.</p>
          </div>
        </div>
      </div>
    );
  }

  // No services or packages available - check after loading/error states
  if (!hasServices && !hasWeddingPackages) {
    return (
      <div className="w-full">
        <Breadcrumb currentStep={currentStep} setCurrentStep={setCurrentStep} isWeddingPackage={!!selectedWeddingPackage} />
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-primary/10 rounded-full text-primary">
              <Scissors className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-bold font-headline">Select Your Services</h2>
          </div>
          <p className="text-muted-foreground">Choose one or more services you'd like to book.</p>
        </div>

        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Scissors className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No services or wedding packages available at this salon.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1 cursor-pointer w-fit" onClick={() => window.history.back()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/back 1.png" alt="back" className="h-5 w-5" />
          <h2 className="text-2xl font-bold font-headline text-black">
            {viewMode === 'services' ? 'Select Your Services' : 'Choose Wedding Package'}
          </h2>
        </div>
        <p className="text-sm text-black pl-7">
          {viewMode === 'services'
            ? 'Choose one or more services you\'d like to book.'
            : 'Select from our specially curated wedding packages'}
        </p>
      </div>

      {/* View Mode Tabs */}
      {hasWeddingPackages && (
        <div className="flex gap-2 md:gap-4 mb-6 overflow-x-auto pb-1">
          <button
            onClick={() => {
              setViewMode('services');
              if (onWeddingPackageSelect) onWeddingPackageSelect(null);
            }}
            className="flex items-center gap-1.5 md:gap-2 px-2.5 py-1.5 md:px-4 md:py-2 text-[11px] md:text-sm font-medium whitespace-nowrap transition-colors"
            style={{
              background: viewMode === 'services' ? '#422A3C' : '#ffffff',
              color: viewMode === 'services' ? '#ffffff' : '#374151',
              border: '1px solid #00000082',
              borderRadius: '0.375rem'
            }}
          >
            <Image src="/images/Mask group (3).png" alt="Individual" width={14} height={14} className={viewMode === 'services' ? 'brightness-0 invert' : ''} />
            Individual Services
          </button>
          <button
            onClick={() => {
              setViewMode('packages');
              if (onClearServices) onClearServices();
            }}
            className="flex items-center gap-1.5 md:gap-2 px-2.5 py-1.5 md:px-4 md:py-2 text-[11px] md:text-sm font-medium whitespace-nowrap transition-colors"
            style={{
              background: viewMode === 'packages' ? '#422A3C' : '#ffffff',
              color: viewMode === 'packages' ? '#ffffff' : '#374151',
              border: '1px solid #00000082',
              borderRadius: '0.375rem'
            }}
          >
            <Image src="/images/like (1) 1.png" alt="Wedding" width={14} height={14} className={viewMode === 'packages' ? 'brightness-0 invert' : ''} />
            Wedding Packages
            {displayWeddingPackages.length > 0 && (
              <span
                className="ml-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={
                  viewMode === 'packages'
                    ? { background: '#ffffff', color: '#422A3C' }
                    : { background: 'rgba(66,42,60,0.1)', color: '#422A3C' }
                }
              >
                {displayWeddingPackages.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Services View */}
      {viewMode === 'services' && (
        <>
          {/* Booking Mode Switcher - FIRST */}
          <div className="mb-4 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ background: '#EBF3FD' }}>
            <div className="flex items-center gap-3">
              <Image src="/images/calendar (6) 1.png" alt="Calendar" width={24} height={24} />
              <div>
                <h3 className="font-semibold text-black text-sm md:text-base">How would you like to book?</h3>
                <p className="text-xs md:text-sm text-black">Select your preferred services location type</p>
              </div>
            </div>

            <div className="flex bg-white rounded-md p-1 shadow-sm border border-gray-100">
              <button
                onClick={() => setBookingMode('salon')}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                style={{
                  background: bookingMode === 'salon' ? '#422A3C' : 'transparent',
                  color: bookingMode === 'salon' ? '#ffffff' : '#000000'
                }}
              >
                <Image src="/images/Mask group (4).png" alt="Salon" width={16} height={16} className={bookingMode === 'salon' ? 'brightness-0 invert' : ''} />
                Visit Salon
              </button>
              <button
                onClick={() => setBookingMode('home')}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                style={{
                  background: bookingMode === 'home' ? '#422A3C' : 'transparent',
                  color: bookingMode === 'home' ? '#ffffff' : '#000000'
                }}
              >
                <Image src="/images/home (2) 1.png" alt="Home" width={16} height={16} className={bookingMode === 'home' ? 'brightness-0 invert' : ''} />
                Home Service
              </button>
            </div>
          </div>

          {/* Category Dropdown - AFTER booking mode switcher */}
          {displayCategories.length > 1 && (
            <div className="mb-4 w-full max-w-[550px]">
              <Select value={activeCategory} onValueChange={setActiveCategory}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {displayCategories.map((category: { name: string }) => (
                    <SelectItem key={category.name} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Offer-mode banner: shown only when the user arrived via a Special Offer link */}
          {activeOffer && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: '#FFF7ED', border: '1px solid #F59E0B', color: '#92400E' }}>
              <span>🏷️</span>
              <span>
                Offer <strong>{activeOffer.code}</strong> is active.
                Services not eligible for this offer are disabled.
              </span>
            </div>
          )}

          {/* Services List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {servicesToDisplay
              .filter((service: Service) => {
                // In home mode, hide salon-only services entirely
                if (bookingMode === 'home') {
                  const isHomeService = service.homeService?.available || service.serviceHomeService?.available;
                  return !!isHomeService;
                }
                return true; // Visit Salon: show all
              })
              .map((service: Service) => {
                const isSelected = selectedServices.some(s => s.id === service.id);
                // Use true (checkEligibilityOnly) for accurate per-service eligibility
                const isApplicable = activeOffer ? isOfferApplicable(activeOffer, [service], true) : true;

                return (
                  <div
                    key={service.id}
                    className={cn(
                      'flex p-3 rounded-xl transition-shadow relative hover:shadow-md',
                      isSelected ? 'ring-2 shadow-md' : '',
                      isApplicable ? 'cursor-pointer' : 'opacity-75 cursor-not-allowed'
                    )}
                    style={{ border: isSelected ? '1px solid #087326' : '1px solid #00000080', background: 'linear-gradient(90deg, #EBF3FD 0%, #FFFFFF 100%)' }}
                    onClick={() => isApplicable && handleSelectService(service)}
                  >
                    {/* Selected Badge Removed */}

                    {/* Image Section */}
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden flex-shrink-0 mr-3 border border-gray-200">
                      <Image
                        src={service.image || `https://picsum.photos/seed/${service.name}/200/200.png`}
                        alt={service.name}
                        fill
                        className="object-fill"
                        data-ai-hint="beauty service"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `https://picsum.photos/seed/${service.name}/200/200.png`;
                        }}
                      />
                    </div>

                    {/* Content Section */}
                    <div className="flex flex-col flex-1 py-1">
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <div className="flex flex-col">
                          <h4 className="font-medium text-black text-sm sm:text-base pr-2">{service.name}</h4>
                          {!isApplicable && (
                            <span className="text-[10px] text-red-500 font-medium">Not eligible for this offer</span>
                          )}
                        </div>
                        {service.discountedPrice && parseFloat(String(service.discountedPrice)) < parseFloat(String(service.price)) && (
                          <span className="shrink-0 bg-black text-white text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                            Save {Math.round(((parseFloat(String(service.price)) - parseFloat(String(service.discountedPrice))) / parseFloat(String(service.price))) * 100)}%
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Image src="/images/clock (20).png" alt="Time" width={14} height={14} />
                        <span className="text-xs text-black">{service.duration}</span>
                      </div>

                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-1.5">
                          <Image src="/images/rupee (2) 1.png" alt="Price" width={14} height={14} />
                          <span className="text-xs sm:text-sm text-black">
                            {service.discountedPrice && parseFloat(String(service.discountedPrice)) < parseFloat(String(service.price)) ? (
                              <>
                                <span className="line-through text-black mr-1">{service.price}/-</span>
                                <span className="font-bold">{service.discountedPrice}/-</span>
                              </>
                            ) : (
                              <span className="font-bold">{service.price}/-</span>
                            )}
                          </span>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); if (isApplicable) handleSelectService(service); }}
                          disabled={!isApplicable}
                          className={cn(
                            'border h-7 md:h-8 px-2.5 md:px-4 text-[11px] md:text-sm font-medium flex justify-center items-center gap-1 transition-colors rounded-none rounded-tr-xl rounded-bl-xl whitespace-nowrap',
                            isSelected ? 'bg-[#087326]/10 border-[#087326] text-[#087326]' : (isApplicable ? 'hover:bg-gray-50' : 'bg-gray-100 cursor-not-allowed text-gray-400')
                          )}
                          style={isSelected ? { color: '#087326', borderColor: '#087326', backgroundColor: 'rgba(8, 115, 38, 0.1)' } : (isApplicable ? { borderColor: '#422A3C', color: '#422A3C' } : { borderColor: '#9ca3af', color: '#9ca3af' })}
                          title={!isApplicable ? "This offer is not applicable for this service." : ""}
                        >
                          {isSelected ? <><Image src="/images/check 1.png" alt="Selected" width={14} height={14} /> <span className="hidden sm:inline">Selected</span></> : <><Plus className="w-3 h-3 md:w-4 md:h-4" /> Add</>}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}

      {/* Wedding Packages View */}
      {viewMode === 'packages' && (displayWeddingPackages && displayWeddingPackages.length > 0) && (
        <div className="pb-6">
          {displayWeddingPackages && displayWeddingPackages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 md:gap-5">
              {displayWeddingPackages.map((pkg, index) => {
                const hasId = pkg && (pkg.id || pkg._id);
                const hasName = pkg && pkg.name;
                const isValidPackage = hasId && hasName;

                if (!isValidPackage) return null;

                const isSelected = !!selectedWeddingPackage &&
                  (selectedWeddingPackage.id === (pkg.id || pkg._id) || selectedWeddingPackage._id === (pkg.id || pkg._id));
                const isCustomized = isSelected && weddingPackageMode === 'customized' && selectedWeddingPackage;

                const displayServicesCount = isCustomized ? (selectedWeddingPackage.services?.length || 0) : (pkg.services?.length || 0);
                const displayDuration = isCustomized ? (selectedWeddingPackage.duration || 0) : (pkg.duration || 0);
                const displayTotalPrice = isCustomized ? (selectedWeddingPackage.totalPrice || 0) : (pkg.totalPrice || 0);
                const displayDiscountedPrice = isCustomized ? (selectedWeddingPackage.discountedPrice || null) : (pkg.discountedPrice || null);

                const discount = displayDiscountedPrice && displayDiscountedPrice !== displayTotalPrice
                  ? Math.round(((displayTotalPrice - displayDiscountedPrice) / displayTotalPrice) * 100)
                  : 0;

                return (
                  <Card
                    key={pkg.id || pkg._id}
                    className={cn(
                      'overflow-hidden transition-all duration-300 hover:shadow-lg cursor-pointer group relative',
                      'bg-card flex flex-col h-full rounded-tl-lg rounded-tr-[24px] rounded-bl-[24px] rounded-br-lg',
                      isSelected
                        ? 'ring-2 ring-primary shadow-lg'
                        : 'shadow-sm hover:shadow-md border'
                    )}
                  >
                    {/* Discount Badge */}
                    {discount > 0 && (
                      <div className="absolute top-0 left-0 z-10 bg-[#3a2b38] text-white px-3 py-2 rounded-br-2xl rounded-tl-lg text-xs font-bold shadow-sm flex flex-col items-center leading-tight">
                        <span>{discount}%</span>
                        <span>OFF</span>
                      </div>
                    )}

                    {/* Selected Badge */}
                    {isSelected && (
                      <div className="absolute top-4 right-4 z-10 bg-primary text-primary-foreground rounded-full p-1.5 shadow-sm">
                        <Check className="h-4 w-4" />
                      </div>
                    )}

                    {/* Image Header */}
                    <div className="relative w-full h-40 sm:h-44 overflow-hidden bg-muted">
                      <Image
                        src={pkg.image || '/images/wedding package placeholder.png'}
                        alt={pkg.name}
                        fill
                        className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:rotate-1"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/images/wedding package placeholder.png';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                      {/* Tags Overlay */}
                      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center px-2 py-1 rounded bg-white text-[11px] font-bold text-gray-900 shadow-sm">
                          <img src="/images/menu (1) 1.png" alt="Services" className="h-3 w-3 mr-1" />
                          {displayServicesCount} Services
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded bg-white text-[11px] font-bold text-gray-900 shadow-sm">
                          <img src="/images/clock (20).png" alt="Duration" className="h-3 w-3 mr-1" />
                          {displayDuration >= 60
                            ? `${Math.floor(displayDuration / 60)}hr ${displayDuration % 60 > 0 ? (displayDuration % 60) + 'min' : ''}`
                            : `${displayDuration} min`}
                        </span>
                        {pkg.staffCount && (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-white text-[11px] font-bold text-gray-900 shadow-sm">
                            <img src="/images/group (4) 1.png" alt="Staff" className="h-3 w-3 mr-1" />
                            {pkg.staffCount} Staff
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-3 flex-1 flex flex-col">
                      {/* Title */}
                      <h4 className="font-bold text-base text-foreground mb-1 line-clamp-1">
                        {pkg.name}
                      </h4>

                      {/* Pricing */}
                      <div className="flex items-baseline gap-2 mb-2">
                        {displayDiscountedPrice && displayDiscountedPrice !== displayTotalPrice ? (
                          <>
                            <span className="font-bold text-lg" style={{ color: "#422A3C" }}>
                              ₹ {displayDiscountedPrice?.toLocaleString('en-IN')}/-
                            </span>
                            <span className="text-muted-foreground line-through text-sm">
                              ₹ {displayTotalPrice?.toLocaleString('en-IN')}/-
                            </span>
                          </>
                        ) : (
                          <span className="font-bold text-lg" style={{ color: "#422A3C" }}>
                            ₹ {displayTotalPrice?.toLocaleString('en-IN')}/-
                          </span>
                        )}
                      </div>

                      {/* Services Preview */}
                      {(isCustomized ? selectedWeddingPackage.services : pkg.services) && (isCustomized ? selectedWeddingPackage.services : pkg.services).length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm font-bold text-foreground mb-1">What's Included</p>
                          <p className="text-sm text-foreground/80 truncate">
                            • {(isCustomized ? selectedWeddingPackage.services : pkg.services).map((s: any) => s.serviceName || s.name).join(', ')}
                          </p>
                        </div>
                      )}

                      {/* Staff Preview */}
                      {pkg.assignedStaff && pkg.assignedStaff.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm font-bold text-foreground mb-1">Expert Staff</p>
                          <p className="text-sm text-foreground/80 truncate">
                            {pkg.assignedStaff.map((staff: any) => `• ${getStaffName(staff)}`).join('   ')}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-auto pt-1">
                        <Button
                          variant="outline"
                          className="flex-[1] min-w-0 rounded-md border-gray-300 font-bold hover:bg-gray-50 text-xs py-1.5 whitespace-nowrap"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPackageForDetails(pkg);
                          }}
                        >
                          Details
                        </Button>
                        <button
                          className={`flex-[2] min-w-0 rounded-tl-md rounded-tr-[14px] rounded-bl-[14px] rounded-br-md text-xs font-bold px-3 py-1.5 transition-colors border whitespace-nowrap ${isSelected
                            ? 'bg-[#422A3C] text-white border-[#422A3C]'
                            : 'bg-transparent text-[#422A3C] border-[#422A3C] hover:bg-[#422A3C]/5'
                            }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSelected) handleSelectWeddingPackage(null);
                            else handleSelectWeddingPackage(pkg);
                          }}
                        >
                          {isSelected ? 'Remove' : 'Select Package'}
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
                <Heart className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Wedding Packages Available</h3>
              <p className="text-muted-foreground">
                Check back later for our exclusive wedding packages
              </p>
            </div>
          )}
        </div>
      )}

      {/* Continue Button - Removed as per user request */}

      {/* Confirmation Dialog */}
      <Dialog open={packageToConfirm !== null} onOpenChange={(open) => !open && setPackageToConfirm(null)}>
        <DialogContent className="max-w-[420px] rounded-2xl p-6 border border-gray-200 shadow-2xl bg-white overflow-hidden">
          {packageToConfirm && (
            <div className="relative">
              <div className="flex items-start gap-3 mt-1 pr-6">
                {/* Check Icon Image */}
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                  <img
                    src="/images/check (23) 1.png"
                    alt="Confirm"
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">Confirm Package Selection</h3>
                  <p className="text-sm text-black mt-0.5 leading-normal">
                    <span className="font-normal">Are you sure you want to select</span>{' '}
                    <span className="font-bold">{packageToConfirm.name}</span>
                    <span className="font-bold">?</span>
                  </p>
                </div>
              </div>

              {/* Blue Invoice Breakdown Box */}
              {(() => {
                const pkgPrice = packageToConfirm.discountedPrice || packageToConfirm.totalPrice || 0;

                // Read rates dynamically from taxFeeSettings (or default to 15% and 18%)
                const platformFeeRate = taxFeeSettings?.platformFee != null ? parseFloat(taxFeeSettings.platformFee) : 15;
                const serviceTaxRate = taxFeeSettings?.serviceTax != null ? parseFloat(taxFeeSettings.serviceTax) : 18;

                const platformFee = pkgPrice * (platformFeeRate / 100);
                const gst = pkgPrice * (serviceTaxRate / 100);
                const finalTotal = pkgPrice + platformFee + gst;

                return (
                  <div className="mt-5 bg-[#EBF4FE] border border-[#D5E6FC] rounded-2xl p-5 space-y-3.5">
                    <div className="flex justify-between items-center text-sm font-semibold text-[#1F2937]">
                      <span>Platform Fee ({platformFeeRate}%) :</span>
                      <span>₹ {platformFee.toFixed(2)}/-</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-semibold text-[#1F2937]">
                      <span>GST ({serviceTaxRate}%) :</span>
                      <span>₹ {gst.toFixed(2)}/-</span>
                    </div>
                    <div className="border-t border-[#00000020] my-2"></div>
                    <div className="flex justify-between items-center text-sm font-bold text-black">
                      <span>Total Amount :</span>
                      <span>₹ {finalTotal.toLocaleString('en-IN')}/-</span>
                    </div>
                  </div>
                );
              })()}

              <p className="text-xs text-gray-500 text-left mt-4 whitespace-nowrap">
                You can change your selection anytime before confirming the booking
              </p>

              {/* Buttons */}
              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setPackageToConfirm(null)}
                  className="flex-1 py-3 px-5 border border-[#422A3C] text-[#422A3C] hover:bg-[#422A3C]/5 font-semibold rounded-2xl text-base transition-colors text-center"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPackageSelection}
                  className="flex-1 py-3 px-5 bg-[#422A3C] hover:bg-[#422A3C]/95 text-white font-semibold rounded-2xl text-base transition-colors text-center shadow-md"
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Package Details Modal - Updated UI */}
      <Dialog open={selectedPackageForDetails !== null} onOpenChange={(open) => !open && setSelectedPackageForDetails(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-[580px] h-[90vh] sm:h-[530px] overflow-hidden p-0 gap-0 [&>button]:hidden">
          {selectedPackageForDetails && (
            <div className="flex flex-col h-full max-h-[90vh] sm:max-h-[530px]">
              {/* Header with Image + badges on image + small X close button */}
              <div className="relative w-full h-40 sm:h-48 flex-shrink-0 overflow-hidden bg-muted">
                <Image
                  src={selectedPackageForDetails.image || '/images/wedding package placeholder.png'}
                  alt={selectedPackageForDetails.name}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/images/wedding package placeholder.png';
                  }}
                />
                {/* Hidden title for accessibility (kept for a11y, visible name now below image) */}
                <DialogTitle className="sr-only">{selectedPackageForDetails.name}</DialogTitle>
                {/* Small X Close Button top-right */}
                <button
                  onClick={() => setSelectedPackageForDetails(null)}
                  className="absolute top-2 right-2 z-20 w-6 h-6 flex items-center justify-center"
                  aria-label="Close"
                >
                  <img src="/images/x-button (3) 1.png" alt="Close" className="w-6 h-6 object-contain" />
                </button>

                {/* Info Badges on image bottom */}
                <div className="absolute bottom-2 left-3 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center px-2 py-1 rounded bg-white text-[11px] font-bold text-gray-900 shadow-sm">
                    <img src="/images/menu (1) 1.png" alt="Services" className="h-3 w-3 mr-1" />
                    {selectedPackageForDetails.services?.length || 0} Services
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded bg-white text-[11px] font-bold text-gray-900 shadow-sm">
                    <img src="/images/clock (20).png" alt="Duration" className="h-3 w-3 mr-1" />
                    {(() => {
                      const dur = selectedPackageForDetails.duration || 0;
                      return dur >= 60
                        ? `${Math.floor(dur / 60)}hr ${dur % 60 > 0 ? (dur % 60) + 'min' : ''}`
                        : `${dur} min`;
                    })()}
                  </span>
                  {selectedPackageForDetails.staffCount && (
                    <span className="inline-flex items-center px-2 py-1 rounded bg-white text-[11px] font-bold text-gray-900 shadow-sm">
                      <img src="/images/group (4) 1.png" alt="Staff" className="h-3 w-3 mr-1" />
                      {selectedPackageForDetails.staffCount} Staff
                    </span>
                  )}
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2" style={{ backgroundColor: '#ffffff' }}>
                {/* Package Name - bold, below image */}
                <h3 className="font-bold text-base sm:text-lg text-black mb-3">
                  {selectedPackageForDetails.name}
                </h3>


                {/* Two Column Layout: Services | Staff */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  {/* Left Column: Included Services */}
                  {selectedPackageForDetails.services && selectedPackageForDetails.services.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <img src="/images/customer-review 1.png" alt="Services" className="h-6 w-6 object-contain" />
                        <h4 className="font-bold text-sm text-black">Included Services ({selectedPackageForDetails.services.length})</h4>
                      </div>
                      <div className="space-y-1.5">
                        {selectedPackageForDetails.services.map((service, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-sm text-black">
                            <img src="/images/checkmark (3) 1 (1).png" alt="check" className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 object-contain" />
                            <span className="leading-relaxed font-normal text-[13px]">{service.serviceName || (service as any).name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Right Column: Expert Staff */}
                  {selectedPackageForDetails.assignedStaff && selectedPackageForDetails.assignedStaff.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <img src="/images/group (4) 1.png" alt="Staff" className="h-6 w-6 object-contain" />
                        <h4 className="font-bold text-sm text-black">Expert Staff ({selectedPackageForDetails.assignedStaff.length})</h4>
                      </div>
                      <div className="space-y-2">
                        {selectedPackageForDetails.assignedStaff.map((staff, idx) => {
                          const staffName = getStaffName(staff);
                          const staffPosition = getStaffPosition(staff);
                          const staffArr: any[] = Array.isArray(staffData)
                            ? staffData
                            : ((staffData as any)?.data || []);
                          const staffObj = staffArr.find((s: any) =>
                            s._id === staff || s.id === staff ||
                            s._id === (staff as any)?._id || s.id === (staff as any)?._id
                          );
                          const staffPhoto = staffObj?.profileImage || staffObj?.photo || staffObj?.image || (staff as any)?.photo || (staff as any)?.image;
                          // Merge position from lookup + direct object fields for maximum coverage
                          const resolvedPosition =
                            staffPosition ||
                            staffObj?.position ||
                            staffObj?.role ||
                            staffObj?.designation ||
                            staffObj?.specialization ||
                            staffObj?.jobTitle ||
                            staffObj?.title ||
                            (staff as any)?.position ||
                            (staff as any)?.role ||
                            (staff as any)?.designation ||
                            '';
                          return (
                            <div key={idx} className="flex items-center gap-2 text-black">
                              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-200 border border-gray-200">
                                {staffPhoto ? (
                                  <img src={staffPhoto} alt={staffName} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                                    <User className="h-4 w-4 text-primary" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-sm leading-tight text-black">{staffName}</p>
                                {resolvedPosition && (
                                  <p className="text-xs text-gray-500 leading-tight mt-0.5">{resolvedPosition}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Package Pricing Bar */}
              <div className="flex-shrink-0 mx-4 mb-4 mt-2 rounded-lg border overflow-hidden flex items-center justify-between" style={{ backgroundColor: '#EBF3FD', borderColor: '#00000082' }}>
                {/* Left vertical accent */}
                <div className="w-[5px] self-stretch flex-shrink-0" style={{ backgroundColor: '#422A3C' }} />
                <span className="font-semibold text-sm text-black flex-1 px-3 py-2.5">Package Pricing</span>
                <span className="font-bold text-sm text-black px-4 py-2.5">
                  {selectedPackageForDetails.discountedPrice && selectedPackageForDetails.discountedPrice !== selectedPackageForDetails.totalPrice
                    ? `₹ ${selectedPackageForDetails.discountedPrice?.toLocaleString('en-IN')}/-`
                    : `₹ ${selectedPackageForDetails.totalPrice?.toLocaleString('en-IN')}/-`}
                </span>
              </div>

              {/* Footer Actions: Cancel + Confirm/Deselect (small width on the right) */}
              <div className="flex-shrink-0 px-4 pt-4 pb-4 flex justify-end gap-3" style={{ backgroundColor: '#EBF3FD' }}>
                <button
                  onClick={() => setSelectedPackageForDetails(null)}
                  className="w-24 py-1.5 font-bold rounded-xl text-xs transition-colors text-center border"
                  style={{ backgroundColor: '#EBF3FD', borderColor: '#000000', color: '#000000' }}
                >
                  Cancel
                </button>
                {selectedWeddingPackage?.id === (selectedPackageForDetails.id || selectedPackageForDetails._id) ? (
                  <button
                    onClick={() => {
                      handleSelectWeddingPackage(null);
                      setSelectedPackageForDetails(null);
                    }}
                    className="w-32 py-1.5 font-bold rounded-xl text-xs transition-colors text-center border text-white"
                    style={{ backgroundColor: '#422A3C', borderColor: '#000000' }}
                  >
                    Deselect Package
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleSelectWeddingPackage(selectedPackageForDetails);
                      setSelectedPackageForDetails(null);
                    }}
                    className="w-24 py-1.5 font-bold rounded-xl text-xs transition-colors text-center border text-white"
                    style={{ backgroundColor: '#422A3C', borderColor: '#000000' }}
                  >
                    Confirm
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Add-ons Selection Modal */}
      <Dialog open={isAddonModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAddonModalOpen(false);
          setCurrentServiceForAddons(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customize your service</DialogTitle>
            <DialogDescription>
              Would you like to add any extras to <strong>{currentServiceForAddons?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 max-h-[60vh] overflow-y-auto space-y-3">
            {currentServiceForAddons?.addOns?.map((addon) => (
              <div
                key={addon._id}
                className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  toggleAddon(addon._id);
                }}
              >
                <Checkbox
                  checked={selectedAddonIds.includes(addon._id)}
                  className="mt-1 pointer-events-none"
                />
                <div className="flex-1 grid gap-1 pointer-events-none">
                  <span className="font-medium">
                    {addon.name}
                  </span>
                  {addon.description && (
                    <p className="text-sm text-muted-foreground">
                      {addon.description}
                    </p>
                  )}
                </div>
                <div className="font-semibold text-primary pointer-events-none">
                  +₹{addon.price}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddonModalOpen(false);
                setCurrentServiceForAddons(null);
                setSelectedAddonIds([]);
              }}
              className="sm:order-1 border-destructive text-destructive hover:bg-destructive/10"
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={skipAddonSelection}
              className="sm:order-2"
            >
              Skip
            </Button>
            <Button
              onClick={confirmAddonSelection}
              className="sm:order-3"
            >
              Add with extras
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
