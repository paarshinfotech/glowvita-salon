import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import ClientOrderModel from '@repo/lib/models/user/ClientOrder.model';
import OrderModel from '@repo/lib/models/Vendor/Order.model';
import VendorModel from '@repo/lib/models/Vendor/Vendor.model';
import SupplierModel from '@repo/lib/models/Vendor/Supplier.model';
import DoctorModel from '@repo/lib/models/Vendor/Docters.model';
import StaffModel from '@repo/lib/models/Vendor/Staff.model';
import UserModel from '@repo/lib/models/user';
import _db from '@repo/lib/db';
import { authMiddlewareAdmin } from "../../../../middlewareAdmin";

// GET — Fetch all product orders:
//   1. ClientOrders where paymentMethod = 'Online'  (B2C online)
//   2. All Order model records                       (B2B marketplace)
export const GET = authMiddlewareAdmin(async (req) => {
    try {
        await _db();

        const url = new URL(req.url);
        let page  = parseInt(url.searchParams.get('page'))  || 1;
        let limit = parseInt(url.searchParams.get('limit')) || 10;
        const search   = url.searchParams.get('search')   || '';
        const regionId = url.searchParams.get('regionId') || '';
        const status   = url.searchParams.get('status')   || '';

        if (page  < 1)         page  = 1;
        if (limit < 1 || limit > 1000) limit = 10;

        const { getRegionQuery } = await import("@repo/lib/utils/regionQuery");
        const regionQuery = getRegionQuery(
            req.user,
            regionId && regionId !== 'all' ? regionId : null
        );

        // ── 1. B2C online client orders ───────────────────────────────────
        // paymentMethod is stored as 'pay-online' from the web checkout page
        const clientQuery = { ...regionQuery, paymentMethod: 'pay-online' };
        if (status && status !== 'all') clientQuery.status = status;
        if (search) {
            clientQuery.$or = [
                { paymentId:        { $regex: search, $options: 'i' } },
                { razorpayOrderId:  { $regex: search, $options: 'i' } },
                { shippingAddress:  { $regex: search, $options: 'i' } },
            ];
        }
        if (clientQuery.regionId && typeof clientQuery.regionId === 'string') {
            try { clientQuery.regionId = new mongoose.Types.ObjectId(clientQuery.regionId); } catch (e) {}
        }

        const clientOrders = await ClientOrderModel.find(clientQuery)
            .sort({ createdAt: -1 })
            .lean();

        // ── 2. B2B marketplace orders (Order model) ───────────────────────
        const b2bQuery = { ...regionQuery };
        if (status && status !== 'all') b2bQuery.status = status;
        if (search) {
            b2bQuery.$or = [
                { orderId:         { $regex: search, $options: 'i' } },
                { customerName:    { $regex: search, $options: 'i' } },
                { shippingAddress: { $regex: search, $options: 'i' } },
            ];
        }
        if (b2bQuery.regionId && typeof b2bQuery.regionId === 'string') {
            try { b2bQuery.regionId = new mongoose.Types.ObjectId(b2bQuery.regionId); } catch (e) {}
        }

        const b2bOrders = await OrderModel.find(b2bQuery)
            .sort({ createdAt: -1 })
            .lean();

        // ── 3. Collect all unique IDs to batch fetch across models ────────
        const extractId = (val) => {
            if (!val) return null;
            if (typeof val === 'object') {
                if (val._id) return val._id.toString();
                // If it's an ObjectId instance itself
                try { const s = val.toString(); return (s && s !== '[object Object]') ? s : null; } catch (e) { return null; }
            }
            const s = String(val).trim();
            return (s && s !== '[object Object]') ? s : null;
        };

        const rawVendorIds = [
            ...clientOrders.map(o => extractId(o.vendorId)),
            ...b2bOrders.map(o => extractId(o.vendorId || o.vendor || o.salonId || o.customerId)),
        ].filter(Boolean);

        const rawSupplierIds = [
            ...clientOrders.map(o => extractId(o.vendorId)), // B2C orders could also be sold by suppliers
            ...b2bOrders.map(o => extractId(o.supplierId || o.supplier)),
        ].filter(Boolean);

        const rawUserIds = [
            ...clientOrders.map(o => extractId(o.userId)),
            ...b2bOrders.map(o => extractId(o.customerId)),
        ].filter(Boolean);

        const uniqueVendorIds = [...new Set(rawVendorIds)];
        const uniqueSupplierIds = [...new Set(rawSupplierIds)];
        const uniqueUserIds = [...new Set(rawUserIds)];

        const toObjectIds = (ids) => ids
            .filter(id => id && mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));

        const vendorObjectIds = toObjectIds(uniqueVendorIds);
        const supplierObjectIds = toObjectIds(uniqueSupplierIds);
        const userObjectIds = toObjectIds(uniqueUserIds);

        const [vendors, suppliers, doctors, staffs, users] = await Promise.all([
            VendorModel.find({ $or: [{ _id: { $in: vendorObjectIds } }, { _id: { $in: uniqueVendorIds } }] }).select('businessName firstName lastName phone email').lean(),
            SupplierModel.find({ $or: [{ _id: { $in: supplierObjectIds } }, { _id: { $in: uniqueSupplierIds } }] }).select('shopName firstName lastName mobile email').lean(),
            DoctorModel.find({ $or: [{ _id: { $in: vendorObjectIds } }, { _id: { $in: uniqueVendorIds } }] }).select('name businessName firstName lastName phone email').lean(),
            StaffModel.find({ $or: [{ _id: { $in: vendorObjectIds } }, { _id: { $in: uniqueVendorIds } }] }).select('fullName vendorId mobileNo emailAddress').lean(),
            UserModel.find({ $or: [{ _id: { $in: userObjectIds } }, { _id: { $in: uniqueUserIds } }] }).select('firstName lastName mobileNo emailAddress').lean(),
        ]);

        const vendorMap = Object.fromEntries(vendors.map(v => [v._id.toString(), v]));
        const supplierMap = Object.fromEntries(suppliers.map(s => [s._id.toString(), s]));
        const doctorMap = Object.fromEntries(doctors.map(d => [d._id.toString(), d]));
        const staffMap = Object.fromEntries(staffs.map(st => [st._id.toString(), st]));
        const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));

        // Direct collection fallback query for vendors missing from vendorMap:
        const missingVendorIds = uniqueVendorIds.filter(id => !vendorMap[id]);
        if (missingVendorIds.length > 0 && mongoose.connection?.db) {
            try {
                const missingObjIds = toObjectIds(missingVendorIds);
                const rawVendors = await mongoose.connection.db.collection('vendors').find({
                    $or: [
                        { _id: { $in: missingObjIds } },
                        { _id: { $in: missingVendorIds } }
                    ]
                }).project({ businessName: 1, firstName: 1, lastName: 1, phone: 1, email: 1 }).toArray();

                for (const rv of rawVendors) {
                    if (rv && rv._id) vendorMap[rv._id.toString()] = rv;
                }
            } catch (err) {
                console.error("Direct collection fallback query error for vendors:", err);
            }
        }

        // Direct collection fallback query for users missing from userMap:
        const missingUserIds = uniqueUserIds.filter(id => !userMap[id]);
        if (missingUserIds.length > 0 && mongoose.connection?.db) {
            try {
                const missingUserObjIds = toObjectIds(missingUserIds);
                const rawUsers = await mongoose.connection.db.collection('users').find({
                    $or: [
                        { _id: { $in: missingUserObjIds } },
                        { _id: { $in: missingUserIds } }
                    ]
                }).project({ firstName: 1, lastName: 1, mobileNo: 1, emailAddress: 1 }).toArray();

                for (const ru of rawUsers) {
                    if (ru && ru._id) userMap[ru._id.toString()] = ru;
                }
            } catch (err) {
                console.error("Direct collection fallback query error for users:", err);
            }
        }

        // Direct collection fallback query for suppliers missing from supplierMap:
        const missingSupplierIds = uniqueSupplierIds.filter(id => !supplierMap[id]);
        if (missingSupplierIds.length > 0 && mongoose.connection?.db) {
            try {
                const missingSupObjIds = toObjectIds(missingSupplierIds);
                const rawSuppliers = await mongoose.connection.db.collection('suppliers').find({
                    $or: [
                        { _id: { $in: missingSupObjIds } },
                        { _id: { $in: missingSupplierIds } }
                    ]
                }).project({ shopName: 1, firstName: 1, lastName: 1, mobile: 1, email: 1 }).toArray();

                for (const rs of rawSuppliers) {
                    if (rs && rs._id) supplierMap[rs._id.toString()] = rs;
                }
            } catch (err) {
                console.error("Direct collection fallback query error for suppliers:", err);
            }
        }

        // Fetch parent vendors for any staff buyers
        const staffParentVendorIds = staffs
            .map(st => st.vendorId?.toString())
            .filter(id => id && !vendorMap[id]);
        if (staffParentVendorIds.length > 0) {
            const extraObjIds = toObjectIds(staffParentVendorIds);
            const extraVendors = await VendorModel.find({ _id: { $in: [...extraObjIds, ...staffParentVendorIds] } })
                .select('businessName firstName lastName phone')
                .lean();
            extraVendors.forEach(v => { vendorMap[v._id.toString()] = v; });
        }

        // Helper to resolve Buyer info (for B2B orders)
        const resolveBuyerInfo = async (o) => {
            // 1. Populated object (mongoose populate resolved it)
            if (o.vendorId && typeof o.vendorId === 'object' && !Array.isArray(o.vendorId)) {
                const vName = o.vendorId.businessName || `${o.vendorId.firstName || ''} ${o.vendorId.lastName || ''}`.trim();
                if (vName) {
                    return { name: vName, phone: o.vendorId.phone || '—', type: 'Vendor' };
                }
            }

            // 2. Lookup by ID in pre-fetched maps
            const vId = extractId(o.vendorId || o.vendor || o.salonId || o.customerId);
            if (vId) {
                if (vendorMap[vId]) {
                    const v = vendorMap[vId];
                    const vName = v.businessName || `${v.firstName || ''} ${v.lastName || ''}`.trim();
                    if (vName) {
                        return { name: vName, phone: v.phone || '—', type: 'Vendor' };
                    }
                }

                // 3. Direct DB fallback — query vendors collection directly with ObjectId
                try {
                    let directV = null;
                    if (mongoose.connection?.db) {
                        const lookupId = mongoose.Types.ObjectId.isValid(vId) ? new mongoose.Types.ObjectId(vId) : vId;
                        directV = await mongoose.connection.db.collection('vendors').findOne({
                            $or: [{ _id: lookupId }, { _id: vId }]
                        });
                    }
                    if (!directV) {
                        directV = await VendorModel.findById(vId).select('businessName firstName lastName phone').lean();
                    }
                    if (directV) {
                        vendorMap[vId] = directV;
                        const vName = directV.businessName || `${directV.firstName || ''} ${directV.lastName || ''}`.trim();
                        if (vName) {
                            return { name: vName, phone: directV.phone || '—', type: 'Vendor' };
                        }
                    }
                } catch (e) {}

                if (staffMap[vId]) {
                    const st = staffMap[vId];
                    const parentV = st.vendorId ? vendorMap[st.vendorId.toString()] : null;
                    const salonName = parentV?.businessName ? ` (${parentV.businessName})` : '';
                    return { name: `${st.fullName || 'Staff'}${salonName}`, phone: st.mobileNo || '—', type: 'Vendor' };
                }
                if (doctorMap[vId]) {
                    const d = doctorMap[vId];
                    return { name: d.businessName || d.name || `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Doctor', phone: d.phone || '—', type: 'Doctor' };
                }
                if (supplierMap[vId]) {
                    const s = supplierMap[vId];
                    return { name: s.shopName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Supplier', phone: s.mobile || '—', type: 'Supplier' };
                }
                if (userMap[vId]) {
                    const u = userMap[vId];
                    return { name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Customer', phone: u.mobileNo || '—', type: 'Customer' };
                }
            }

            const cId = extractId(o.customerId);
            if (cId && userMap[cId]) {
                const u = userMap[cId];
                return { name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Customer', phone: u.mobileNo || '—', type: 'Customer' };
            }

            if (o.customerName) {
                return { name: o.customerName, phone: o.customerPhone || '—', type: 'Vendor' };
            }

            return { name: 'Unknown Vendor', phone: '—', type: 'Vendor' };
        };

        // Helper to resolve Seller info (Supplier for B2B, Vendor/Supplier for B2C)
        const resolveSellerInfo = async (o, orderSource) => {
            if (orderSource === 'B2B') {
                // 1. Populated object
                if (o.supplierId && typeof o.supplierId === 'object' && !Array.isArray(o.supplierId)) {
                    const sName = o.supplierId.shopName || `${o.supplierId.firstName || ''} ${o.supplierId.lastName || ''}`.trim();
                    if (sName) {
                        return { name: sName, phone: o.supplierId.mobile || '—', type: 'Supplier' };
                    }
                }

                // 2. Map lookup
                const sId = extractId(o.supplierId);
                if (sId) {
                    if (supplierMap[sId]) {
                        const s = supplierMap[sId];
                        return {
                            name: s.shopName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Supplier',
                            phone: s.mobile || '—',
                            type: 'Supplier',
                        };
                    }
                    if (vendorMap[sId]) {
                        const v = vendorMap[sId];
                        return {
                            name: v.businessName || `${v.firstName || ''} ${v.lastName || ''}`.trim() || 'Vendor',
                            phone: v.phone || '—',
                            type: 'Vendor',
                        };
                    }

                    // 3. Direct DB fallback
                    try {
                        let directS = null;
                        if (mongoose.connection?.db) {
                            const lookupId = mongoose.Types.ObjectId.isValid(sId) ? new mongoose.Types.ObjectId(sId) : sId;
                            directS = await mongoose.connection.db.collection('suppliers').findOne({ _id: lookupId });
                        }
                        if (!directS) {
                            directS = await SupplierModel.findById(sId).select('shopName firstName lastName mobile').lean();
                        }
                        if (directS) {
                            supplierMap[sId] = directS;
                            return {
                                name: directS.shopName || `${directS.firstName || ''} ${directS.lastName || ''}`.trim() || 'Supplier',
                                phone: directS.mobile || '—',
                                type: 'Supplier',
                            };
                        }
                    } catch (e) {}
                }
                return { name: 'Supplier', phone: '—', type: 'Supplier' };
            } else {
                // B2C: Seller is in vendorId (could be Vendor or Supplier)
                if (o.vendorId && typeof o.vendorId === 'object') {
                    const vName = o.vendorId.businessName || `${o.vendorId.firstName || ''} ${o.vendorId.lastName || ''}`.trim();
                    if (vName) {
                        return {
                            name: vName,
                            phone: o.vendorId.phone || '—',
                            type: 'Vendor',
                        };
                    }
                }

                const vId = extractId(o.vendorId);
                if (vId) {
                    if (vendorMap[vId]) {
                        const v = vendorMap[vId];
                        return {
                            name: v.businessName || `${v.firstName || ''} ${v.lastName || ''}`.trim() || 'Vendor',
                            phone: v.phone || '—',
                            type: 'Vendor',
                        };
                    }
                    if (supplierMap[vId]) {
                        const s = supplierMap[vId];
                        return {
                            name: s.shopName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Supplier',
                            phone: s.mobile || '—',
                            type: 'Supplier',
                        };
                    }

                    try {
                        const directV = await VendorModel.findById(vId).select('businessName firstName lastName phone').lean();
                        if (directV) {
                            vendorMap[vId] = directV;
                            return {
                                name: directV.businessName || `${directV.firstName || ''} ${directV.lastName || ''}`.trim() || 'Vendor',
                                phone: directV.phone || '—',
                                type: 'Vendor',
                            };
                        }
                    } catch (e) {}
                }
                return {
                    name: 'Vendor',
                    phone: '—',
                    type: 'Vendor',
                };
            }
        };

        // ── 4. Normalise into a single shape ─────────────────────────────
        const normaliseClient = async (o) => {
            let userName = '';
            let userPhone = '';

            // 1. Populated userId object directly on order
            if (o.userId && typeof o.userId === 'object') {
                const fn = o.userId.firstName || '';
                const ln = o.userId.lastName || '';
                const fullName = `${fn} ${ln}`.trim();
                if (fullName) {
                    userName = fullName;
                    userPhone = o.userId.mobileNo || o.userId.phone || '';
                }
            }

            // 2. Lookup in userMap using extractId
            const uId = extractId(o.userId);
            if (!userName && uId && userMap[uId]) {
                const u = userMap[uId];
                const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
                if (fullName) {
                    userName = fullName;
                    userPhone = u.mobileNo || u.phone || '';
                }
            }

            // 3. Direct DB fallback to 'users' collection
            if (!userName && uId) {
                try {
                    let uDoc = null;
                    if (mongoose.connection?.db) {
                        const lookupId = mongoose.Types.ObjectId.isValid(uId) ? new mongoose.Types.ObjectId(uId) : uId;
                        uDoc = await mongoose.connection.db.collection('users').findOne({
                            $or: [{ _id: lookupId }, { _id: uId }]
                        });
                    }
                    if (!uDoc) {
                        uDoc = await UserModel.findById(uId).select('firstName lastName mobileNo emailAddress').lean();
                    }
                    if (uDoc) {
                        userMap[uId] = uDoc;
                        const fullName = `${uDoc.firstName || ''} ${uDoc.lastName || ''}`.trim();
                        if (fullName) {
                            userName = fullName;
                            userPhone = uDoc.mobileNo || '';
                        }
                    }
                } catch (e) {}
            }

            const customerName = userName || o.customerName || 'Online Customer';
            const customerPhone = userPhone || o.contactNumber || '—';
            const seller = await resolveSellerInfo(o, 'B2C');

            return {
                _id:          o._id,
                orderRef:     o.paymentId
                                ? o.paymentId.slice(-8).toUpperCase()
                                : `ORD-${o._id.toString().slice(-6).toUpperCase()}`,
                date:         o.createdAt,
                customerName,
                customerPhone,
                buyerType:    'Customer',
                vendorName:   seller.name,
                supplierName: seller.type === 'Supplier' ? seller.name : null,
                sellerType:   seller.type,
                itemsSummary: o.items?.length === 1
                                ? (o.items[0].name || o.items[0].productName)
                                : `${o.items?.length || 0} products`,
                totalAmount:  o.totalAmount || 0,
                status:       o.status,
                orderSource:  'B2C',
                paymentMethod: o.paymentMethod || 'online',
                paymentStatus: o.paymentStatus || 'completed',
                paymentId:     o.paymentId || null,
            };
        };

        const normaliseB2B = async (o) => {
            const buyer = await resolveBuyerInfo(o);
            const seller = await resolveSellerInfo(o, 'B2B');

            return {
                _id:          o._id,
                orderRef:     o.orderId || `ORD-${o._id.toString().slice(-6).toUpperCase()}`,
                date:         o.createdAt,
                customerName: buyer.name,
                customerPhone: buyer.phone,
                buyerType:    buyer.type,
                vendorName:   buyer.name,
                supplierName: seller.name,
                sellerType:   seller.type,
                itemsSummary: o.items?.length === 1
                                ? (o.items[0].productName || o.items[0].name)
                                : `${o.items?.length || 0} products`,
                totalAmount:  o.totalAmount || 0,
                status:       o.status,
                orderSource:  'B2B',
                paymentMethod: o.paymentMethod || 'online',
                paymentStatus: o.paymentStatus || (o.paymentId ? 'completed' : 'pending'),
                paymentId:     o.paymentId || null,
            };
        };

        const [clientRows, b2bRows] = await Promise.all([
            Promise.all(clientOrders.map(normaliseClient)),
            Promise.all(b2bOrders.map(normaliseB2B)),
        ]);

        const allOrders = [
            ...clientRows,
            ...b2bRows,
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // ── 5. Summary ────────────────────────────────────────────────────
        const totalAmount   = allOrders.reduce((s, o) => s + o.totalAmount, 0);
        const totalOrders   = allOrders.length;
        const b2cTotal      = clientOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
        const b2bTotal      = b2bOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);

        // ── 6. Paginate ───────────────────────────────────────────────────
        const total      = allOrders.length;
        const totalPages = Math.ceil(total / limit);
        const paginated  = allOrders.slice((page - 1) * limit, page * limit);

        return NextResponse.json({
            success: true,
            data: paginated,
            summary: { totalOrders, totalAmount, b2cTotal, b2bTotal },
            pagination: { page, limit, total, totalPages },
        }, { status: 200 });

    } catch (error) {
        console.error('=== ERROR FETCHING PRODUCT TRANSACTIONS ===', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to fetch product transactions',
            error: error.message,
        }, { status: 500 });
    }
}, ["SUPER_ADMIN", "REGIONAL_ADMIN", "STAFF"], "reports:view");
