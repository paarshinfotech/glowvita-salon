import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import VendorModel from '@repo/lib/models/Vendor/Vendor.model';
import SupplierModel from '@repo/lib/models/Vendor/Supplier.model';
import SubscriptionPlanModel from '@repo/lib/models/admin/SubscriptionPlan.model';
import _db from '@repo/lib/db';
import { authMiddlewareAdmin } from "../../../../middlewareAdmin";

// GET - Fetch subscription payment transactions for vendors & suppliers
export const GET = authMiddlewareAdmin(async (req) => {
    try {
        await _db();

        const url = new URL(req.url);
        let page = parseInt(url.searchParams.get('page')) || 1;
        let limit = parseInt(url.searchParams.get('limit')) || 10;
        const search = url.searchParams.get('search') || '';
        const regionId = url.searchParams.get('regionId') || '';
        const userType = url.searchParams.get('userType') || 'all'; // 'vendor' | 'supplier' | 'all'
        const planType = url.searchParams.get('planType') || 'all'; // 'trial' | 'regular' | 'all'

        if (page < 1) page = 1;
        if (limit < 1 || limit > 1000) limit = 10;

        const { getRegionQuery } = await import("@repo/lib/utils/regionQuery");
        const regionQuery = getRegionQuery(req.user, regionId && regionId !== 'all' ? regionId : null);

        // Build base match for Vendors
        const vendorMatch = { ...regionQuery };
        if (search) {
            vendorMatch.$or = [
                { businessName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }

        // Build base match for Suppliers
        const supplierMatch = { ...regionQuery };
        if (search) {
            supplierMatch.$or = [
                { shopName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } },
            ];
        }

        // Fetch vendors with subscription history
        let vendorRows = [];
        if (userType === 'all' || userType === 'vendor') {
            const vendors = await VendorModel.find(vendorMatch)
                .select('businessName email phone subscription regionId')
                .lean();

            for (const vendor of vendors) {
                // Current active subscription
                if (vendor.subscription?.plan && vendor.subscription?.purchaseDate) {
                    vendorRows.push({
                        _id: `${vendor._id}_current`,
                        entityId: vendor._id,
                        entityName: vendor.businessName || `${vendor.firstName} ${vendor.lastName}`,
                        entityEmail: vendor.email,
                        entityPhone: vendor.phone,
                        userType: 'Vendor',
                        planId: vendor.subscription.plan,
                        purchaseDate: vendor.subscription.purchaseDate || vendor.subscription.startDate,
                        startDate: vendor.subscription.startDate,
                        endDate: vendor.subscription.endDate,
                        status: vendor.subscription.status,
                        isHistory: false,
                    });
                }
                // Historical subscriptions
                if (Array.isArray(vendor.subscription?.history)) {
                    for (const h of vendor.subscription.history) {
                        vendorRows.push({
                            _id: `${vendor._id}_hist_${h.startDate}`,
                            entityId: vendor._id,
                            entityName: vendor.businessName || `${vendor.firstName} ${vendor.lastName}`,
                            entityEmail: vendor.email,
                            entityPhone: vendor.phone,
                            userType: 'Vendor',
                            planId: h.plan,
                            purchaseDate: h.purchaseDate || h.startDate,
                            startDate: h.startDate,
                            endDate: h.endDate,
                            status: h.status,
                            isHistory: true,
                        });
                    }
                }
            }
        }

        // Fetch suppliers with subscription history
        let supplierRows = [];
        if (userType === 'all' || userType === 'supplier') {
            const suppliers = await SupplierModel.find(supplierMatch)
                .select('shopName firstName lastName email mobile subscription regionId')
                .lean();

            for (const supplier of suppliers) {
                if (supplier.subscription?.plan && supplier.subscription?.purchaseDate) {
                    supplierRows.push({
                        _id: `${supplier._id}_current`,
                        entityId: supplier._id,
                        entityName: supplier.shopName || `${supplier.firstName} ${supplier.lastName}`,
                        entityEmail: supplier.email,
                        entityPhone: supplier.mobile,
                        userType: 'Supplier',
                        planId: supplier.subscription.plan,
                        purchaseDate: supplier.subscription.purchaseDate || supplier.subscription.startDate,
                        startDate: supplier.subscription.startDate,
                        endDate: supplier.subscription.endDate,
                        status: supplier.subscription.status,
                        isHistory: false,
                    });
                }
                if (Array.isArray(supplier.subscription?.history)) {
                    for (const h of supplier.subscription.history) {
                        supplierRows.push({
                            _id: `${supplier._id}_hist_${h.startDate}`,
                            entityId: supplier._id,
                            entityName: supplier.shopName || `${supplier.firstName} ${supplier.lastName}`,
                            entityEmail: supplier.email,
                            entityPhone: supplier.mobile,
                            userType: 'Supplier',
                            planId: h.plan,
                            purchaseDate: h.purchaseDate || h.startDate,
                            startDate: h.startDate,
                            endDate: h.endDate,
                            status: h.status,
                            isHistory: true,
                        });
                    }
                }
            }
        }

        // Merge all rows and sort by purchaseDate desc
        let allRows = [...vendorRows, ...supplierRows].sort(
            (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
        );

        // Collect all unique plan IDs and populate plan details
        const planIds = [...new Set(allRows.map(r => r.planId?.toString()).filter(Boolean))];
        const plans = await SubscriptionPlanModel.find({ _id: { $in: planIds } })
            .select('name price discountedPrice planType duration durationType')
            .lean();
        const planMap = Object.fromEntries(plans.map(p => [p._id.toString(), p]));

        // Attach plan info & filter by planType
        allRows = allRows
            .map(row => ({
                ...row,
                plan: planMap[row.planId?.toString()] || null,
            }))
            .filter(row => {
                if (planType === 'all') return true;
                return row.plan?.planType === planType;
            });

        // Summary
        const totalRevenue = allRows
            .filter(r => r.plan?.planType === 'regular')
            .reduce((sum, r) => sum + (r.plan?.discountedPrice ?? r.plan?.price ?? 0), 0);

        const summary = {
            totalTransactions: allRows.length,
            vendorTransactions: allRows.filter(r => r.userType === 'Vendor').length,
            supplierTransactions: allRows.filter(r => r.userType === 'Supplier').length,
            totalRevenue,
        };

        // Paginate
        const total = allRows.length;
        const totalPages = Math.ceil(total / limit);
        const paginated = allRows.slice((page - 1) * limit, page * limit);

        return NextResponse.json({
            success: true,
            data: paginated,
            summary,
            pagination: { page, limit, total, totalPages },
        }, { status: 200 });

    } catch (error) {
        console.error('=== ERROR FETCHING SUBSCRIPTION TRANSACTIONS ===', error);
        return NextResponse.json({
            success: false,
            message: "Failed to fetch subscription transactions",
            error: error.message
        }, { status: 500 });
    }
}, ["SUPER_ADMIN", "REGIONAL_ADMIN", "STAFF"], "reports:view");
