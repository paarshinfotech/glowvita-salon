
"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { Pagination } from "@repo/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@repo/ui/dialog';
import { Input } from '@repo/ui/input';
import { Label } from '@repo/ui/label';
import { Checkbox } from '@repo/ui/checkbox';
import { Skeleton } from '@repo/ui/skeleton';
import { Edit2, Eye, Trash2, Plus, Percent, Tag, CheckSquare, IndianRupee, Upload, X, Power } from "lucide-react";
import { Switch } from '@repo/ui/switch';
import { useAppDispatch, useAppSelector } from '@repo/store/hooks';
import { closeModal, openModal } from '@repo/store/slices/modalSlice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@repo/ui/dropdown-menu";
import { ChevronDown, Filter } from "lucide-react";
import { useForm } from 'react-hook-form';
import {
  useGetAdminOffersQuery,
  useCreateAdminOfferMutation,
  useUpdateAdminOfferMutation,
  useDeleteAdminOfferMutation,
  useGetServicesQuery,
  useGetRegionsQuery,
  useGetCategoriesQuery
} from '@repo/store/api';
import { setSelectedRegion, selectSelectedRegion } from '@repo/store/slices/adminAuthSlice';

import { toast } from 'sonner';

type Coupon = {
  _id: string;
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  status: string;
  startDate: string;
  expires: string;
  redeemed: number;
  applicableSpecialties: string[];
  applicableCategories: string[];
  offerImage?: string;
  isCustomCode?: boolean;
  regionId?: string | null;
  disabledRegions?: string[];
  isActive?: boolean;
};

type CouponForm = {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  startDate: string;
  expires: string;
  applicableSpecialties: string[];
  applicableCategories: string[];
  offerImage?: string;
  isCustomCode: boolean;
  regionId?: string | null;
};

// Predefined options for target audience
const genderOptions = ['Men', 'Women', 'Unisex'];

export default function OffersCouponsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [serviceFilters, setServiceFilters] = useState<string[]>([]);
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { token, admin } = useAppSelector((state: any) => state.adminAuth);
  const selectedRegion = useAppSelector(selectSelectedRegion);
  const userRole = admin?.roleName || admin?.role;
  const userRegion = admin?.assignedRegions?.[0];

  const dispatch = useAppDispatch();
  const { isOpen, modalType, data } = useAppSelector(
    (state: any) => state.modal
  );

  const { data: regionsResponse } = useGetRegionsQuery(undefined);
  const regions = (regionsResponse as any)?.data || [];

  // Safely find region name
  const getRegionName = (id: string | null | undefined) => {
    if (!id) return 'All Regions';
    if (!Array.isArray(regions)) return 'Regional';
    return regions.find((r: any) => r._id?.toString() === id?.toString())?.name || 'Regional';
  };
  const handleRegionChange = (value: string) => {
    dispatch(setSelectedRegion(value || null));
  };



  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CouponForm>({
    defaultValues: {
      code: '',
      type: 'percentage',
      value: 0,
      startDate: '',
      expires: '',
      applicableSpecialties: [],
      applicableCategories: [],
      offerImage: '',
      isCustomCode: false,
      regionId: userRole === 'SUPER_ADMIN' || userRole === 'superadmin' ? null : userRegion || null,
    }
  });

  const { data: couponsData = [], isLoading, isError, refetch } = useGetAdminOffersQuery({ regionId: selectedRegion || undefined });
  const { data: servicesResponse = [] } = useGetServicesQuery(undefined);
  const { data: categoriesResponse = [] } = useGetCategoriesQuery(undefined);

  const [createOffer, { isLoading: isCreating }] = useCreateAdminOfferMutation();
  const [updateOffer, { isLoading: isUpdating }] = useUpdateAdminOfferMutation();
  const [deleteOffer, { isLoading: isDeleting }] = useDeleteAdminOfferMutation();

  const categoryOptions = useMemo(() => {
    return Array.isArray(categoriesResponse) ? categoriesResponse.map((cat: any) => cat.name) : [];
  }, [categoriesResponse]);

  const specialtyOptions = useMemo(() => {
    return Array.isArray(servicesResponse) ? servicesResponse.map((item: any) => item.name) : [];
  }, [servicesResponse]);

  // Convert file to base64
  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      try {
        const base64 = await convertToBase64(file);
        setValue('offerImage', base64);
        setPreviewImage(base64);
      } catch (error) {
        toast.error('Error processing image');
      }
    }
  };

  // Remove uploaded image
  const removeImage = () => {
    setValue('offerImage', '');
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle specialty selection
  const handleSpecialtyChange = (specialty: string, checked: boolean) => {
    const updated = checked
      ? [...selectedSpecialties, specialty]
      : selectedSpecialties.filter((s: string) => s !== specialty);
    setSelectedSpecialties(updated);
    setValue('applicableSpecialties', updated);
  };

  // Handle category selection
  const handleCategoryChange = (category: string, checked: boolean) => {
    let updated = checked
      ? [...selectedCategories, category]
      : selectedCategories.filter((c: string) => c !== category);

    let updatedSpecialties = [...selectedSpecialties];

    // If a target audience (gender option) is selected/deselected, also toggle its related subcategories
    if (genderOptions.includes(category)) {
      const matchesGender = (catName: string, gender: string) => {
        const nameLower = catName.toLowerCase();
        const genderLower = gender.toLowerCase();

        // Helper to check if name is classified as Men
        const isMen = () => {
          if (nameLower.includes('men') && !nameLower.includes('women')) return true;
          const menKeywords = ['hair cut', 'beard', 'shave'];
          return menKeywords.some(keyword => nameLower.includes(keyword));
        };

        // Helper to check if name is classified as Women
        const isWomen = () => {
          if (nameLower.includes('women')) return true;
          const womenKeywords = ['makeup', 'hairstyling'];
          return womenKeywords.some(keyword => nameLower.includes(keyword));
        };

        if (genderLower === 'men') {
          return isMen();
        } else if (genderLower === 'women') {
          return isWomen();
        } else if (genderLower === 'unisex') {
          // A category is considered Unisex if:
          // 1. It explicitly contains 'unisex'
          // 2. OR it is NOT specifically classified as Men and is NOT specifically classified as Women!
          return nameLower.includes('unisex') || (!isMen() && !isWomen());
        }

        return false;
      };

      const matchingSubCategories = categoryOptions.filter((cat: string) => matchesGender(cat, category));

      if (checked) {
        // Add all matching subcategories that are not already selected
        matchingSubCategories.forEach((cat: string) => {
          if (!updated.includes(cat)) {
            updated.push(cat);
          }
        });
      } else {
        // Remove all matching subcategories
        updated = updated.filter((c: string) => !matchingSubCategories.includes(c));
      }

      // Also select/deselect all services belonging to these matching subcategories
      if (Array.isArray(servicesResponse)) {
        matchingSubCategories.forEach((cat: string) => {
          const servicesInCategory = servicesResponse
            .filter((s: any) => {
              const serviceCatName = s.category?.name || s.category;
              return serviceCatName === cat;
            })
            .map((s: any) => s.name);

          if (checked) {
            servicesInCategory.forEach(sName => {
              if (!updatedSpecialties.includes(sName)) {
                updatedSpecialties.push(sName);
              }
            });
          } else {
            updatedSpecialties = updatedSpecialties.filter((sName: string) => !servicesInCategory.includes(sName));
          }
        });
      }
    }

    // Always select/deselect services belonging to the directly toggled category/subcategory itself
    if (Array.isArray(servicesResponse)) {
      const servicesInCategory = servicesResponse
        .filter((s: any) => {
          const serviceCatName = s.category?.name || s.category;
          return serviceCatName === category;
        })
        .map((s: any) => s.name);

      if (checked) {
        // When category is checked, add all its services
        servicesInCategory.forEach(sName => {
          if (!updatedSpecialties.includes(sName)) {
            updatedSpecialties.push(sName);
          }
        });
      } else {
        // When category is unchecked, remove all its services
        updatedSpecialties = updatedSpecialties.filter((sName: string) => !servicesInCategory.includes(sName));
      }
    }

    setSelectedCategories(updated);
    setValue('applicableCategories', updated);
    setSelectedSpecialties(updatedSpecialties);
    setValue('applicableSpecialties', updatedSpecialties);
  };

  // Update form values when editing
  useEffect(() => {
    if (modalType === 'editCoupon' && data) {
      const coupon = data as Coupon;
      setValue('code', coupon.code || '');
      setValue('type', coupon.type || 'percentage');
      setValue('value', coupon.value || 0);
      setValue('startDate', coupon.startDate ? coupon.startDate.split('T')[0] : '');
      setValue('expires', coupon.expires ? coupon.expires.split('T')[0] : '');

      const specialties = Array.isArray(coupon.applicableSpecialties) ? coupon.applicableSpecialties : [];
      const categories = Array.isArray(coupon.applicableCategories) ? coupon.applicableCategories : [];

      setSelectedSpecialties(specialties);
      setSelectedCategories(categories);
      setValue('applicableSpecialties', specialties);
      setValue('applicableCategories', categories);
      setValue('offerImage', coupon.offerImage || '');
      setPreviewImage(coupon.offerImage || null);
      setUseCustomCode(coupon.isCustomCode || false);
      setValue('isCustomCode', coupon.isCustomCode || false);
      setValue('regionId', coupon.regionId || null);
    } else {
      reset();
      setValue('regionId', userRole === 'SUPER_ADMIN' || userRole === 'superadmin' ? null : userRegion || null);
      setSelectedSpecialties([]);
      setSelectedCategories([]);
      setPreviewImage(null);
      setUseCustomCode(false);
    }
  }, [modalType, data, setValue, reset]);

  const filteredCoupons = useMemo(() => {
    if (!Array.isArray(couponsData)) return [];

    let filtered = couponsData;

    // Status Filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((coupon: Coupon) => coupon.status === statusFilter);
    }

    // Service Filter
    if (serviceFilters.length > 0) {
      filtered = filtered.filter((coupon) => {
        // If coupon applies to all services (specialties list is empty or undefined)
        const isGlobalOffer = !coupon.applicableSpecialties || coupon.applicableSpecialties.length === 0;

        // Show if it's global OR if it matches any of the selected service filters
        return isGlobalOffer || coupon.applicableSpecialties.some((s: string) => serviceFilters.includes(s));
      });
    }

    return filtered;
  }, [couponsData, statusFilter, serviceFilters]);

  const lastItemIndex = currentPage * itemsPerPage;
  const firstItemIndex = lastItemIndex - itemsPerPage;
  const currentItems = [...filteredCoupons].reverse().slice(firstItemIndex, lastItemIndex);

  const totalPages = Math.ceil(filteredCoupons.length / itemsPerPage) || 1;

  const handleOpenModal = (type: 'addCoupon' | 'editCoupon' | 'viewCoupon', coupon?: Coupon) => {
    dispatch(openModal({ modalType: type, data: coupon }));
  };

  const handleCloseModal = () => {
    dispatch(closeModal());
    reset();
    setSelectedSpecialties([]);
    setSelectedCategories([]);
    setPreviewImage(null);
    setUseCustomCode(false);
  };

  const handleDeleteClick = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedCoupon) {
      try {
        await deleteOffer(selectedCoupon._id).unwrap();
        toast.success('Coupon deleted successfully');
        setIsDeleteModalOpen(false);
        setSelectedCoupon(null);
      } catch (error) {
        console.error('Failed to delete coupon:', error);
      }
    }
  };

  const onSubmit = async (formData: CouponForm) => {
    const processedData = {
      ...formData,
      code: useCustomCode ? formData.code : '', // Send empty if auto-generate
      applicableSpecialties: selectedSpecialties,
      applicableCategories: selectedCategories,
      isCustomCode: useCustomCode,
    };

    try {
      if (modalType === 'addCoupon') {
        await createOffer(processedData).unwrap();
        toast.success('Coupon created successfully');
      } else if (modalType === 'editCoupon' && data) {
        await updateOffer({ id: (data as Coupon)._id, ...processedData }).unwrap();
        toast.success('Coupon updated successfully');
      }
      handleCloseModal();
      refetch();
    } catch (error) {
      console.error('Coupon submit error:', error);
    }
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.type === 'percentage') {
      return `${coupon.value}% Off`;
    }
    return `₹${coupon.value} Off`;
  };

  const formatList = (list: string[] | undefined | null): string => {
    if (!Array.isArray(list) || list.length === 0) {
      return 'All';
    }
    return list.join(', ');
  };

  const totalDiscountValue = Array.isArray(couponsData) ? couponsData.reduce((acc, coupon) => {
    return acc + (coupon.totalDiscount || 0);
  }, 0) : 0;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-8 w-64 mb-6" />

        {/* Stats cards skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main table skeleton */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-56 mt-2" />
              </div>
              <Skeleton className="h-9 w-40" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto no-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    {[...Array(10)].map((_, i) => (
                      <TableHead key={i}><Skeleton className="h-4 w-16" /></TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(10)].map((_, j) => (
                        <TableCell key={j}>
                          {j === 0 ? (
                            <Skeleton className="h-8 w-8 rounded" />
                          ) : j === 9 ? (
                            <div className="flex gap-1">
                              <Skeleton className="h-8 w-8" />
                              <Skeleton className="h-8 w-8" />
                              <Skeleton className="h-8 w-8" />
                            </div>
                          ) : (
                            <Skeleton className="h-4 w-20" />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Skeleton className="h-10 w-full mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) return <div>Error loading coupons. Please try again.</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold font-headline">Offers & Coupons</h1>
      </div>


      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Coupons</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(couponsData) ? couponsData.length : 0}</div>
            <p className="text-xs text-muted-foreground">Across all categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Coupons</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Array.isArray(couponsData) ? couponsData.filter(c => c.status === 'Active' && c.isActive !== false).length : 0}
            </div>
            <p className="text-xs text-muted-foreground">Currently usable by customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Redeemed</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(couponsData) ? couponsData.reduce((acc, c) => acc + c.redeemed, 0) : 0}
            </div>
            <p className="text-xs text-muted-foreground">Total times coupons were applied</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Discount Value</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{totalDiscountValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Actual value of discounts</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <CardTitle>Manage Coupons</CardTitle>
              <CardDescription>Manage and create new promotional coupons.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
                <SelectTrigger className="w-[150px] lg:w-[180px]">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[150px] lg:w-[180px] justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Filter className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {serviceFilters.length === 0 ? "All Services" : `${serviceFilters.length} Services`}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 max-h-80 overflow-y-auto">
                  <DropdownMenuLabel>Filter by Service</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={serviceFilters.length === 0}
                    onCheckedChange={() => setServiceFilters([])}
                  >
                    All Services
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {specialtyOptions.map((service: string) => (
                    <DropdownMenuCheckboxItem
                      key={service}
                      checked={serviceFilters.includes(service)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setServiceFilters([...serviceFilters, service]);
                        } else {
                          setServiceFilters(serviceFilters.filter((s: string) => s !== service));
                        }
                        setCurrentPage(1);
                      }}
                    >
                      {service}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button onClick={() => handleOpenModal('addCoupon')} disabled={isCreating} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Create New Coupon
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto no-scrollbar">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coupon Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Toggle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Starts On</TableHead>
                  <TableHead>Expires On</TableHead>
                  <TableHead>Specialties</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Redeemed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.map((coupon) => (
                  <TableRow key={coupon._id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {coupon.code}
                        {coupon.isCustomCode && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">Custom</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDiscount(coupon)}</TableCell>
                    <TableCell>
                      {(() => {
                        const isSuperAdmin = userRole?.toUpperCase() === 'SUPER_ADMIN' || userRole?.toUpperCase() === 'SUPERADMIN';
                        const isGlobalOffer = !coupon.regionId;
                        const currentRegionId = typeof userRegion === 'string' ? userRegion : (userRegion as any)?._id?.toString() || userRegion?.toString();

                        if (!isSuperAdmin && isGlobalOffer && currentRegionId) {
                          // Regional Admin looking at a Global Offer: Toggle for THEIR region
                          const isRegionallyDisabled = coupon.disabledRegions?.some((r: any) => r.toString() === currentRegionId);
                          return (
                            <Switch
                              checked={!isRegionallyDisabled}
                              onCheckedChange={async () => {
                                try {
                                  const action = isRegionallyDisabled ? 'enable_global' : 'disable_global';
                                  await updateOffer({ id: coupon._id, action }).unwrap();
                                  toast.success(`Offer ${isRegionallyDisabled ? 'Enabled' : 'Disabled'} for your region`);
                                  refetch();
                                } catch (err) {
                                  toast.error("Failed to update regional status");
                                }
                              }}
                            />
                          );
                        } else {
                          // Super Admin OR Regional Admin looking at their OWN regional offer: Toggle global isActive
                          return (
                            <Switch
                              checked={coupon.isActive !== false}
                              onCheckedChange={async () => {
                                try {
                                  await updateOffer({ id: coupon._id, action: 'toggle_active' }).unwrap();
                                  toast.success(`Offer ${coupon.isActive !== false ? 'Deactivated' : 'Activated'} Successfully`);
                                  refetch();
                                } catch (err) {
                                  toast.error("Failed to toggle offer status");
                                }
                              }}
                            />
                          );
                        }
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const isSuperAdmin = userRole?.toUpperCase() === 'SUPER_ADMIN' || userRole?.toUpperCase() === 'SUPERADMIN';
                        const currentRegionId = typeof userRegion === 'string' ? userRegion : (userRegion as any)?._id?.toString() || userRegion?.toString();
                        const isRegionallyDisabled = !isSuperAdmin && !coupon.regionId && currentRegionId && coupon.disabledRegions?.some((r: any) => r.toString() === currentRegionId);

                        if (isRegionallyDisabled) {
                          return (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                              DISABLED (REGION)
                            </span>
                          );
                        }

                        return (
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${coupon.isActive === false ? "bg-red-50 text-red-700 border border-red-100" :
                            coupon.status === "Active"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : coupon.status === "Scheduled"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                            }`}>
                            {coupon.isActive === false ? "Deactivated" : coupon.status}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>{coupon.startDate.split('T')[0]}</TableCell>
                    <TableCell>{coupon.expires ? coupon.expires.split('T')[0] : 'N/A'}</TableCell>
                    <TableCell>
                      {(() => {
                        const items = coupon.applicableSpecialties || [];
                        if (items.length === 0) return <span className="text-muted-foreground text-xs">All services</span>;
                        const preview = items.slice(0, 2);
                        const remaining = items.length - 2;
                        return (
                          <div className="max-w-[200px]">
                            <div className="space-y-0.5">
                              {preview.map((s: string, i: number) => (
                                <div key={i} className="text-xs text-gray-700 leading-tight">{s}</div>
                              ))}
                            </div>
                            {remaining > 0 && (
                              <span className="text-xs text-blue-500 italic">...and {remaining} more</span>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const items = coupon.applicableCategories || [];
                        if (items.length === 0) return <span className="text-muted-foreground text-xs">All categories</span>;
                        const preview = items.slice(0, 2);
                        const remaining = items.length - 2;
                        return (
                          <div className="max-w-[200px]">
                            <div className="space-y-0.5">
                              {preview.map((c: string, i: number) => (
                                <div key={i} className="text-xs text-gray-700 leading-tight">{c}</div>
                              ))}
                            </div>
                            {remaining > 0 && (
                              <span className="text-xs text-blue-500 italic">...and {remaining} more</span>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {coupon.offerImage ? (
                        <img
                          src={coupon.offerImage}
                          alt="Offer"
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <span className="text-gray-400 text-sm">No image</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {coupon.regionId ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                            📍 REGIONAL
                          </span>
                          <span className="text-xs font-semibold text-gray-700 ml-1">
                            {getRegionName(coupon.regionId)}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                          🌐 ALL REGIONS (GLOBAL)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{coupon.redeemed}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenModal('viewCoupon', coupon)}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenModal('editCoupon', coupon)}>
                          <Edit2 className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteClick(coupon)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            className="mt-4"
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={setItemsPerPage}
            totalItems={filteredCoupons.length}
          />
        </CardContent>
      </Card>

      <Dialog open={isOpen && (modalType === 'addCoupon' || modalType === 'editCoupon' || modalType === 'viewCoupon')} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalType === 'addCoupon' && 'Create New Coupon'}
              {modalType === 'editCoupon' && 'Edit Coupon'}
              {modalType === 'viewCoupon' && 'Coupon Details'}
            </DialogTitle>
            <DialogDescription>
              {modalType === 'addCoupon' && "Enter the details for the new coupon."}
              {modalType === 'editCoupon' && "Update the details for this coupon."}
              {modalType === 'viewCoupon' && "Viewing details for this coupon."}
            </DialogDescription>
          </DialogHeader>

          {modalType === 'viewCoupon' ? (
            <div className="grid gap-4 py-4 text-sm">
              {(() => {
                const couponData = data ? (data as unknown as Coupon) : null;
                return (
                  <>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="font-semibold text-muted-foreground">Code</span>
                      <span className="col-span-2 flex items-center gap-2">
                        {couponData?.code || 'N/A'}
                        {couponData?.isCustomCode && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">Custom</span>
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="font-semibold text-muted-foreground">Discount</span>
                      <span className="col-span-2">{couponData ? formatDiscount(couponData) : 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="font-semibold text-muted-foreground">Status</span>
                      <span className="col-span-2">
                        {(() => {
                          if (!couponData) return 'N/A';
                          const isSuperAdmin = userRole?.toUpperCase() === 'SUPER_ADMIN' || userRole?.toUpperCase() === 'SUPERADMIN';
                          const currentRegionId = typeof userRegion === 'string' ? userRegion : (userRegion as any)?._id?.toString() || userRegion?.toString();
                          const isRegionallyDisabled = !isSuperAdmin && !couponData.regionId && currentRegionId && couponData.disabledRegions?.some((r: any) => r.toString() === currentRegionId);

                          if (isRegionallyDisabled) return 'DISABLED (REGION)';
                          if (couponData.isActive === false) return 'Deactivated';
                          return couponData.status || 'N/A';
                        })()}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="font-semibold text-muted-foreground">Starts</span>
                      <span className="col-span-2">{couponData?.startDate?.split('T')[0] || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="font-semibold text-muted-foreground">Expires</span>
                      <span className="col-span-2">{couponData?.expires ? couponData.expires.split('T')[0] : 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-3 items-start gap-4">
                      <span className="font-semibold text-muted-foreground pt-0.5">Specialties</span>
                      <div className="col-span-2">
                        {!couponData?.applicableSpecialties || couponData.applicableSpecialties.length === 0 ? (
                          <span className="text-sm text-muted-foreground">All services</span>
                        ) : (
                          <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
                            {couponData.applicableSpecialties.map((s: string, i: number) => (
                              <div key={i} className="text-sm text-gray-700 leading-snug">{s}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 items-start gap-4">
                      <span className="font-semibold text-muted-foreground pt-0.5">Categories</span>
                      <div className="col-span-2">
                        {!couponData?.applicableCategories || couponData.applicableCategories.length === 0 ? (
                          <span className="text-sm text-muted-foreground">All categories</span>
                        ) : (
                          <div className="space-y-0.5">
                            {couponData.applicableCategories.map((c: string, i: number) => (
                              <div key={i} className="text-sm text-gray-700 leading-snug">{c}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="font-semibold text-muted-foreground">Image</span>
                      <div className="col-span-2">
                        {couponData?.offerImage ? (
                          <img
                            src={couponData.offerImage}
                            alt="Offer"
                            className="w-20 h-20 object-cover rounded border"
                          />
                        ) : (
                          <span className="text-gray-400">No image uploaded</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="font-semibold text-muted-foreground">Region</span>
                      <span className="col-span-2">
                        {couponData?.regionId
                          ? regions.find((r: any) => r._id === couponData.regionId)?.name || 'Regional'
                          : 'Global'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="font-semibold text-muted-foreground">Redeemed</span>
                      <span className="col-span-2">{couponData?.redeemed || 0}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useCustomCode"
                  checked={useCustomCode}
                  onCheckedChange={(checked) => {
                    setUseCustomCode(!!checked);
                    setValue('isCustomCode', !!checked);
                    if (!checked) {
                      setValue('code', '');
                    }
                  }}
                />
                <Label htmlFor="useCustomCode">Use custom coupon code</Label>
              </div>

              {useCustomCode && (
                <div className="space-y-2">
                  <Label htmlFor="code">Custom Coupon Code</Label>
                  <Input
                    id="code"
                    placeholder="Enter custom code (e.g., SAVE20)"
                    {...register('code', {
                      required: useCustomCode ? 'Custom coupon code is required' : false,
                      pattern: {
                        value: /^[A-Z0-9]+$/,
                        message: 'Code must contain only uppercase letters and numbers'
                      }
                    })}
                  />
                  {errors.code && <p className="text-red-500 text-sm">{errors.code.message}</p>}
                  <p className="text-sm text-muted-foreground">
                    Leave unchecked to auto-generate a unique code
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="type">Discount Type</Label>
                <Select
                  defaultValue={data ? (data as Coupon).type || 'percentage' : 'percentage'}
                  onValueChange={(value) => setValue('type', value as 'percentage' | 'fixed')}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select discount type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(userRole === 'SUPER_ADMIN' || userRole === 'superadmin') && (
                <div className="space-y-2">
                  <Label htmlFor="regionId">Region</Label>
                  <Select
                    value={watch('regionId') || "global"}
                    onValueChange={(value) => setValue('regionId', value === "global" ? null : value)}
                  >
                    <SelectTrigger id="regionId">
                      <SelectValue placeholder="Global (Super Admin only)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global</SelectItem>
                      {regions.map((region: any) => (
                        <SelectItem key={region._id} value={region._id}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="value">Discount Value</Label>
                <Input
                  id="value"
                  type="number"
                  {...register('value', {
                    required: 'Discount value is required',
                    min: { value: 1, message: 'Value must be greater than 0' }
                  })}
                />
                {errors.value && <p className="text-red-500 text-sm">{errors.value.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Starts On</Label>
                  <Input
                    id="startDate"
                    type="date"
                    {...register('startDate', { required: 'Start date is required' })}
                  />
                  {errors.startDate && <p className="text-red-500 text-sm">{errors.startDate.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expires">Expires On</Label>
                  <Input
                    id="expires"
                    type="date"
                    {...register('expires')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>1. Category (Target Audience - select multiple or none for all)</Label>
                <div className="grid grid-cols-3 gap-2 p-3 border rounded-md">
                  {genderOptions.map((gender) => (
                    <div key={gender} className="flex items-center space-x-2">
                      <Checkbox
                        id={`gender-${gender}`}
                        checked={selectedCategories.includes(gender)}
                        onCheckedChange={(checked) => handleCategoryChange(gender, !!checked)}
                      />
                      <Label htmlFor={`gender-${gender}`} className="text-sm">
                        {gender}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>2. Sub-Category (Service Groups - Auto-selects services)</Label>
                <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-40 overflow-y-auto">
                  {categoryOptions.map((category) => (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category}`}
                        checked={selectedCategories.includes(category)}
                        onCheckedChange={(checked) => handleCategoryChange(category, !!checked)}
                      />
                      <Label htmlFor={`category-${category}`} className="text-sm">
                        {category}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedCategories.filter(c => !genderOptions.includes(c)).length === 0 ? 'No sub-categories selected' : `Selected categories: ${selectedCategories.filter(c => !genderOptions.includes(c)).length}`}
                </p>
              </div>

              <div className="space-y-2">
                <Label>3. Individual Services (Select specific services if needed)</Label>
                <DropdownMenu open={isServiceDropdownOpen} onOpenChange={setIsServiceDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="truncate">
                        {selectedSpecialties.length === 0
                          ? "Apply to all services"
                          : `Selected ${selectedSpecialties.length} services`}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[calc(100vw-3rem)] sm:w-[500px] max-h-60 overflow-y-auto">
                    <div className="p-2 sticky top-0 bg-popover z-10">
                      <Input
                        placeholder="Search services..."
                        value={serviceSearchTerm}
                        onChange={(e) => setServiceSearchTerm(e.target.value)}
                        className="h-8"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={selectedSpecialties.length === 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedSpecialties([]);
                          setValue('applicableSpecialties', []);
                        }
                      }}
                    >
                      Apply to All Services
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {specialtyOptions
                      .filter((s: string) => s.toLowerCase().includes(serviceSearchTerm.toLowerCase()))
                      .map((specialty: string) => (
                        <DropdownMenuCheckboxItem
                          key={specialty}
                          checked={selectedSpecialties.includes(specialty)}
                          onCheckedChange={(checked) => handleSpecialtyChange(specialty, !!checked)}
                        >
                          {specialty}
                        </DropdownMenuCheckboxItem>
                      ))
                    }
                  </DropdownMenuContent>
                </DropdownMenu>
                <p className="text-sm text-muted-foreground">
                  {selectedSpecialties.length === 0 ? 'Will apply to all services' : `Active filters: ${selectedSpecialties.length}`}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Offer Image (Optional)</Label>
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />

                  {previewImage ? (
                    <div className="relative">
                      <img
                        src={previewImage}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={removeImage}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-32 h-32 border-dashed"
                    >
                      <div className="text-center">
                        <Upload className="h-6 w-6 mx-auto mb-2" />
                        <span className="text-sm">Upload Image</span>
                      </div>
                    </Button>
                  )}

                  <p className="text-sm text-muted-foreground">
                    Supports JPG, PNG, GIF, WebP. Max size: 5MB
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancel</Button>
                <Button type="submit" disabled={isCreating || isUpdating}>
                  {modalType === 'addCoupon' ? 'Create Coupon' : 'Update Coupon'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Coupon?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the coupon "{selectedCoupon?.code}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
