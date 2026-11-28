
// crm/api/notifications/route.js

import _db from "../../../../../../../packages/lib/src/db.js";
import VendorNotificationsModel from '@repo/lib/models/Vendor/VendorNotification.model';
import { withSubscriptionCheck } from "../../../../middlewareCrm";

await _db();

// Create or update a VendorNotifications document, adding notifications to the array
export const POST = withSubscriptionCheck(async (req) => {
  const vendor = req.user;
  const body = await req.json();
  const { title, channels, content, targetType, targets } = body;

  const vendorId = vendor.userId.toString();

  // 1️⃣ Validate required fields
  const isValidTargetType = Array.isArray(targetType) ? targetType.length > 0 : !!targetType;
  if (!vendorId || !title || !channels || !Array.isArray(channels) || !content || !isValidTargetType) {
    return Response.json(
      { message: "Vendor ID, title, channels array, content, and targetType are required" },
      { status: 400 }
    );
  }

  // 2️⃣ Validate target if specific
  const includesSpecific = Array.isArray(targetType) ? targetType.includes('specific_clients') : targetType === 'specific_clients';
  if (includesSpecific && (!targets || !Array.isArray(targets))) {
    return Response.json(
      { message: "Targets array is required for specific_clients" },
      { status: 400 }
    );
  }

  const notificationToInsert = {
    title,
    channels,
    content,
    targetType,
    targets: includesSpecific ? targets : [],
    date: new Date(),
    status: 'Sent',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // 3️⃣ Create or update VendorNotifications document
  const vendorNotifications = await VendorNotificationsModel.findOneAndUpdate(
    { vendor: vendorId },
    {
      $push: { notifications: notificationToInsert },
      $set: { updatedAt: Date.now() },
    },
    { upsert: true, new: true }
  );

  // 4️⃣ Trigger Push Notifications
  try {
    const { NotificationService } = await import("@repo/lib");
    const targetTypesArray = Array.isArray(targetType) ? targetType : [targetType];

    // Group recipient IDs by role
    const recipientsByRole = {
      client: new Set(),
      staff: new Set(),
      vendor: new Set(), // Vendor might use this too if they target other vendors
    };

    const { default: mongoose } = await import("mongoose");
    const AppointmentModel = (await import("@repo/lib/models/Appointment/Appointment.model")).default;
    const ClientModel = (await import("@repo/lib/models/Vendor/Client.model")).default;
    const StaffModel = (await import("@repo/lib/models/Vendor/Staff.model")).default;

    for (const type of targetTypesArray) {
      if (type === 'all_online_clients') {
        const appointments = await AppointmentModel.find({
          vendorId: new mongoose.Types.ObjectId(vendorId),
          client: { $exists: true, $ne: null }
        }).select('client').lean();
        appointments.forEach(appt => recipientsByRole.client.add(appt.client.toString()));
      } else if (type === 'all_offline_clients') {
        const offlineClients = await ClientModel.find({ vendorId: vendorId }).select('_id').lean();
        offlineClients.forEach(c => recipientsByRole.client.add(c._id.toString()));
      } else if (type === 'all_staffs') {
        const staffs = await StaffModel.find({ vendorId: vendorId }).select('_id').lean();
        staffs.forEach(s => recipientsByRole.staff.add(s._id.toString()));
      } else if (type === 'specific_clients') {
        if (targets && Array.isArray(targets)) {
          targets.forEach(t => {
            const id = t.id || t._id || t;
            if (id) recipientsByRole.client.add(id.toString());
          });
        }
      }
    }

    // Send notifications for each role that has recipients
    for (const [role, idsSet] of Object.entries(recipientsByRole)) {
      const recipientIds = Array.from(idsSet);
      if (recipientIds.length > 0) {
        await NotificationService.sendMassNotification(recipientIds, role, {
          title: title,
          body: content,
          type: 'broadcast',
          channels: channels || ['Push']
        });
      }
    }
  } catch (err) {
    console.error('CRM Push Notification Trigger Error:', err);
  }

  return Response.json(
    { message: "Notification created successfully", vendorNotifications },
    { status: 201 }
  );
}, ["vendor", "doctor", "supplier"]);


const targetDisplayMap = {
  all_online_clients: "All Online Clients",
  all_offline_clients: "All Offline Clients",
  all_staffs: "All Staffs",
  specific_clients: "Specific Clients",
};

// GET: Retrieve VendorNotifications by vendor ID or paginated notifications
export const GET = withSubscriptionCheck(async (req) => {
  const vendorId = req.user.userId.toString();

  if (!vendorId) {
    return Response.json(
      { message: "Vendor ID is required" },
      { status: 400 }
    );
  }

  const vendorNotificationsDoc = await VendorNotificationsModel.findOne({ vendor: vendorId }).lean();

  if (!vendorNotificationsDoc || vendorNotificationsDoc.notifications.length === 0) {
    return Response.json(
      {
        message: "No notifications found for this vendor",
        notifications: [],
        stats: { total: 0, pushSent: 0, smsSent: 0, mostTargeted: 'None' },
      },
      { status: 200 }
    );
  }

  const allNotifications = vendorNotificationsDoc.notifications.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Compute stats
  const total = allNotifications.length;
  const pushSent = allNotifications.filter(n => n.channels.includes('Push')).length;
  const smsSent = allNotifications.filter(n => n.channels.includes('WhatsApp') || n.channels.includes('SMS')).length;
  const emailSent = allNotifications.filter(n => n.channels.includes('Email')).length;

  const targetCounts = allNotifications.reduce((acc, n) => {
    const types = Array.isArray(n.targetType) ? n.targetType : [n.targetType];
    types.forEach(type => {
      acc[type] = (acc[type] || 0) + 1;
    });
    return acc;
  }, {});

  const mostTargetedType = total > 0 ? Object.keys(targetCounts).reduce((a, b) => targetCounts[a] > targetCounts[b] ? a : b, '') : 'None';
  const mostTargeted = targetDisplayMap[mostTargetedType] || mostTargetedType;

  const response = {
    _id: vendorNotificationsDoc._id,
    vendor: vendorNotificationsDoc.vendor,
    notifications: allNotifications,
    createdAt: vendorNotificationsDoc.createdAt,
    updatedAt: vendorNotificationsDoc.updatedAt,
    stats: {
      total,
      pushSent,
      smsSent,
      emailSent,
      mostTargeted,
    },
  };

  return Response.json(response);
}, ["vendor", "doctor", "supplier"]);

// DELETE: Remove specific notifications from the VendorNotifications document
export const DELETE = withSubscriptionCheck(async (req) => {
  const vendor = req.user.userId.toString();

  const body = await req.json();
  const { notificationId } = body;

  if (!vendor) {
    return Response.json(
      { message: "Vendor ID is required" },
      { status: 400 }
    );
  }

  if (!notificationId) {
    return Response.json(
      { message: "Notification ID is required" },
      { status: 400 }
    );
  }

  // Delete the specific notification from vendor's notifications array
  const result = await VendorNotificationsModel.findOneAndUpdate(
    { vendor },
    {
      $pull: { notifications: { _id: notificationId } },
      $set: { updatedAt: Date.now() },
    },
    { new: true }
  );

  if (!result) {
    return Response.json(
      { message: "Vendor or notification not found" },
      { status: 404 }
    );
  }

  return Response.json(
    { message: "Notification deleted successfully", vendorNotifications: result },
    { status: 200 }
  );
}, ["vendor", "doctor", "supplier"]);
