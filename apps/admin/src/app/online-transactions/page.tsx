"use client";

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { Pagination } from "@repo/ui/pagination";
import { Input } from "@repo/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Eye, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@repo/ui/dialog';
import { Skeleton } from "@repo/ui/skeleton";

import { useAppSelector } from '@repo/store/hooks';
import { selectSelectedRegion } from '@repo/store/slices/adminAuthSlice';
import { glowvitaApi } from '../../../../../packages/store/src/services/api';

export default function OnlineTransactionsPage() {
    const tableRef = useRef<HTMLDivElement>(null);
    const selectedRegion = useAppSelector(selectSelectedRegion);

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
    const [vendorFilter, setVendorFilter] = useState('all');
    const [txTypeFilter, setTxTypeFilter] = useState('all'); // all | appointment | subscription | product | marketplace
    const [dateFilter, setDateFilter] = useState('all');
    const [pagination, setPagination] = useState({ currentPage: 1, itemsPerPage: 10 });

    const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ── Appointment transactions (original) ──────────────────────────────────
    const { data: response, isLoading, error } = glowvitaApi.endpoints.getAdminOnlineTransactions.useQuery({
        page: 1,
        limit: 1000,
        regionId: selectedRegion,
    });

    const transactions = response?.data || [];
    const vendorsList = response?.vendorsList || [];
    const summary = response?.summary || {
        totalAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        totalAmountPaid: 0,
    };
    const totalTransactions = response?.pagination?.total || 0;
    const totalPages = response?.pagination?.totalPages || 0;

    // ── Subscription transactions (read-only, no filters, all pages) ─────────
    const { data: subResponse, isLoading: subLoading } =
        glowvitaApi.endpoints.getAdminSubscriptionTransactions.useQuery({
            page: 1,
            limit: 1000,
            regionId: selectedRegion,
            planType: 'regular', // only paid plans (not trial)
        });
    const subTransactions: any[] = subResponse?.data || [];

    // ── Product / Client-order transactions ──────────────────────────────────
    const { data: productResponse, isLoading: productLoading } =
        glowvitaApi.endpoints.getAdminProductTransactions.useQuery({
            page: 1,
            limit: 1000,
            regionId: selectedRegion,
        });
    const productTransactions: any[] = productResponse?.data || [];
    const productSummary = productResponse?.summary || { totalOrders: 0, totalAmount: 0 };

    // ── Precise timestamp resolver for sorting descending ───────────────────
    const getSortTimestamp = (row: any, type: string) => {
        if (type === 'appointment') {
            if (row.createdAt) {
                const t = new Date(row.createdAt).getTime();
                if (!isNaN(t) && t > 0) return t;
            }
            if (row.paymentHistory && row.paymentHistory.length > 0 && row.paymentHistory[0].paymentDate) {
                const t = new Date(row.paymentHistory[0].paymentDate).getTime();
                if (!isNaN(t) && t > 0) return t;
            }
            if (row.date) {
                const d = new Date(row.date);
                if (row.startTime && typeof row.startTime === 'string' && row.startTime.includes(':')) {
                    const [h, m] = row.startTime.split(':').map(Number);
                    d.setHours(h || 0, m || 0, 0, 0);
                }
                return d.getTime();
            }
            return 0;
        }
        if (type === 'subscription') {
            const raw = row.purchaseDate || row.createdAt || row.startDate;
            return raw ? new Date(raw).getTime() : 0;
        }
        if (type === 'product') {
            const raw = row.date || row.createdAt;
            return raw ? new Date(raw).getTime() : 0;
        }
        return 0;
    };

    // ── Merge all rows and sort by exact date/time desc ──────────────────────
    const allMergedRows: any[] = [
        ...transactions.map((tx: any) => ({
            ...tx,
            _txType: 'appointment',
            _sortDate: getSortTimestamp(tx, 'appointment'),
        })),
        ...subTransactions.map((sub: any) => ({
            ...sub,
            _txType: 'subscription',
            _sortDate: getSortTimestamp(sub, 'subscription'),
        })),
        ...productTransactions.map((order: any) => ({
            ...order,
            _txType: 'product',
            _sortDate: getSortTimestamp(order, 'product'),
        })),
    ].sort((a, b) => b._sortDate - a._sortDate);

    // Apply txTypeFilter
    const typeFilteredRows = txTypeFilter === 'all'
        ? allMergedRows
        : allMergedRows.filter(r => {
            if (txTypeFilter === 'appointment') return r._txType === 'appointment';
            if (txTypeFilter === 'subscription') return r._txType === 'subscription';
            if (txTypeFilter === 'marketplace') return r._txType === 'product' && r.orderSource === 'B2B';
            if (txTypeFilter === 'product' || txTypeFilter === 'payment') return r._txType === 'product' && r.orderSource === 'B2C';
            return r._txType === txTypeFilter;
        });

    // Apply vendorFilter across all rows
    const vendorFilteredRows = vendorFilter === 'all'
        ? typeFilteredRows
        : typeFilteredRows.filter(r => {
            if (r._txType === 'appointment') {
                return (r.vendorId?._id?.toString() === vendorFilter || r.vendorId?.toString() === vendorFilter);
            }
            if (r._txType === 'subscription') {
                return r.entityId?.toString() === vendorFilter;
            }
            if (r._txType === 'product') {
                return (r.vendorId?.toString() === vendorFilter || r.vendorId?._id?.toString() === vendorFilter || r.supplierId?.toString() === vendorFilter);
            }
            return true;
        });

    // Unified Status matcher across appointments, subscriptions, and products
    const matchStatus = (r: any, filter: string) => {
        if (filter === 'all') return true;
        const s = String(r.status || '').toLowerCase().trim();
        const f = filter.toLowerCase().trim();
        if (s === f) return true;
        if (f === 'completed') return s === 'completed' || s === 'delivered' || s === 'active';
        if (f === 'pending') return s === 'pending';
        if (f === 'scheduled') return s === 'scheduled';
        if (f === 'confirmed') return s === 'confirmed' || s === 'processing' || s === 'packed' || s === 'shipped';
        if (f === 'cancelled') return s === 'cancelled' || s === 'expired';
        return s.includes(f);
    };

    // Unified Pay Status matcher across appointments, subscriptions, and products
    const matchPaymentStatus = (r: any, filter: string) => {
        if (filter === 'all') return true;
        const f = filter.toLowerCase().trim();
        const ps = String(r.paymentStatus || '').toLowerCase().trim();
        const pm = String(r.paymentMethod || '').toLowerCase().trim();

        if (f === 'completed' || f === 'paid') {
            if (r._txType === 'subscription') return true;
            return ps === 'completed' || ps === 'paid' || pm === 'online' || pm === 'paid';
        }
        if (f === 'pending') {
            return ps === 'pending' || pm === 'cod';
        }
        if (f === 'partial') return ps === 'partial';
        if (f === 'failed') return ps === 'failed';
        if (f === 'refunded') return ps === 'refunded';
        return ps === f;
    };

    // Unified Date Range matcher across all rows
    const matchDate = (r: any, filter: string) => {
        if (filter === 'all') return true;
        const ts = r._sortDate;
        if (!ts || isNaN(ts)) return true;

        const rowDate = new Date(ts);
        const now = new Date();

        if (filter === 'today') {
            return rowDate.toDateString() === now.toDateString();
        }
        if (filter === 'yesterday') {
            const y = new Date();
            y.setDate(now.getDate() - 1);
            return rowDate.toDateString() === y.toDateString();
        }
        if (filter === 'last7days') {
            const past7 = new Date();
            past7.setDate(now.getDate() - 7);
            return rowDate >= past7 && rowDate <= now;
        }
        if (filter === 'thisMonth') {
            return rowDate.getMonth() === now.getMonth() && rowDate.getFullYear() === now.getFullYear();
        }
        if (filter === 'lastMonth') {
            const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            return rowDate >= lmStart && rowDate <= lmEnd;
        }
        return true;
    };

    // Apply statusFilter across all types
    const statusFilteredRows = statusFilter === 'all'
        ? vendorFilteredRows
        : vendorFilteredRows.filter(r => matchStatus(r, statusFilter));

    // Apply paymentStatusFilter across all types
    const paymentFilteredRows = paymentStatusFilter === 'all'
        ? statusFilteredRows
        : statusFilteredRows.filter(r => matchPaymentStatus(r, paymentStatusFilter));

    // Apply dateFilter across all types
    const dateFilteredRows = dateFilter === 'all'
        ? paymentFilteredRows
        : paymentFilteredRows.filter(r => matchDate(r, dateFilter));

    // Apply client-side search across all merged rows
    const searchLower = debouncedSearch.toLowerCase().trim();
    const filteredMergedRows = searchLower
        ? dateFilteredRows.filter(r => {
            if (r._txType === 'appointment') {
                return (
                    (r.invoiceNumber && r.invoiceNumber.toLowerCase().includes(searchLower)) ||
                    (r.clientName && r.clientName.toLowerCase().includes(searchLower)) ||
                    (r.serviceName && r.serviceName.toLowerCase().includes(searchLower)) ||
                    (r.vendorId?.businessName && r.vendorId.businessName.toLowerCase().includes(searchLower))
                );
            }
            if (r._txType === 'subscription') {
                return (
                    (r.entityName && r.entityName.toLowerCase().includes(searchLower)) ||
                    (r.entityEmail && r.entityEmail.toLowerCase().includes(searchLower)) ||
                    (r.plan?.name && r.plan.name.toLowerCase().includes(searchLower))
                );
            }
            if (r._txType === 'product') {
                return (
                    (r.orderRef && r.orderRef.toLowerCase().includes(searchLower)) ||
                    (r.customerName && r.customerName.toLowerCase().includes(searchLower)) ||
                    (r.vendorName && r.vendorName.toLowerCase().includes(searchLower)) ||
                    (r.supplierName && r.supplierName.toLowerCase().includes(searchLower)) ||
                    (r.itemsSummary && r.itemsSummary.toLowerCase().includes(searchLower))
                );
            }
            return false;
        })
        : dateFilteredRows;

    const totalMergedItems = filteredMergedRows.length;
    const totalMergedPages = Math.max(1, Math.ceil(totalMergedItems / pagination.itemsPerPage));
    const paginatedMergedRows = filteredMergedRows.slice(
        (pagination.currentPage - 1) * pagination.itemsPerPage,
        pagination.currentPage * pagination.itemsPerPage
    );

    const hasActiveFilters = txTypeFilter !== 'all' || vendorFilter !== 'all' || statusFilter !== 'all' || paymentStatusFilter !== 'all' || dateFilter !== 'all' || search !== '';

    const resetFilters = () => {
        setSearch('');
        setDebouncedSearch('');
        setTxTypeFilter('all');
        setVendorFilter('all');
        setStatusFilter('all');
        setPaymentStatusFilter('all');
        setDateFilter('all');
        setPagination(p => ({ ...p, currentPage: 1 }));
    };

    const debounce = useRef<NodeJS.Timeout | null>(null);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearch(val);
        setPagination(prev => ({ ...prev, currentPage: 1 }));
        if (debounce.current) clearTimeout(debounce.current);
        debounce.current = setTimeout(() => setDebouncedSearch(val), 500);
    };

    const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
        setter(value);
        setPagination(prev => ({ ...prev, currentPage: 1 }));
    };

    const handlePageChange = (page: number) => setPagination(prev => ({ ...prev, currentPage: page }));
    const handleItemsPerPageChange = (size: number) => setPagination({ currentPage: 1, itemsPerPage: size });

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <h1 className="text-2xl font-bold font-headline mb-6">Online Transactions</h1>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Amount Paid</CardTitle>
                        <CardDescription className="text-xs">All transactions combined</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ₹{(
                                (summary.totalAmountPaid || 0) +
                                subTransactions.reduce((sum: number, s: any) => sum + (s.plan?.discountedPrice ?? s.plan?.price ?? 0), 0) +
                                (productSummary.totalAmount || 0)
                            ).toFixed(2)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Appointment Amount</CardTitle>
                        <CardDescription className="text-xs">Online appointment payments</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{(summary.totalAmountPaid || 0).toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Subscription Amount</CardTitle>
                        <CardDescription className="text-xs">Vendor &amp; supplier plans</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ₹{subTransactions
                                .reduce((sum: number, s: any) => sum + (s.plan?.discountedPrice ?? s.plan?.price ?? 0), 0)
                                .toFixed(2)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Product Amount</CardTitle>
                        <CardDescription className="text-xs">Online product payments</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{(productSummary.totalAmount || 0).toFixed(2)}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <CardTitle>Transactions</CardTitle>
                            <CardDescription>
                                All online payments — appointments, subscriptions, and products.
                                {selectedRegion && selectedRegion !== 'all' && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        Region Filtered
                                    </span>
                                )}
                            </CardDescription>
                        </div>
                        {hasActiveFilters && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={resetFilters}
                                className="self-start sm:self-auto text-xs text-muted-foreground hover:text-foreground h-8 px-2.5"
                            >
                                <X className="h-3.5 w-3.5 mr-1" /> Reset Filters
                            </Button>
                        )}
                    </div>
                    {/* Responsive Standard Unified Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search invoice or name"
                                className="w-full pl-8 h-9 text-xs sm:text-sm"
                                value={search}
                                onChange={handleSearch}
                            />
                        </div>
                        {/* 1. Transaction Type filter */}
                        <Select value={txTypeFilter} onValueChange={(v) => { setTxTypeFilter(v); setPagination(p => ({ ...p, currentPage: 1 })); }}>
                            <SelectTrigger className="w-full h-9 text-xs sm:text-sm">
                                <SelectValue placeholder="Transaction Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="appointment">Appointment</SelectItem>
                                <SelectItem value="subscription">Subscription</SelectItem>
                                <SelectItem value="product">Product (Client)</SelectItem>
                                <SelectItem value="marketplace">Marketplace (B2B)</SelectItem>
                            </SelectContent>
                        </Select>
                        {/* 2. Vendor Filter */}
                        <Select value={vendorFilter} onValueChange={handleFilterChange(setVendorFilter)}>
                            <SelectTrigger className="w-full h-9 text-xs sm:text-sm">
                                <SelectValue placeholder="Vendor" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Vendors</SelectItem>
                                {vendorsList.map((v: any) => (
                                    <SelectItem key={v._id} value={v._id}>{v.businessName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {/* 3. Unified Status Filter */}
                        <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
                            <SelectTrigger className="w-full h-9 text-xs sm:text-sm">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="completed">Completed / Delivered</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="confirmed">Confirmed / Shipped</SelectItem>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="cancelled">Cancelled / Expired</SelectItem>
                            </SelectContent>
                        </Select>
                        {/* 4. Unified Pay Status Filter */}
                        <Select value={paymentStatusFilter} onValueChange={handleFilterChange(setPaymentStatusFilter)}>
                            <SelectTrigger className="w-full h-9 text-xs sm:text-sm">
                                <SelectValue placeholder="Pay Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Pay Status</SelectItem>
                                <SelectItem value="completed">Paid / Completed</SelectItem>
                                <SelectItem value="pending">Pending / COD</SelectItem>
                                <SelectItem value="partial">Partial</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                                <SelectItem value="refunded">Refunded</SelectItem>
                            </SelectContent>
                        </Select>
                        {/* 5. Date Range Filter */}
                        <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v); setPagination(p => ({ ...p, currentPage: 1 })); }}>
                            <SelectTrigger className="w-full h-9 text-xs sm:text-sm">
                                <SelectValue placeholder="Date Range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Time</SelectItem>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="yesterday">Yesterday</SelectItem>
                                <SelectItem value="last7days">Last 7 Days</SelectItem>
                                <SelectItem value="thisMonth">This Month</SelectItem>
                                <SelectItem value="lastMonth">Last Month</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <div ref={tableRef} className="overflow-x-auto no-scrollbar">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Invoice / ID</TableHead>
                                    <TableHead>Date / Time</TableHead>
                                    <TableHead>Client / Vendor</TableHead>
                                    <TableHead>Vendor / Supplier</TableHead>
                                    <TableHead>Services / Plan / Products</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-center">Type</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-center">Pay Status</TableHead>
                                    <TableHead className="text-center">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(isLoading || subLoading || productLoading) ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            {[...Array(10)].map((__, j) => (
                                                <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : (
                                    <>
                                        {/* ── Paginated rows merged and sorted by exact date/time desc ── */}
                                        {paginatedMergedRows.map((row: any) => {

                                            if (row._txType === 'appointment') return (
                                                <TableRow key={`appt-${row._id}`}>
                                                    <TableCell className="font-medium">
                                                        {row.invoiceNumber || row._id.substring(0, 8).toUpperCase()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{new Date(row.createdAt || row.date).toLocaleDateString()}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {row.createdAt ? new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `${row.startTime} - ${row.endTime}`}
                                                            {row.startTime && row.createdAt ? ` (Slot: ${row.startTime})` : ''}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{row.clientName || 'N/A'}</div>
                                                        {row.clientPhone && <div className="text-xs text-muted-foreground">{row.clientPhone}</div>}
                                                    </TableCell>
                                                    <TableCell>{row.vendorId?.businessName || 'Unknown Vendor'}</TableCell>
                                                    <TableCell>
                                                        {row.isMultiService ? (
                                                            <span className="text-sm">{row.serviceItems?.length || 0} services</span>
                                                        ) : (
                                                            <span className="text-sm truncate max-w-[150px] inline-block" title={row.serviceName}>
                                                                {row.serviceName || 'N/A'}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        ₹{(row.finalAmount || row.totalAmount || 0).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="outline" className="text-xs">Appointment</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant={
                                                            row.status === 'completed' ? 'success' :
                                                                row.status === 'cancelled' ? 'destructive' :
                                                                    row.status === 'confirmed' ? 'default' : 'secondary'
                                                        }>{row.status}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center text-xs font-medium uppercase">
                                                        {row.paymentStatus || 'unknown'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Button variant="ghost" size="sm" onClick={() => setSelectedTransaction(row)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );

                                            if (row._txType === 'subscription') return (
                                                <TableRow key={`sub-${row._id}`} className="bg-purple-50/40 dark:bg-purple-950/10">
                                                    <TableCell className="font-medium text-muted-foreground">
                                                        SUB-{row.entityId?.toString().slice(-6).toUpperCase()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">
                                                            {row.purchaseDate ? new Date(row.purchaseDate).toLocaleDateString() : '—'}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {row.purchaseDate ? new Date(row.purchaseDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                            {row.startDate && row.endDate ? ` (${new Date(row.startDate).toLocaleDateString()} → ${new Date(row.endDate).toLocaleDateString()})` : ''}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{row.entityName}</div>
                                                        <div className="text-xs text-muted-foreground">{row.entityEmail}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={row.userType === 'Vendor' ? 'default' : 'secondary'} className="text-xs">
                                                            {row.userType}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-sm font-medium">{row.plan?.name || '—'}</span>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {row.plan ? `₹${(row.plan.discountedPrice ?? row.plan.price ?? 0).toFixed(2)}` : '—'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200">
                                                            Subscription
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant={
                                                            row.status === 'Active' ? 'success' :
                                                                row.status === 'Expired' ? 'destructive' :
                                                                    row.status === 'Scheduled' ? 'default' : 'secondary'
                                                        }>{row.status || '—'}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center text-xs font-medium text-green-600 uppercase">paid</TableCell>
                                                    <TableCell className="text-center">
                                                        <Button variant="ghost" size="sm" onClick={() => setSelectedTransaction(row)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );

                                            if (row._txType === 'product') return (
                                                <TableRow key={`prod-${row._id}`} className="bg-green-50/40 dark:bg-green-950/10">
                                                    <TableCell className="font-medium text-muted-foreground">{row.orderRef}</TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{new Date(row.date).toLocaleDateString()}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {new Date(row.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{row.customerName || row.vendorName || '—'}</div>
                                                        {row.customerPhone && row.customerPhone !== '—' && (
                                                            <div className="text-xs text-muted-foreground">{row.customerPhone}</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {row.orderSource === 'B2B' ? (
                                                            <div>
                                                                <div className="font-medium">{row.supplierName || 'Unknown Supplier'}</div>
                                                                <div className="text-xs text-muted-foreground">Supplier</div>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <div className="font-medium">{row.vendorName || 'Unknown Vendor'}</div>
                                                                {row.supplierName && (
                                                                    <div className="text-xs text-muted-foreground">Supplier</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell><span className="text-sm">{row.itemsSummary}</span></TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        ₹{(row.totalAmount || 0).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {row.orderSource === 'B2B' ? (
                                                            <Badge className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">Marketplace</Badge>
                                                        ) : (
                                                            <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Product</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant={
                                                            row.status === 'Delivered' ? 'success' :
                                                                row.status === 'Cancelled' ? 'destructive' :
                                                                    row.status === 'Shipped' ? 'default' : 'secondary'
                                                        }>{row.status}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center text-xs font-medium text-green-600 uppercase">
                                                        {row.orderSource === 'B2C' ? 'online' : row.paymentMethod || 'paid'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Button variant="ghost" size="sm" onClick={() => setSelectedTransaction(row)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );

                                            return null;
                                        })}

                                        {error && (
                                            <TableRow>
                                                <TableCell colSpan={10} className="text-center text-destructive py-6">
                                                    Error loading transactions.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {!error && totalMergedItems === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={10} className="text-center text-muted-foreground py-6">
                                                    No online transactions found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {/* Pagination for all merged rows */}
                    {!isLoading && totalMergedItems > 0 && (
                        <Pagination
                            className="mt-4"
                            currentPage={pagination.currentPage}
                            totalPages={totalMergedPages}
                            onPageChange={handlePageChange}
                            itemsPerPage={pagination.itemsPerPage}
                            onItemsPerPageChange={handleItemsPerPageChange}
                            totalItems={totalMergedItems}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Details Dialog — handles Appointment, Subscription, and Product */}
            <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Transaction Details</DialogTitle>
                        <DialogDescription>
                            {selectedTransaction?._txType === 'subscription' && `Subscription — ${selectedTransaction?.entityName}`}
                            {selectedTransaction?._txType === 'product' && `Order — ${selectedTransaction?.orderRef}`}
                            {selectedTransaction?._txType === 'appointment' && `Invoice: ${selectedTransaction?.invoiceNumber || selectedTransaction?._id}`}
                            {!selectedTransaction?._txType && `Invoice: ${selectedTransaction?.invoiceNumber || selectedTransaction?._id}`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">

                        {/* ── Appointment details (original) ── */}
                        {(selectedTransaction?._txType === 'appointment' || !selectedTransaction?._txType) && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Client Name</p>
                                        <p className="font-medium">{selectedTransaction?.clientName || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Vendor</p>
                                        <p className="font-medium">{selectedTransaction?.vendorId?.businessName || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Amount</p>
                                        <p className="font-medium text-green-600">
                                            ₹{(selectedTransaction?.finalAmount || selectedTransaction?.totalAmount || 0).toFixed(2)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Payment Status</p>
                                        <Badge variant="outline">{selectedTransaction?.paymentStatus}</Badge>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Date &amp; Time</p>
                                        <p className="text-sm">
                                            {selectedTransaction?.date ? new Date(selectedTransaction.date).toLocaleDateString() : 'N/A'}<br />
                                            {selectedTransaction?.startTime} - {selectedTransaction?.endTime}
                                        </p>
                                    </div>
                                </div>
                                {selectedTransaction?.isMultiService && selectedTransaction?.serviceItems?.length > 0 && (
                                    <div className="mt-4 border-t pt-4">
                                        <p className="font-medium mb-2">Services Provided:</p>
                                        <ul className="space-y-2 text-sm">
                                            {selectedTransaction.serviceItems.map((s: any, i: number) => (
                                                <li key={i} className="flex justify-between items-center bg-muted/50 p-2 rounded">
                                                    <span>{s.serviceName}</span>
                                                    <span className="font-medium">₹{s.amount}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {!selectedTransaction?.isMultiService && selectedTransaction?.serviceName && (
                                    <div className="mt-4 border-t pt-4">
                                        <p className="font-medium mb-2">Service Provided:</p>
                                        <div className="flex justify-between items-center bg-muted/50 p-2 rounded text-sm">
                                            <span>{selectedTransaction.serviceName}</span>
                                            <span className="font-medium">₹{selectedTransaction.amount}</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── Subscription details ── */}
                        {selectedTransaction?._txType === 'subscription' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Name</p>
                                    <p className="font-medium">{selectedTransaction?.entityName || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Email</p>
                                    <p className="font-medium text-xs">{selectedTransaction?.entityEmail || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Type</p>
                                    <Badge variant={selectedTransaction?.userType === 'Vendor' ? 'default' : 'secondary'}>
                                        {selectedTransaction?.userType}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Plan</p>
                                    <p className="font-medium">{selectedTransaction?.plan?.name || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Amount</p>
                                    <p className="font-medium text-green-600">
                                        ₹{(selectedTransaction?.plan?.discountedPrice ?? selectedTransaction?.plan?.price ?? 0).toFixed(2)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    <Badge variant={
                                        selectedTransaction?.status === 'Active' ? 'success' :
                                            selectedTransaction?.status === 'Expired' ? 'destructive' :
                                                selectedTransaction?.status === 'Scheduled' ? 'default' : 'secondary'
                                    }>
                                        {selectedTransaction?.status || '—'}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Purchase Date</p>
                                    <p className="text-sm">{selectedTransaction?.purchaseDate ? new Date(selectedTransaction.purchaseDate).toLocaleDateString() : '—'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Valid Until</p>
                                    <p className="text-sm">{selectedTransaction?.endDate ? new Date(selectedTransaction.endDate).toLocaleDateString() : '—'}</p>
                                </div>
                            </div>
                        )}

                        {/* ── Product / Order details ── */}
                        {selectedTransaction?._txType === 'product' && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            {selectedTransaction?.orderSource === 'B2B' ? 'Buyer (Vendor)' : 'Customer'}
                                        </p>
                                        <p className="font-medium">{selectedTransaction?.customerName || 'N/A'}</p>
                                        {selectedTransaction?.customerPhone && selectedTransaction?.customerPhone !== '—' && (
                                            <p className="text-xs text-muted-foreground">{selectedTransaction?.customerPhone}</p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            {selectedTransaction?.orderSource === 'B2B' ? 'Seller (Supplier)' : 'Seller'}
                                        </p>
                                        <p className="font-medium">
                                            {selectedTransaction?.orderSource === 'B2B'
                                                ? (selectedTransaction?.supplierName || 'N/A')
                                                : (selectedTransaction?.vendorName || selectedTransaction?.supplierName || 'N/A')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Amount</p>
                                        <p className="font-medium text-green-600">₹{(selectedTransaction?.totalAmount || 0).toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Order Type</p>
                                        <Badge className={selectedTransaction?.orderSource === 'B2B'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-green-100 text-green-700'}>
                                            {selectedTransaction?.orderSource === 'B2B' ? 'Marketplace (B2B)' : 'Product (B2C)'}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Status</p>
                                        <Badge variant={
                                            selectedTransaction?.status === 'Delivered' ? 'success' :
                                                selectedTransaction?.status === 'Cancelled' ? 'destructive' :
                                                    selectedTransaction?.status === 'Shipped' ? 'default' : 'secondary'
                                        }>
                                            {selectedTransaction?.status}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Date &amp; Time</p>
                                        <p className="text-sm">
                                            {selectedTransaction?.date ? new Date(selectedTransaction.date).toLocaleDateString() : '—'}{' '}
                                            {selectedTransaction?.date ? new Date(selectedTransaction.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Payment Method</p>
                                        <p className="text-sm font-medium uppercase">{selectedTransaction?.paymentMethod || 'Online'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Payment Status</p>
                                        <Badge variant="outline" className="text-xs uppercase">
                                            {selectedTransaction?.paymentStatus || 'Completed'}
                                        </Badge>
                                    </div>
                                    {selectedTransaction?.paymentId && (
                                        <div className="col-span-2">
                                            <p className="text-sm text-muted-foreground">Payment ID</p>
                                            <p className="text-xs font-mono">{selectedTransaction?.paymentId}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 border-t pt-4">
                                    <p className="font-medium mb-2">Items:</p>
                                    <p className="text-sm bg-muted/50 p-2 rounded">{selectedTransaction?.itemsSummary}</p>
                                </div>
                            </>
                        )}

                    </div>
                    <DialogFooter>
                        <Button onClick={() => setSelectedTransaction(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
