import { NextResponse } from "next/server";
import validator from "validator";
import bcrypt from "bcryptjs";
import VendorModel from "@repo/lib/models/Vendor/Vendor.model";
import StaffModel from "@repo/lib/models/Vendor/Staff.model";
import SubscriptionPlan from "@repo/lib/models/admin/SubscriptionPlan.model";
import RegionModel from "@repo/lib/models/admin/Region.model";
import { ReferralModel, V2VSettingsModel, C2VSettingsModel } from "../../../../../../../../packages/lib/src/models/admin/Reffer.model.js";
import UserModel from "@repo/lib/models/user/User.model";
import _db from "@repo/lib/db";
import mongoose from "mongoose";
import { NotificationService } from "@repo/lib";

await _db();

// Function to generate a unique referral code
const generateReferralCode = async (businessName) => {
  let referralCode;
  let isUnique = false;
  // Use a more robust prefix generation
  const namePrefix = ((businessName || "VENDOR").replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 4)) || "VEND";

  while (!isUnique) {
    const randomNumbers = Math.floor(1000 + Math.random() * 9000); // Generates 4-digit number
    referralCode = `${namePrefix}${randomNumbers}`;

    // Check if code already exists
    const existingVendor = await VendorModel.findOne({ referralCode });
    if (!existingVendor) {
      isUnique = true;
    }
  }
  return referralCode;
};

// Function to automatically create staff member from vendor data
const createOwnerAsStaff = async (vendor, plainTextPassword) => {
  try {


    // Ensure we have a proper ObjectId for the vendor
    let vendorObjectId;
    if (vendor._id instanceof mongoose.Types.ObjectId) {
      vendorObjectId = vendor._id;
    } else if (typeof vendor._id === 'string') {
      if (mongoose.Types.ObjectId.isValid(vendor._id)) {
        vendorObjectId = new mongoose.Types.ObjectId(vendor._id);
      } else {
        console.error('Invalid vendor ID string:', vendor._id);
        return null;
      }
    } else {
      console.error('Unexpected vendor ID type:', typeof vendor._id, vendor._id);
      return null;
    }


    // Check if staff member already exists for this vendor using multiple approaches

    // Approach 1: Direct query
    let existingStaff = await StaffModel.findOne({
      vendorId: vendorObjectId,
      emailAddress: vendor.email
    });

    // Approach 2: If not found, try string conversion
    if (!existingStaff) {
      try {
        existingStaff = await StaffModel.findOne({
          vendorId: vendorObjectId.toString(),
          emailAddress: vendor.email
        });
      } catch (err) {
        console.error('String conversion approach failed:', err);
      }
    }

    // Approach 3: If still not found, try with original vendor ID
    if (!existingStaff && vendor._id !== vendorObjectId) {
      try {
        existingStaff = await StaffModel.findOne({
          vendorId: vendor._id,
          emailAddress: vendor.email
        });
      } catch (err) {
        console.error('Original vendor ID approach failed:', err);
      }
    }

    if (existingStaff) {

      return existingStaff;
    }

    // Hash the password before creating staff member
    const hashedPassword = await bcrypt.hash(plainTextPassword, 10);

    // Create staff member using vendor details
    const staffData = {
      vendorId: vendorObjectId, // Use the properly converted ObjectId
      userType: 'Vendor',
      fullName: `${vendor.firstName} ${vendor.lastName}`,
      position: 'Owner',
      mobileNo: vendor.phone,
      emailAddress: vendor.email,
      photo: vendor.profileImage || null,
      description: vendor.description || `Owner of ${vendor.businessName}`,
      salary: 0,
      startDate: new Date(),
      yearOfExperience: 0,
      clientsServed: 0,
      commission: false,
      password: hashedPassword, // Use the hashed password
      role: 'staff',
      permissions: ['all'], // Owner gets all permissions
      status: 'Active',
      // Default availability (can be updated later)
      mondayAvailable: true,
      mondaySlots: [{ startTime: '09:00', endTime: '20:00', startMinutes: 540, endMinutes: 1200 }],
      tuesdayAvailable: true,
      tuesdaySlots: [{ startTime: '09:00', endTime: '20:00', startMinutes: 540, endMinutes: 1200 }],
      wednesdayAvailable: true,
      wednesdaySlots: [{ startTime: '09:00', endTime: '20:00', startMinutes: 540, endMinutes: 1200 }],
      thursdayAvailable: true,
      thursdaySlots: [{ startTime: '09:00', endTime: '20:00', startMinutes: 540, endMinutes: 1200 }],
      fridayAvailable: true,
      fridaySlots: [{ startTime: '09:00', endTime: '20:00', startMinutes: 540, endMinutes: 1200 }],
      saturdayAvailable: true,
      saturdaySlots: [{ startTime: '09:00', endTime: '20:00', startMinutes: 540, endMinutes: 1200 }],
      sundayAvailable: true,
      sundaySlots: [{ startTime: '09:00', endTime: '20:00', startMinutes: 540, endMinutes: 1200 }],
      timezone: 'UTC'
    };



    // Create staff member with validation bypass for salon owner
    // We need to bypass validation because vendor working hours aren't set up yet
    const newStaff = new StaffModel(staffData);
    newStaff.$locals.skipValidation = true; // Bypass validation for salon owner
    await newStaff.save();



    // Verify the staff member was created correctly using multiple approaches

    // Approach 1: Direct query
    let verifiedStaff = await StaffModel.findById(newStaff._id);

    // Approach 2: Query by vendorId and email
    if (!verifiedStaff) {
      verifiedStaff = await StaffModel.findOne({
        vendorId: vendorObjectId,
        emailAddress: vendor.email
      });
    }

    if (verifiedStaff) {
    } else {
    }

    return newStaff;
  } catch (error) {
    console.error("Error creating staff member for vendor:", error);
    return null;
  }
};

// This endpoint is public for new registrations.
export async function POST(req) {
  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      businessName,
      email,
      phone,
      state,
      city,
      pincode,
      category,
      subCategories,
      address,
      password,
      description,
      profileImage,
      website,
      location,
      referredByCode,
      gstNo: incomingGstNo,
      referralCode: incomingReferralCode,
    } = body;

    const gstNo = incomingGstNo || '';
    // Generate a unique referral code if none provided
    const referralCode = (incomingReferralCode && incomingReferralCode.trim() !== '')
      ? incomingReferralCode.trim()
      : await generateReferralCode(businessName);

    // 1️⃣ Validate required fields for initial account creation
    if (!firstName || !lastName || !email || !phone || !password) {
      return NextResponse.json({ error: "Name, email, phone, and password are required" }, { status: 400 });
    }

    // Validation checks...
    if (!validator.isEmail(email)) return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    if (!validator.isMobilePhone(phone, "any")) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

    // 2️⃣ Check if email or phone already exists
    const existingVendor = await VendorModel.findOne({ $or: [{ email }, { phone }] });
    if (existingVendor) {
      return NextResponse.json({ error: "An account with this email or phone number already exists." }, { status: 409 });
    }

    // 3️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5️⃣ Assign a default trial plan
    const trialPlan = await SubscriptionPlan.findOne({
      $or: [
        { name: 'Trial Plan' },
        { name: /trial/i },
        { planType: 'trial' }
      ]
    });
    if (!trialPlan) {
      return NextResponse.json({ message: "Default trial plan for vendors not found. Please contact support." }, { status: 500 });
    }
    const durationDays = typeof trialPlan.duration === 'number' && trialPlan.duration > 0 ? trialPlan.duration : 30;
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setDate(subscriptionEndDate.getDate() + durationDays);

    // 6️⃣ Auto-Assign Region based on City/State/Location
    // Ensure location has proper default values
    const locationData = location || { lat: 0, lng: 0 };

    const { assignRegion } = await import("@repo/lib/utils/assignRegion.js");
    // Pass locationData for geospatial matching
    let regionId = await assignRegion(city, state, locationData);

    // If no matching region found for coordinates/city, fallback to any active region
    if (!regionId) {
      const fallbackRegion = await RegionModel.findOne({ isActive: true });
      if (fallbackRegion) {
        regionId = fallbackRegion._id;
      }
    }

    if (!regionId) {
      return NextResponse.json(
        { error: `No active region available for ${city || 'your area'}. Please contact administrator.` },
        { status: 400 }
      );
    }

    // 7️⃣ Create vendor with minimal required data + any other data provided

    const newVendor = await VendorModel.create({
      firstName,
      lastName,
      businessName: businessName || `${firstName}'s Salon`,
      email,
      phone,
      password: hashedPassword,
      referralCode: referralCode,
      gstNo: String(gstNo || ''),
      // Include other fields if they are passed, with defaults
      state: state || 'N/A',
      city: city || 'N/A',
      pincode: pincode || '000000',
      address: address || 'N/A',
      category: category || 'unisex',
      subCategories: subCategories && subCategories.length > 0 ? subCategories : ['at-salon'],
      location: locationData,
      // Add baseLocation with default values to satisfy the required fields
      baseLocation: locationData,
      description: description || null,
      profileImage: profileImage || null,
      website: website || null,
      regionId, // <--- Assigned Region
      isPhoneVerified: true,
      subscription: {
        plan: trialPlan._id,
        status: 'Active',
        endDate: subscriptionEndDate,
        history: [],
      }
    });

    // Trigger Registration Notification
    (async () => {
      try {
        await NotificationService.sendRegistrationAlert(newVendor._id.toString(), 'vendor', {
          name: newVendor.firstName,
          role: 'Vendor'
        });
        // Notify Admin
        await NotificationService.sendAdminAlert('Vendor Registration', `New vendor registered: ${newVendor.businessName} (${newVendor.email})`);
      } catch (err) {
        console.error('Registration Notification Error:', err);
      }
    })();

    // Reload the vendor to ensure we have the proper _id
    const reloadedVendor = await VendorModel.findById(newVendor._id);

    // 7️⃣ Automatically create staff member from vendor data


    const staffResult = await createOwnerAsStaff(reloadedVendor, password);

    // Verify the staff member was created
    if (staffResult && staffResult._id) {
      const verifiedStaff = await StaffModel.findById(staffResult._id);
      if (verifiedStaff) {

      }

      // Also check by vendorId and email
      // Make sure to use the reloaded vendor ID for verification
      const staffByVendorAndEmail = await StaffModel.findOne({
        vendorId: reloadedVendor._id,
        emailAddress: reloadedVendor.email
      });
      if (staffByVendorAndEmail) {
      }
    } else {
      const existingStaff = await StaffModel.findOne({
        vendorId: reloadedVendor._id,
        emailAddress: reloadedVendor.email
      });
      if (existingStaff) {
      }
    }


    // 8️⃣ Handle referral if a code was provided
    if (referredByCode) {
      try {
        const { checkAndCreditReferralBonus } = await import("@repo/lib/utils/referralWalletCredit");
        const referredCode = referredByCode.trim().toUpperCase();
        let referringEntity = null;
        let referralType = 'V2V';
        let entityType = 'Vendor';
        let SettingsModel = V2VSettingsModel;

        // Try Vendor model first
        referringEntity = await VendorModel.findOne({ referralCode: referredCode });

        // If not found, try User model (C2V)
        if (!referringEntity) {
          referringEntity = await UserModel.findOne({ refferalCode: referredCode });
          if (referringEntity) {
            referralType = 'C2V';
            entityType = 'User';
            SettingsModel = C2VSettingsModel;
          }
        }

        if (referringEntity) {
          // Fetch settings for correct region
          const settings = await SettingsModel.findOne({
            $or: [
              { regionId: newVendor.regionId },
              { regionId: null }
            ]
          }).sort({ regionId: -1 });

          const bonusValue = settings?.referrerBonus?.bonusValue || 0;
          const referralId = `REF_REG_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          const referringName = entityType === 'Vendor'
            ? (referringEntity.businessName || `${referringEntity.firstName} ${referringEntity.lastName}`)
            : `${referringEntity.firstName} ${referringEntity.lastName}`;

          await ReferralModel.create({
            referralId,
            referralType,
            referrer: referringEntity._id.toString(),
            referrerType: entityType,
            referee: newVendor._id.toString(),
            refereeType: 'Vendor',
            date: new Date(),
            status: 'Pending', // Set to pending initially, will be completed after subscription purchase
            bonus: `₹${bonusValue}`,
            regionId: newVendor.regionId
          });

          // Trigger Referral Notifications
          (async () => {
            try {
              // Notify Referee (New Vendor)
              await NotificationService.sendReferralAlert(newVendor._id.toString(), 'vendor', {
                referrerName: referringName,
                rewardAmount: bonusValue,
                status: 'pending'
              });

              // Notify Referrer (User or Vendor)
              await NotificationService.sendReferralAlert(referringEntity._id.toString(), entityType.toLowerCase(), {
                referrerName: newVendor.businessName,
                rewardAmount: bonusValue,
                status: 'pending'
              });
            } catch (err) {
              console.error('Referral Notification Error:', err);
            }
          })();
        }
      } catch (referralErr) {
        console.error('Referral processing error:', referralErr);
      }
    }

    // 9️⃣ Remove password before returning
    const vendorData = newVendor.toObject();
    delete vendorData.password;

    // The user is now registered. They will be logged in and then can proceed with onboarding.
    return NextResponse.json({ message: "Account created successfully. Proceed to onboarding.", vendor: vendorData }, { status: 201 });
  } catch (err) {
    console.error("Vendor Registration Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}