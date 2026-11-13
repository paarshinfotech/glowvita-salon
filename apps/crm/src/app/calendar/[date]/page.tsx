"use client";

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { glowvitaApi } from '@repo/store/api';
import { Button } from '@repo/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@repo/ui/dialog';
import { Card } from '@repo/ui/card';
import { Badge } from '@repo/ui/badge';
import { ChevronLeft, Loader2, Clock, Plus, X } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@repo/ui/select';
import { Label } from '@repo/ui/label';
import { Textarea } from '@repo/ui/textarea';
import { toast } from 'sonner';
import React from 'react';
import { format, parseISO, isSameDay, addMinutes, parse, isWithinInterval, addDays, startOfDay, endOfDay } from 'date-fns';
import { useCrmAuth } from '@/hooks/useCrmAuth';

// Types
type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'completed without payment' | 'partially-completed';

type Appointment = {
  id?: string;
  _id: string;
  vendorId: string;
  client?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  service?: string;
  serviceName?: string;
  staff?: string;
  staffName?: string;
  date: Date;
  startTime: string;
  endTime: string;
  duration?: number;
  notes?: string;
  status?: AppointmentStatus;
  paymentStatus?: string;
  amount?: number;
  tax?: number;
  totalAmount?: number;
  // Additional payment fields
  platformFee?: number;
  serviceTax?: number;
  taxRate?: number;
  discountAmount?: number;
  finalAmount?: number;
  paymentMethod?: string;
  payment?: {
    paid?: number;
    paymentMode?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    [key: string]: any;
  };
};

// Components
import DayScheduleView from '../components/DayScheduleView';
import NewAppointmentForm from '../components/NewAppointmentForm';
import AppointmentDetailView from '../../../components/AppointmentDetailView';

// Store
import {
  selectAllAppointments,
  selectSelectedAppointment,
  setSelectedAppointment,
} from '@repo/store/slices/appointmentSlice';
import { useAppDispatch, useAppSelector } from '@repo/store/hooks';
import { setWorkingHours } from '@repo/store/slices/workingHoursSlice';
import { selectBlockedTimes } from '@repo/store/slices/blockTimeSlice';

// Helper function to parse time string (e.g., "09:00AM" or "09:00") to hours and minutes
const parseTimeString = (timeStr: string): [number, number] => {
  if (!timeStr) return [0, 0];

  try {
    // Remove all whitespace and convert to uppercase
    const cleanTime = timeStr.replace(/\s+/g, '').toUpperCase();

    // Check if time has AM/PM
    const hasAM = cleanTime.includes('AM');
    const hasPM = cleanTime.includes('PM');
    const hasPeriod = hasAM || hasPM;

    // Extract the time part (without AM/PM)
    const timePart = hasPeriod ? cleanTime.replace(/[AP]M$/, '') : cleanTime;

    // Split by colon or period
    const parts = timePart.split(/[:.]/);
    if (parts.length < 1 || parts.length > 2) {
      console.warn('Invalid time format (splitting failed):', timeStr);
      return [0, 0];
    }

    // Parse hours and minutes
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1] ? parseInt(parts[1], 10) : 0;

    // Handle 12-hour format
    if (hasPeriod) {
      if (hasPM && hours < 12) hours += 12;
      if (hasAM && hours === 12) hours = 0;
    }

    // Validate values
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.warn('Invalid time values:', timeStr, { hours, minutes });
      return [0, 0];
    }

    // Debug log for time parsing
    if (process.env.NODE_ENV !== 'production') {

    }

    return [hours, minutes];
  } catch (error) {
    console.error('Error parsing time string:', timeStr, error);
    return [0, 0];
  }
};

// Helper function to format dates without timezone issues
const formatDateForAPI = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Move date validation outside the component
function validateAndParseDate(dateString: any): { isValid: boolean; date?: Date; dayName?: string } {
  if (!dateString || typeof dateString !== 'string') return { isValid: false };

  const [year, month, day] = dateString.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return { isValid: false };

  // Create date in local timezone to avoid timezone shift
  const date = new Date(year, month - 1, day);
  const isValid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  if (!isValid) return { isValid: false };

  return {
    isValid: true,
    date,
    dayName: date.toLocaleString('en-US', { weekday: 'long' }).toLowerCase()
  };
}

export default function DailySchedulePage() {
  const router = useRouter();
  const params = useParams();
  const dispatch = useAppDispatch();
  const { role } = useCrmAuth();

  // State
  const [showBlockTimeModal, setShowBlockTimeModal] = useState(false);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState('All Staff');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ date: Date; time: string } | null>(null);

  // RTK Query hooks
  const [createAppointment] = glowvitaApi.useCreateAppointmentMutation();
  const [updateAppointment] = glowvitaApi.useUpdateAppointmentMutation();
  const [deleteAppointment] = glowvitaApi.useDeleteAppointmentMutation();
  const [updateAppointmentStatus] = glowvitaApi.useUpdateAppointmentStatusMutation();

  // Extract and validate date
  const { date: dateString } = params || {};
  const { isValid, date: selectedDate, dayName } = validateAndParseDate(dateString);

  // Get appointments from Redux store
  const allAppointments = useSelector(selectAllAppointments);

  // Fetch appointments for the selected date range using RTK Query
  // For doctors, we might need to filter appointments by doctor ID
  const { data: appointmentsData, isLoading: isLoadingAppointments, refetch: refetchAppointments } = glowvitaApi.useGetAppointmentsQuery(
    {
      startDate: selectedDate ? formatDateForAPI(selectedDate) : '',
      endDate: selectedDate ? formatDateForAPI(selectedDate) : '',
    },
    { skip: !selectedDate }
  );

  // Transform appointments data to match the expected format
  const appointments = useMemo(() => {
    if (!appointmentsData || !Array.isArray(appointmentsData)) return [];
    return appointmentsData
      .filter((appt: any) => appt._id || appt.id) // Only include appointments with valid IDs
      .map((appt: any) => ({
        id: appt._id || appt.id,
        _id: appt._id || appt.id,
        vendorId: appt.vendorId || 'default',
        client: appt.client || appt.clientName,
        clientName: appt.clientName || appt.client,
        service: appt.service,
        serviceName: appt.serviceName,
        staff: appt.staff,
        staffName: appt.staffName,
        date: new Date(appt.date),
        startTime: appt.startTime,
        endTime: appt.endTime,
        duration: appt.duration,
        notes: appt.notes || '',
        status: appt.status || 'scheduled',
        paymentStatus: appt.paymentStatus || 'pending',
        amount: appt.amount || 0,
        tax: appt.tax || 0,
        totalAmount: appt.totalAmount || appt.amount || 0,
        mode: appt.mode, // Only include if it exists in backend
        // Multi-service appointment fields
        isMultiService: appt.isMultiService || false,
        serviceItems: appt.serviceItems || [],
        payment: appt.payment,
        // Additional payment fields from appointment root
        platformFee: appt.platformFee || 0,
        serviceTax: appt.serviceTax || 0,
        taxRate: appt.taxRate || 0,
        discountAmount: appt.discountAmount || 0,
        finalAmount: appt.finalAmount || appt.totalAmount || appt.amount || 0,
        clientEmail: appt.clientEmail,
        clientPhone: appt.clientPhone,
        paymentMethod: appt.paymentMethod || 'Pay at Salon',
        isHomeService: appt.isHomeService,
        isWeddingService: appt.isWeddingService,
        homeServiceLocation: appt.homeServiceLocation,
        weddingPackageDetails: appt.weddingPackageDetails,
      }));
  }, [appointmentsData]);

  // Filter appointments for the selected staff and date
  const filteredAppointments = useMemo(() => {
    if (!appointments || !Array.isArray(appointments)) return [];
    if (!selectedDate) return [];

    return appointments.filter(appointment => {
      // Filter by date
      if (!isSameDay(new Date(appointment.date), selectedDate)) return false;

      // For doctors, we might want to show all appointments regardless of staff filter
      // or handle staff filtering differently
      if (role === 'doctor') {
        // Doctors see all their appointments
        return true;
      }

      // Filter by staff if a specific staff is selected (vendor behavior)
      if (selectedStaff !== 'All Staff' && appointment.staffName !== selectedStaff) {
        return false;
      }

      return true;
    });
  }, [appointments, selectedDate, selectedStaff, role]);

  // Handle appointment form submission
  const handleAppointmentSubmit = async (appointmentData: any) => {
    const toastId = toast.loading('Saving appointment...');
    try {
      setIsLoading(true);

      // Always use the selected date from the URL for the appointment
      const appointmentDate = selectedDate || new Date();

      // Format the appointment data with timezone-safe date
      const formattedData = {
        ...appointmentData,
        date: formatDateForAPI(appointmentDate),
        startTime: appointmentData.startTime,
        endTime: appointmentData.endTime,
        status: appointmentData.status || 'scheduled',
      };

      if (selectedAppointment?._id) {
        // Update existing appointment
        await updateAppointment({
          id: selectedAppointment._id,
          ...formattedData,
        });
        toast.success('Appointment updated successfully');
      } else {
        // Create new appointment
        await createAppointment(formattedData);
        toast.success('Appointment created successfully');
      }

      // Refresh appointments
      await refetchAppointments();

      // Close the form
      setIsNewAppointmentOpen(false);
      setSelectedAppointment(null);

    } catch (error: any) {
      console.error('Error saving appointment:', error);
      toast.error('Failed to save appointment', {
        description: error?.data?.message || error.message || 'Please try again.'
      });
    } finally {
      setIsLoading(false);
      toast.dismiss(toastId);
    }
  };

  // Handle appointment status update
  const handleUpdateStatus = async (id: string, status: string, reason: string = '') => {
    // Resolve the appointment ID: use passed id, or fall back to selectedAppointment
    const appointmentId = id || selectedAppointment?._id;
    if (!appointmentId) {
      console.error('handleUpdateStatus: no appointment ID available');
      return;
    }

    try {
      setIsLoading(true);
      await updateAppointmentStatus({
        id: appointmentId,
        status,
        cancellationReason: status === 'cancelled' ? reason : undefined
      }).unwrap();

      toast.success(`Appointment status updated to ${status}`);
      await refetchAppointments();
      setShowCancelDialog(false);
      setCancelReason('');
      // Update selectedAppointment status locally for immediate UI feedback
      if (selectedAppointment) {
        setSelectedAppointment({ ...selectedAppointment, status: status as any });
      }
    } catch (error: any) {
      console.error('Error updating appointment status:', error);
      toast.error('Failed to update appointment status', {
        description: error?.data?.message || error.message || 'Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle appointment deletion
  const handleDeleteAppointment = async (id: string) => {
    if (!id) return;

    if (window.confirm('Are you sure you want to delete this appointment?')) {
      try {
        setIsLoading(true);
        await deleteAppointment(id).unwrap();
        toast.success('Appointment deleted successfully');
        await refetchAppointments();
        setIsNewAppointmentOpen(false);
        setSelectedAppointment(null);
      } catch (error: any) {
        console.error('Error deleting appointment:', error);
        toast.error('Failed to delete appointment', {
          description: error?.data?.message || error.message || 'Please try again.'
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle appointment click
  const handleAppointmentClick = useCallback((appointment: any) => {
    setSelectedAppointment(appointment);
  }, []);

  // Handle creating a new appointment from the DayScheduleView
  const handleCreateNewAppointment = useCallback((appointmentData: any) => {
    // If we have a time slot selected, use its date
    const appointmentDate = selectedTimeSlot?.date || selectedDate || new Date();

    // Format the appointment data
    const newAppointment = {
      ...appointmentData,
      date: appointmentDate,
      startTime: appointmentData.startTime || '09:00',
      endTime: appointmentData.endTime || '10:00',
      status: 'scheduled'
    };

    // Open the form with the new appointment data
    setSelectedAppointment(newAppointment);
    setIsNewAppointmentOpen(true);
  }, [selectedDate, selectedTimeSlot]);

  // Handle new appointment button click
  const handleNewAppointment = useCallback(() => {
    setSelectedAppointment(null);
    setIsNewAppointmentOpen(true);
  }, []);

  // Handle edit appointment button click
  const handleEditAppointment = useCallback((appointment: any) => {
    setSelectedAppointment(appointment);
    // setIsNewAppointmentOpen(true);
  }, []);

  // Allow AppointmentDetailView's Client History to open another appointment
  const handleOpenAppointmentFromHistory = useCallback((appointmentId: string) => {
    if (!appointmentId) return;
    // Find in the loaded appointments list
    const found = (appointments || []).find((a: any) => (a?._id || a?.id) === appointmentId);
    if (found) {
      setSelectedAppointment(found as any);
    }
  }, [appointments]);

  // Handle date change from the DayScheduleView
  const handleDateChange = useCallback((newDate: Date) => {
    if (!newDate || !(newDate instanceof Date)) return;

    // Format the new date to YYYY-MM-DD for the URL
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const day = String(newDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    // Navigate to the new date
    router.push(`/calendar/${dateString}`);
  }, [router]);

  // Handle back button click
  const handleBackClick = useCallback(() => {
    router.push('/calendar');
  }, [router]);

  // Handle time slot click
  const handleTimeSlotClick = (time: string) => {
    if (!selectedDate) return;

    // Parse the time string to 24-hour format
    const [hours, minutes] = parseTimeString(time);
    const slotDate = new Date(selectedDate);
    slotDate.setHours(hours, minutes, 0, 0);

    setSelectedTimeSlot({
      date: slotDate,
      time: time
    });
    setIsNewAppointmentOpen(true);
  };

  // Fetch working hours - use doctor endpoint for doctors, vendor endpoint for others
  const { data: workingHoursData, isLoading: isLoadingWorkingHours, error: workingHoursError } = role === 'doctor'
    ? glowvitaApi.useGetCrmDoctorWorkingHoursQuery(undefined, { skip: !selectedDate })
    : glowvitaApi.useGetWorkingHoursQuery(
      selectedDate ? formatDateForAPI(selectedDate) : '',
      { skip: !selectedDate }
    );

  // Fetch staff data - for doctors, we might want to show only the doctor themselves
  const { data: staffData = [], isLoading: isLoadingStaff, error: staffError } = glowvitaApi.useGetStaffQuery(undefined, {
    refetchOnMountOrArgChange: true,
    skip: role === 'doctor' // Doctors don't need staff data in the same way vendors do
  });

  // For doctors, we might want to create a pseudo-staff entry for themselves
  const doctorStaffData = useMemo(() => {
    if (role !== 'doctor' || !workingHoursData) return [];

    // Create a staff-like object for the doctor
    return [{
      _id: 'doctor-self',
      id: 'doctor-self',
      fullName: 'Doctor',
      name: 'Doctor',
      position: 'Doctor',
      status: 'active',
      isAvailable: true,
      isCurrentlyAvailable: true,
      // Use doctor working hours for the staff entry
      workingHours: {
        startTime: '09:00',
        endTime: '18:00',
        startHour: 9,
        endHour: 18
      },
      mondayAvailable: true,
      tuesdayAvailable: true,
      wednesdayAvailable: true,
      thursdayAvailable: true,
      fridayAvailable: true,
      saturdayAvailable: false,
      sundayAvailable: false,
      mondaySlots: [],
      tuesdaySlots: [],
      wednesdaySlots: [],
      thursdaySlots: [],
      fridaySlots: [],
      saturdaySlots: [],
      sundaySlots: [],
      hasWeekdayAvailability: true,
      hasWeekendAvailability: false,
      blockedTimes: [],
      startTime: '09:00',
      endTime: '18:00',
      timezone: 'Asia/Kolkata'
    }];
  }, [role, workingHoursData]);

  // Transform staff data for the schedule view
  const staffList = useMemo(() => {
    // For doctors, use the doctorStaffData instead of regular staff data
    const sourceData = role === 'doctor' ? doctorStaffData : staffData;

    if (!sourceData || !Array.isArray(sourceData)) return [];

    const transformed = sourceData.map((staff: any) => ({
      id: staff._id || staff.id,
      name: staff.fullName || staff.name,
      position: staff.position || '',
      image: staff.photo || undefined,
      isActive: staff.status === 'active' || staff.status === 'Active',
      isAvailable: staff.isAvailable !== false,
      isCurrentlyAvailable: staff.isCurrentlyAvailable !== false,
      workingHours: staff.workingHours || {
        startTime: '09:00',
        endTime: '18:00',
        startHour: 9,
        endHour: 18
      },
      // Set default availability for each day
      mondayAvailable: staff.mondayAvailable !== false,
      tuesdayAvailable: staff.tuesdayAvailable !== false,
      wednesdayAvailable: staff.wednesdayAvailable !== false,
      thursdayAvailable: staff.thursdayAvailable !== false,
      fridayAvailable: staff.fridayAvailable !== false,
      saturdayAvailable: staff.saturdayAvailable !== false,
      sundayAvailable: staff.sundayAvailable !== false,
      // Initialize empty slots for each day
      mondaySlots: staff.mondaySlots || [],
      tuesdaySlots: staff.tuesdaySlots || [],
      wednesdaySlots: staff.wednesdaySlots || [],
      thursdaySlots: staff.thursdaySlots || [],
      fridaySlots: staff.fridaySlots || [],
      saturdaySlots: staff.saturdaySlots || [],
      sundaySlots: staff.sundaySlots || [],
      // Set default weekday/weekend availability
      hasWeekdayAvailability: staff.hasWeekdayAvailability !== false,
      hasWeekendAvailability: staff.hasWeekendAvailability !== false,
      // Initialize empty blocked times array
      blockedTimes: staff.blockedTimes || [],
      // Add any other required fields with defaults
      startTime: staff.startTime || '09:00',
      endTime: staff.endTime || '18:00',
      timezone: staff.timezone || 'Asia/Kolkata'
    }));

    // Add "Any Professional" as the first column for unassigned appointments
    const anyProfessional = {
      id: 'Any Professional', // Matches staffName in the example
      name: 'Any Professional',
      position: 'Shared Pool',
      isActive: true,
      isAvailable: true,
      isCurrentlyAvailable: true,
      workingHours: {
        startTime: '08:00',
        endTime: '22:00',
        startHour: 8,
        endHour: 22
      },
      mondayAvailable: true,
      tuesdayAvailable: true,
      wednesdayAvailable: true,
      thursdayAvailable: true,
      fridayAvailable: true,
      saturdayAvailable: true,
      sundayAvailable: true,
      mondaySlots: [],
      tuesdaySlots: [],
      wednesdaySlots: [],
      thursdaySlots: [],
      fridaySlots: [],
      saturdaySlots: [],
      sundaySlots: [],
      hasWeekdayAvailability: true,
      hasWeekendAvailability: true,
      blockedTimes: [],
      startTime: '08:00',
      endTime: '22:00',
      timezone: 'Asia/Kolkata'
    };

    // Find any staff in appointments that are not in the sourceData
    // This ensures that appointments assigned to "Wedding Team" or inactive staff still show up
    const missingStaffMap = new Map();

    if (appointments && Array.isArray(appointments)) {
      appointments.forEach((appt: any) => {
        // Skip if no staff assigned or if it's "Any Professional"
        if (!appt.staffName || appt.staffName === 'Any Professional') return;

        // Check if this staff already exists in our transformed list
        const exists = transformed.some(s =>
          s.id === appt.staff ||
          s.name === appt.staffName ||
          (s.id && appt.staff && s.id.toString() === appt.staff.toString())
        );

        if (!exists && !missingStaffMap.has(appt.staffName)) {
          // Create a virtual staff member for this appointment
          missingStaffMap.set(appt.staffName, {
            id: appt.staff || `virtual-${appt.staffName.replace(/\s+/g, '-')}`,
            name: appt.staffName,
            position: appt.isWeddingService ? 'Wedding Team' : (appt.isHomeService ? 'Home Service' : 'External/Inactive'),
            isActive: true, // Force active so it shows up
            isAvailable: true,
            isCurrentlyAvailable: true,
            workingHours: {
              startTime: '08:00',
              endTime: '20:00',
              startHour: 8,
              endHour: 20
            },
            mondayAvailable: true,
            tuesdayAvailable: true,
            wednesdayAvailable: true,
            thursdayAvailable: true,
            fridayAvailable: true,
            saturdayAvailable: true,
            sundayAvailable: true,
            mondaySlots: [],
            tuesdaySlots: [],
            wednesdaySlots: [],
            thursdaySlots: [],
            fridaySlots: [],
            saturdaySlots: [],
            sundaySlots: [],
            hasWeekdayAvailability: true,
            hasWeekendAvailability: true,
            blockedTimes: [],
            startTime: '08:00',
            endTime: '20:00',
            timezone: 'Asia/Kolkata',
            isVirtual: true // Flag to identify auto-generated staff
          });
        }

        // For wedding/multi-service appointments, also scan serviceItems
        // so every team member gets a column even if not the primary staff
        if ((appt.isWeddingService || appt.isMultiService) && Array.isArray(appt.serviceItems)) {
          appt.serviceItems.forEach((item: any) => {
            if (!item.staffName || item.staffName === 'Any Professional') return;
            const itemStaffExists = transformed.some(s =>
              s.id === item.staff ||
              s.name === item.staffName ||
              (s.id && item.staff && s.id.toString() === item.staff.toString())
            );
            if (!itemStaffExists && !missingStaffMap.has(item.staffName)) {
              missingStaffMap.set(item.staffName, {
                id: item.staff || `virtual-${item.staffName.replace(/\s+/g, '-')}`,
                name: item.staffName,
                position: appt.isWeddingService ? 'Wedding Team' : 'Team Member',
                isActive: true,
                isAvailable: true,
                isCurrentlyAvailable: true,
                workingHours: { startTime: '08:00', endTime: '20:00', startHour: 8, endHour: 20 },
                mondayAvailable: true, tuesdayAvailable: true, wednesdayAvailable: true,
                thursdayAvailable: true, fridayAvailable: true, saturdayAvailable: true,
                sundayAvailable: true, mondaySlots: [], tuesdaySlots: [], wednesdaySlots: [],
                thursdaySlots: [], fridaySlots: [], saturdaySlots: [], sundaySlots: [],
                hasWeekdayAvailability: true, hasWeekendAvailability: true, blockedTimes: [],
                startTime: '08:00', endTime: '20:00', timezone: 'Asia/Kolkata',
                isVirtual: true
              });
            }
          });
        }
      });
    }

    const virtualStaff = Array.from(missingStaffMap.values());

    return [anyProfessional, ...transformed, ...virtualStaff];
  }, [staffData, doctorStaffData, role, appointments]);

  // Debug: Log the response structure
  useEffect(() => {
    if (workingHoursData) {
    }
    if (workingHoursError) {
      console.error('Working Hours API Error:', workingHoursError);
    }

    // Debug: Log staff data

  }, [workingHoursData, workingHoursError, staffData, staffList]);

  // Get working hours for the current day from the response
  const dayWorkingHours = useMemo(() => {
    // Default working hours if none found
    const defaultHours = {
      startTime: '09:00',
      endTime: '18:00',
      isWorking: true
    };

    if (!workingHoursData) {
      return defaultHours;
    }

    // Handle doctor working hours structure (different from vendor)
    let workingHoursArray = [];
    if (role === 'doctor') {
      // Doctor working hours are in workingHoursArray property
      workingHoursArray = workingHoursData.workingHoursArray || [];
    } else {
      // Vendor working hours are in workingHours property
      workingHoursArray = workingHoursData.workingHours || [];
    }

    if (!Array.isArray(workingHoursArray)) {
      return defaultHours;
    }

    // Find the day - convert dayName to match API format (Monday, Tuesday, etc.)
    const targetDay = dayName ? dayName.charAt(0).toUpperCase() + dayName.slice(1) : '';

    const found = workingHoursArray.find(
      (dayData: any) => dayData.day === targetDay
    );


    // For doctors, isOpen property indicates if the day is working
    if (role === 'doctor') {
      return {
        startTime: found?.open || '09:00',
        endTime: found?.close || '18:00',
        isWorking: found?.isOpen !== false // Default to true if isOpen is not explicitly false
      };
    }

    return found || defaultHours;
  }, [workingHoursData, dayName, role]);

  // Get blocked times for the selected date with proper timezone handling
  const blockedTimes = useSelector((state: any) => {
    if (!selectedDate) return [];

    return (state?.blockTime?.blockedTimes || []).filter((block: any) => {
      if (!block?.date) return false;

      // Create date objects in local timezone for comparison
      const blockDate = new Date(block.date);

      // Compare year, month, and date parts only
      return blockDate.getFullYear() === selectedDate.getFullYear() &&
        blockDate.getMonth() === selectedDate.getMonth() &&
        blockDate.getDate() === selectedDate.getDate();
    });
  });

  // Handle status change from AppointmentDetailView
  const handleStatusChange = useCallback(async (newStatus: string, cancellationReason?: string) => {
    if (!selectedAppointment) return;

    try {
      setIsLoading(true);

      // Call the updateAppointmentStatus mutation
      await updateAppointmentStatus({
        id: selectedAppointment._id || selectedAppointment.id,
        status: newStatus,
        cancellationReason: cancellationReason || (newStatus === 'cancelled' ? 'No reason provided' : undefined)
      }).unwrap();

      // Show success message
      toast.success(`Appointment ${newStatus} successfully`);

      // Refresh appointments to show updated status on calendar grid
      await refetchAppointments();

      // Close the detail view
      setSelectedAppointment(null);

    } catch (error: any) {
      console.error('Error updating appointment status:', error);
      toast.error(`Failed to ${newStatus} appointment`, {
        description: error?.data?.message || error.message || 'Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedAppointment, updateAppointmentStatus, refetchAppointments]);

  // Handle collect payment
  const handleCollectPayment = async (paymentData: { amount: number; paymentMethod: string; notes?: string }) => {
    const toastId = toast.loading('Processing payment...');
    try {
      if (!selectedAppointment?._id) {
        throw new Error('No appointment selected');
      }

      // Calculate the new paid amount
      const currentAmountPaid = (selectedAppointment as any).amountPaid || (selectedAppointment as any).payment?.paid || 0;
      const totalAmount = (selectedAppointment as any).finalAmount || selectedAppointment.totalAmount || 0;
      const currentBalance = totalAmount - currentAmountPaid;

      // Validate that payment does not exceed remaining balance
      if (paymentData.amount > currentBalance + 0.01) {
        toast.error(`Payment amount (₹${paymentData.amount.toFixed(2)}) exceeds remaining balance (₹${currentBalance.toFixed(2)})`);
        return;
      }

      const newPaidAmount = ((selectedAppointment as any).payment?.paid || 0) + paymentData.amount;
      const newAmountPaid = currentAmountPaid + paymentData.amount;
      const remainingAmount = Math.max(0, totalAmount - newAmountPaid);

      // Determine payment status
      let paymentStatus = 'pending';
      if (newAmountPaid >= totalAmount - 0.01) {
        paymentStatus = 'completed';
      } else if (newAmountPaid > 0) {
        paymentStatus = 'partial';
      }

      // Update appointment with payment information
      const updatedAppointment = {
        ...selectedAppointment,
        payment: {
          ...(selectedAppointment as any).payment,
          paid: newPaidAmount,
          paymentMethod: paymentData.paymentMethod,
          paymentStatus: paymentStatus,
          lastPaymentDate: new Date().toISOString(),
          lastPaymentAmount: paymentData.amount,
          lastPaymentNotes: paymentData.notes || '',
        },
        paymentStatus: paymentStatus,
        amountPaid: newAmountPaid,
        amountRemaining: remainingAmount,
      };

      // Call the update appointment API
      await updateAppointment({
        id: selectedAppointment._id,
        ...updatedAppointment,
        date: formatDateForAPI(new Date(selectedAppointment.date)),
      }).unwrap();

      toast.success('Payment collected successfully', {
        description: `₹${paymentData.amount.toFixed(2)} received via ${paymentData.paymentMethod}`
      });

      // Refresh appointments to show updated payment status
      await refetchAppointments();

      // Close the appointment detail view
      setSelectedAppointment(null);

    } catch (error: any) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment', {
        description: error?.data?.message || error.message || 'Please try again.'
      });
    } finally {
      toast.dismiss(toastId);
    }
  };

  // Handle updating an appointment
  const handleUpdateAppointment = useCallback(async (updatedAppointment: any) => {
    const toastId = toast.loading('Updating appointment...');
    try {
      const appointmentId = updatedAppointment?._id || updatedAppointment?.id;
      if (!appointmentId) {
        throw new Error('Cannot update appointment: Missing appointment ID');
      }


      // Format the data for the API
      const updateData = {
        id: appointmentId,
        _id: appointmentId, // Include both id and _id for backward compatibility
        ...updatedAppointment,
        // Ensure date is properly formatted for the API
        date: formatDateForAPI(new Date(updatedAppointment.date)),
        // Ensure all required fields are included
        clientName: updatedAppointment.clientName || updatedAppointment.client,
        serviceName: updatedAppointment.serviceName || updatedAppointment.service,
        staffName: updatedAppointment.staffName || updatedAppointment.staff,
      };


      // For partial updates, we should ensure we're not missing required fields
      // If this is just a status update, make sure we include all required fields
      const result = await updateAppointment(updateData).unwrap();

      await refetchAppointments();

      toast.success('Appointment updated successfully');
      return result;

    } catch (error: any) {
      console.error('Error updating appointment:', error);
      toast.error('Failed to update appointment', {
        description: error?.data?.message || error.message || 'Please try again.'
      });
      throw error;
    } finally {
      toast.dismiss(toastId);
    }
  }, [updateAppointment, refetchAppointments]);

  // Handle appointment reschedule
  const handleRescheduleAppointment = async (appointmentData: any) => {
    const toastId = toast.loading('Rescheduling appointment...');
    try {
      const appointmentId = appointmentData?._id || appointmentData?.id;
      if (!appointmentId) {
        throw new Error('Cannot reschedule appointment: Missing appointment ID');
      }


      // Format the data for the API
      const rescheduleData = {
        id: appointmentId,
        ...appointmentData,
        // Ensure date is properly formatted for the API
        date: formatDateForAPI(new Date(appointmentData.date)),
        // Ensure all required fields are included
        clientName: appointmentData.clientName || appointmentData.client,
        serviceName: appointmentData.serviceName || appointmentData.service,
        staffName: appointmentData.staffName || appointmentData.staff,
      };


      // For rescheduling, ensure all required fields are preserved
      const result = await updateAppointment(rescheduleData).unwrap();

      await refetchAppointments();

      toast.success('Appointment rescheduled successfully');
      return result;

    } catch (error: any) {
      console.error('Error rescheduling appointment:', error);
      toast.error('Failed to reschedule appointment', {
        description: error?.data?.message || error.message || 'Please try again.'
      });
      throw error;
    } finally {
      toast.dismiss(toastId);
    }
  };

  if (!isValid || !selectedDate) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Invalid date selected</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="relative p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <Button
            variant="ghost"
            onClick={handleBackClick}
            className="hover:bg-secondary/80 transition-all duration-200 rounded-lg px-4 py-2 text-foreground font-medium text-sm flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Calendar
          </Button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
            {role !== 'doctor' && (
              <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                <SelectTrigger className="w-full sm:w-[180px] h-12">
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Staff">All Staff</SelectItem>
                  {staffList.map(staff => (
                    <SelectItem key={staff.id} value={staff.name}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              onClick={handleNewAppointment}
              className="h-12 px-6 rounded-lg bg-primary hover:bg-primary/90 transition-colors duration-200 flex-1 sm:flex-none"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Booking
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <DayScheduleView
            selectedDate={selectedDate}
            appointments={filteredAppointments}
            staffList={staffList}
            workingHours={dayWorkingHours}
            blockedTimes={blockedTimes}
            isLoading={isLoading || isLoadingAppointments || isLoadingWorkingHours || (role !== 'doctor' && isLoadingStaff)}
            error={staffError || workingHoursError}
            role={role}
            onAppointmentClick={handleAppointmentClick}
            onTimeSlotClick={handleTimeSlotClick}
            timeSlots={useMemo(() => {
              try {
                // Get working hours with fallbacks
                const startTime = dayWorkingHours?.startTime || '09:00';
                const endTime = dayWorkingHours?.endTime || '18:00';
                const isWorking = dayWorkingHours?.isWorking !== false;

                // Parse start and end times
                const [startHour, startMinute] = parseTimeString(startTime);
                const [endHour, endMinute] = parseTimeString(endTime);

                // Create date objects in local timezone
                const startDate = new Date(selectedDate);
                startDate.setHours(startHour, startMinute, 0, 0);

                const endDate = new Date(selectedDate);
                endDate.setHours(endHour, endMinute, 0, 0);

                // Handle case where end time is on the next day
                if (endDate <= startDate) {
                  endDate.setDate(endDate.getDate() + 1);
                }

                const slots = [];
                let current = new Date(startDate);
                const slotDuration = 30; // minutes

                // Generate slots every 30 minutes within working hours
                while (current < endDate) {
                  const hours = current.getHours();
                  const minutes = current.getMinutes();

                  // Format time in 24-hour format for internal use (HH:MM)
                  const time24 = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

                  // Format time in 12-hour format for display (h:MM AM/PM)
                  const displayHours = hours % 12 || 12;
                  const period = hours >= 12 ? 'PM' : 'AM';
                  const formattedTime = `${displayHours}:${String(minutes).padStart(2, '0')}${period}`;

                  slots.push({
                    id: `${formatDateForAPI(selectedDate)}-${time24}`,
                    time: time24, // Internal: 24-hour format (HH:MM)
                    formattedTime: formattedTime, // Display: 12-hour format (h:MM AM/PM)
                    isAvailable: isWorking, // Respect working/non-working day
                    staffId: 'default',
                    date: new Date(current) // Store the exact date object for this slot
                  });

                  // Move to next time slot
                  current = new Date(current.getTime() + slotDuration * 60000);
                }



                return slots;

              } catch (error) {
                console.error('Error generating time slots:', error);
                // Fallback to default time slots if there's an error
                return [
                  '09:00am', '09:30am', '10:00am', '10:30am', '11:00am', '11:30am',
                  '12:00pm', '12:30pm', '01:00pm', '01:30pm', '02:00pm', '02:30pm',
                  '03:00pm', '03:30pm', '04:00pm', '04:30pm', '05:00pm', '05:30pm',
                  '06:00pm', '06:30pm', '07:00pm'
                ].map(time => ({
                  id: `${formatDateForAPI(selectedDate)}-${time}`,
                  time: time,
                  formattedTime: time,
                  isAvailable: true,
                  staffId: 'default',
                  date: new Date(selectedDate)
                }));
              }
            }, [dayWorkingHours, selectedDate])}
            onCreateAppointment={handleCreateNewAppointment}
            onDateChange={handleDateChange}
            onUpdateAppointmentStatus={handleUpdateStatus}
            onCollectPayment={handleCollectPayment}
          />
        </div>
      </div>

      <Dialog
        open={isNewAppointmentOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setIsNewAppointmentOpen(false);
            setSelectedTimeSlot(null);
            setSelectedAppointment(null);
          } else {
            setIsNewAppointmentOpen(true);
          }
        }}
      >
        <DialogContent
          className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {selectedAppointment ? 'Edit Appointment' : 'New Appointment'}
            </DialogTitle>
          </DialogHeader>
          <NewAppointmentForm
            defaultDate={selectedTimeSlot?.date || selectedDate}
            defaultValues={{
              ...(selectedTimeSlot && {
                startTime: selectedTimeSlot.time,
                // Set end time to 1 hour after start time by default
                endTime: format(addMinutes(selectedTimeSlot.date, 60), 'hh:mmaaa').toLowerCase(),
              }),
              ...(selectedAppointment && {
                ...selectedAppointment,
                date: selectedDate,
              })
            }}
            isEditing={!!selectedAppointment}
            onSubmit={handleAppointmentSubmit}
            onCancel={() => {
              setIsNewAppointmentOpen(false);
              setSelectedTimeSlot(null);
              setSelectedAppointment(null);
            }}
            onDelete={selectedAppointment?._id ? () => handleDeleteAppointment(selectedAppointment._id!) : undefined}
            onSuccess={async () => {
              await refetchAppointments();
              setIsNewAppointmentOpen(false);
              setSelectedTimeSlot(null);
              setSelectedAppointment(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Appointment Detail View */}
      {selectedAppointment && selectedAppointment._id && (
        <AppointmentDetailView
          // @ts-ignore - Type compatibility issue with Appointment interfaces
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={handleStatusChange}
          onCollectPayment={handleCollectPayment}
          onUpdateAppointment={handleUpdateAppointment}
          onRescheduleAppointment={handleRescheduleAppointment}
          onOpenAppointment={handleOpenAppointmentFromHistory}
        />
      )}

      {/* Cancel Appointment Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Cancel Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Are you sure you want to cancel this appointment?</p>
            <div className="space-y-2">
              <Label htmlFor="cancelReason" className="text-sm font-medium">Reason for cancellation</Label>
              <Textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please provide a reason for cancellation"
                className="min-h-[80px]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowCancelDialog(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleUpdateStatus(selectedAppointment?._id || '', 'cancelled', cancelReason)}
                disabled={isLoading || !cancelReason.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Confirm Cancellation'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}