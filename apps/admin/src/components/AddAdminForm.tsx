"use client";

import { useState, useEffect } from 'react';
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Checkbox } from "@repo/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { sidebarNavItems } from '@/lib/routes';
import { Trash2, Loader2, Eye, EyeOff, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@repo/ui/cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { useCreateAdminMutation, useUpdateAdminMutation, useDeleteAdminMutation, useGetRegionsQuery } from '../../../../packages/store/src/services/api.js';
import { useAuth } from '@/hooks/useAuth';

export type AdminUser = {
  _id?: string;
  id?: string;
  fullName: string;
  mobileNo: string;
  emailAddress: string;
  password?: string;
  confirmPassword?: string;
  roleName: string;
  designation: string;
  address: string;
  profileImage?: string | File;
  isActive?: boolean;
  assignedRegions?: string[];
  permissions?: string[];
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type AdminRole = {
  roleName: string;
};

type AddAdminFormProps = {
  isOpen: boolean;
  onClose: () => void;
  roles: AdminRole[];
  initialData?: AdminUser | null;
  onSave?: (data: AdminUser) => void;
  onDelete?: (id?: string) => void;
  isEditMode?: boolean;
};

export function AddAdminForm({
  isOpen,
  onClose,
  roles,
  initialData = null,
  onSave,
  onDelete,
  isEditMode = false
}: AddAdminFormProps) {

  const { admin: currentAdmin } = useAuth();

  // RTK Query hooks
  const [createAdmin, { isLoading: isCreating }] = useCreateAdminMutation();
  const [updateAdmin, { isLoading: isUpdating }] = useUpdateAdminMutation();
  const [deleteAdmin, { isLoading: isDeleting }] = useDeleteAdminMutation();
  const { data: regionsResponse } = useGetRegionsQuery({});
  const allRegions = regionsResponse?.data || [];

  // Filter regions based on current admin's assigned regions if they are not SUPER_ADMIN
  const regionsList = (currentAdmin?.roleName?.toUpperCase() === 'SUPER_ADMIN')
    ? allRegions
    : allRegions.filter((r: any) => currentAdmin?.assignedRegions?.includes(r._id));

  const isTargetSuperAdmin = initialData?.roleName?.toUpperCase() === 'SUPER_ADMIN';
  const isCurrentSuperAdmin = currentAdmin?.roleName?.toUpperCase() === 'SUPER_ADMIN';
  const isSuperAdminPasswordRestricted = isEditMode && isTargetSuperAdmin && !isCurrentSuperAdmin;

  const getInitialFormData = (data: AdminUser | null) => {
    const base = {
      fullName: '',
      mobileNo: '',
      emailAddress: '',
      password: '',
      confirmPassword: '',
      roleName: (!isEditMode && currentAdmin?.roleName?.toUpperCase() === 'REGIONAL_ADMIN') ? 'STAFF' : '',
      designation: '',
      address: '',
      permissions: [],
      assignedRegions: [],
      ...data
    };

    // Normalize mobile number: strip country code (+91) and non-digits to keep 10-digit number
    if (base.mobileNo) {
      const digits = String(base.mobileNo).replace(/\D/g, '');
      base.mobileNo = digits.length > 10 ? digits.slice(-10) : digits;
    }

    // Normalize roleName to UPPERCASE for consistent UI matching in Select component
    if (base.roleName) {
      base.roleName = base.roleName.toUpperCase();
    }

    return base as AdminUser;
  };

  const [formData, setFormData] = useState<AdminUser>(getInitialFormData(initialData));
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP Verification States
  const [emailOtp, setEmailOtp] = useState('');
  const [isEmailOtpSent, setIsEmailOtpSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  const [phoneOtp, setPhoneOtp] = useState('');
  const [isPhoneOtpSent, setIsPhoneOtpSent] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  const [isOtpLoading, setIsOtpLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initialFormState = getInitialFormData(initialData);
      setFormData(initialFormState);
      setSelectedPermissions(initialFormState.permissions || []);
      setSelectedRegions(initialFormState.assignedRegions || []);
      setSelectedFile(null);
      setErrors({});
      setShowPassword(false);
      setShowConfirmPassword(false);

      // Reset Verification
      setEmailOtp('');
      setIsEmailOtpSent(false);
      setIsEmailVerified(isEditMode);
      setPhoneOtp('');
      setIsPhoneOtpSent(false);
      setIsPhoneVerified(isEditMode);
    }
  }, [isOpen, initialData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // Prevent numbers in Full Name and Designation
    if ((name === 'fullName' || name === 'designation') && /[0-9]/.test(value)) {
      return;
    }

    if (name === 'mobileNo') {
      const numericValue = value.replace(/\D/g, '');
      if (numericValue.length > 10) return;
      let numericValue = value.replace(/\D/g, '');
      if (numericValue.length > 10) {
        if (numericValue.startsWith('91') && numericValue.length === 12) {
          numericValue = numericValue.slice(2);
        } else {
          numericValue = numericValue.slice(-10);
        }
      }

      if (!isEditMode) {
        setIsPhoneVerified(false);
        setIsPhoneOtpSent(false);
      }

      setFormData(prev => ({
        ...prev,
        [name]: numericValue
      }));
    } else if (name === 'emailAddress') {
      let finalValue = value;
      if (!isEditMode) {
        finalValue = value.replace(/[^a-zA-Z0-9@.]/g, '');
        setIsEmailVerified(false);
        setIsEmailOtpSent(false);
      }
      setFormData(prev => ({
        ...prev,
        [name]: finalValue
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!validTypes.includes(file.type)) {
        setErrors(prev => ({ ...prev, profileImage: 'Please upload a valid image file (JPG or PNG).' }));
        e.target.value = '';
        return;
      }

      if (file.size > maxSize) {
        setErrors(prev => ({ ...prev, profileImage: 'Image size should be maximum 5MB.' }));
        e.target.value = '';
        return;
      }

      setSelectedFile(file);
      setErrors(prev => ({ ...prev, profileImage: '' }));
    }
  };

  const handlePermissionChange = (module: string, action: string, checked: boolean) => {
    setSelectedPermissions(prev => {
      let updated = checked ? [...prev, `${module}:${action}`] : prev.filter(p => p !== `${module}:${action}`);

      // If "all" is checked, automatically check everything else
      if (action === 'all' && checked) {
        updated = updated.filter(p => !p.startsWith(`${module}:`));
        updated.push(`${module}:all`, `${module}:view`, `${module}:edit`, `${module}:delete`);
      }

      // If "all" is unchecked, remove the :all flag
      if (action === 'all' && !checked) {
        updated = updated.filter(p => p !== `${module}:all`);
      }

      // If "edit" or "delete" is checked, automatically check "view"
      if (checked && (action === 'edit' || action === 'delete')) {
        if (!updated.includes(`${module}:view`)) {
          updated.push(`${module}:view`);
        }
      }

      // If "view" is unchecked, also uncheck "edit", "delete", and "all" (because you can't edit what you can't see)
      if (action === 'view' && !checked) {
        updated = updated.filter(p => p !== `${module}:edit` && p !== `${module}:delete` && p !== `${module}:all`);
      }

      return Array.from(new Set(updated)); // Ensure uniqueness
    });
  };

  const isPermissionChecked = (module: string, action: string) => {
    // If "all" is selected, show all checkboxes as checked
    if (selectedPermissions.includes(`${module}:all`)) {
      return true;
    }
    return selectedPermissions.includes(`${module}:${action}`);
  };

  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  const handleSendEmailOtp = async () => {
    if (!formData.emailAddress || !/\S+@\S+\.\S+/.test(formData.emailAddress)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setIsOtpLoading(true);
    try {
      const res = await fetch('/api/admin/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.emailAddress }),
      });
      const data = await res.json();
      if (data.success) {
        setIsEmailOtpSent(true);
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error("Failed to send email OTP");
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!emailOtp || emailOtp.length < 6) {
      toast.error("Please enter a valid OTP");
      return;
    }
    setIsOtpLoading(true);
    try {
      const res = await fetch('/api/admin/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.emailAddress, otp: emailOtp }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setIsEmailVerified(true);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error("Failed to verify email OTP");
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    if (!formData.mobileNo || formData.mobileNo.length < 10) {
      toast.error("Please enter a valid mobile number");
      return;
    }
    setIsOtpLoading(true);
    try {
      const res = await fetch('/api/admin/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.mobileNo }),
      });
      const data = await res.json();
      if (data.success) {
        setIsPhoneOtpSent(true);
        toast.success(data.message || 'OTP sent to mobile number');
      } else {
        toast.error(data.message || 'Failed to send phone OTP');
      }
    } catch (err) {
      toast.error("Failed to send phone OTP");
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!phoneOtp || phoneOtp.length < 6) {
      toast.error("Please enter a valid OTP");
      return;
    }
    setIsOtpLoading(true);
    try {
      const res = await fetch('/api/admin/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.mobileNo, otp: phoneOtp }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Mobile number verified successfully!');
        setIsPhoneVerified(true);
      } else {
        toast.error(data.message || 'Invalid phone OTP');
      }
    } catch (err) {
      toast.error("Failed to verify phone OTP");
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleRegionToggle = (regionId: string, checked: boolean) => {
    setSelectedRegions(prev =>
      checked ? [...prev, regionId] : prev.filter(id => id !== regionId)
    );
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (!/^[a-zA-Z\s]+$/.test(formData.fullName)) {
      newErrors.fullName = 'Full Name should contain only alphabets and spaces.';
    }

    const cleanMobile = formData.mobileNo ? formData.mobileNo.replace(/\D/g, '').slice(-10) : '';
    if (!formData.mobileNo.trim()) {
      newErrors.mobileNo = 'Mobile number is required';
    } else if (!/^\d{10}$/.test(formData.mobileNo)) {
    } else if (!/^\d{10}$/.test(cleanMobile)) {
      newErrors.mobileNo = 'Please enter a valid 10-digit mobile number.';
    } else if (!isEditMode && !isPhoneVerified) {
      newErrors.mobileNo = 'Please verify your mobile number.';
    }

    if (!formData.emailAddress.trim()) {
      newErrors.emailAddress = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.emailAddress)) {
      newErrors.emailAddress = 'Please enter a valid email address.';
    } else if (!isEditMode && !isEmailVerified) {
      newErrors.emailAddress = 'Please verify your email address.';
    }

    if (!formData.roleName) {
      newErrors.roleName = 'Role is required';
    }

    if (!formData.designation.trim()) {
      newErrors.designation = 'Designation is required';
    } else if (!/^[a-zA-Z\s]+$/.test(formData.designation)) {
      newErrors.designation = 'Designation should contain only text.';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    } else if (!/^[a-zA-Z\s]+$/.test(formData.address)) {
      newErrors.address = 'Address should contain only alphabets and spaces.';
    }

    // Password validation for new admin or when changing password
    if (!isEditMode || formData.password) {
      if (isSuperAdminPasswordRestricted && formData.password) {
        newErrors.password = "You do not have permission to reset Super Admin's password.";
      } else if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(formData.password)) {
        newErrors.password = 'Password must be at least 8 characters and include uppercase, lowercase, and a number.';
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Password and Confirm Password must be the same.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      // Handle file upload separately if needed
      let profileImageUrl = formData.profileImage;

      // If there's a new file selected, convert to base64
      if (selectedFile) {
        const fileBase64 = await convertFileToBase64(selectedFile);
        profileImageUrl = fileBase64;
      }

      const cleanMobile = formData.mobileNo.replace(/\D/g, '').slice(-10);

      // Prepare JSON data matching MongoDB schema
      const jsonDataToSend = {
        fullName: formData.fullName.trim(),
        mobileNo: formData.mobileNo.trim(),
        mobileNo: cleanMobile,
        emailAddress: formData.emailAddress.trim(),
        roleName: formData.roleName,
        designation: formData.designation.trim(),
        address: formData.address.trim(),
        permissions: selectedPermissions,
        assignedRegions: currentAdmin?.roleName?.toUpperCase() === 'REGIONAL_ADMIN'
          ? (selectedRegions.length > 0 ? selectedRegions : currentAdmin.assignedRegions)
          : selectedRegions,
        isActive: formData.isActive ?? true,
        updatedAt: new Date().toISOString(),
        ...(profileImageUrl && { profileImage: profileImageUrl }),
        // Only include password fields if needed and allowed
        ...(!isEditMode || (formData.password && !isSuperAdminPasswordRestricted) ? {
          password: formData.password
        } : {}),
        // Add createdAt only for new admin
        ...(!isEditMode ? {
          createdAt: new Date().toISOString()
        } : {}),
      };

      if (isEditMode && (formData.id || formData._id)) {
        // Update existing admin
        await updateAdmin({
          id: formData.id || formData._id!,
          data: jsonDataToSend
        }).unwrap();
      } else {
        // Create new admin
        await createAdmin(jsonDataToSend).unwrap();
      }

      // Call onSave callback if provided (for backward compatibility)
      if (onSave) {
        const dataToSave: AdminUser = {
          ...formData,
          permissions: selectedPermissions,
          profileImage: profileImageUrl,
          password: (isEditMode && !formData.password) ? undefined : formData.password,
          confirmPassword: (isEditMode && !formData.password) ? undefined : formData.confirmPassword,
        };
        onSave(dataToSave);
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving admin:', error);
      // Handle API errors
      if (error.data?.message) {
        setErrors({ general: error.data.message });
      } else {
        setErrors({ general: 'An error occurred while saving the admin' });
      }
    }
  };

  // Helper function to convert file to base64
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Alternative: Upload file separately (uncomment if using separate file upload endpoint)
  // const uploadFile = async (file: File): Promise<string> => {
  //   const fileFormData = new FormData();
  //   fileFormData.append('file', file);
  //   
  //   const response = await fetch('/api/upload', {
  //     method: 'POST',
  //     body: fileFormData,
  //   });
  //   
  //   if (!response.ok) {
  //     throw new Error('File upload failed');
  //   }
  //   
  //   const result = await response.json();
  //   return result.url;
  // };

  const handleDelete = async () => {
    const adminId = formData.id || formData._id;
    if (!adminId) return;

    const confirmed = window.confirm('Are you sure you want to delete this admin?');
    if (!confirmed) return;

    try {
      await deleteAdmin(adminId).unwrap();

      // Call onDelete callback if provided (for backward compatibility)
      if (onDelete) {
        onDelete(adminId);
      }

      onClose();
    } catch (error: any) {
      console.error('Error deleting admin:', error);
      setErrors({ general: 'An error occurred while deleting the admin' });
    }
  };

  const isLoading = isCreating || isUpdating || isDeleting;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="sticky top-0 bg-background z-10 pb-4">
            <DialogTitle className="text-lg sm:text-xl">
              {isEditMode ? 'Edit Admin User' : 'Add New Admin'}
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              {isEditMode
                ? 'Update the admin user details and permissions below.'
                : 'Fill in the details below to create a new admin user.'}
            </DialogDescription>
          </DialogHeader>

          {errors.general && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm mb-4">
              {errors.general}
            </div>
          )}

          <div className="grid gap-4 sm:gap-6 py-4">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-base font-medium border-b pb-2">Basic Information</h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm">Full Name *</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className={`text-sm ${errors.fullName ? 'border-destructive' : ''}`}
                    disabled={isLoading}
                    required
                  />
                  {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                </div>

                <div className="space-y-2 p-3 rounded border border-gray-100 bg-gray-50/30">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="mobileNo" className="text-sm font-semibold flex items-center gap-1">Mobile Number *</Label>
                    {!isEditMode && isPhoneVerified && <span className="text-green-600 text-xs font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Verified</span>}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="mobileNo"
                      name="mobileNo"
                      type="tel"
                      value={formData.mobileNo}
                      onChange={handleInputChange}
                      className={cn(`text-sm flex-1 ${errors.mobileNo ? 'border-destructive' : ''}`, !isEditMode && isPhoneVerified && "border-green-300 bg-green-50 text-green-800")}
                      disabled={isLoading || (!isEditMode && (isPhoneVerified || isOtpLoading))}
                      required
                    />
                    {!isEditMode && !isPhoneVerified && (
                      <Button
                        type="button"
                        onClick={handleSendPhoneOtp}
                        disabled={isOtpLoading || !formData.mobileNo || formData.mobileNo.length < 10}
                        className="text-sm px-3 bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      >
                        {isPhoneOtpSent ? "Resend" : "Verify"}
                      </Button>
                    )}
                  </div>
                  {errors.mobileNo && <p className="text-xs text-destructive">{errors.mobileNo}</p>}

                  {!isEditMode && isPhoneOtpSent && !isPhoneVerified && (
                    <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="OTP"
                          maxLength={6}
                          value={phoneOtp}
                          onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
                          disabled={isOtpLoading}
                          className="text-sm flex-1 text-center tracking-widest font-black"
                        />
                        <Button
                          type="button"
                          onClick={handleVerifyPhoneOtp}
                          disabled={isOtpLoading || phoneOtp.length < 6}
                          className="text-sm px-4 bg-primary text-primary-foreground"
                        >
                          {isOtpLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Verify"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2 p-3 rounded border border-gray-100 bg-gray-50/30">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="emailAddress" className="text-sm font-semibold flex items-center gap-1">Email Address *</Label>
                    {!isEditMode && isEmailVerified && <span className="text-green-600 text-xs font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Verified</span>}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="emailAddress"
                      name="emailAddress"
                      type="email"
                      value={formData.emailAddress}
                      onChange={handleInputChange}
                      className={cn(`text-sm flex-1 ${errors.emailAddress ? 'border-destructive' : ''}`, !isEditMode && isEmailVerified && "border-green-300 bg-green-50 text-green-800")}
                      disabled={isLoading || (!isEditMode && (isEmailVerified || isOtpLoading))}
                      required
                    />
                    {!isEditMode && !isEmailVerified && (
                      <Button
                        type="button"
                        onClick={handleSendEmailOtp}
                        disabled={isOtpLoading || !formData.emailAddress || !/\S+@\S+\.\S+/.test(formData.emailAddress)}
                        className="text-sm px-3 bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      >
                        {isEmailOtpSent ? "Resend" : "Verify"}
                      </Button>
                    )}
                  </div>
                  {errors.emailAddress && <p className="text-xs text-destructive">{errors.emailAddress}</p>}

                  {!isEditMode && isEmailOtpSent && !isEmailVerified && (
                    <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="OTP"
                          maxLength={6}
                          value={emailOtp}
                          onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                          disabled={isOtpLoading}
                          className="text-sm flex-1 text-center tracking-widest font-black"
                        />
                        <Button
                          type="button"
                          onClick={handleVerifyEmailOtp}
                          disabled={isOtpLoading || emailOtp.length < 6}
                          className="text-sm px-4 bg-primary text-primary-foreground"
                        >
                          {isOtpLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Verify"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="designation" className="text-sm">Designation *</Label>
                  <Input
                    id="designation"
                    name="designation"
                    value={formData.designation}
                    onChange={handleInputChange}
                    className={`text-sm ${errors.designation ? 'border-destructive' : ''}`}
                    disabled={isLoading}
                    required
                  />
                  {errors.designation && <p className="text-xs text-destructive">{errors.designation}</p>}
                </div>
              </div>
            </div>

            {/* Security Section */}
            <div className="space-y-4">
              <h3 className="text-base font-medium border-b pb-2">Security</h3>

              {isSuperAdminPasswordRestricted ? (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-xs sm:text-sm">
                  Super Admin password cannot be reset by another admin role. Only Super Admin can change their own password.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm">
                      {isEditMode ? 'New Password (Optional)' : 'Password *'}
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password || ''}
                        onChange={handleInputChange}
                        className={`text-sm pr-10 ${errors.password ? 'border-destructive' : ''}`}
                        disabled={isLoading}
                        required={!isEditMode}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm">
                      {isEditMode ? 'Confirm New Password' : 'Confirm Password *'}
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={formData.confirmPassword || ''}
                        onChange={handleInputChange}
                        className={`text-sm pr-10 ${errors.confirmPassword ? 'border-destructive' : ''}`}
                        disabled={isLoading}
                        required={!isEditMode || !!formData.password}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Role & Profile Section */}
            <div className="space-y-4">
              <h3 className="text-base font-medium border-b pb-2">Role & Profile</h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="roleName" className="text-sm">Role *</Label>
                  <Select
                    value={formData.roleName}
                    onValueChange={(value) => {
                      setFormData(prev => ({ ...prev, roleName: value }));
                      if (errors.roleName) {
                        setErrors(prev => ({ ...prev, roleName: '' }));
                      }
                    }}
                    disabled={isLoading || (isEditMode && (initialData?._id?.toString() === currentAdmin?.userId?.toString()) && currentAdmin?.roleName?.toUpperCase() !== 'SUPER_ADMIN')}
                    required
                  >
                    <SelectTrigger className={`text-sm ${errors.roleName ? 'border-destructive' : ''}`}>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentAdmin?.roleName?.toUpperCase() === 'SUPER_ADMIN' ? (
                        <>
                          <SelectItem value="SUPER_ADMIN" className="text-sm">SUPER_ADMIN</SelectItem>
                          <SelectItem value="REGIONAL_ADMIN" className="text-sm">REGIONAL_ADMIN</SelectItem>
                          <SelectItem value="STAFF" className="text-sm">STAFF</SelectItem>
                          {/* Allow dynamic roles if they exist in props */}
                          {roles.map((role) => (
                            !['SUPER_ADMIN', 'REGIONAL_ADMIN', 'STAFF'].includes(role.roleName) && (
                              <SelectItem key={role.roleName} value={role.roleName.toUpperCase()} className="text-sm">
                                {role.roleName}
                              </SelectItem>
                            )
                          ))}
                        </>
                      ) : currentAdmin?.roleName?.toUpperCase() === 'REGIONAL_ADMIN' ? (
                        <SelectItem value="STAFF" className="text-sm">STAFF</SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                  {errors.roleName && <p className="text-xs text-destructive">{errors.roleName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profileImage" className="text-sm">Profile Image</Label>
                  <Input
                    id="profileImage"
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={handleFileChange}
                    className="text-sm"
                    disabled={isLoading}
                  />
                  {errors.profileImage && <p className="text-xs text-destructive">{errors.profileImage}</p>}
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div className="space-y-4">
              <h3 className="text-base font-medium border-b pb-2">Address</h3>

              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm">Address *</Label>
                <textarea
                  id="address"
                  name="address"
                  rows={3}
                  className={`flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none ${errors.address ? 'border-destructive' : ''}`}
                  value={formData.address}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  required
                />
                {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
              </div>
            </div>

            {/* Region Assignment Section */}
            {/* Super Admin can assign regions to Regional Admins. Staff are handled separately (global or auto-assigned). */}
            {((currentAdmin?.roleName?.toUpperCase() === 'SUPER_ADMIN' && (formData.roleName?.toUpperCase() === 'REGIONAL_ADMIN')) ||
              (currentAdmin?.roleName?.toUpperCase() === 'REGIONAL_ADMIN' && (formData.roleName?.toUpperCase() === 'STAFF'))) &&
              !(isEditMode && (initialData?._id?.toString() === currentAdmin?.userId?.toString())) ? (
              <div className="space-y-4">
                <h3 className="text-base font-medium border-b pb-2">Region Assignment</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Select regions this admin will be responsible for.
                </p>

                <div className="rounded-md border p-3 sm:p-4 max-h-40 overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {regionsList.map((region: any) => (
                      <div key={region._id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`region_${region._id}`}
                          checked={selectedRegions.includes(region._id)}
                          onCheckedChange={(checked) => handleRegionToggle(region._id, !!checked)}
                          disabled={isLoading}
                        />
                        <label
                          htmlFor={`region_${region._id}`}
                          className="text-xs sm:text-sm font-medium leading-none cursor-pointer"
                        >
                          {region.name} ({region.code})
                        </label>
                      </div>
                    ))}
                    {regionsList.length === 0 && (
                      <p className="text-sm text-muted-foreground">No regions available. Create regions first.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Permissions Section */}
            {(currentAdmin?.roleName?.toUpperCase() === 'SUPER_ADMIN' || (currentAdmin?.roleName?.toUpperCase() === 'REGIONAL_ADMIN' && (formData.roleName?.toUpperCase() === 'STAFF'))) &&
              !(isEditMode && (initialData?._id?.toString() === currentAdmin?.userId?.toString())) ? (
              <div className="space-y-4">
                <h3 className="text-base font-medium border-b pb-2">Granular Permissions</h3>

                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Module / Page</TableHead>
                        <TableHead className="text-center">All</TableHead>
                        <TableHead className="text-center">View</TableHead>
                        <TableHead className="text-center">Edit</TableHead>
                        <TableHead className="text-center">Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sidebarNavItems
                        .filter(item => {
                          // Regional Admin cannot see or assign "Region" or "Admin Roles" permissions for their staff
                          if (currentAdmin?.roleName?.toUpperCase() === 'REGIONAL_ADMIN') {
                            return item.permission !== 'admin-roles';
                          }
                          return true;
                        })
                        .map(item => (
                          <TableRow key={item.permission}>
                            <TableCell className="font-medium">{item.title}</TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                id={`all_${item.permission}`}
                                checked={isPermissionChecked(item.permission, 'all')}
                                onCheckedChange={(checked) => handlePermissionChange(item.permission, 'all', !!checked)}
                                disabled={formData.roleName === 'SUPER_ADMIN' || isLoading}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                id={`view_${item.permission}`}
                                checked={isPermissionChecked(item.permission, 'view')}
                                onCheckedChange={(checked) => handlePermissionChange(item.permission, 'view', !!checked)}
                                disabled={formData.roleName === 'SUPER_ADMIN' || isLoading}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                id={`edit_${item.permission}`}
                                checked={isPermissionChecked(item.permission, 'edit')}
                                onCheckedChange={(checked) => handlePermissionChange(item.permission, 'edit', !!checked)}
                                disabled={formData.roleName === 'SUPER_ADMIN' || isLoading}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                id={`delete_${item.permission}`}
                                checked={isPermissionChecked(item.permission, 'delete')}
                                onCheckedChange={(checked) => handlePermissionChange(item.permission, 'delete', !!checked)}
                                disabled={formData.roleName === 'SUPER_ADMIN' || isLoading}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>

                {formData.roleName === 'SUPER_ADMIN' && (
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Super Admin has access to all permissions by default.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:items-center w-full gap-3 sm:gap-0 pt-4 border-t">
            <div className="order-2 sm:order-1">
              {isEditMode && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isLoading}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Admin
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 order-1 sm:order-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                size="sm"
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                size="sm"
                className="w-full sm:w-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  isEditMode ? 'Update Admin' : 'Create Admin'
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddAdminForm;