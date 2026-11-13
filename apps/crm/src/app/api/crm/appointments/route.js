import { NextResponse } from 'next/server';
import AppointmentModel from "../../../../../../../packages/lib/src/models/Appointment/Appointment.model";
import _db from '@repo/lib/db';
import { chromium } from "playwright";
import ClientModel from '@repo/lib/models/Vendor/Client.model';
import UserModel from "../../../../../../../packages/lib/src/models/user/User.model";
import { withSubscriptionCheck } from '@/middlewareCrm';
import { sendEmail } from "../../../../../../../packages/lib/src/emailService";
import { getConfirmationTemplate, getCompletionTemplate, getInvoiceTemplate, getCancellationTemplate } from "../../../../../../../packages/lib/src/emailTemplates";
import VendorModelLib from "../../../../../../../packages/lib/src/models/Vendor/Vendor.model";
import { NotificationService, SmsService } from "@repo/lib";
import { checkAndCreditReferralBonus } from "../../../../../../../packages/lib/src/utils/referralWalletCredit";

// Helper function to send appointment emails and notifications
const sendAppointmentEmail = async (appointment, vendorId, newStatus, oldStatus, fallbackClientId = null) => {

    if (newStatus === oldStatus) return;

    try {
        const vendor = await VendorModelLib.findById(vendorId).select('businessName address phone city state pincode');
        const businessName = vendor?.businessName || 'GlowVita Salon';
        const businessAddress = `${vendor?.address || ''}, ${vendor?.city || ''}, ${vendor?.state || ''}, ${vendor?.pincode || ''}`.trim().replace(/^,|,$/g, '');
        const businessPhone = vendor?.phone || '';

        // Resolve Client Info
        let clientEmail = appointment.client?.email || appointment.clientEmail;
        let clientName = appointment.client?.fullName || appointment.clientName;
        let clientPhone = appointment.client?.phone || '';
        let clientId = appointment.client?._id || appointment.client || fallbackClientId;

        if ((!clientEmail || !clientPhone) && clientId) {
            try {
                const user = await UserModel.findById(clientId).select('firstName lastName emailAddress email mobileNo');
                if (user) {
                    clientEmail = clientEmail || user.emailAddress || user.email;
                    clientName = clientName || `${user.firstName} ${user.lastName}`;
                    clientPhone = clientPhone || user.mobileNo || user.phone;
                }
            } catch (err) {
                console.error('[Notification Debug] User fetch error:', err);
            }
        }

        // 1. Send Email (Existing Logic Restored)
        if (clientEmail) {
            try {
                if (newStatus === 'confirmed') {
                    const emailHtml = getConfirmationTemplate({
                        clientName,
                        businessName,
                        serviceName: appointment.serviceName,
                        date: appointment.date,
                        startTime: appointment.startTime,
                        location: appointment.homeServiceLocation?.address || businessName
                    });

                    await sendEmail({
                        to: clientEmail,
                        subject: `Appointment Confirmed - ${businessName}`,
                        html: emailHtml
                    });
                } else if (newStatus === 'completed' || newStatus === 'completed without payment') {
                    // Send completion template
                    const completionHtml = getCompletionTemplate({
                        clientName,
                        businessName,
                        serviceName: appointment.serviceName,
                        appointmentId: appointment.invoiceNumber || appointment._id.toString(),
                        appointmentDbId: appointment._id.toString(),
                        appointmentDate: new Date(appointment.date || appointment.startTime || new Date()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' }),
                        appointmentTime: appointment.startTime,
                        completedDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' }),
                        completedTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                        orderTotal: appointment.totalAmount,
                        location: appointment.homeServiceLocation?.address || businessName,
                        businessAddress,
                        businessPhone
                    });

                    // Fetch formal invoice
                    let invoiceHtml;
                    let formalInvoice;
                    try {
                        const { default: InvoiceModel } = await import('@repo/lib/models/Invoice/Invoice.model');
                        formalInvoice = await InvoiceModel.findOne({ appointmentId: appointment._id });

                        if (formalInvoice) {
                            invoiceHtml = getInvoiceTemplate({
                                clientName,
                                clientPhone,
                                businessName,
                                businessAddress,
                                businessPhone,
                                date: new Date(formalInvoice.createdAt).toLocaleDateString(),
                                items: formalInvoice.items,
                                subtotal: formalInvoice.subtotal,
                                tax: formalInvoice.taxAmount,
                                taxRate: formalInvoice.taxRate,
                                platformFee: formalInvoice.platformFee,
                                discount: formalInvoice.discountAmount,
                                couponCode: appointment.payment?.offer?.code || "",
                                totalAmount: formalInvoice.totalAmount,
                                paymentStatus: formalInvoice.paymentStatus,
                                invoiceNumber: formalInvoice.invoiceNumber,
                                paymentMethod: formalInvoice.paymentMethod
                            });
                        } else {
                            // Fallback
                            invoiceHtml = getInvoiceTemplate({
                                clientName,
                                clientPhone,
                                businessName,
                                businessAddress,
                                businessPhone,
                                date: new Date(appointment.date).toLocaleDateString(),
                                items: [{
                                    name: appointment.serviceName,
                                    price: appointment.amount,
                                    quantity: 1,
                                    totalPrice: appointment.amount
                                }],
                                subtotal: appointment.amount,
                                tax: appointment.serviceTax || appointment.tax || 0,
                                taxRate: 0,
                                platformFee: appointment.platformFee || 0,
                                discount: appointment.discountAmount || appointment.discount || 0,
                                totalAmount: appointment.totalAmount,
                                paymentStatus: appointment.paymentStatus,
                                invoiceNumber: appointment.invoiceNumber || appointment._id.toString(),
                                paymentMethod: appointment.paymentMethod
                            });
                        }
                    } catch (tplError) {
                        console.error('Error fetching invoice for email:', tplError);
                    }
                    // Generate PDF Buffer
                let pdfBuffer;

if (invoiceHtml) {
    let browser;

    try {
        browser = await chromium.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox"
            ]
        });

        const page = await browser.newPage();

        await page.setContent(invoiceHtml, {
            waitUntil: "networkidle"
        });

        pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true
        });

    } catch (pdfError) {
        console.error("PDF generation failed:", pdfError);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

                    await sendEmail({
                        to: clientEmail,
                        subject: `Appointment Completed - ${businessName}`,
                        html: completionHtml,
                        attachments: pdfBuffer ? [{
                            filename: `Invoice_${formalInvoice?.invoiceNumber || appointment.invoiceNumber || appointment._id}.pdf`,
                            content: pdfBuffer,
                            contentType: 'application/pdf'
                        }] : []
                    });
                } else if (newStatus === 'cancelled') {
                    const emailHtml = getCancellationTemplate({
                        clientName, businessName, serviceName: appointment.serviceName,
                        date: appointment.date, startTime: appointment.startTime,
                        cancellationReason: appointment.cancellationReason
                    });
                    await sendEmail({ to: clientEmail, subject: `Appointment Cancelled - ${businessName}`, html: emailHtml });
                }
            } catch (e) {
                console.error('Email Dispatch Fail:', e);
            }
        }

        // 2. Send Push Notification (INSTANT)
        if (clientId && clientId.toString().length === 24) {
            await NotificationService.sendAppointmentAlert(clientId, 'client', appointment, newStatus);
        }

        // Notify Vendor as well
        if (vendorId) {
            await NotificationService.sendAppointmentAlert(vendorId, 'vendor', appointment, newStatus);
        }

        // 3. Send SMS (CRITICAL STATUSES)
        if (clientPhone) {
            const smsStatusMap = ['confirmed', 'cancelled', 'scheduled'];
            if (smsStatusMap.includes(newStatus)) {
                await SmsService.sendAppointmentSms(clientPhone, appointment, newStatus);
            }
        }

    } catch (error) {
        console.error('Notification Dispatch Error:', error);
    }
};

await _db();

// Helper function to extract appointment ID from URL
const extractAppointmentId = (url, params) => {
    // First try to get from params (for dynamic routes like [id] or [...id])
    if (params?.id) {
        // Handle both single ID and array of IDs
        const id = Array.isArray(params.id) ? params.id[0] : params.id;
        if (id && /^[0-9a-fA-F]{24}$/.test(id)) {
            return id;
        }
    }

    // Fallback: try to extract from URL path
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/');
    const appointmentsIndex = pathSegments.findIndex(segment => segment === 'appointments');
    if (appointmentsIndex !== -1 && pathSegments[appointmentsIndex + 1]) {
        const potentialId = pathSegments[appointmentsIndex + 1];
        // Validate if it's a MongoDB ObjectId
        if (/^[0-9a-fA-F]{24}$/.test(potentialId)) {
            return potentialId;
        }
    }

    return null;
};

// Handle both GET /api/crm/appointments and GET /api/crm/appointments/[id]
export const GET = withSubscriptionCheck(async (req, { params }) => {
    try {

        const vendorId = req.user.vendorId || req.user.userId;
        const { searchParams } = new URL(req.url);
        const id = extractAppointmentId(req.url, params);



        // If ID is provided, return single appointment
        if (id) {
            const appt = await AppointmentModel.findOne({
                _id: id,
                vendorId: vendorId
            })
                .populate('staff', 'fullName position')
                .populate('service', 'name duration price')
                .lean();

            if (!appt) {
                return NextResponse.json(
                    { message: "Appointment not found or access denied" },
                    { status: 404 }
                );
            }

            if (appt.client) {
                if (appt.mode === 'online') {
                    const UserModel = (await import('@repo/lib/models/user')).default;
                    const user = await UserModel.findById(appt.client).select('firstName lastName emailAddress mobileNo').lean();
                    if (user) {
                        appt.client = {
                            _id: user._id,
                            name: `${user.firstName} ${user.lastName}`,
                            email: user.emailAddress,
                            phone: user.mobileNo
                        };
                    }
                } else {
                    const client = await ClientModel.findById(appt.client).select('fullName email phone').lean();
                    if (client) {
                        appt.client = {
                            _id: client._id,
                            name: client.fullName,
                            email: client.email,
                            phone: client.phone
                        };
                    }
                }
            }

            return NextResponse.json(appt, { status: 200 });
        }

        // Otherwise, return filtered list of appointments
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const staffId = searchParams.get('staffId');
        const status = searchParams.get('status');

        const query = { vendorId };

        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        if (staffId) query.staff = staffId;
        if (status) query.status = status;

        const rawAppointments = await AppointmentModel.find(query)
            .populate('staff', 'fullName position')
            .populate('service', 'name duration price')
            .lean();

        const appointments = await Promise.all(rawAppointments.map(async (appt) => {
            if (appt.client) {
                if (appt.mode === 'online') {
                    // Try to populate from User model for online appointments
                    const UserModel = (await import('@repo/lib/models/user')).default;
                    const user = await UserModel.findById(appt.client).select('firstName lastName emailAddress mobileNo').lean();
                    if (user) {
                        appt.client = {
                            _id: user._id,
                            name: `${user.firstName} ${user.lastName}`,
                            email: user.emailAddress,
                            phone: user.mobileNo
                        };
                    }
                } else {
                    // Try to populate from Client model for offline appointments
                    const client = await ClientModel.findById(appt.client).select('fullName email phone').lean();
                    if (client) {
                        appt.client = {
                            _id: client._id,
                            name: client.fullName,
                            email: client.email,
                            phone: client.phone
                        };
                    }
                }
            }
            return appt;
        }));

        return NextResponse.json(appointments, { status: 200 });
    } catch (error) {
        console.error("Error in appointments GET API:", error);
        return NextResponse.json(
            { message: "Error processing request", error: error.message },
            { status: 500 }
        );
    }
}, ['vendor']);

// POST a new appointment
export const POST = withSubscriptionCheck(async (req) => {
    try {
        const vendorId = (req.user.vendorId || req.user.userId).toString();
        const body = await req.json();


        // Required fields validation
        const requiredFields = [
            'clientName',
            'service',
            'serviceName',
            'staff',
            'staffName',
            'date',
            'startTime',
            'endTime',
            'duration',
            'amount',
            'totalAmount'
        ];

        const missingFields = requiredFields.filter(field => {
            // Special handling for staff field - it can be null but must be present
            if (field === 'staff') {
                return body[field] === undefined;
            }
            return !body[field];
        });

        if (missingFields.length > 0) {
            return NextResponse.json(
                { message: `Missing required fields: ${missingFields.join(', ')}` },
                { status: 400 }
            );
        }

        // Calculate end time if not provided
        if (!body.endTime) {
            const [hours, minutes] = body.startTime.split(':').map(Number);
            const startDate = new Date();
            startDate.setHours(hours, minutes, 0, 0);
            const endDate = new Date(startDate.getTime() + (body.duration || 30) * 60000);
            body.endTime = endDate.toTimeString().slice(0, 5);
        }

        // Fetch vendor's region to inherit
        const VendorModel = (await import("@repo/lib/models/Vendor/Vendor.model")).default;
        const vendor = await VendorModel.findById(vendorId).select('regionId');
        // Process service items (for multi-service appointments)
        let serviceItems = [];
        if (body.serviceItems && Array.isArray(body.serviceItems)) {
            serviceItems = body.serviceItems.map(item => ({
                service: item.service || item._id || item.id,
                serviceName: item.serviceName || item.name,
                staff: item.staff || body.staff,
                staffName: item.staffName || body.staffName,
                startTime: item.startTime || body.startTime,
                endTime: item.endTime || body.endTime,
                duration: item.duration || body.duration,
                amount: item.amount || item.price || 0,
                // Include add-ons if they exist - check both 'addOns' and 'selectedAddons'
                addOns: (item.addOns || item.selectedAddons || []).map(addon => ({
                    name: addon.name,
                    price: addon.price,
                    duration: addon.duration || 0,
                    _id: addon._id || addon.id
                }))
            }));
        } else {
            // For single service appointments, create a single service item
            serviceItems = [{
                service: body.service,
                serviceName: body.serviceName,
                staff: body.staff,
                staffName: body.staffName,
                startTime: body.startTime,
                endTime: body.endTime,
                duration: body.duration,
                amount: body.amount,
                // Include add-ons if they exist in the main body - check both 'addOns' and 'selectedAddons'
                addOns: (body.addOns || body.selectedAddons || []).map(addon => ({
                    name: addon.name,
                    price: addon.price,
                    duration: addon.duration || 0,
                    _id: addon._id || addon.id
                }))
            }];
        }

        // Calculate total amount including add-ons, tax, and discount
        // We prioritize the totalAmount sent from the frontend if available, 
        // as the frontend now has the complex vendor-specific tax logic.
        const baseAmount = Number(body.amount) || 0;
        const addOnsAmount = serviceItems.reduce((sum, item) => {
            return sum + (item.addOns?.reduce((addonSum, addon) => addonSum + (Number(addon.price) || 0), 0) || 0);
        }, 0);

        const discountAmount = Number(body.discount || body.discountAmount) || 0;
        const taxAmount = Number(body.serviceTax || body.tax) || 0;
        const platformFee = Number(body.platformFee) || 0;

        // If totalAmount is provided in body, use it, otherwise calculate it
        const totalAmount = body.totalAmount !== undefined
            ? Number(body.totalAmount)
            : Math.max(0, baseAmount + addOnsAmount - discountAmount + taxAmount + platformFee);

        // Set default values
        const appointmentData = {
            ...body,
            vendorId,
            regionId: vendor?.regionId,
            status: body.status || 'scheduled',
            amount: baseAmount,
            addOnsAmount,
            discount: discountAmount,
            discountAmount: discountAmount,
            couponCode: body.couponCode || null,
            serviceTax: taxAmount,
            tax: taxAmount,
            platformFee: platformFee,
            totalAmount,
            finalAmount: totalAmount, // Ensure finalAmount is in sync with totalAmount
            notes: body.notes || '',
            mode: 'offline', // CRM bookings are always offline mode
            serviceItems // Include the processed service items
        };

        // Check for conflicts before creating
        const { checkMultiServiceConflict } = await import('../../../../../../../packages/lib/src/modules/scheduling/ConflictChecker');
        const conflict = await checkMultiServiceConflict(
            vendorId,
            appointmentData.date,
            serviceItems
        );

        if (conflict) {
            return NextResponse.json(
                {
                    message: "The selected professional is already booked at this time.",
                    conflict: {
                        startTime: conflict.startTime,
                        endTime: conflict.endTime,
                        staffName: conflict.staffName
                    }
                },
                { status: 409 }
            );
        }

        const newAppointment = await AppointmentModel.create(appointmentData);

        // Increment coupon redemption count and total discount if applicable
        if (appointmentData.couponCode) {
            try {
                const CRMOfferModel = (await import('../../../../../../../packages/lib/src/models/Vendor/CRMOffer.model')).default;
                const discountToTrack = appointmentData.discountAmount || appointmentData.discount || 0;
                const crmResult = await CRMOfferModel.incrementRedemption(appointmentData.couponCode, discountToTrack);
                if (!crmResult) {
                    const AdminOfferModel = (await import('../../../../../../../packages/lib/src/models/admin/AdminOffers.model.js')).default;
                    await AdminOfferModel.incrementRedemption(appointmentData.couponCode, discountToTrack);
                }
            } catch (offerErr) {
                console.error(`Error incrementing offline coupon redemption for ${appointmentData.couponCode}:`, offerErr);
            }
        }

        // CREDIT STAFF LEDGER IF CREATED AS COMPLETED
        if (newAppointment.status === 'completed' || newAppointment.status === 'completed without payment') {
            try {
                const { syncStaffCommission } = await import('@repo/lib/modules/accounting/StaffAccounting');
                await syncStaffCommission(newAppointment._id);
            } catch (accError) {
                console.error("Error syncing staff on creation:", accError);
            }
        }

        const populatedAppointment = await AppointmentModel.findById(newAppointment._id)
            .populate('staff', 'fullName position')
            .populate('service', 'name duration price')
            .populate('serviceItems.service', 'name duration price');

        // Instant Push Notifications for new booking
        try {
            const rawClientId = populatedAppointment.client;
            const newStatus = populatedAppointment.status || 'scheduled';
            
            if (rawClientId && rawClientId.toString().length === 24) {
                await NotificationService.sendAppointmentAlert(rawClientId, 'client', populatedAppointment, newStatus);
            }
            if (vendorId) {
                await NotificationService.sendAppointmentAlert(vendorId, 'vendor', populatedAppointment, newStatus);
            }
            
            // SMS Alerts
            // Try to extract phone from body or populated client (if available)
            let clientPhone = body.clientPhone;
            if (!clientPhone && populatedAppointment.client && populatedAppointment.client.phone) {
                clientPhone = populatedAppointment.client.phone;
            }
            if (clientPhone) {
                const smsStatusMap = ['confirmed', 'cancelled', 'scheduled'];
                if (smsStatusMap.includes(newStatus)) {
                    await SmsService.sendAppointmentSms(clientPhone, populatedAppointment, newStatus);
                }
            }
        } catch (notifErr) {
            console.error('❌ Error sending push notifications on CRM booking:', notifErr);
        }

        return NextResponse.json(
            { message: "Appointment created successfully", appointment: populatedAppointment },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating appointment:', error);
        return NextResponse.json(
            { message: "Error creating appointment", error: error.message },
            { status: 500 }
        );
    }
}, ['vendor']);

// Handle PUT /api/crm/appointments/[id] (update)
export const PUT = withSubscriptionCheck(async (req, { params }) => {
    try {
        const vendorId = req.user.vendorId || req.user.userId;
        const appointmentId = params?.id;

        if (!appointmentId) {
            return NextResponse.json(
                { success: false, message: 'Appointment ID is required' },
                { status: 400 }
            );
        }

        const requestBody = await req.json();

        // Handle both direct updates and updates in an 'updates' object
        const updateData = requestBody.updates || requestBody;

        if (!updateData || Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { success: false, message: 'No update data provided' },
                { status: 400 }
            );
        }

        // Ensure the appointment exists and belongs to the vendor
        const existingAppointment = await AppointmentModel.findOne({
            _id: appointmentId,
            vendorId: vendorId
        });

        if (!existingAppointment) {
            return NextResponse.json(
                { success: false, message: 'Appointment not found or access denied' },
                { status: 404 }
            );
        }

        // Calculate end time if start time or duration is updated
        if (updateData.startTime || updateData.duration) {
            const startTime = updateData.startTime || existingAppointment.startTime;
            const duration = updateData.duration || existingAppointment.duration;
            const [hours, minutes] = startTime.split(':').map(Number);
            const startDate = new Date();
            startDate.setHours(hours, minutes, 0, 0);
            const endDate = new Date(startDate.getTime() + duration * 60000);
            updateData.endTime = endDate.toTimeString().slice(0, 5);
        }

        // Recalculate total amount if relevant fields are updated
        if (updateData.amount !== undefined || updateData.discount !== undefined || updateData.tax !== undefined || updateData.serviceTax !== undefined || updateData.addOnsAmount !== undefined) {
            const amount = updateData.amount !== undefined ? Number(updateData.amount) : existingAppointment.amount;
            const discount = updateData.discount !== undefined ? Number(updateData.discount) : (existingAppointment.discountAmount || existingAppointment.discount || 0);
            const tax = updateData.serviceTax !== undefined ? Number(updateData.serviceTax) : (updateData.tax !== undefined ? Number(updateData.tax) : (existingAppointment.serviceTax || existingAppointment.tax || 0));
            const addOns = updateData.addOnsAmount !== undefined ? Number(updateData.addOnsAmount) : (existingAppointment.addOnsAmount || 0);
            const platformFee = updateData.platformFee !== undefined ? Number(updateData.platformFee) : (existingAppointment.platformFee || 0);

            updateData.totalAmount = Math.max(0, amount + addOns - discount + tax + platformFee);
        }

        // Check for conflicts if staff, date, or time is being updated
        if (updateData.staff || updateData.date || updateData.startTime || updateData.endTime || updateData.serviceItems) {
            const { checkMultiServiceConflict } = await import('../../../../../../../packages/lib/src/modules/scheduling/ConflictChecker');

            const checkDate = updateData.date ? new Date(updateData.date) : existingAppointment.date;

            // Re-construct service items for verification
            let verificationItems = updateData.serviceItems || existingAppointment.serviceItems;

            // If it's a legacy single-service update that doesn't use serviceItems array
            if (!updateData.serviceItems && (updateData.staff || updateData.startTime || updateData.endTime)) {
                verificationItems = [{
                    staff: updateData.staff || existingAppointment.staff,
                    startTime: updateData.startTime || existingAppointment.startTime,
                    endTime: updateData.endTime || existingAppointment.endTime,
                    service: updateData.service || existingAppointment.service
                }];
            }

            const conflict = await checkMultiServiceConflict(
                vendorId,
                checkDate,
                verificationItems,
                appointmentId // Exclude current appointment from check
            );

            if (conflict) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "The update would cause a conflict with another appointment.",
                        conflict: {
                            startTime: conflict.startTime,
                            endTime: conflict.endTime,
                            staffName: conflict.staffName
                        }
                    },
                    { status: 409 }
                );
            }
        }

        // Update the appointment using findOne and save to trigger pre-save hooks
        const updatedAppointment = await AppointmentModel.findOne({
            _id: appointmentId,
            vendorId: vendorId
        });

        if (!updatedAppointment) {
            return NextResponse.json(
                { success: false, message: 'Appointment not found or access denied' },
                { status: 404 }
            );
        }

        // Handle cancellation specifically to capture reason and add to notes
        if (updateData.status === 'cancelled' && existingAppointment.status !== 'cancelled') {
            updateData.cancellationReason = updateData.cancellationReason || 'No reason provided';
            const cancellationNote = `[${new Date().toISOString()}] Appointment cancelled: ${updateData.cancellationReason}`;
            const existingNotes = existingAppointment.notes || '';
            updateData.notes = existingNotes ? `${cancellationNote}\n${existingNotes}` : cancellationNote;
        }

        // Apply updates
        Object.keys(updateData).forEach(key => {
            updatedAppointment[key] = updateData[key];
        });

        // Ensure totalAmount and finalAmount are in sync if updated
        if (updateData.totalAmount !== undefined) {
            updatedAppointment.finalAmount = updateData.totalAmount;
        }

        // Support both naming conventions for discount in updates
        if (updateData.discountAmount !== undefined && updateData.discount === undefined) {
            updateData.discount = updateData.discountAmount;
        } else if (updateData.discount !== undefined && updateData.discountAmount === undefined) {
            updateData.discountAmount = updateData.discount;
        }

        // Check if couponCode is being added or changed to increment redemption count and total discount
        if (updateData.couponCode && updateData.couponCode !== existingAppointment.couponCode) {
            try {
                const CRMOfferModel = (await import('../../../../../../../packages/lib/src/models/Vendor/CRMOffer.model')).default;
                const discountToTrack = updateData.discountAmount !== undefined ? updateData.discountAmount :
                    (updateData.discount !== undefined ? updateData.discount :
                        (existingAppointment.discountAmount || existingAppointment.discount || 0));
                const crmResult = await CRMOfferModel.incrementRedemption(updateData.couponCode, discountToTrack);
                if (!crmResult) {
                    const AdminOfferModel = (await import('../../../../../../../packages/lib/src/models/admin/AdminOffers.model.js')).default;
                    await AdminOfferModel.incrementRedemption(updateData.couponCode, discountToTrack);
                }
            } catch (offerErr) {
                console.error(`Error incrementing updated coupon redemption for ${updateData.couponCode}:`, offerErr);
            }
        }

        await updatedAppointment.save({ validateBeforeSave: false });

        // SYNC STAFF LEDGER IF RELEVANT CHANGES OCCURRED
        const commissionRelevantFields = ['status', 'amount', 'discount', 'staff', 'serviceItems', 'totalAmount'];
        const hasRelevantChanges = Object.keys(updateData).some(key => commissionRelevantFields.includes(key));

        if (hasRelevantChanges) {
            try {
                const { syncStaffCommission } = await import('@repo/lib/modules/accounting/StaffAccounting');
                await syncStaffCommission(appointmentId);
            } catch (accError) {
                console.error("Error syncing staff on update:", accError);
            }
        }

        // Populate for response
        await updatedAppointment.populate([
            { path: 'client', select: 'fullName email phone' },
            { path: 'service', select: 'name duration price' },
            { path: 'staff', select: 'fullName position email phone' }
        ]);

        // Send email notifications in the background so HTTP response is instant
        sendAppointmentEmail(updatedAppointment, vendorId, updatedAppointment.status, existingAppointment.status).catch(err => {
            console.error('Background sendAppointmentEmail error in PUT:', err);
        });

        return NextResponse.json({
            success: true,
            data: updatedAppointment,
            message: 'Appointment updated successfully'
        });

    } catch (error) {
        console.error('Error updating appointment:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Failed to update appointment',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            },
            { status: 500 }
        );
    }
});

// DELETE an appointment
export const DELETE = withSubscriptionCheck(async (req, { params }) => {
    try {
        const vendorId = req.user.vendorId || req.user.userId;
        const appointmentId = extractAppointmentId(req.url, params);



        if (!appointmentId) {
            console.error('No appointment ID found for deletion');
            return NextResponse.json(
                {
                    message: "Appointment ID is required for deletion",
                    receivedUrl: req.url,
                    receivedParams: params
                },
                { status: 400 }
            );
        }

        const deletedAppointment = await AppointmentModel.findOneAndDelete({
            _id: appointmentId,
            vendorId: vendorId
        });

        if (!deletedAppointment) {
            return NextResponse.json(
                { message: "Appointment not found or access denied" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                message: "Appointment deleted successfully",
                appointment: deletedAppointment
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error deleting appointment:', error);
        return NextResponse.json(
            { message: "Error deleting appointment", error: error.message },
            { status: 500 }
        );
    }
}, ['vendor']);

// PATCH /api/crm/appointments - Update appointment status
export const PATCH = withSubscriptionCheck(async (req, { params }) => {
    try {
        const vendorId = req.user.vendorId || req.user.userId;
        const body = await req.json();
        const appointmentId = extractAppointmentId(req.url, params) || body._id;



        if (!appointmentId || !body.status) {
            return NextResponse.json(
                { message: "Appointment ID and status are required" },
                { status: 400 }
            );
        }

        // Validate status
        const validStatuses = ['scheduled', 'confirmed', 'completed', 'completed without payment', 'partially-completed', 'cancelled', 'no-show'];
        if (!validStatuses.includes(body.status)) {
            return NextResponse.json(
                { message: "Invalid status value" },
                { status: 400 }
            );
        }

        // Fetch the existing appointment once to get old values
        const existingAppointment = await AppointmentModel.findOne({ _id: appointmentId, vendorId });
        if (!existingAppointment) {
            return NextResponse.json(
                { message: "Appointment not found or access denied" },
                { status: 404 }
            );
        }

        const oldStatus = existingAppointment.status;
        const rawClientId = existingAppointment.client;

        // Add cancellation reason to notes if status is cancelled
        if (body.status === 'cancelled') {
            const cancellationReasonText = body.cancellationReason || 'No reason provided';
            const cancellationNote = `[${new Date().toISOString()}] Appointment cancelled: ${cancellationReasonText}`;
            const existingNotes = existingAppointment.notes || '';

            const updateObj = {
                $set: {
                    status: 'cancelled',
                    cancellationReason: cancellationReasonText,
                    notes: existingNotes ? `${cancellationNote}\n${existingNotes}` : cancellationNote,
                    updatedAt: new Date()
                }
            };

            const updatedAppointment = await AppointmentModel.findOneAndUpdate(
                { _id: appointmentId, vendorId },
                updateObj,
                { new: true, runValidators: false } // Disable validation to avoid issues with existing appointments
            )
                .populate('client', 'fullName email phone')
                .populate('staff', 'fullName position')
                .populate('service', 'name duration price');

            if (!updatedAppointment) {
                return NextResponse.json(
                    { message: "Appointment not found or access denied" },
                    { status: 404 }
                );
            }

            if (updatedAppointment) {
                // Send email notifications in the background so HTTP response is instant
                sendAppointmentEmail(updatedAppointment, vendorId, 'cancelled', oldStatus, rawClientId).catch(err => {
                    console.error('Background sendAppointmentEmail error (cancelled):', err);
                });
            }

            // Sync Commission on PATCH
            try {
                const { syncStaffCommission } = await import('@repo/lib/modules/accounting/StaffAccounting');
                await syncStaffCommission(appointmentId);
            } catch (accError) {
                console.error("Error syncing staff on PATCH:", accError);
            }

            return NextResponse.json({
                message: "Appointment status updated successfully",
                appointment: updatedAppointment
            });
        } else {
            // Logic for completing an appointment and calculating staff commission

            const updateFields = { status: body.status };

            // Use findOne and save instead of findOneAndUpdate to trigger pre-save hooks (like commission calculation)
            const updatedAppointment = await AppointmentModel.findOne({ _id: appointmentId, vendorId });

            if (!updatedAppointment) {
                return NextResponse.json(
                    { message: "Appointment not found or access denied" },
                    { status: 404 }
                );
            }

            // Apply updates
            Object.keys(updateFields).forEach(key => {
                updatedAppointment[key] = updateFields[key];
            });

            await updatedAppointment.save({ validateBeforeSave: false });

            // CENTRALIZED INVOICE GENERATION LOGIC
            if (body.status === 'completed' || body.status === 'completed without payment') {
                try {
                    const { default: InvoiceModel } = await import('@repo/lib/models/Invoice/Invoice.model');
                    const invoice = await InvoiceModel.createFromAppointment(appointmentId, vendorId);
                    if (invoice) {
                        updatedAppointment.invoiceNumber = invoice.invoiceNumber;
                    }
                } catch (invoiceError) {
                    console.error("Error in centralized invoice generation:", invoiceError);
                }

                // SYNC STAFF COMMISSION — runs independently of invoice logic
                // This MUST be outside the invoice try-catch so invoice errors don't block commission
                try {
                    const { syncStaffCommission } = await import('@repo/lib/modules/accounting/StaffAccounting');
                    const syncResult = await syncStaffCommission(appointmentId);
                } catch (commError) {
                    console.error("[PATCH] Error syncing staff commission:", commError);
                }

                // ===== REFERRAL BONUS CHECK =====
                // Use existingAppointment.client (raw ObjectId BEFORE any populate) for user ID resolution

                // ROBUST USER ID RESOLUTION:
                // The `client` field can hold either a User ID (online bookings) or a Client ID (offline bookings).
                // Step 1: Try using the client field value directly as a User ID.
                // Step 2: If not found, look up Client model to get the linked userId.
                let targetUserId = null;
                // Always use existingAppointment.client — it is the raw ObjectId before populate
                const rawClientValue = existingAppointment.client?.toString();

                if (rawClientValue) {
                    try {
                        // Step 1: Check if rawClientValue is a valid User ID directly
                        const UserModelRef = (await import('@repo/lib/models/user/User.model')).default;
                        const userDoc = await UserModelRef.findById(rawClientValue).select('_id').lean();
                        if (userDoc) {
                            targetUserId = rawClientValue;
                        }
                    } catch (userErr) {
                        console.warn(`[CRM Referral] client field not a direct User ID, trying Client model:`, userErr.message);
                    }

                    if (!targetUserId) {
                        try {
                            // Step 2: client field is a Client record ID — look up linked userId
                            const ClientModelRef = (await import('@repo/lib/models/Vendor/Client.model')).default;
                            const clientDoc = await ClientModelRef.findById(rawClientValue).select('userId').lean();
                            if (clientDoc && clientDoc.userId) {
                                targetUserId = clientDoc.userId.toString();
                            } else {
                            }
                        } catch (clientErr) {
                            console.error(`[CRM Referral] Error fetching Client record:`, clientErr);
                        }
                    }
                } else {
                }

                if (targetUserId) {
                    try {

                        const referralResult = await checkAndCreditReferralBonus(targetUserId, 'appointment');


                        if (referralResult.success) {
                        } else {
                            console.warn(`[CRM Referral] ⚠️ Referral bonus not credited: ${referralResult.message}`);
                        }
                    } catch (referralError) {
                        // Don't fail the appointment update if referral crediting fails, just log the error
                        console.error('[CRM Referral] ❌ ERROR crediting referral bonus:', referralError);
                    }
                } else {
                }
            }

            // Populate for response
            await updatedAppointment.populate([
                { path: 'client', select: 'fullName email phone' },
                { path: 'staff', select: 'fullName position' },
                { path: 'service', select: 'name duration price' }
            ]);

            // Send email/SMS notifications in the background so HTTP response is instant
            sendAppointmentEmail(updatedAppointment, vendorId, updatedAppointment.status, oldStatus, rawClientId).catch(err => {
                console.error('Background sendAppointmentEmail error in PATCH:', err);
            });

            return NextResponse.json({
                message: "Appointment status updated successfully",
                appointment: updatedAppointment
            });
        }
    } catch (error) {
        console.error('Error updating appointment status:', error);
        return NextResponse.json(
            { message: "Error updating appointment status", error: error.message },
            { status: 500 }
        );
    }
}, ['vendor']);

