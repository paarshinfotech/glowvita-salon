"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@repo/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Textarea } from "@repo/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { X, Phone, Mail, MapPin, Clock, Calendar, User, Scissors, IndianRupee, UserCheck, CreditCard, Wallet, Smartphone, History, CalendarPlus, ClipboardList, Printer, Download, Home, Building2 } from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { Badge } from "@repo/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@repo/ui/card";
import NewAppointmentForm, { type Appointment as FormAppointment } from "../app/calendar/components/NewAppointmentForm";
import { toast } from 'sonner';
import { useCollectPaymentMutation, useGetAppointmentsQuery, useGetVendorProfileQuery, useGetStaffQuery, useGetVendorWeddingPackagesQuery } from '@repo/store/services/api';
import { glowvitaApi } from '@repo/store/api';
import { AppointmentInvoice } from './AppointmentInvoice';

interface PaymentDetails {
  amount: number;
  paid: number;
  discount?: {
    amount: number;
    code?: string;
    description: string;
  };
  tax: number;
  total: number;
  paymentMethod?: string;
  paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded';
  platformFee?: number;
  serviceTax?: number;
  offer?: {
    code: string;
    description: string;
    discountAmount: number;
  };
  bookingSource?: 'web' | 'phone' | 'walk-in';
  paymentMode?: 'online' | 'salon';
}

// Service item interface for multi-service appointments
interface ServiceItem {
  _id?: string;
  service: string;
  serviceName: string;
  staff: string;
  staffName: string;
  startTime: string;
  endTime: string;
  duration: number;
  amount: number;
  addOns?: Array<{
    _id: string;
    name: string;
    price: number;
    duration: number;
  }>;
}

// Create a new interface that combines the properties we need
interface Appointment {
  // Properties from the original FormAppointment interface
  id?: string;
  _id?: string;
  client: string;
  clientName: string;
  service: string;
  serviceName: string;
  staff: string;
  staffName: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  duration: number;
  notes: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'pending' | 'completed without payment' | 'partially-completed';
  amount: number;
  discount: number;
  tax: number;
  totalAmount: number;
  paymentStatus?: string;
  clientEmail?: string;
  clientPhone?: string;
  createdAt?: string;
  updatedAt?: string;

  // Multi-service appointment properties
  isMultiService?: boolean;
  serviceItems?: ServiceItem[];

  // Service Type flags
  isHomeService?: boolean;
  isWeddingService?: boolean;
  homeServiceLocation?: {
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
  };
  weddingPackageDetails?: {
    packageName?: string;
    totalAmount?: number;
    totalDuration?: number;
    venueAddress?: string;
    travelTime?: number;
  };
  travelTime?: number;

  // Additional properties used in this component
  payment?: PaymentDetails;
  vendorId?: string;
  addOnsAmount?: number;
  platformFee?: number;
  serviceTax?: number;
  finalAmount?: number;
  amountPaid?: number;
  amountRemaining?: number;
  invoiceNumber?: string;
}

interface AppointmentDetailViewProps {
  appointment: Appointment;
  onClose: () => void;
  onStatusChange?: (status: string, reason?: string) => void;
  onCollectPayment?: (paymentData: { amount: number; paymentMethod: string; notes?: string }) => void;
  onUpdateAppointment?: (appointment: Appointment) => Promise<void>;
  onRescheduleAppointment?: (appointment: Appointment) => Promise<void>;
  onCloseReschedule?: () => void;
  onOpenAppointment?: (appointmentId: string) => void;
}

interface ClientAppointment {
  id: string;
  date: Date;
  service: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'missed' | 'completed without payment' | 'partially-completed';
  staffName: string;
  amount: number;
  startTime?: string;
  endTime?: string;
  notes?: string;
  payment?: PaymentDetails;
}

export function AppointmentDetailView({
  appointment,
  onClose,
  onStatusChange,
  onCollectPayment,
  onUpdateAppointment,
  onRescheduleAppointment,
  onCloseReschedule,
  onOpenAppointment,
}: AppointmentDetailViewProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [clientHistory, setClientHistory] = useState<ClientAppointment[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeHistoryFilter, setActiveHistoryFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'missed' | 'completed without payment' | 'partially-completed'>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCollectingPayment, setIsCollectingPayment] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'cash',
    notes: ''
  });
  const [collectPayment, { isLoading: isCollectingPaymentLoading }] = useCollectPaymentMutation();

  // Add the missing isStatusChanging state
  const [isStatusChanging, setIsStatusChanging] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const { data: vendorProfile, isLoading: isVendorLoading } = useGetVendorProfileQuery({});
  const { data: staffData } = useGetStaffQuery(undefined);
  const staffList = useMemo(() => {
    if (Array.isArray(staffData)) return staffData;
    if (Array.isArray(staffData?.data)) return staffData.data;
    return [];
  }, [staffData]);

  // Fetch wedding packages if it's a wedding appointment for fallback staff resolution
  const isWeddingOrPackage = (appointment as any).isWeddingService || (appointment as any).weddingPackageDetails?.packageId;
  const { data: weddingPackagesData } = useGetVendorWeddingPackagesQuery(
    (appointment as any).vendorId || vendorProfile?.data?._id,
    { skip: !isWeddingOrPackage }
  );
  const weddingPackages = useMemo(() => weddingPackagesData?.data || [], [weddingPackagesData]);

  // Build a price map for wedding sub-services from the catalog for fallback lookup
  const weddingServicePriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    const pkgs = Array.isArray(weddingPackagesData?.weddingPackages)
      ? weddingPackagesData.weddingPackages
      : Array.isArray(weddingPackagesData?.data)
        ? weddingPackagesData.data
        : Array.isArray(weddingPackages)
          ? weddingPackages
          : [];
    pkgs.forEach((pkg: any) => {
      const services = pkg.services || [];
      services.forEach((s: any) => {
        const id = s.serviceId || s._id || s.id;
        const price = Number(s.price || s.discountedPrice || s.amount || 0);
        if (id && price > 0) map[String(id)] = price;
      });
    });
    return map;
  }, [weddingPackagesData, weddingPackages]);

  // Fetch vendor services for catalog price fallback lookup
  const vendorIdForServices = (vendorProfile as any)?.data?._id || (vendorProfile as any)?._id || '';
  const { data: vendorServicesResponse } = glowvitaApi.useGetVendorServicesQuery(
    { vendorId: vendorIdForServices, page: 1, limit: 200 },
    { skip: !vendorIdForServices }
  );
  const catalogPriceMap = useMemo(() => {
    let servicesArr: any[] = [];
    if (vendorServicesResponse?.data?.services) servicesArr = vendorServicesResponse.data.services;
    else if (vendorServicesResponse?.services) servicesArr = vendorServicesResponse.services;
    else if (Array.isArray(vendorServicesResponse?.data)) servicesArr = vendorServicesResponse.data;
    else if (Array.isArray(vendorServicesResponse)) servicesArr = vendorServicesResponse;
    const map: Record<string, number> = {};
    servicesArr.forEach((s: any) => {
      const id = s._id || s.id;
      if (id && s.price != null) map[id] = Number(s.price);
    });
    return map;
  }, [vendorServicesResponse]);

  // Tax settings are already stored in the appointment data, no need to fetch separately
  // const { data: taxSettings } = useGetTaxFeeSettingsQuery(undefined);

  // Local override for payment values after a successful collection, so UI updates immediately
  const [overridePayment, setOverridePayment] = useState<{ amountPaid: number; amountRemaining: number; paymentStatus: string } | null>(null);
  // Local override for status so it shows immediately after payment
  const [overrideStatus, setOverrideStatus] = useState<string | null>(null);
  // Local override for payment history so it shows immediately after payment
  const [overridePaymentHistory, setOverridePaymentHistory] = useState<any[] | null>(null);

  // Pull latest appointments list from store and merge the one for this id
  const { data: allAppointments, refetch: refetchAppointments } = useGetAppointmentsQuery(undefined, { refetchOnMountOrArgChange: true });
  const liveAppointment = useMemo(() => {
    const currentId = (appointment as any)._id || (appointment as any).id;
    const fromList = Array.isArray(allAppointments)
      ? allAppointments.find((a: any) => (a?._id || a?.id) === currentId)
      : undefined;
    const merged = { ...appointment, ...(fromList || {}) } as any;
    // Apply status override if present
    if (overrideStatus) {
      merged.status = overrideStatus;
    }

    // Resolve Staff Names for Wedding Services
    if (merged.isWeddingService) {
      let staffNames: string[] = [];

      // 1. Check teamMembers (root level or package level)
      if (merged.teamMembers && Array.isArray(merged.teamMembers)) {
        const names = merged.teamMembers.map((m: any) => typeof m === 'string' ? m : (m.name || m.firstName || m.staffName)).filter(Boolean);
        if (names.length > 0) staffNames = names;
      }


      // 2. Check weddingPackageDetails.teamMembers if still empty
      if (staffNames.length === 0 && merged.weddingPackageDetails?.teamMembers && Array.isArray(merged.weddingPackageDetails.teamMembers)) {
        const names = merged.weddingPackageDetails.teamMembers.map((m: any) => typeof m === 'string' ? m : (m.name || m.firstName || m.staffName)).filter(Boolean);
        if (names.length > 0) staffNames = names;
      }

      // 3. Fallback: Map Staff IDs from packageServices using staffList
      if (staffNames.length === 0 && merged.weddingPackageDetails?.packageServices && Array.isArray(merged.weddingPackageDetails.packageServices) && staffList.length > 0) {
        const staffIds = merged.weddingPackageDetails.packageServices.map((s: any) => s.staffId).filter(Boolean);
        if (staffIds.length > 0) {
          // Map IDs to names
          const names = staffIds.map((id: string) => {
            const staff = staffList.find((s: any) => String(s._id) === String(id) || String(s.id) === String(id));
            return staff ? (staff.name || staff.firstName) : null;
          }).filter(Boolean);
          if (names.length > 0) {
            staffNames = [...new Set(names)] as string[];
          }
        }
      }

      // 4. Ultimate Fallback: Look up assigned staff from the original Wedding Package definition
      if ((staffNames.length === 0 || merged.staffName === 'Wedding Team') && merged.weddingPackageDetails?.packageId) {
        const packageId = String(merged.weddingPackageDetails.packageId);
        const packages = Array.isArray(weddingPackages) ? weddingPackages : [];
        const pkg = packages.find((p: any) => String(p._id) === packageId || String(p.id) === packageId);

        if (pkg && pkg.assignedStaff && Array.isArray(pkg.assignedStaff) && pkg.assignedStaff.length > 0) {
          const pkgStaffIds = pkg.assignedStaff.map((s: any) => (typeof s === 'object' ? (s._id || s.id) : s));

          const names = pkgStaffIds.map((id: string) => {
            const staff = staffList.find((s: any) => String(s._id) === String(id) || String(s.id) === String(id));
            return staff ? (staff.name || staff.firstName) : null;
          }).filter(Boolean);

          if (names.length > 0) {
            staffNames = [...new Set(names)] as string[];
          }
        }
      }

      if (staffNames.length > 0) {
        merged.staffName = staffNames.join(', ');
      }
    }

    // Resolve Staff Names for Regular Services if not already resolved or showing IDs
    if (!merged.isWeddingService && staffList.length > 0) {
      let staffIds: string[] = [];
      const currentStaff = merged.staff;
      const currentStaffName = merged.staffName;

      // Helper to detect if a string looks like a MongoID (24 hex chars)
      const isMongoIdString = (str: string) => /^[a-f\d]{24}$/i.test(str.trim());

      // 1. Try merged.staff (array, string, or object)
      if (Array.isArray(currentStaff)) {
        staffIds = currentStaff.map((s: any) => typeof s === 'object' ? (s._id || s.id) : String(s));
      } else if (typeof currentStaff === 'string') {
        if (currentStaff.includes(',') || isMongoIdString(currentStaff)) {
          staffIds = currentStaff.split(',').map(s => s.trim()).filter(Boolean);
        }
      } else if (currentStaff && typeof currentStaff === 'object') {
        staffIds = [currentStaff._id || currentStaff.id];
      }

      // 2. Fallback: If no IDs found yet, or if staffName currently holds the IDs (common issue)
      // Check if staffName looks like a list of IDs
      if (typeof currentStaffName === 'string' && (currentStaffName.includes(',') || isMongoIdString(currentStaffName))) {
        const potentialIds = currentStaffName.split(',').map(s => s.trim()).filter(Boolean);
        // If the "name" is actually valid MongoIDs, treat them as IDs to be resolved
        if (potentialIds.every(id => isMongoIdString(id))) {
          // If we found IDs in the name field, prefer them if we didn't find any in the staff field, 
          // or if the staff field resulted in the same IDs.
          if (staffIds.length === 0) {
            staffIds = potentialIds;
          }
        }
      }

      // If we found potential IDs, try to map them to names
      if (staffIds.length > 0) {
        const names = staffIds.map(id => {
          // Find staff in the loaded list
          const staffMember = staffList.find((s: any) => String(s._id) === String(id) || String(s.id) === String(id));
          // Prioritize fullName from schema, then other common name fields
          return staffMember ? (staffMember.fullName || staffMember.name || staffMember.firstName) : null;
        }).filter(Boolean);

        // If we successfully resolved names, use them
        if (names.length > 0) {
          merged.staffName = names.join(', ');
        }
      }
    }



    return merged;
  }, [allAppointments, appointment, overrideStatus, staffList, weddingPackages]);

  // Normalize all appointments into an array regardless of API shape
  const appointmentsList: any[] = useMemo(() => {
    const r: any = allAppointments;
    if (Array.isArray(r)) return r;
    if (Array.isArray(r?.data)) return r.data;
    if (Array.isArray(r?.appointments)) return r.appointments;
    if (Array.isArray(r?.data?.appointments)) return r.data.appointments;
    if (Array.isArray(r?.data?.data)) return r.data.data;
    return [];
  }, [allAppointments]);

  // Calculate totals for services and add-ons
  const { totalBaseAmount, totalAddOnsAmount } = useMemo(() => {
    if (liveAppointment.serviceItems && liveAppointment.serviceItems.length > 0) {
      const base = liveAppointment.serviceItems.reduce((sum: number, item: any) =>
        sum + (Number(item.amount) || Number(item.discountedPrice) || Number(item.price) || catalogPriceMap[String(item.serviceId || item.service || item._id)] || catalogPriceMap[String(item.serviceName)] || 0), 0);
      const addOns = liveAppointment.serviceItems.reduce((sum: number, item: any) => {
        const itemAddOns = Array.isArray(item.addOns) ? item.addOns : [];
        return sum + itemAddOns.reduce((aSum: number, a: any) => aSum + (Number(a.price) || 0), 0);
      }, 0);

      // If all service items have ₹0 amount (e.g. wedding packages where individual prices aren't set),
      // fall back to root-level amount as the total service amount
      const effectiveBase = base > 0
        ? base
        : (Number(liveAppointment.amount) || Number((liveAppointment as any).weddingPackageDetails?.totalAmount) || 0);

      return { totalBaseAmount: effectiveBase, totalAddOnsAmount: addOns };
    }
    // Fallback: use amount, but if it's 0 fall back to totalAmount / finalAmount
    const singleBase =
      Number(liveAppointment.amount) ||
      Number((liveAppointment as any).totalAmount) ||
      Number((liveAppointment as any).finalAmount) ||
      0;
    return {
      totalBaseAmount: singleBase,
      totalAddOnsAmount: Number((liveAppointment as any).addOnsAmount) || 0
    };
  }, [liveAppointment]);


  // Prepare default values for edit/reschedule form
  const defaultFormValues = useMemo(() => {
    // Map 'pending' status to 'scheduled' since NewAppointmentForm doesn't support 'pending'
    const status = liveAppointment.status === 'pending' ? 'scheduled' : liveAppointment.status;

    // Extract add-ons from serviceItems or root level
    const addOns = (liveAppointment as any).addOns ||
      (liveAppointment.serviceItems && liveAppointment.serviceItems.length > 0
        ? liveAppointment.serviceItems[0].addOns
        : []) ||
      [];

    return {
      ...appointment,
      date: appointment.date instanceof Date ? appointment.date : new Date(appointment.date),
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      service: appointment.service, // This should be the service ID
      serviceName: appointment.serviceName || appointment.service, // Fallback to service ID if name is missing
      staff: appointment.staff, // This should be the staff ID
      staffName: appointment.staffName,
      clientName: appointment.clientName,
      notes: appointment.notes || '',
      amount: appointment.amount,
      status: status,
      // Ensure these are always defined
      _id: appointment._id,
      id: appointment._id,
      duration: appointment.duration || 60,
      totalAmount: appointment.totalAmount || appointment.amount || 0,
      discount: appointment.discount || 0,
      tax: (appointment as any).tax || 0,
      paymentStatus: (appointment as any).paymentStatus || 'pending',
      // Include add-ons for rescheduling
      addOns: addOns
    };
  }, [appointment, liveAppointment]);

  // Create service object in the format expected by NewAppointmentForm
  const currentService = {
    _id: appointment.service,
    id: appointment.service,
    name: appointment.serviceName,
    duration: appointment.duration,
    price: appointment.amount,
    // Add other required service fields with default values if needed
    category: '',
    staff: [],
    description: '',
    gender: 'unisex'
  };

  // Create staff object in the format expected by NewAppointmentForm
  const currentStaff = {
    _id: appointment.staff,
    id: appointment.staff,
    name: appointment.staffName,
    email: '',
    phone: ''
  };

  // Handle reschedule form submission
  const handleRescheduleSubmit = async (data: any) => {
    const toastId = toast.loading('Rescheduling appointment...');
    try {
      // Call the parent component's onStatusChange with the updated appointment data
      if (onRescheduleAppointment) {
        const updatedAppointment = {
          ...appointment,
          ...data,
          // Ensure date is a Date object
          date: data.date instanceof Date ? data.date : new Date(data.date),
          // Reset status to confirmed on reschedule
          status: 'confirmed',
        };

        await onRescheduleAppointment(updatedAppointment);
        // Don't show success toast here, let the parent component handle it
      }

      // Close the reschedule dialog if open
      if (onCloseReschedule) {
        onCloseReschedule();
      }
    } catch (error: any) {
      console.error('Error rescheduling appointment:', error);
      toast.error('Failed to reschedule appointment', {
        description: error?.message || 'Please try again.'
      });
    } finally {
      toast.dismiss(toastId);
    }
  };

  // Handle form submission
  const handleFormSubmit = async (formData: any) => {
    const toastId = toast.loading('Saving appointment...');
    try {

      const appointmentId = appointment?._id || appointment?.id || '';
      if (!appointmentId) {
        console.error('Appointment ID is missing in handleFormSubmit');
        throw new Error('Appointment ID is missing. Cannot save changes.');
      }

      setIsSaving(true);

      // Format date safely
      const formatDate = (date: any) => {
        if (!date) return appointment?.date;
        if (typeof date === 'string') return date.split('T')[0];
        if (date instanceof Date) return date.toISOString().split('T')[0];
        return appointment?.date;
      };

      // Create the updated appointment object with all required fields
      const updatedAppointment = {
        ...appointment,      // Start with all original data
        ...formData,         // Apply form updates
        _id: appointmentId,  // Ensure _id is preserved
        id: appointmentId,   // Also set id for backward compatibility
        date: formatDate(formData.date || appointment?.date),
        clientName: formData.clientName || appointment?.clientName,
        serviceName: formData.serviceName || appointment?.serviceName,
        staffName: formData.staffName || appointment?.staffName,
        startTime: formData.startTime || appointment?.startTime,
        endTime: formData.endTime || appointment?.endTime,
        status: formData.status || (appointment.status === 'cancelled' ? 'confirmed' : appointment.status) || 'scheduled',
        notes: formData.notes || appointment?.notes || '',
        amount: formData.amount || appointment?.amount || 0,
        discount: formData.discount || appointment?.discount || 0,
        tax: formData.tax || appointment?.tax || 0,
        totalAmount: formData.totalAmount || appointment?.totalAmount || 0,
      };


      // Call the update handler if provided
      if (onUpdateAppointment) {
        await onUpdateAppointment(updatedAppointment);
        toast.success('Appointment updated successfully');
      }

      // Close the detail view
      onClose();

    } catch (error) {
      console.error('Error in handleFormSubmit:', error);
      toast.error('Failed to save appointment', {
        description: typeof error === 'object' && error !== null && 'message' in error ? (error as { message?: string }).message || 'Unknown error occurred' : 'Unknown error occurred'
      });
    } finally {
      setIsSaving(false);
      toast.dismiss(toastId);
    }
  };

  // Initialize payment data with values from the latest appointment snapshot
  const payment: PaymentDetails = {
    amount: (liveAppointment as any).amount || appointment.amount || 0,
    paid: (liveAppointment as any).amountPaid || (appointment as any).amountPaid || 0,
    tax: (liveAppointment as any).tax || (appointment as any).tax || 0,
    total: (liveAppointment as any).totalAmount || (appointment as any).totalAmount || appointment.amount || 0,
    paymentStatus: (liveAppointment as any).paymentStatus || (appointment as any).paymentStatus || 'pending',
    ...(liveAppointment as any).payment || appointment.payment
  };

  // Calculate total amount - prioritize finalAmount, then totalAmount, then amount (from liveAppointment)
  const totalAmount = (liveAppointment as any).finalAmount ?? (liveAppointment as any).totalAmount ?? payment.total ?? (liveAppointment as any).amount ?? 0;

  // Use override first, then amountPaid from appointment, then fallback to payment.paid
  const paidAmount = overridePayment?.amountPaid !== undefined
    ? Number(overridePayment.amountPaid)
    : (liveAppointment as any).amountPaid !== undefined
      ? parseFloat((liveAppointment as any).amountPaid)
      : (payment.paid ? parseFloat(payment.paid as any) : 0);

  // Calculate remaining amount - prefer override, then appointment, else compute
  const remainingAmount = overridePayment?.amountRemaining !== undefined
    ? Number(overridePayment.amountRemaining)
    : (liveAppointment as any).amountRemaining !== undefined
      ? parseFloat((liveAppointment as any).amountRemaining)
      : Math.max(0, totalAmount - paidAmount);

  const discountAmount = (liveAppointment as any).discountAmount ?? liveAppointment.discount ?? 0;
  const couponCode = (liveAppointment as any).couponCode ?? '';

  // Resolve payment history to display
  const displayPaymentHistory = useMemo(() => {
    const hist = overridePaymentHistory ?? (liveAppointment as any)?.paymentHistory ?? [];
    // Sort desc by date if available
    return Array.isArray(hist)
      ? [...hist].sort((a: any, b: any) => new Date(b.paymentDate || b.date || 0).getTime() - new Date(a.paymentDate || a.date || 0).getTime())
      : [];
  }, [overridePaymentHistory, liveAppointment]);



  // Update paymentData when remainingAmount changes
  useEffect(() => {
    setPaymentData(prev => ({
      ...prev,
      amount: remainingAmount
    }));
  }, [remainingAmount]);

  // Ensure paymentData is updated when appointment data changes
  useEffect(() => {
    setPaymentData(prev => ({
      ...prev,
      amount: remainingAmount
    }));
  }, [appointment._id, remainingAmount]);

  // Build client history: prefer clientId match; also allow name/phone fallback. Include all dates and statuses.
  useEffect(() => {
    setIsLoadingHistory(true);
    try {
      const currentClientId = String((appointment as any)?.client?._id ?? (appointment as any)?.client ?? (appointment as any)?.clientId ?? (appointment as any)?.client_id ?? '').trim();
      const currentClientName = String((appointment as any)?.clientName ?? (appointment as any)?.client?.name ?? '').trim().toLowerCase();
      const currentClientPhone = String((appointment as any)?.client?.phone ?? (appointment as any)?.clientPhone ?? (appointment as any)?.phone ?? '').replace(/\D+/g, '');

      const mapStatus = (s: any): ClientAppointment['status'] => {
        const status = String(s || '').toLowerCase();
        if (status === 'confirmed') return 'confirmed';
        if (status === 'completed' || status === 'completed without payment') return 'completed';
        if (status === 'cancelled') return 'cancelled';
        if (status === 'no_show' || status === 'no-show' || status === 'missed') return 'missed';
        return 'pending';
      };

      const history = (appointmentsList || [])
        .filter((a: any) => {
          const rawClientId = a?.client?._id ?? a?.client ?? a?.clientId ?? a?.client_id;
          const clientId = rawClientId != null ? String(rawClientId).trim() : '';
          const name = String(a?.clientName ?? a?.client?.name ?? '').trim().toLowerCase();
          const phone = String(a?.client?.phone ?? a?.clientPhone ?? a?.phone ?? '').replace(/\D+/g, '');

          const idMatches = !!currentClientId && !!clientId && clientId === currentClientId;
          const nameMatches = !!currentClientName && !!name && name === currentClientName;
          const phoneMatches = !!currentClientPhone && !!phone && phone === currentClientPhone;
          return idMatches || nameMatches || phoneMatches;
        })
        .map((a: any) => ({
          id: String(a?._id ?? a?.id ?? ''),
          date: new Date(a?.date),
          service: String(a?.serviceName ?? a?.service?.name ?? a?.service ?? 'Service'),
          status: mapStatus(a?.status),
          staffName: String(a?.staffName ?? a?.staff?.name ?? ''),
          amount: Number(a?.totalAmount ?? a?.finalAmount ?? a?.amount ?? 0) || 0,
          startTime: a?.startTime,
          endTime: a?.endTime,
          notes: a?.notes ?? '',
          payment: a?.payment,
        }))
        .sort((a: ClientAppointment, b: ClientAppointment) => b.date.getTime() - a.date.getTime());

      const filtered = activeHistoryFilter === 'all' ? history : history.filter(h => h.status === activeHistoryFilter);
      if (process && process.env && typeof window !== 'undefined') {
      }
      setClientHistory(filtered);
    } catch (e) {
      console.error('Error building client history', e);
      setClientHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [appointmentsList, appointment, activeHistoryFilter]);

  // Function to update appointment status
  const updateAppointmentStatus = (appointmentId: string, newStatus: 'pending' | 'completed' | 'cancelled' | 'missed' | 'completed without payment' | 'partially-completed') => {
    setPendingStatus(newStatus);
    setShowStatusConfirm(true);
  };

  const confirmStatusUpdate = () => {
    if (!pendingStatus) return;

    const newStatus = pendingStatus as 'pending' | 'completed' | 'cancelled' | 'missed' | 'completed without payment' | 'partially-completed';

    // Update local state
    setClientHistory(prevHistory =>
      prevHistory.map(appt =>
        appt.id === appointment._id
          ? { ...appt, status: newStatus }
          : appt
      )
    );

    // Call the onStatusChange prop if provided
    if (onStatusChange) {
      onStatusChange(newStatus);
    }

    // Close the confirmation dialog
    setShowStatusConfirm(false);
    setPendingStatus(null);
  };

  // Status update confirmation dialog
  const renderStatusConfirmDialog = () => (
    <Dialog open={showStatusConfirm} onOpenChange={setShowStatusConfirm}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Status Update</DialogTitle>
          <DialogDescription>
            Are you sure you want to mark this appointment as <span className="font-semibold">{pendingStatus}</span>?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowStatusConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={confirmStatusUpdate}
            className={`${(pendingStatus === 'completed' || pendingStatus === 'completed without payment') ? 'bg-green-600 hover:bg-green-700' :
              pendingStatus === 'cancelled' ? 'bg-red-600 hover:bg-red-700' :
                pendingStatus === 'missed' ? 'bg-purple-600 hover:bg-purple-700' :
                  'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            Confirm {pendingStatus}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Ensure total is calculated if not provided
  if (!payment.total && totalAmount > 0) {
    payment.total = totalAmount;
  }

  const statusColors = {
    confirmed: 'bg-green-100 text-green-800',
  }

  // Format date for display
  const formatAppointmentDate = (date: Date) => {
    return format(date, 'MMM d, yyyy');
  };

  // Get status badge color
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed without payment':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'partially-completed':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'missed':
      case 'no_show':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const isOnlineBooking = liveAppointment.mode === 'online' ||
    liveAppointment.bookingSource === 'web' ||
    liveAppointment.payment?.bookingSource === 'web' ||
    liveAppointment.paymentMethod?.toLowerCase() === 'pay online' ||
    liveAppointment.payment?.paymentMethod?.toLowerCase() === 'pay online';

  const isFullyPaid = liveAppointment.paymentStatus?.toLowerCase() === 'completed' ||
    liveAppointment.paymentStatus?.toLowerCase() === 'paid' ||
    liveAppointment.payment?.paymentStatus?.toLowerCase() === 'completed' ||
    liveAppointment.payment?.paymentStatus?.toLowerCase() === 'paid';

  const isPaidOnline = isOnlineBooking && isFullyPaid;

  const getStatusOptions = (currentStatus: string) => {
    const statusLabels: Record<string, string> = {
      'scheduled': 'Scheduled',
      'pending': 'Pending',
      'confirmed': 'Confirmed',
      'completed': 'Completed',
      'completed without payment': 'Completed without payment',
      'cancelled': 'Cancelled',
      'partially-completed': 'Partially Completed',
      'in_progress': 'In Progress',
      'missed': 'Missed',
      'no_show': 'No Show'
    };

    const currentOption = { value: currentStatus, label: statusLabels[currentStatus] || currentStatus };
    const commonOptions = [
      { value: 'cancelled', label: 'Cancel Appointment' }
    ];

    let options = [];

    if (isPaidOnline) {
      // For online paid appointments, show "Confirmed", "Completed" and "Cancelled" (restored as per user request)
      options = [
        { value: 'confirmed', label: 'Confirm Appointment' },
        { value: 'completed', label: 'Mark as Completed' },
        { value: 'cancelled', label: 'Cancel Appointment' }
      ];
    } else {
      switch (currentStatus) {
        case 'scheduled':
          options = [
            { value: 'confirmed', label: 'Confirm Appointment' },
            { value: 'completed without payment', label: 'Completed without payment' },
            ...commonOptions
          ];
          break;
        case 'pending':
          options = [
            { value: 'scheduled', label: 'Mark as Scheduled' },
            { value: 'confirmed', label: 'Confirm Appointment' },
            { value: 'completed without payment', label: 'Completed without payment' },
            ...commonOptions
          ];
          break;
        case 'confirmed':
          options = [
            { value: 'completed without payment', label: 'Completed without payment' },
            ...commonOptions
          ];
          break;
        default:
          options = [
            { value: 'scheduled', label: 'Mark as Scheduled' },
            { value: 'confirmed', label: 'Confirm Appointment' },
            ...commonOptions
          ];
      }
    }

    // Ensure current status is in the options list if not already there
    const hasCurrent = options.some(opt => opt.value === currentStatus);
    return hasCurrent ? options : [currentOption, ...options];
  };

  const getStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      'scheduled': 'Scheduled',
      'pending': 'Pending',
      'confirmed': 'Confirmed',
      'completed': 'Completed',
      'completed without payment': 'Completed without payment',
      'cancelled': 'Cancelled',
      'partially-completed': 'Partially Completed',
      'in_progress': 'In Progress',
      'missed': 'Missed',
      'no_show': 'No Show'
    };
    return statusLabels[status] || status.replace(/-/g, ' ').toUpperCase();
  };

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!appointment || !onStatusChange) return;

    if (newStatus === 'cancelled') {
      // Show cancellation dialog instead of immediately changing status
      setPendingStatus(newStatus);
      setShowCancelDialog(true);
      return;
    }

    const toastId = toast.loading('Updating status...');
    setIsStatusChanging(true);
    setOverrideStatus(newStatus);
    try {
      // Call the parent's status change handler with the new status
      await onStatusChange(newStatus);
    } catch (error: any) {
      console.error('Error updating status:', error);
      setOverrideStatus(null);
      toast.error('Failed to update status', {
        description: error?.message || 'Please try again.'
      });
    } finally {
      setIsStatusChanging(false);
      toast.dismiss(toastId);
    }
  }, [appointment, onStatusChange]);

  const handleConfirmCancel = useCallback(async () => {
    const toastId = toast.loading('Cancelling appointment...');
    if (!pendingStatus || !onStatusChange) return;

    setIsStatusChanging(true);
    try {
      // Call the parent's status change handler with the cancellation reason
      await onStatusChange('cancelled', cancellationReason);
      toast.success('Appointment cancelled successfully');
      setShowCancelDialog(false);
      setCancellationReason('');
    } catch (error: any) {
      console.error('Error cancelling appointment:', error);
      toast.error('Failed to cancel appointment', {
        description: error?.message || 'Please try again.'
      });
    } finally {
      setIsStatusChanging(false);
      setPendingStatus(null);
      toast.dismiss(toastId);
    }
  }, [pendingStatus, onStatusChange, cancellationReason]);

  const handleEditClick = () => {
    setIsEditing(true);
    setIsRescheduling(false);
  };

  const handleRescheduleClick = () => {
    setIsRescheduling(true);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setIsRescheduling(false);
  };

  // Collect payment and update appointment/payment state
  const handlePaymentSubmit = async () => {
    const toastId = toast.loading('Processing payment...');
    try {
      // Validate payment amount
      if (paymentData.amount <= 0) {
        toast.error('Payment amount must be greater than zero');
        return;
      }

      // Validate appointment ID
      if (!appointment?._id) {
        toast.error('Appointment ID is missing');
        return;
      }

      // Prepare payload
      const paymentPayload = {
        appointmentId: appointment._id,
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod,
        notes: paymentData.notes,
      };


      // Call API
      const result: any = await collectPayment(paymentPayload).unwrap();

      if (!result || !result.success) {
        throw new Error(result?.message || 'Failed to process payment');
      }

      // Extract response data
      const updatedAppointmentData = result.appointment || {};
      const paymentDetails = result.paymentDetails || {};

      // Derive amounts/status from most reliable source
      const newAmountPaid =
        paymentDetails.amountPaid ?? updatedAppointmentData.amountPaid ?? (appointment as any).amountPaid ?? 0;
      const newRemainingAmount =
        paymentDetails.amountRemaining ?? updatedAppointmentData.amountRemaining ?? (appointment as any).amountRemaining ?? 0;
      const newPaymentStatus =
        paymentDetails.paymentStatus ?? updatedAppointmentData.paymentStatus ?? (appointment as any).paymentStatus ?? 'pending';


      // Update parent with latest appointment state
      if (onUpdateAppointment) {
        const updatedAppointment: any = {
          ...appointment,
          ...updatedAppointmentData,
          payment: {
            ...(appointment.payment || {}),
            ...(updatedAppointmentData.payment || {}),
          },
          amountPaid: newAmountPaid,
          amountRemaining: newRemainingAmount,
          paymentStatus: newPaymentStatus,
          status: updatedAppointmentData.status || appointment.status,
        };

        // Keep payment object in sync
        updatedAppointment.payment = {
          ...updatedAppointment.payment,
          paid: newAmountPaid,
          paymentStatus: newPaymentStatus,
          amount: (updatedAppointment as any).finalAmount || updatedAppointment.totalAmount || updatedAppointment.amount || 0,
        };

        await onUpdateAppointment(updatedAppointment);
      }

      // Success toast
      let successMessage = `Payment of ₹${paymentData.amount.toFixed(2)} received via ${paymentData.paymentMethod}`;
      if (updatedAppointmentData?.status && appointment.status !== updatedAppointmentData.status) {
        successMessage += ` and appointment marked as ${updatedAppointmentData.status}`;
      }
      toast.success('Payment Successful', { description: successMessage });

      // Update local payment input to remaining amount
      setPaymentData((prev) => ({
        ...prev,
        amount: newRemainingAmount,
        paymentMethod: paymentPayload.paymentMethod,
        notes: paymentPayload.notes,
      }));

      // Locally override UI payment values immediately
      setOverridePayment({
        amountPaid: newAmountPaid,
        amountRemaining: newRemainingAmount,
        paymentStatus: newPaymentStatus,
      });

      // Override status based on payment completion
      // If payment is fully collected, status should be 'completed'
      let newStatus = updatedAppointmentData?.status || appointment.status;
      if (newRemainingAmount === 0 && newAmountPaid > 0) {
        newStatus = 'completed';
      }

      // Set override if status changed
      if (newStatus !== appointment.status) {
        setOverrideStatus(newStatus);
      }

      // Update local payment history for immediate UI
      const newHistoryEntry = {
        amount: paymentData.amount,
        paymentMethod: paymentPayload.paymentMethod,
        paymentDate: new Date().toISOString(),
        notes: paymentPayload.notes || '',
        transactionId: (result?.paymentCollection?.paymentHistory || []).slice(-1)[0]?.transactionId || null,
      };
      const backendHistory = updatedAppointmentData?.paymentHistory || result?.paymentCollection?.paymentHistory || [];
      setOverridePaymentHistory(Array.isArray(backendHistory) && backendHistory.length > 0
        ? backendHistory
        : [newHistoryEntry, ...((overridePaymentHistory as any[]) || ((liveAppointment as any)?.paymentHistory || []))]);

      // Refetch appointments to ensure we have latest data
      refetchAppointments();

      // Close payment form
      setIsCollectingPayment(false);
    } catch (error: any) {
      console.error('Error collecting payment:', error);
      toast.error('Payment Failed', {
        description: error?.message || 'There was an error processing your payment. Please try again.',
      });
    } finally {
      toast.dismiss(toastId);
    }
  };

  // Prepare Invoice Data
  const invoiceData = useMemo(() => {
    if (!liveAppointment) return null;

    // Helper to resolve staff name from ID or object
    const resolveName = (val: any) => {
      if (!val) return null;
      if (typeof val === 'object') return val.name || val.firstName || val.fullName || val.staffName;
      if (typeof val === 'string') {
        // Check if it's an ID
        if (/^[a-f\d]{24}$/i.test(val.trim())) {
          const staff = staffList.find((s: any) => String(s._id) === val.trim() || String(s.id) === val.trim());
          return staff ? (staff.name || staff.firstName || staff.fullName) : val;
        }
        return val;
      }
      return val;
    };

    return {
      invoiceNumber: liveAppointment.invoiceNumber || (() => {
        const dateStr = liveAppointment.date instanceof Date
          ? liveAppointment.date.toISOString().split('T')[0].replace(/-/g, '')
          : String(liveAppointment.date).split('T')[0].replace(/-/g, '');
        const salonName = vendorProfile?.data?.businessName?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 10) || 'SALON';
        const uniqueId = liveAppointment._id ? liveAppointment._id.substring(liveAppointment._id.length - 6).toUpperCase() : '000';
        return `INV-${dateStr}-${salonName}-${uniqueId}`;
      })(),
      date: liveAppointment.date instanceof Date ? liveAppointment.date.toLocaleDateString() : String(liveAppointment.date).split('T')[0],
      time: (() => {
        if (liveAppointment.serviceItems && liveAppointment.serviceItems.length > 0) {
          const firstItem = liveAppointment.serviceItems[0];
          const lastItem = liveAppointment.serviceItems[liveAppointment.serviceItems.length - 1];
          if (firstItem.startTime && lastItem.endTime) {
            return `${firstItem.startTime} - ${lastItem.endTime}`;
          }
        }
        return liveAppointment.startTime;
      })(),
      client: {
        fullName: liveAppointment.clientName,
        phone: (liveAppointment.client as any)?.phone || liveAppointment.clientPhone || ''
      },
      status: liveAppointment.status,
      items: liveAppointment.isWeddingService && (liveAppointment as any).weddingPackageDetails?.packageServices?.length
        ? [
          {
            name: liveAppointment.serviceName,
            price: liveAppointment.amount,
            quantity: 1,
            totalPrice: liveAppointment.amount,
            discount: discountAmount,
            staff: (() => {
              const teamMembers = (liveAppointment as any).teamMembers || (liveAppointment as any).staffMembers || (liveAppointment as any).weddingPackageDetails?.teamMembers;
              if (teamMembers && Array.isArray(teamMembers) && teamMembers.length > 0) {
                const names = teamMembers.map(resolveName).filter(Boolean);
                if (names.length > 0) return names.join(', ');
              }
              return resolveName(liveAppointment.staffName) || liveAppointment.staffName;
            })(),
            duration: liveAppointment.duration,
            type: 'service'
          },
          ...(liveAppointment as any).weddingPackageDetails.packageServices.map((pkgService: any) => {
            const weddingCatalogPrice = weddingServicePriceMap[String(pkgService.serviceId || pkgService._id || '')] || 0;
            const vendorCatalogPrice = catalogPriceMap[String(pkgService.serviceId || pkgService._id || '')] || catalogPriceMap[String(pkgService.service || '')] || 0;
            const catalogPrice = weddingCatalogPrice || vendorCatalogPrice;
            const originalPrice = pkgService.originalAmount ?? pkgService.price ?? (catalogPrice > 0 ? catalogPrice : null);
            const chargedAmount = Number(pkgService.amount || pkgService.price || catalogPrice || 0);
            return {
              name: pkgService.serviceName,
              price: originalPrice !== null ? Number(originalPrice) : chargedAmount,
              discountedPrice: chargedAmount,
              quantity: 1,
              totalPrice: 0,
              discount: 0,
              staff: pkgService.staffName || 'Wedding Team',
              duration: pkgService.duration,
              type: 'wedding_included_service'
            };
          })
        ]
        : liveAppointment.serviceItems?.length ? liveAppointment.serviceItems.flatMap((item: any) => [
          {
            name: item.serviceName,
            price: Number(item.amount || item.discountedPrice || item.price || catalogPriceMap[String(item.serviceId || item.service || item._id)] || catalogPriceMap[String(item.serviceName)] || 0),
            quantity: 1,
            totalPrice: Number(item.amount || item.discountedPrice || item.price || catalogPriceMap[String(item.serviceId || item.service || item._id)] || catalogPriceMap[String(item.serviceName)] || 0),
            discount: 0,
            staff: resolveName(item.staffName || item.staff),
            duration: item.duration,
            type: 'service'
          },
          ...(Array.isArray(item.addOns) ? item.addOns.map((addOn: any) => ({
            name: `${addOn.name} (Add-on)`,
            price: addOn.price,
            quantity: 1,
            totalPrice: addOn.price,
            discount: 0,
            duration: addOn.duration,
            type: 'addon'
          })) : [])
        ]) : [
          {
            name: liveAppointment.serviceName,
            price: liveAppointment.amount,
            quantity: 1,
            totalPrice: liveAppointment.amount,
            discount: liveAppointment.discount,
            staff: (() => {
              // For wedding services, check multiple possible data sources for staff names
              if (liveAppointment.isWeddingService) {
                // Check if teamMembers (preferred) or staffMembers array exists at root level
                const teamMembers = (liveAppointment as any).teamMembers || (liveAppointment as any).staffMembers;
                if (teamMembers && Array.isArray(teamMembers) && teamMembers.length > 0) {
                  const staffNames = teamMembers.map(resolveName).filter(Boolean);
                  if (staffNames.length > 0) {
                    return staffNames.join(', ');
                  }
                }

                // Check weddingPackageDetails.teamMembers
                const pkgTeamMembers = (liveAppointment as any).weddingPackageDetails?.teamMembers;
                if (pkgTeamMembers && Array.isArray(pkgTeamMembers) && pkgTeamMembers.length > 0) {
                  const staffNames = pkgTeamMembers.map(resolveName).filter(Boolean);
                  if (staffNames.length > 0) {
                    return staffNames.join(', ');
                  }
                }
              }
              // Fallback to the main staffName
              const mainStaff = resolveName(liveAppointment.staffName) || liveAppointment.staffName;

              // If mainStaff still looks like a list of IDs (comma separated), try to resolve each
              if (typeof mainStaff === 'string' && mainStaff.includes(',')) {
                const parts = mainStaff.split(',').map(s => s.trim());
                if (parts.some(p => /^[a-f\d]{24}$/i.test(p))) {
                  return parts.map(p => resolveName(p)).join(', ');
                }
              }
              return mainStaff;
            })(),
            duration: liveAppointment.duration,
            type: 'service'
          },
          ...((liveAppointment as any).addOns || []).map((addOn: any) => ({
            name: `${addOn.name} (Add-on)`,
            price: addOn.price,
            quantity: 1,
            totalPrice: addOn.price,
            discount: 0,
            duration: addOn.duration,
            type: 'addon'
          }))
        ],
      subtotal: totalBaseAmount + totalAddOnsAmount,
      originalSubtotal: totalBaseAmount + totalAddOnsAmount,
      discount: discountAmount,
      tax: (liveAppointment as any).serviceTax || (liveAppointment as any).tax || liveAppointment.payment?.serviceTax || 0,
      taxRate: (liveAppointment as any).taxRate || 0,
      platformFee: (liveAppointment as any).platformFee || liveAppointment.payment?.platformFee || 0,
      total: totalAmount,
      balance: remainingAmount,
      paymentMethod: (liveAppointment as any).paymentMethod || liveAppointment.payment?.paymentMethod || null,
      couponCode: (liveAppointment as any).couponCode || ''
    };
  }, [liveAppointment, totalAmount, remainingAmount, vendorProfile, totalBaseAmount, totalAddOnsAmount, discountAmount, staffList, weddingServicePriceMap]);

  const handleDownloadPdf = async () => {
    const toastId = toast.loading('Generating PDF...');
    try {
      // Dynamic import
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('invoice-content');

      if (!element) {
        throw new Error('Invoice element not found');
      }

      // Clone the element to avoid modifying the visible one
      const clone = element.cloneNode(true) as HTMLElement;

      // Create a temporary container for the clone
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '800px'; // Force standard A4 width
      container.style.backgroundColor = 'white';
      container.appendChild(clone);
      document.body.appendChild(container);

      // Ensure buttons are hidden in the clone (double check)
      const buttons = clone.querySelector('[data-html2canvas-ignore="true"]');
      if (buttons) {
        (buttons as HTMLElement).style.display = 'none';
      }

      const opt: any = {
        margin: [10, 10, 10, 10] as [number, number, number, number], // Top, Right, Bottom, Left margins in mm
        filename: `Invoice_${invoiceData?.invoiceNumber || appointment._id?.substring(appointment._id.length - 6).toUpperCase() || 'INV'}.pdf`,
        image: { type: 'jpeg' as 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      await html2pdf().set(opt).from(clone).save();

      // Cleanup
      document.body.removeChild(container);

      toast.success('Invoice downloaded successfully');
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download invoice', {
        description: error?.message || 'Please try again.'
      });
    } finally {
      toast.dismiss(toastId);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const renderActionButtons = () => (
    <div className="flex justify-end space-x-2 mt-4">
      {!isEditing && !isRescheduling && (
        <>
          {/* <Button variant="outline" onClick={handleRescheduleClick}>
            Reschedule
          </Button>
          <Button onClick={handleEditClick}>
            Edit
          </Button> */}
        </>
      )}
      {(isEditing || isRescheduling) && (
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleCancelEdit}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="appointment-form"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );

  if (!appointment) return null;

  if (isEditing || isRescheduling) {
    return (
      <Dialog open={true} onOpenChange={handleCancelEdit}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isRescheduling ? 'Reschedule Appointment' : 'Edit Appointment'}
            </DialogTitle>
          </DialogHeader>
          <NewAppointmentForm
            key={`form-${appointment._id}-${isRescheduling ? 'reschedule' : 'edit'}`}
            defaultValues={defaultFormValues}
            isEditing={isEditing && !isRescheduling}
            isRescheduling={isRescheduling}
            onSubmit={isRescheduling ? handleRescheduleSubmit : handleFormSubmit}
            onCancel={handleCancelEdit}
            onSuccess={onClose}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Debug log to check appointment data

  // Helper function to format currency with proper symbol and formatting
  const formatCurrency = (amount: number | string): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '₹0.00';
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isFutureAppointment = new Date(liveAppointment.date).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0);

  return (
    <>
      {renderStatusConfirmDialog()}

      <Dialog open={!!appointment} onOpenChange={(open) => {
        // Only call onClose when the dialog is being closed by the user
        if (!open && onClose) {
          onClose();
        }
      }}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] h-auto overflow-y-scroll p-0 scrollbar-hidden" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl font-semibold text-foreground">Appointment Details</DialogTitle>
                <div className="text-sm text-muted-foreground mt-1">
                  <span>{appointment.clientName}</span>
                  <span className="mx-2">•</span>
                  <span>{format(new Date(appointment.date), 'MMM d, yyyy')}</span>
                  <span className="mx-2">•</span>
                  <span>{appointment.startTime}</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge
                  variant="outline"
                  className={`px-2 py-0.5 text-xs font-medium ${liveAppointment.status === 'completed' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' :
                    liveAppointment.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200' :
                      liveAppointment.status === 'partially-completed' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' :
                        liveAppointment.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200' :
                          liveAppointment.status === 'confirmed' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' :
                            liveAppointment.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' :
                              liveAppointment.status === 'completed without payment' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' :
                                liveAppointment.status === 'no_show' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200' :
                                  'bg-gray-100 dark:bg-gray-900/50 text-gray-800 dark:text-gray-200'
                    } border-0`}
                >
                  {liveAppointment.status.toUpperCase().replace(/-/g, ' ')}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 py-0 h-12">
              <TabsTrigger
                value="details"
                className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-4 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <User className="mr-2 h-4 w-4" />
                Details
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-4 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <History className="mr-2 h-4 w-4" />
                Client History
                {clientHistory.length > 0 && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {clientHistory.length}
                  </span>
                )}
              </TabsTrigger>
              {/* Only show Invoice tab if appointment is completed */}
              {(liveAppointment.status === 'completed' || liveAppointment.status === 'completed without payment') && (
                <TabsTrigger
                  value="invoice"
                  className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-4 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Invoice
                </TabsTrigger>
              )}
            </TabsList>



            <TabsContent value="invoice" className="p-6 pt-4">
              {invoiceData && (
                <AppointmentInvoice
                  invoiceData={invoiceData}
                  vendorName={vendorProfile?.data?.businessName || "GlowVita Salon"}
                  vendorProfile={vendorProfile}
                  taxRate={invoiceData.taxRate}
                  isOrderSaved={true}
                  onEmailClick={() => {
                    toast.success('Invoice email sent to client');
                  }}
                  onRebookClick={(liveAppointment.isWeddingService || liveAppointment.isHomeService) ? undefined : () => {
                    setIsRescheduling(true);
                    setActiveTab('details');
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="details" className="p-6 pt-4 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div className="w-full flex flex-col sm:flex-row gap-3">
                  {(remainingAmount > 0 && (overridePayment?.paymentStatus ?? (liveAppointment as any).paymentStatus) !== 'completed' && liveAppointment.status !== 'completed' && liveAppointment.status !== 'cancelled') && (
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={isFutureAppointment}
                      onClick={() => {
                        // When opening the payment form, set the amount to the remaining balance
                        if (!isCollectingPayment) {
                          setPaymentData(prev => ({
                            ...prev,
                            amount: remainingAmount
                          }));
                        }
                        setIsCollectingPayment(!isCollectingPayment);
                      }}
                    >
                      <IndianRupee className="w-4 h-4 mr-2" />
                      {isCollectingPayment ? 'Hide Payment' : 'Collect Payment'}
                    </Button>
                  )}
                  {liveAppointment.status !== 'completed' && !isPaidOnline && !liveAppointment.isWeddingService && !liveAppointment.isHomeService && (
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setIsRescheduling(true)}
                    >
                      <CalendarPlus className="w-4 h-4 mr-2" />
                      Reschedule
                    </Button>
                  )}
                  {/* <div className="w-full sm:w-[200px]">
                  <Select 
                    value={appointment.status || "scheduled"}
                    onValueChange={handleStatusChange}
                    disabled={isStatusChanging}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        { value: 'scheduled', label: 'Mark as Scheduled' },
                        { value: 'confirmed', label: 'Mark as Confirmed' },
                        { value: 'completed', label: 'Mark as Completed' },
                        { value: 'cancelled', label: 'Mark as Cancelled' },
                      ].map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div> */}
                  <div className="w-full sm:w-[200px]">
                    {(liveAppointment.status === 'completed' || liveAppointment.status === 'completed without payment' || liveAppointment.status === 'cancelled') ? (
                      <div className="w-full h-10 px-3 py-2 border rounded-md bg-muted/20 flex items-center text-sm font-medium text-foreground cursor-default">
                        {getStatusLabel(liveAppointment.status)}
                      </div>
                    ) : (
                      <Select
                        value={liveAppointment.status || "scheduled"}
                        onValueChange={handleStatusChange}
                        disabled={isStatusChanging}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {getStatusOptions(liveAppointment.status || 'scheduled').map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Collection Form */}
              {isCollectingPayment && (
                <div className="bg-background p-5 rounded-lg border-2 border-muted">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg flex items-center text-foreground">
                      <IndianRupee className="w-5 h-5 mr-2 text-foreground" />
                      Payment Collection
                    </h3>
                    {appointment.payment?.bookingSource && (
                      <Badge variant="outline" className="text-xs font-medium">
                        {appointment.payment.bookingSource === 'web' ? 'ðŸŒ Online Booking' :
                          appointment.payment.bookingSource === 'phone' ? '📞 Phone Booking' :
                            '🚶 Walk-in'}
                      </Badge>
                    )}
                  </div>

                  {/* Booking Source & Payment Mode Info */}
                  {appointment.payment?.bookingSource === 'web' && (
                    <div className="mb-4 p-3 bg-muted rounded-lg border border-muted">
                      <div className="flex items-start gap-2">
                        <div className="p-1.5 bg-foreground rounded-md mt-0.5">
                          <svg className="w-4 h-4 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            Online Booking {appointment.payment?.paymentMode === 'online' ? '- Paid Online' : '- Pay at Salon'}
                          </p>
                          <p className="text-xs text-foreground/80 mt-0.5">
                            {appointment.payment?.paymentMode === 'online'
                              ? 'Customer has already paid online. Verify payment status before service.'
                              : 'Customer selected "Pay at Salon" option. Collect payment now.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Payment Breakdown */}
                    <div className="bg-background p-4 rounded-lg border shadow-sm">
                      <h4 className="text-sm font-semibold mb-3 text-foreground">Payment Breakdown</h4>

                      <div className="space-y-2 text-sm">
                        {/* Service Amount */}
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Service Amount</span>
                          <span className="font-medium">{formatCurrency(totalBaseAmount)}</span>
                        </div>

                        {/* Add-on Amount */}
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Add-on Amount</span>
                          <span className="font-medium">{formatCurrency(totalAddOnsAmount)}</span>
                        </div>

                        {/* Service Tax (GST) */}
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Service Tax (GST)</span>
                          <span className="font-medium">{formatCurrency((liveAppointment as any).serviceTax || (liveAppointment as any).tax || appointment.payment?.serviceTax || 0)}</span>
                        </div>

                        {/* Platform Fee */}
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Platform Fee</span>
                          <span className="font-medium">{formatCurrency((liveAppointment as any).platformFee || appointment.payment?.platformFee || 0)}</span>
                        </div>

                        {/* Discount(couponcode) */}
                        <div className="flex justify-between items-center text-red-600">
                          <span>Discount{couponCode ? `(${couponCode})` : ''}</span>
                          <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                        </div>

                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between items-center font-semibold text-base">
                            <span>Total Amount</span>
                            <span className="text-foreground">{formatCurrency(totalAmount)}</span>
                          </div>
                        </div>

                        {/* Payment Method (from appointment root) */}
                        {(appointment as any).paymentMethod && (
                          <div className="flex justify-between items-center py-2 px-3 bg-muted rounded-lg">
                            <span className="text-sm font-medium text-foreground">Payment Method:</span>
                            <span className="text-sm font-semibold text-foreground">{(appointment as any).paymentMethod}</span>
                          </div>
                        )}

                        {/* Payment Status (from appointment root) */}
                        {(appointment as any).paymentStatus && (
                          <div className="flex justify-between items-center py-2 px-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                            <span className="text-sm font-medium text-purple-900 dark:text-purple-100">Payment Status:</span>
                            <span className={`text-sm font-semibold capitalize ${(appointment as any).paymentStatus === 'completed' ? 'text-green-700 dark:text-green-300' :
                              (appointment as any).paymentStatus === 'pending' ? 'text-yellow-700 dark:text-yellow-300' :
                                'text-red-700 dark:text-red-300'
                              }`}>
                              {(appointment as any).paymentStatus}
                            </span>
                          </div>
                        )}

                        {/* Amount Paid (from appointment root) */}
                        <div className="flex justify-between items-center py-2 px-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <span className="text-sm font-medium text-green-900 dark:text-green-100">Amount Paid:</span>
                          <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                            {formatCurrency(paidAmount)}
                          </span>
                        </div>

                        {/* Amount Remaining (from appointment root) */}
                        <div className="flex justify-between items-center py-2 px-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                          <span className="text-sm font-medium text-orange-900 dark:text-orange-100">Amount Remaining:</span>
                          <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                            {formatCurrency(remainingAmount)}
                          </span>
                        </div>

                        {/* Amount Already Paid */}
                        {(appointment.payment?.paid ?? 0) > 0 && (
                          <div className="flex justify-between items-center text-foreground">
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Amount Paid {appointment.payment?.paymentMode === 'online' ? '(Online)' : ''}</span>
                            </div>
                            <span className="font-medium">{formatCurrency(appointment.payment?.paid ?? 0)}</span>
                          </div>
                        )}

                        {/* Remaining Amount */}
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-base">Amount to Collect</span>
                            <span className="text-xl font-bold text-foreground">
                              {formatCurrency(remainingAmount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Payment Collection Details */}
                    <div className="bg-background p-4 rounded-lg border shadow-sm mt-4">
                      <h4 className="text-sm font-semibold mb-3 text-foreground">Payment Collection Details</h4>

                      {/* Debug Information - Remove this in production */}

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center py-2 px-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Total Amount</span>
                          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                            {formatCurrency(totalAmount)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-2 px-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <span className="text-sm font-medium text-green-900 dark:text-green-100">Amount Paid</span>
                          <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                            {formatCurrency(paidAmount)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-2 px-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                          <span className="text-sm font-medium text-orange-900 dark:text-orange-100">Amount Remaining</span>
                          <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                            {formatCurrency(remainingAmount)}
                          </span>
                        </div>

                        {/* Payment Status */}
                        <div className={`flex justify-between items-center py-2 px-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg`}>
                          <span className="text-sm font-medium text-purple-900 dark:text-purple-100">Payment Status</span>
                          <span className={`text-sm font-semibold ${(overridePayment?.paymentStatus ?? (appointment as any).paymentStatus) === 'completed' ? 'text-green-700 dark:text-green-300' :
                            (overridePayment?.paymentStatus ?? (appointment as any).paymentStatus) === 'pending' ? 'text-yellow-700 dark:text-yellow-300' :
                              'text-red-700 dark:text-red-300'
                            }`}>
                            {/* Map backend payment status to user-friendly terms */}
                            {(() => {
                              const status = overridePayment?.paymentStatus ?? (appointment as any).paymentStatus;
                              const amountPaid = Number(paidAmount || 0) || 0;
                              const totalAmount = Number((appointment as any).finalAmount ?? appointment.totalAmount ?? 0) || 0;

                              switch (status) {
                                case 'completed': return 'PAID';
                                case 'pending':
                                  if (amountPaid > 0 && totalAmount > 0) {
                                    return `PARTIAL (${formatCurrency(amountPaid)})`;
                                  }
                                  return 'UNPAID';
                                default: return status.toUpperCase();
                              }
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Collect Payment Amount */}
                    {remainingAmount > 0 && (
                      <>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Collecting Amount (Manual Entry)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground font-medium">₹</span>
                            <Input
                              type="number"
                              value={paymentData.amount}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setPaymentData(prev => ({
                                  ...prev,
                                  amount: value >= 0 ? value : 0
                                }));
                              }}
                              className={`pl-7 text-lg font-semibold ${paymentData.amount > remainingAmount ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                              min="0"
                              max={remainingAmount}
                              step="0.01"
                              placeholder="Enter amount to collect"
                            />
                          </div>
                          <div className="flex justify-between items-center mt-1.5">
                            <p className="text-xs text-foreground/80">
                              Remaining Balance: {formatCurrency(remainingAmount)}
                            </p>
                            {paymentData.amount !== remainingAmount && remainingAmount > 0 && (
                              <button
                                onClick={() => setPaymentData(prev => ({ ...prev, amount: remainingAmount }))}
                                className="text-xs text-foreground font-medium hover:opacity-80"
                              >
                                Set to Remaining
                              </button>
                            )}
                          </div>
                          {paymentData.amount > remainingAmount && (
                            <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Amount cannot exceed remaining balance (Max: {formatCurrency(remainingAmount)})
                            </p>
                          )}
                        </div>

                        {/* Payment Methods */}
                        <div>
                          <label className="text-sm font-medium mb-2 block">Payment Method</label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <button
                              onClick={() => setPaymentData(prev => ({ ...prev, paymentMethod: 'cash' }))}
                              className={`p-3 rounded-lg border-2 transition-all ${paymentData.paymentMethod === 'cash'
                                ? 'border-foreground bg-muted'
                                : 'border-muted hover:border-foreground/50'
                                }`}
                            >
                              <Wallet className={`w-6 h-6 mx-auto mb-1 ${paymentData.paymentMethod === 'cash' ? 'text-foreground' : 'text-foreground/60'
                                }`} />
                              <p className="text-xs font-medium">Cash</p>
                            </button>

                            <button
                              onClick={() => setPaymentData(prev => ({ ...prev, paymentMethod: 'card' }))}
                              className={`p-3 rounded-lg border-2 transition-all ${paymentData.paymentMethod === 'card'
                                ? 'border-foreground bg-muted'
                                : 'border-muted hover:border-foreground/50'
                                }`}
                            >
                              <CreditCard className={`w-6 h-6 mx-auto mb-1 ${paymentData.paymentMethod === 'card' ? 'text-foreground' : 'text-foreground/60'
                                }`} />
                              <p className="text-xs font-medium">Card</p>
                            </button>

                            <button
                              onClick={() => setPaymentData(prev => ({ ...prev, paymentMethod: 'upi' }))}
                              className={`p-3 rounded-lg border-2 transition-all ${paymentData.paymentMethod === 'upi'
                                ? 'border-foreground bg-muted'
                                : 'border-muted hover:border-foreground/50'
                                }`}
                            >
                              <Smartphone className={`w-6 h-6 mx-auto mb-1 ${paymentData.paymentMethod === 'upi' ? 'text-foreground' : 'text-foreground/60'
                                }`} />
                              <p className="text-xs font-medium">UPI</p>
                            </button>

                            <button
                              onClick={() => setPaymentData(prev => ({ ...prev, paymentMethod: 'netbanking' }))}
                              className={`p-3 rounded-lg border-2 transition-all ${paymentData.paymentMethod === 'netbanking'
                                ? 'border-foreground bg-muted'
                                : 'border-muted hover:border-foreground/50'
                                }`}
                            >
                              <svg className={`w-6 h-6 mx-auto mb-1 ${paymentData.paymentMethod === 'netbanking' ? 'text-foreground' : 'text-foreground/60'
                                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                              <p className="text-xs font-medium">Net Banking</p>
                            </button>
                          </div>
                        </div>

                        {/* UPI QR Code Section */}
                        {paymentData.paymentMethod === 'upi' && (
                          <div className="bg-muted p-4 rounded-lg border-2 border-dashed border-muted">
                            <div className="flex flex-col items-center">
                              <div className="bg-background p-3 rounded-lg shadow-md mb-3">
                                {/* Placeholder for QR Code - You can integrate a QR code generator library */}
                                <div className="w-48 h-48 bg-muted rounded flex items-center justify-center">
                                  <div className="text-center">
                                    <Smartphone className="w-12 h-12 mx-auto mb-2 text-foreground" />
                                    <p className="text-xs text-foreground/80">QR Code</p>
                                    <p className="text-xs text-foreground/80">Scan to Pay</p>
                                  </div>
                                </div>
                              </div>
                              <p className="text-sm font-medium text-center">Scan QR code to pay {formatCurrency(paymentData.amount)}</p>
                              <p className="text-xs text-foreground/80 mt-1">Or enter UPI ID manually</p>
                            </div>
                          </div>
                        )}

                        {/* Payment Notes */}
                        <div>
                          <label className="text-sm font-medium mb-2 block">Transaction Notes (Optional)</label>
                          <Textarea
                            placeholder="Add payment reference, transaction ID, or any notes..."
                            value={paymentData.notes}
                            onChange={(e) => setPaymentData(prev => ({
                              ...prev,
                              notes: e.target.value
                            }))}
                            rows={2}
                            className="resize-none"
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            onClick={() => setIsCollectingPayment(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handlePaymentSubmit}
                            disabled={paymentData.amount <= 0 || paymentData.amount > remainingAmount || isCollectingPaymentLoading}
                            className="flex-1 bg-foreground hover:bg-foreground/90 text-background"
                          >
                            {isCollectingPaymentLoading ? (
                              <>
                                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Processing...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Confirm Payment {formatCurrency(paymentData.amount)}
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    )}

                    {/* Already Paid Message */}
                    {remainingAmount <= 0 && (
                      <div className="bg-muted p-4 rounded-lg border-2 border-muted">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-foreground rounded-full">
                            <svg className="w-6 h-6 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Payment Complete</p>
                            <p className="text-sm text-foreground/80">Full payment of {formatCurrency(appointment.totalAmount)} has been received.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment History */}
              <div className="bg-background p-4 rounded-lg border shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <History className="w-4 h-4" /> Payment History
                  </h4>
                  {displayPaymentHistory.length > 0 && (
                    <span className="text-xs text-muted-foreground">{displayPaymentHistory.length} entr{displayPaymentHistory.length === 1 ? 'y' : 'ies'}</span>
                  )}
                </div>

                {displayPaymentHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {displayPaymentHistory.map((p: any, idx: number) => {
                      const when = p.paymentDate || p.date;
                      const dateStr = when ? format(new Date(when), 'MMM d, yyyy h:mm a') : '';
                      return (
                        <div key={idx} className="flex items-start justify-between p-3 rounded-lg border bg-card/50">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{formatCurrency(p.amount)}</span>
                              <span className="text-xs text-muted-foreground">• {String(p.paymentMethod || 'cash').toUpperCase()}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{dateStr}</div>
                            {(p.notes || p.transactionId) && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {p.notes && <span className="mr-2">{p.notes}</span>}
                                {p.transactionId && <span className="font-mono">Txn: {p.transactionId}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Appointment</DialogTitle>
                    <DialogDescription>Provide a reason to cancel this appointment.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Label htmlFor="cancelReason">Reason</Label>
                    <Textarea
                      id="cancelReason"
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      placeholder="Enter cancellation reason"
                      rows={3}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={isStatusChanging}>Close</Button>
                    <Button variant="destructive" onClick={handleConfirmCancel} disabled={isStatusChanging || !cancellationReason.trim()}>Confirm Cancel</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {/* Client & Service Info */}
              <div className="bg-gradient-to-br from-background/50 to-muted/20 p-3 sm:p-4 rounded-lg border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-5">
                    <div className="bg-background p-3 rounded-lg border shadow-sm">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <User className="h-5 w-5 text-foreground" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client</p>
                          <p className="text-lg font-semibold text-foreground">{appointment.clientName}</p>
                          {/* Check for client details in multiple places */}
                          {(() => {
                            const clientPhone = (appointment as any).client?.mobileNo ||
                              (appointment as any).client?.phone ||
                              (appointment as any).client?.mobileNumber ||
                              (appointment as any).client?.phoneNumber ||
                              (appointment as any).clientPhone ||
                              (appointment as any).phone ||
                              (appointment as any).mobileNo ||
                              (appointment as any).mobile ||
                              'N/A';

                            const clientEmail = (appointment as any).client?.email ||
                              (appointment as any).client?.emailAddress ||
                              (appointment as any).clientEmail ||
                              (appointment as any).email ||
                              (appointment as any).emailAddress;

                            return (
                              <div className="flex flex-col gap-1 mt-1">
                                <div className="flex items-center text-sm text-foreground/70">
                                  <Phone className="h-3 w-3 mr-1.5" />
                                  <span>{clientPhone}</span>
                                </div>
                                {clientEmail && (
                                  <div className="flex items-center text-sm text-foreground/70">
                                    <Mail className="h-3 w-3 mr-1.5" />
                                    <span className="truncate max-w-[200px]">
                                      {clientEmail}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Show single service or multi-service header */}
                    <div className="bg-background p-3 rounded-lg border shadow-sm">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Scissors className="h-5 w-5 text-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {(((appointment.serviceItems || []).length > 1) || appointment.isWeddingService) ? 'Services' : 'Service'}
                          </p>
                          {(((appointment.serviceItems || []).length > 1) || (appointment.isWeddingService && (appointment.weddingPackageDetails as any)?.packageServices && (appointment.weddingPackageDetails as any).packageServices.length > 1)) ? (
                            <p className="text-lg font-semibold text-foreground">
                              {appointment.isWeddingService
                                ? `${appointment.weddingPackageDetails?.packageName || appointment.serviceName || 'Wedding Package'} (${(appointment.weddingPackageDetails as any)?.packageServices?.length || 0} Services)`
                                : `Multi-Service (${(appointment.serviceItems || []).length} Services)`}
                            </p>
                          ) : (
                            <p className="text-lg font-semibold text-foreground">
                              {appointment.serviceName || 'No service specified'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Service Items List */}
                      {(() => {
                        const addMinutesToTimeStr = (timeStr: string, mins: number) => {
                          if (!timeStr) return '';
                          const [time, period] = timeStr.trim().split(/\s+/);
                          const parts = time.split(':');
                          let hours = parseInt(parts[0], 10);
                          const minutes = parseInt(parts[1] || '0', 10);
                          if (isNaN(hours) || isNaN(minutes)) return timeStr;

                          if (period && period.toUpperCase() === 'PM' && hours < 12) hours += 12;
                          if (period && period.toUpperCase() === 'AM' && hours === 12) hours = 0;

                          const totalMinutes = hours * 60 + minutes + mins;
                          let newHours24 = Math.floor(totalMinutes / 60) % 24;
                          if (newHours24 < 0) newHours24 += 24;
                          const newMinutes = ((totalMinutes % 60) + 60) % 60;

                          const pad = (n: number) => String(n).padStart(2, '0');
                          if (period) {
                            const isPM = newHours24 >= 12;
                            const newHours12 = newHours24 % 12 || 12;
                            return `${pad(newHours12)}:${pad(newMinutes)} ${isPM ? 'PM' : 'AM'}`;
                          }
                          return `${pad(newHours24)}:${pad(newMinutes)}`;
                        };

                        const servicesList = (appointment.serviceItems && appointment.serviceItems.length > 0)
                          ? appointment.serviceItems
                          : (appointment.isWeddingService && (appointment.weddingPackageDetails as any)?.packageServices)
                            ? (appointment.weddingPackageDetails as any).packageServices.map((srv: any, idx: number) => {
                              const member = (appointment.weddingPackageDetails as any)?.teamMembers?.[idx];
                              let staffName = 'Wedding Team';
                              if (member) {
                                if (typeof member === 'object') {
                                  staffName = member.name || member.firstName || member.staffName || 'Wedding Team';
                                } else if (typeof member === 'string') {
                                  if (/^[a-f\d]{24}$/i.test(member.trim())) {
                                    const staff = staffList.find((s: any) => String(s._id) === member.trim() || String(s.id) === member.trim());
                                    staffName = staff ? (staff.name || staff.firstName || staff.fullName) : member;
                                  } else {
                                    staffName = member;
                                  }
                                }
                              }

                              const duration = Math.round((appointment.weddingPackageDetails?.totalDuration || appointment.duration || 60) / (appointment.weddingPackageDetails as any).packageServices.length);
                              const staggeredStartTime = addMinutesToTimeStr(appointment.startTime, idx * duration);
                              const staggeredEndTime = addMinutesToTimeStr(appointment.startTime, (idx + 1) * duration);

                              return {
                                _id: srv._id || srv.serviceId || String(idx),
                                serviceName: srv.serviceName,
                                staffName: staffName,
                                startTime: staggeredStartTime,
                                endTime: staggeredEndTime,
                                duration: duration,
                                amount: Number(srv.amount || srv.discountedPrice || srv.price || srv.originalAmount || weddingServicePriceMap[String(srv.serviceId || srv._id || '')] || catalogPriceMap[String(srv.serviceId || srv._id || '')] || catalogPriceMap[String(srv.service || '')] || 0),
                                addOns: []
                              };
                            })
                            : [];

                        if (servicesList.length === 0) return null;

                        return (
                          <div className="mt-3 space-y-3">
                            {servicesList.map((item: any, index: number) => {
                              // Ensure addOns is always an array
                              const itemAddOns = Array.isArray(item.addOns) ? item.addOns : [];

                              return (
                                <div key={item._id || index} className="p-3 bg-muted/20 rounded-lg border border-muted/30">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-medium text-foreground">{item.serviceName}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {item.staffName} {item.startTime && item.endTime ? `• ${item.startTime} - ${item.endTime}` : ''} ({item.duration} min)
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-medium font-mono">
                                        {formatCurrency(Number(item.amount || item.discountedPrice || item.price || catalogPriceMap[String(item.serviceId || item.service || item._id)] || catalogPriceMap[String(item.serviceName)] || 0))}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Add-ons section */}
                                  {itemAddOns.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-muted/30">
                                      <p className="text-xs font-medium text-muted-foreground mb-1">Add-ons:</p>
                                      <div className="space-y-1">
                                        {itemAddOns.map((addOn: any, addOnIndex: number) => (
                                          <div
                                            key={`${item._id || 'item'}-addon-${addOnIndex}`}
                                            className="flex justify-between items-center text-xs pl-2"
                                          >
                                            <span className="text-muted-foreground">
                                              + {addOn.name} ({addOn.duration} min)
                                            </span>
                                            <span className="font-medium font-mono">
                                              {formatCurrency(addOn.price || 0)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>


                    <div className="bg-background p-3 rounded-lg border shadow-sm">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <UserCheck className="h-5 w-5 text-foreground" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {liveAppointment.isWeddingService ? 'Team Members' : 'Staff'}
                          </p>
                          <p className="text-lg font-semibold text-foreground">
                            {(() => {
                              // Helper to resolve staff name from ID or object
                              const resolveName = (val: any) => {
                                if (!val) return null;
                                if (typeof val === 'object') return val.name || val.firstName || val.fullName || val.staffName;
                                if (typeof val === 'string') {
                                  // Check if it's an ID
                                  if (/^[a-f\d]{24}$/i.test(val.trim())) {
                                    const staff = staffList.find((s: any) => String(s._id) === val.trim() || String(s.id) === val.trim());
                                    return staff ? (staff.name || staff.firstName || staff.fullName) : val;
                                  }
                                  return val;
                                }
                                return val;
                              };

                              // For wedding services, check multiple possible data sources for staff names
                              if (liveAppointment.isWeddingService) {
                                // Check if teamMembers array exists at root level
                                const teamMembers = (liveAppointment as any).teamMembers;
                                if (teamMembers && Array.isArray(teamMembers) && teamMembers.length > 0) {
                                  const staffNames = teamMembers.map(resolveName).filter(Boolean);
                                  if (staffNames.length > 0) {
                                    return staffNames.join(', ');
                                  }
                                }

                                // Check weddingPackageDetails.teamMembers
                                const pkgTeamMembers = (liveAppointment as any).weddingPackageDetails?.teamMembers;
                                if (pkgTeamMembers && Array.isArray(pkgTeamMembers) && pkgTeamMembers.length > 0) {
                                  const staffNames = pkgTeamMembers.map(resolveName).filter(Boolean);
                                  if (staffNames.length > 0) {
                                    return staffNames.join(', ');
                                  }
                                }
                              }

                              // For multi-service appointments with serviceItems, show all staff names
                              if ((liveAppointment.isWeddingService || liveAppointment.isMultiService) && liveAppointment.serviceItems && liveAppointment.serviceItems.length > 0) {
                                // Get unique staff names from service items
                                const staffNames = [...new Set(liveAppointment.serviceItems.map((item: any) => resolveName(item.staffName || item.staff)).filter(Boolean))];
                                if (staffNames.length > 0) {
                                  return staffNames.join(', ');
                                }
                              }

                              // Fallback to the main staffName (which is now resolved in useMemo)
                              const mainStaff = resolveName(liveAppointment.staffName) || liveAppointment.staffName;

                              // If mainStaff still looks like a list of IDs (comma separated), try to resolve each
                              if (typeof mainStaff === 'string' && mainStaff.includes(',')) {
                                const parts = mainStaff.split(',').map(s => s.trim());
                                // Only attempt to resolve if at least one part looks like an ID
                                if (parts.some(p => /^[a-f\d]{24}$/i.test(p))) {
                                  return parts.map(p => resolveName(p)).join(', ');
                                }
                              }

                              return mainStaff;
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="bg-background p-3 rounded-lg border shadow-sm">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Calendar className="h-5 w-5 text-foreground" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date & Time</p>
                          <div className="space-y-1">
                            <p className="text-lg font-semibold text-foreground">
                              {new Date(liveAppointment.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            <div className="flex items-center flex-wrap gap-y-1 text-foreground/80">
                              <Clock className="h-4 w-4 mr-1.5 text-foreground" />
                              {(() => {
                                let start = liveAppointment.startTime;
                                let end = liveAppointment.endTime;
                                let dur = liveAppointment.duration;
                                if (liveAppointment.serviceItems && liveAppointment.serviceItems.length > 0) {
                                  const firstItem = liveAppointment.serviceItems[0];
                                  const lastItem = liveAppointment.serviceItems[liveAppointment.serviceItems.length - 1];
                                  if (firstItem.startTime && lastItem.endTime) {
                                    start = firstItem.startTime;
                                    end = lastItem.endTime;
                                  }
                                  dur = liveAppointment.serviceItems.reduce((sum: number, item: any) => sum + (Number(item.duration) || 0), 0);
                                }
                                return (
                                  <>
                                    <span>{start} - {end}</span>
                                    <span className="ml-2 text-xs text-muted-foreground">({dur} min)</span>
                                  </>
                                );
                              })()}
                              {(liveAppointment.travelTime || liveAppointment.weddingPackageDetails?.travelTime) ? (
                                <span className="ml-2 text-[11px] text-muted-foreground font-medium flex items-center bg-muted/50 px-1.5 py-0.5 rounded border border-muted">
                                  🚗 Travel: {liveAppointment.travelTime || liveAppointment.weddingPackageDetails?.travelTime} min
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-background p-3 rounded-lg border shadow-sm">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${(liveAppointment.status === 'confirmed' || liveAppointment.status === 'in_progress') ? 'bg-blue-100 dark:bg-blue-900/30' :
                          liveAppointment.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                            liveAppointment.status === 'partially-completed' ? 'bg-indigo-100 dark:bg-indigo-900/30' :
                              liveAppointment.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                                liveAppointment.status === 'completed without payment' ? 'bg-green-100 dark:bg-green-900/30' :
                                  liveAppointment.status === 'no_show' ? 'bg-purple-100 dark:bg-purple-900/30' :
                                    'bg-red-100 dark:bg-red-900/30'
                          }`}>
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center ${(liveAppointment.status === 'confirmed' || liveAppointment.status === 'in_progress') ? 'text-blue-600 dark:text-blue-400' :
                            liveAppointment.status === 'pending' ? 'text-yellow-600 dark:text-yellow-400' :
                              liveAppointment.status === 'partially-completed' ? 'text-indigo-600 dark:text-indigo-400' :
                                liveAppointment.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                                  liveAppointment.status === 'completed without payment' ? 'text-green-600 dark:text-green-400' :
                                    liveAppointment.status === 'no_show' ? 'text-purple-600 dark:text-purple-400' :
                                      'text-red-600 dark:text-red-400'
                            }`}>
                            <div className={`h-2.5 w-2.5 rounded-full ${(liveAppointment.status === 'confirmed' || liveAppointment.status === 'in_progress') ? 'bg-blue-500' :
                              liveAppointment.status === 'pending' ? 'bg-yellow-500' :
                                liveAppointment.status === 'partially-completed' ? 'bg-indigo-500' :
                                  liveAppointment.status === 'completed' ? 'bg-green-500' :
                                    liveAppointment.status === 'completed without payment' ? 'bg-green-500' :
                                      liveAppointment.status === 'no_show' ? 'bg-purple-500' : 'bg-red-500'
                              }`} />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Appointment Status</p>
                          <span className="text-lg font-semibold text-foreground capitalize">
                            {liveAppointment.status.replace(/_/g, ' ').replace(/-/g, ' ')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {appointment.notes && (
                      <div className="bg-background p-3 rounded-lg border shadow-sm">
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <rect width="8" height="2" x="8" y="12" rx="1"></rect>
                              <rect width="8" height="2" x="8" y="16" rx="1"></rect>
                              <path d="M10 6h1v4"></path>
                              <path d="M14 6h1v4"></path>
                              <path d="M10 9h1v4"></path>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                            <p className="text-foreground/90 whitespace-pre-wrap break-words">{appointment.notes}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Address Section */}
                    {(() => {
                      const venueAddr = appointment.isWeddingService ? (appointment.weddingPackageDetails?.venueAddress || appointment.homeServiceLocation?.address) : null;
                      const isVenueWedding = appointment.isWeddingService && !!venueAddr;
                      const isHomeService = appointment.isHomeService && !appointment.isWeddingService;

                      if (isVenueWedding) {
                        // Wedding at venue — show venue address
                        return (
                          <div className="bg-background p-3 rounded-lg border shadow-sm border-pink-200 dark:border-pink-800/30 bg-pink-50/50 dark:bg-pink-900/10">
                            <div className="flex items-start space-x-3">
                              <div className="p-2 bg-pink-100 dark:bg-pink-900/20 rounded-lg mt-0.5">
                                <MapPin className="h-5 w-5 text-pink-500" />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                                  📍 Wedding Address
                                </p>
                                <p className="font-semibold text-foreground">Wedding Service Venue</p>
                                <p className="text-foreground/90 mt-1">{venueAddr}</p>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (isHomeService) {
                        // Home service — show home address
                        return (
                          <div className="bg-background p-3 rounded-lg border shadow-sm border-blue-200 dark:border-blue-800/30 bg-blue-50/50 dark:bg-blue-900/10">
                            <div className="flex items-start space-x-3">
                              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg mt-0.5">
                                <Home className="h-5 w-5 text-blue-500" />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                                  🏠 Home Address
                                </p>
                                <p className="font-semibold text-foreground">Home Service Location</p>
                                <p className="text-foreground/90 mt-1">
                                  {appointment.homeServiceLocation?.address || 'Address not specified'}
                                </p>
                                {(appointment.homeServiceLocation?.city || appointment.homeServiceLocation?.landmark) && (
                                  <p className="text-sm text-muted-foreground mt-0.5">
                                    {[appointment.homeServiceLocation.landmark, appointment.homeServiceLocation.city].filter(Boolean).join(', ')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Regular salon appointment — no address needed
                      return null;
                    })()}
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Payment Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service Amount:</span>
                    <span className="font-mono">{formatCurrency(totalBaseAmount)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Add-on Amount:</span>
                    <span className="font-mono">{formatCurrency(totalAddOnsAmount)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service Tax (GST):</span>
                    <span className="font-mono">{formatCurrency((liveAppointment as any).serviceTax || (liveAppointment as any).tax || appointment.payment?.serviceTax || 0)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform Fee:</span>
                    <span className="font-mono">{formatCurrency((liveAppointment as any).platformFee || appointment.payment?.platformFee || 0)}</span>
                  </div>

                  <div className="flex justify-between text-red-600">
                    <span>Discount{couponCode ? `(${couponCode})` : ''}:</span>
                    <span className="font-mono">-{formatCurrency(discountAmount)}</span>
                  </div>

                  <div className="flex justify-between font-medium pt-2 border-t mt-2">
                    <span>Total Amount:</span>
                    <span className="font-mono">{formatCurrency(totalAmount)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-mono">{formatCurrency(paidAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Remaining:</span>
                    <span className="font-mono">{formatCurrency(remainingAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Payment Status:</span>
                    <span className="capitalize">
                      {(() => {
                        const status = (overridePayment?.paymentStatus ?? (liveAppointment as any).paymentStatus ?? 'pending') as string;
                        if (status === 'completed') return 'paid';
                        if (status === 'pending') return paidAmount > 0 ? `partial (${formatCurrency(paidAmount)})` : 'unpaid';
                        if (status === 'partial') return `partial (${formatCurrency(paidAmount)})`;
                        return status;
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>

                {/* Invoice Button */}
                {(appointment.status === 'completed' || appointment.status === 'completed without payment') && (
                  <Button
                    variant="outline"
                    className="gap-2 bg-white hover:bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                    onClick={() => {
                      setShowInvoice(true);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <rect width="8" height="2" x="8" y="12" rx="1"></rect>
                      <rect width="8" height="2" x="8" y="16" rx="1"></rect>
                      <path d="M10 6h1v4"></path>
                      <path d="M14 6h1v4"></path>
                      <path d="M10 9h1v4"></path>
                    </svg>
                    Invoice
                  </Button>
                )}
                <div className="flex flex-wrap gap-2">

                  {/* Collect Payment Button */}
                  {/* {remainingAmount > 0 && (
                  <Button 
                    variant="outline"
                    className="gap-2 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                    onClick={() => {
                      setPaymentAmount(remainingAmount);
                      setShowPaymentForm(true);
                    }}
                  >
                    <IndianRupee className="h-4 w-4" />
                    Collect Payment
                  </Button>
                )} */}

                  {renderActionButtons()}
                </div>
              </div>
            </TabsContent>

            {/* Client History Tab */}
            <TabsContent value="history" className="p-0">
              {/* History Filter Tabs */}
              <div className="border-b px-6">
                <div className="flex space-x-1 overflow-x-auto py-2">
                  {['all', 'pending', 'confirmed', 'completed', 'cancelled', 'missed'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setActiveHistoryFilter(filter as any)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap ${activeHistoryFilter === filter
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                        }`}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      {filter !== 'all' && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-primary/10">
                          {clientHistory.filter(a => a.status === filter).length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {isLoadingHistory ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : clientHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <History className="h-12 w-12 text-muted-foreground mb-4" />
                    <h4 className="text-lg font-medium text-foreground">
                      No {activeHistoryFilter === 'all' ? '' : activeHistoryFilter} appointments found
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                      {activeHistoryFilter === 'all'
                        ? `${appointment.clientName} doesn't have any appointments in our records.`
                        : `No ${activeHistoryFilter} appointments found for ${appointment.clientName}.`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clientHistory.map((appt) => (
                      <div
                        key={appt.id}
                        className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => {
                          if (onOpenAppointment) {
                            onOpenAppointment(appt.id);
                            setActiveTab('details');
                          } else {
                            // Fallback: update URL without navigation if handler not provided
                            if (typeof window !== 'undefined') {
                              window.history.replaceState({}, '', `/appointments/${appt.id}`);
                            }
                          }
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-foreground">
                              {appt.service}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {new Date(appt.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })} • {appt.startTime}
                            </p>
                          </div>
                          <Badge variant={appt.status === 'completed' ? 'default' : 'secondary'}>
                            {appt.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent >
      </Dialog >

      {/* Payment Collection Dialog */}
      {/* <Dialog open={isCollectingPayment} onOpenChange={setIsCollectingPayment}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Collect Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number" 
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData(prev => ({
                    ...prev,
                    amount: parseFloat(e.target.value) || 0
                  }))}
                  className="pl-9"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <Select 
                value={paymentData.paymentMethod}
                onValueChange={(value) => setPaymentData(prev => ({
                  ...prev,
                  paymentMethod: value
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Credit/Debit Card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="netbanking">Net Banking</SelectItem>
                  <SelectItem value="wallet">Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Input 
                placeholder="Add any payment notes"
                value={paymentData.notes}
                onChange={(e) => setPaymentData(prev => ({
                  ...prev,
                  notes: e.target.value
                }))}
              />
            </div>
            
            <div className="pt-2">
              <Button 
                className="w-full"
                onClick={handlePaymentSubmit}
              >
                Process Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog> */}

      {/* Cancel Appointment Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Please provide a reason for cancelling this appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cancellationReason" className="text-right">
                Reason
              </Label>
              <Textarea
                id="cancellationReason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Enter the reason for cancellation"
                className="col-span-3"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false);
                setCancellationReason('');
              }}
              disabled={isStatusChanging}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCancel}
              disabled={isStatusChanging || !cancellationReason.trim()}
              variant="destructive"
            >
              {isStatusChanging ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-full p-0">
          <div className="sticky top-0 z-10 flex justify-end gap-2 p-4 bg-background border-b shadow-sm print:hidden">
            <Button size="sm" variant="outline" onClick={handlePrintPdf}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowInvoice(false)} title="Close Invoice">
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
          <div className="p-6">
            {isVendorLoading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              showInvoice && vendorProfile && invoiceData && (
                <AppointmentInvoice
                  invoiceData={invoiceData}
                  vendorName={vendorProfile?.data?.businessName || 'Salon'}
                  vendorProfile={vendorProfile || {}}
                  taxRate={0}
                  isOrderSaved={true}
                  onEmailClick={() => console.log('Email clicked')}
                  onRebookClick={() => console.log('Rebook clicked')}
                />
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AppointmentDetailView;
