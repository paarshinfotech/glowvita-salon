"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Search, Layers, CheckCircle, XCircle, Eye, Image as ImageIcon, Store, Tag, FileText, Calendar, ShieldCheck, AlertCircle, Info, Users } from "lucide-react";
import { glowvitaApi } from '@repo/store/api';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@repo/ui/dialog';
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Textarea } from "@repo/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { Switch } from "@repo/ui/switch";
import Image from "next/image";
import { Pagination } from "@repo/ui/pagination";
import { ExportButtons } from '@/components/ExportButtons';
import { useAppSelector } from "@repo/store/hooks";
import { selectSelectedRegion } from "@repo/store/slices/adminAuthSlice";
import { Badge } from "@repo/ui/badge";

// --- Shared Interfaces ---

interface Service {
    _id: string;
    name: string;
    category?: string;
    categoryId?: string;
    description?: string;
    serviceImage?: string;
    isActive?: boolean;
    onlineBooking?: boolean;
    status?: 'approved' | 'disapproved';
    vendorName?: string;
    vendorId?: string;
    gender?: string;
    createdAt: string;
}

// --- Main Page Component ---

export default function ServicesPage() {
    const selectedRegion = useAppSelector(selectSelectedRegion);

    // RTK Query hooks - Fetch vendor services for approval
    const {
        data: servicesData = [],
        isLoading,
        refetch,
    } = glowvitaApi.useGetVendorServicesForApprovalQuery({ regionId: selectedRegion });

    const [updateServiceStatus] = glowvitaApi.useUpdateServiceStatusMutation();
    const [updateVendorServiceOnlineBooking] = glowvitaApi.useUpdateVendorServiceOnlineBookingMutation();

    const services = Array.isArray(servicesData) ? servicesData : [];

    // State management
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [vendorFilter, setVendorFilter] = useState("all");

    // Fetch categories and vendors
    const { data: categoriesResponse } = glowvitaApi.useGetCategoriesQuery({});
    const { data: vendorsResponse } = glowvitaApi.useGetVendorsQuery(selectedRegion);

    const categories = useMemo(() => {
        if (categoriesResponse && Array.isArray(categoriesResponse)) return categoriesResponse;
        if (categoriesResponse && categoriesResponse.success && Array.isArray(categoriesResponse.data)) return categoriesResponse.data;
        return [];
    }, [categoriesResponse]);

    const vendors = useMemo(() => {
        if (vendorsResponse && Array.isArray(vendorsResponse)) return vendorsResponse;
        if (vendorsResponse && vendorsResponse.success && Array.isArray(vendorsResponse.data)) return vendorsResponse.data;
        return [];
    }, [vendorsResponse]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [modalType, setModalType] = useState<"add" | "edit" | "view">("add");

    // Action modal state
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [actionType, setActionType] = useState<'approve' | 'disapprove' | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    // Filter and paginate services
    const filteredServices = useMemo(() => {
        return services.filter(
            (service) =>
                (service.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    service.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    service.vendorName?.toLowerCase().includes(searchTerm.toLowerCase())) &&
                (categoryFilter === "all" || service.category === categoryFilter) &&
                (vendorFilter === "all" || service.vendorId === vendorFilter)
        );
    }, [services, searchTerm, categoryFilter, vendorFilter]);

    const lastItemIndex = currentPage * itemsPerPage;
    const firstItemIndex = lastItemIndex - itemsPerPage;
    const currentItems = filteredServices.slice(
        firstItemIndex,
        lastItemIndex
    );
    const totalPages = Math.ceil(filteredServices.length / itemsPerPage);



    // Modal handlers
    const handleOpenModal = (
        type: "add" | "edit" | "view",
        service?: Service
    ) => {
        setModalType(type);
        setSelectedService(service || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedService(null);
    };

    const handleToggleVisibility = async (service: Service) => {
        try {
            const newOnlineBookingStatus = !(service.onlineBooking ?? true);
            await updateVendorServiceOnlineBooking({
                serviceId: service._id,
                onlineBooking: newOnlineBookingStatus
            }).unwrap();
            toast.success(`Service visibility updated - ${newOnlineBookingStatus ? 'Visible on web' : 'Hidden from web'}`);
            refetch();
        } catch (error: any) {
            console.error("Failed to update visibility:", error);
        }
    };

    const handleStatusChange = async (service: Service, newStatus: 'approved' | 'disapproved') => {
        setSelectedService(service);
        setActionType(newStatus === 'approved' ? 'approve' : 'disapprove');
        setIsActionModalOpen(true);
    };

    const handleConfirmAction = async () => {
        if (!selectedService || !actionType) return;

        if (actionType === 'disapprove' && !rejectionReason.trim()) {
            toast.error('Reason Required', { description: 'Please provide a reason for rejection.' });
            return;
        }

        try {
            await updateServiceStatus({
                serviceId: selectedService._id,
                status: actionType === 'approve' ? 'approved' : 'disapproved',
                rejectionReason: actionType === 'disapprove' ? rejectionReason : undefined
            }).unwrap();
            toast.success(`Service "${selectedService.name}" has been ${actionType === 'approve' ? 'approved' : 'disapproved'}.`);
            refetch();
        } catch (error: any) {
            console.error("Failed to update status:", error);
        }

        setIsActionModalOpen(false);
        setSelectedService(null);
        setActionType(null);
        setRejectionReason('');
    };

    // Calculate stats
    const approvedCount = services.filter(s => (s.status === 'approved' || !s.status)).length;
    const disapprovedCount = services.filter(s => s.status === 'disapproved').length;

    return (
        <div className="min-h-screen bg-background">
            <div className="relative p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Header Section */}
                <div className="mb-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div>
                            <h1 className="text-3xl font-bold font-headline mb-1 bg-gradient-to-r from-foreground via-primary to-primary/80 bg-clip-text text-transparent">
                                Vendor Services Management
                            </h1>
                            {selectedRegion && selectedRegion !== 'all' && (
                                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 ml-2">
                                    Region Filtered
                                </Badge>
                            )}
                            <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
                                Review and manage services from all vendors - approve or disapprove services
                            </p>
                        </div>
                    </div>
                </div>

                {/* ServiceStatsCards Logic Inline */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <Card className="group relative overflow-hidden bg-primary/5 border border-primary/20 transition-all duration-300">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-primary mb-1">Total Services</p>
                                    <p className="text-2xl font-bold text-primary">{services.length}</p>
                                    <p className="text-xs text-primary/70 mt-1">Global service catalog</p>
                                </div>
                                <div className="p-3 bg-primary/10 rounded-full transition-colors">
                                    <Layers className="h-6 w-6 text-primary" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="group relative overflow-hidden bg-green-50/50 border border-green-200 transition-all duration-300">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-green-700 mb-1">Approved Services</p>
                                    <p className="text-2xl font-bold text-green-700">
                                        {approvedCount}
                                    </p>
                                    <p className="text-xs text-green-600/70 mt-1">Ready for vendors</p>
                                </div>
                                <div className="p-3 bg-green-100 rounded-full transition-colors">
                                    <CheckCircle className="h-6 w-6 text-green-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="group relative overflow-hidden bg-red-50/50 border border-red-200 transition-all duration-300">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-red-700 mb-1">Disapproved Services</p>
                                    <p className="text-2xl font-bold text-red-700">
                                        {disapprovedCount}
                                    </p>
                                    <p className="text-xs text-red-600/70 mt-1">Hidden from catalog</p>
                                </div>
                                <div className="p-3 bg-red-100 rounded-full transition-colors">
                                    <XCircle className="h-6 w-6 text-red-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ServiceFiltersToolbar Logic Inline */}
                <div className="mb-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search services..."
                                className="pl-10 h-12 rounded-lg border border-border focus:border-primary text-base"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-full sm:w-[150px] h-12 rounded-lg border-border hover:border-primary">
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg border border-border/40 max-h-[300px] overflow-y-auto">
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {categories.map((cat: any) => (
                                        <SelectItem key={cat._id} value={cat.name}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={vendorFilter} onValueChange={setVendorFilter}>
                                <SelectTrigger className="w-full sm:w-[180px] h-12 rounded-lg border-border hover:border-primary">
                                    <SelectValue placeholder="All Vendors" />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg border border-border/40 max-h-[300px] overflow-y-auto">
                                    <SelectItem value="all">All Vendors</SelectItem>
                                    {vendors.map((vendor: any) => (
                                        <SelectItem key={vendor._id} value={vendor._id}>
                                            {vendor.fullName || vendor.businessName || 'Unnamed Vendor'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <div className="flex gap-3 w-full sm:w-auto">
                                <ExportButtons
                                    data={filteredServices}
                                    filename="vendor_services_export"
                                    title="Vendor Services Report"
                                    columns={[
                                        { header: 'Service Name', key: 'name' },
                                        { header: 'Vendor', key: 'vendorName' },
                                        { header: 'Category', key: 'category' },
                                        { header: 'Description', key: 'description' },
                                        { header: 'Status', key: 'status' },
                                        { header: 'Created At', key: 'createdAt', transform: (val: any) => new Date(val).toLocaleDateString() }
                                    ]}
                                    className="h-12 px-4 rounded-lg"
                                />

                            </div>
                        </div>
                    </div>
                </div>

                {/* ServiceTable Logic Inline */}
                <div className="flex-1 flex flex-col min-h-0">
                    <Card className="flex-1 flex flex-col min-h-0">
                        <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="flex-1 overflow-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[80px]">Image</TableHead>
                                                <TableHead>Service Name</TableHead>
                                                <TableHead>Vendor</TableHead>
                                                <TableHead>Category</TableHead>
                                                <TableHead className="max-w-[250px]">Description</TableHead>
                                                <TableHead>Visible</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Created At</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoading ? (
                                                <TableRow>
                                                    <TableCell colSpan={9} className="text-center py-8">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                                            Loading services...
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : currentItems.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                                        {searchTerm || categoryFilter !== 'all' ? 'No services found matching your criteria' : 'No services available'}
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                currentItems.map((service) => (
                                                    <TableRow key={service._id}>
                                                        <TableCell>
                                                            <div className="relative h-12 w-12 rounded-lg overflow-hidden border">
                                                                {service.serviceImage ? (
                                                                    <Image
                                                                        src={service.serviceImage}
                                                                        alt={service.name}
                                                                        fill
                                                                        className="object-fill"
                                                                    />
                                                                ) : (
                                                                    <div className="h-full w-full bg-muted flex items-center justify-center">
                                                                        <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-medium">{service.name}</TableCell>
                                                        <TableCell>
                                                            <span className="text-sm font-medium text-foreground">
                                                                {service.vendorName || 'N/A'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1 items-start">
                                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                                                    {service.category || 'Uncategorized'}
                                                                </span>
                                                                <span className="text-[11px] font-medium text-muted-foreground capitalize flex items-center gap-1">
                                                                    <Users className="h-3 w-3 text-indigo-500" />
                                                                    {service.gender || 'unisex'}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="max-w-[250px]">
                                                            <p className="text-sm text-muted-foreground truncate" title={service.description}>
                                                                {service.description || 'No description'}
                                                            </p>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Switch
                                                                checked={service.onlineBooking ?? true}
                                                                onCheckedChange={() => handleToggleVisibility(service)}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            {service.status === 'approved' ? (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                                                                    APPROVED
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                                                                    DISAPPROVED
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            {new Date(service.createdAt).toLocaleDateString()}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleOpenModal('view', service)}
                                                                    className="h-8 w-8 p-0"
                                                                    title="View Details"
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>

                                                                {service.status === 'disapproved' ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handleStatusChange(service, 'approved')}
                                                                        className="h-8 px-3 text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800"
                                                                    >
                                                                        <CheckCircle className="h-3 w-3 mr-1" />
                                                                        Approve
                                                                    </Button>
                                                                ) : (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handleStatusChange(service, 'disapproved')}
                                                                        className="h-8 px-3 text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800"
                                                                    >
                                                                        <XCircle className="h-3 w-3 mr-1" />
                                                                        Disapprove
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ServicePaginationControls Logic Inline */}
                <Pagination
                    className="mt-8"
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    itemsPerPage={itemsPerPage}
                    onItemsPerPageChange={(value) => {
                        setItemsPerPage(value);
                        setCurrentPage(1);
                    }}
                    totalItems={filteredServices.length}
                />

                {/* View Modal */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="sm:max-w-[440px] max-h-[85vh] p-0 overflow-hidden flex flex-col border border-border/80 rounded-xl shadow-xl">
                        {selectedService && (
                            <div className="flex-1 min-h-0 overflow-y-auto">
                                {/* Banner section */}
                                {selectedService.serviceImage ? (
                                    <div className="relative h-44 w-full overflow-hidden border-b">
                                        <img
                                            src={selectedService.serviceImage}
                                            alt={selectedService.name}
                                            className="w-full h-full object-fill"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent pointer-events-none" />
                                        <div className="absolute top-4 right-4">
                                            {selectedService.status === 'approved' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white shadow-md border border-emerald-400/20 backdrop-blur-md">
                                                    <ShieldCheck className="h-3.5 w-3.5" />
                                                    Approved
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500 text-white shadow-md border border-rose-400/20 backdrop-blur-md">
                                                    <AlertCircle className="h-3.5 w-3.5" />
                                                    Disapproved
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative h-28 w-full bg-gradient-to-r from-violet-600/20 via-primary/10 to-pink-500/10 flex items-center justify-center">
                                        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
                                        <div className="flex flex-col items-center gap-1.5 relative z-10">
                                            <div className="p-2.5 bg-background/80 rounded-full shadow-sm border border-border/40 backdrop-blur-sm">
                                                <ImageIcon className="h-6 w-6 text-primary" />
                                            </div>
                                        </div>
                                        <div className="absolute top-4 right-4">
                                            {selectedService.status === 'approved' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm backdrop-blur-sm">
                                                    <ShieldCheck className="h-3.5 w-3.5" />
                                                    Approved
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/50 shadow-sm backdrop-blur-sm">
                                                    <AlertCircle className="h-3.5 w-3.5" />
                                                    Disapproved
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Content Padding Area */}
                                <div className="p-4 space-y-4">
                                    {/* DialogHeader inside content to ensure correct ARIA compliance */}
                                    <div className="space-y-1">
                                        <DialogHeader className="p-0 text-left">
                                            <DialogTitle className="text-lg font-bold tracking-tight text-foreground break-words">
                                                {selectedService.name}
                                            </DialogTitle>
                                            <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                                                <Info className="h-3.5 w-3.5 text-primary/75" />
                                                View complete details and status of this vendor service.
                                            </DialogDescription>
                                        </DialogHeader>
                                    </div>

                                    {/* Metadata 2x2 grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Vendor Card */}
                                        <div className="p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/40 transition-all duration-200">
                                            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                                                <Store className="h-4 w-4 text-violet-500" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Vendor</span>
                                            </div>
                                            <p className="text-sm font-semibold text-foreground truncate" title={selectedService.vendorName}>
                                                {selectedService.vendorName || 'N/A'}
                                            </p>
                                        </div>

                                        {/* Category Card */}
                                        <div className="p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/40 transition-all duration-200">
                                            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                                                <Tag className="h-4 w-4 text-teal-500" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Category</span>
                                            </div>
                                            <p className="text-sm font-semibold text-foreground truncate" title={selectedService.category}>
                                                {selectedService.category || 'Uncategorized'}
                                            </p>
                                        </div>

                                        {/* Gender / Suitable For Card */}
                                        <div className="p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/40 transition-all duration-200">
                                            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                                                <Users className="h-4 w-4 text-indigo-500" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Gender Preference</span>
                                            </div>
                                            <p className="text-sm font-semibold text-foreground capitalize">
                                                {selectedService.gender || 'Unisex'}
                                            </p>
                                        </div>

                                        {/* Status Card */}
                                        <div className="p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/40 transition-all duration-200">
                                            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                                                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Status</span>
                                            </div>
                                            <div className="flex items-center mt-0.5">
                                                {selectedService.status === 'approved' ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                                                        Approved
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/50">
                                                        Disapproved
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Registered Card */}
                                        <div className="col-span-2 p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/40 transition-all duration-200 flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Calendar className="h-4 w-4 text-amber-500" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Registered Date</span>
                                            </div>
                                            <p className="text-sm font-semibold text-foreground">
                                                {selectedService.createdAt ? new Date(selectedService.createdAt).toLocaleDateString(undefined, {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                }) : 'N/A'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Description block */}
                                    <div className="p-3 rounded-lg border border-border/40 bg-accent/20 space-y-2">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <FileText className="h-4 w-4 text-blue-500" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Service Description</span>
                                        </div>
                                        <p className="text-sm text-foreground/90 leading-relaxed max-h-[90px] overflow-y-auto pr-1 whitespace-pre-wrap break-words">
                                            {selectedService.description || 'No description provided for this service.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                        <DialogFooter className="shrink-0 px-4 py-3 bg-muted/30 border-t border-border/45">
                            <Button type="button" onClick={handleCloseModal} className="px-5 rounded-lg shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all">
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Action Confirmation Modal */}
                <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>
                                {actionType === 'approve' ? 'Approve Service?' : 'Disapprove Service?'}
                            </DialogTitle>
                            <DialogDescription>
                                {actionType === 'approve'
                                    ? `Are you sure you want to approve the service "${selectedService?.name}"?`
                                    : `Are you sure you want to disapprove the service "${selectedService?.name}"? This action cannot be undone.`
                                }
                            </DialogDescription>
                        </DialogHeader>
                        {actionType === 'disapprove' && (
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                                    <Textarea
                                        id="rejectionReason"
                                        placeholder="Please provide a reason for rejection..."
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        className="min-h-[100px]"
                                    />
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsActionModalOpen(false);
                                    setSelectedService(null);
                                    setActionType(null);
                                    setRejectionReason('');
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleConfirmAction}
                                className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                            >
                                {actionType === 'approve' ? 'Approve' : 'Disapprove'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
