
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import validator from "validator";
import generateTokens from "../../../../../../../../packages/lib/src/generateTokens.js";
import VendorModel from '@repo/lib/models/Vendor/Vendor.model';
import DoctorModel from '@repo/lib/models/Vendor/Docters.model';
import SupplierModel from '@repo/lib/models/Vendor/Supplier.model';
import StaffModel from '@repo/lib/models/Vendor/Staff.model';
import _db from "../../../../../../../../packages/lib/src/db.js";

await _db();

// Helper to generate unique referral code
const generateReferralCode = async (name, ModelToCheck) => {
  let referralCode;
  let isUnique = false;

  while (!isUnique) {
    const namePrefix = name.substring(0, 3).toUpperCase();
    const randomNumbers = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    referralCode = `${namePrefix}${randomNumbers}`;

    // Check uniqueness across all models
    const existingVendor = await VendorModel.findOne({ referralCode });
    const existingDoctor = await DoctorModel.findOne({ referralCode });
    const existingSupplier = await SupplierModel.findOne({ referralCode });

    isUnique = !existingVendor && !existingDoctor && !existingSupplier;
  }

  return referralCode;
};

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!validator.isEmail(email)) {
      return NextResponse.json({ success: false, error: "Invalid email address" }, { status: 400 });
    }

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 });
    }

    let user = null;
    let userType = null;
    let Model = null;
    let permissions = [];

    const userRoles = [
      { model: VendorModel, type: 'vendor', selectFields: '+password' },
      { model: DoctorModel, type: 'doctor', selectFields: '+password' },
      { model: SupplierModel, type: 'supplier', selectFields: '+password' },
      { model: StaffModel, type: 'staff', selectFields: '+password' },
    ];

    for (const roleInfo of userRoles) {
      const foundUser = await roleInfo.model.findOne({ email }).select(roleInfo.selectFields);
      if (foundUser && foundUser.email === email && foundUser.password) {
        const isMatch = await bcrypt.compare(password, foundUser.password);
        if (isMatch) {
          user = foundUser;
          userType = roleInfo.type;
          Model = roleInfo.model;
          permissions = foundUser.permissions || [];
          break;
        }
      }
    }

    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    // Generate referralCode for users who don't have one
    if (!user.referralCode) {
      let nameForCode = '';
      if (userType === 'supplier') {
        nameForCode = user.shopName || user.firstName;
      } else if (userType === 'doctor') {
        nameForCode = user.name || user.firstName;
      } else if (userType === 'vendor') {
        nameForCode = user.businessName || user.firstName;
      }



      if (nameForCode) {
        const referralCode = await generateReferralCode(nameForCode, Model);
        await Model.findByIdAndUpdate(user._id, { referralCode });
        user.referralCode = referralCode;
      } else {
      }
    }

    // Reload the user from the database to ensure all fields are included
    if (user.referralCode || userType === 'staff') {
      const reloadedUser = await Model.findById(user._id);
      if (reloadedUser) {
        user = reloadedUser;

        // For staff, get regionId from their vendor/doctor
        if (userType === 'staff' && user.vendorId) {
          const ownerModel = user.userType === 'Doctor' ? DoctorModel : VendorModel;
          const owner = await ownerModel.findById(user.vendorId).select('regionId');
          if (owner) {
            user.regionId = owner.regionId;
          }
        }
      }
    }

    const { accessToken, refreshToken } = generateTokens(
      user._id,
      userType,
      permissions,
      user.assignedRegions || (user.regionId ? [user.regionId] : []),
      null,
      user.regionId,
      userType === 'staff' ? user.vendorId : (userType === 'vendor' ? user._id : null)
    );

    const { password: _, ...safeUser } = user.toObject();

    if (Model && Model.findByIdAndUpdate) {
      await Model.findByIdAndUpdate(user._id, {
        lastLogin: new Date(),
        inactivityReminderSent: false
      });
    }

    const response = NextResponse.json({
      success: true,
      message: "Login Successful",
      user: safeUser,
      access_token: accessToken,
      refresh_token: refreshToken,
      role: userType,
      permissions: permissions,
    });

    response.cookies.set('crm_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return response;
  } catch (error) {
    console.error("CRM Login error:", error);
    return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
  }
}
