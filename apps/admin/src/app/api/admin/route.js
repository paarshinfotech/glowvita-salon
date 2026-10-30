// app/api/admin-users/route.js
import _db from "@repo/lib/db";
import AdminUserModel from "@repo/lib/models/admin/AdminUser";
import { authMiddlewareAdmin } from "../../../middlewareAdmin.js";
import bcrypt from "bcryptjs";
import { uploadBase64, deleteFile } from "@repo/lib/utils/upload";
import { forbiddenResponse } from "@repo/lib";

await _db();

export const POST = authMiddlewareAdmin(
  async (req) => {
    const body = await req.json();
    const {
      fullName,
      emailAddress,
      mobileNo,
      address,
      designation,
      profileImage,
      password,
      roleName,
      permissions,
      assignedRegions,
    } = body;

    const requester = req.user;

    // 1️⃣ Validate required fields
    if (
      !fullName ||
      !emailAddress ||
      !mobileNo ||            
      !address ||
      !designation ||
      !password ||
      !roleName
    ) {
      return Response.json(
        { message: "All required fields must be provided" },
        { status: 400 }
      );
    }

    // 2️⃣ Role-based validation
    if (requester.roleName?.toUpperCase() === 'REGIONAL_ADMIN') {
      // Regional Admin can ONLY create STAFF
      if (roleName !== 'STAFF') {
        return forbiddenResponse("Regional Admin can only create Staff members");
      }
      
      // Ensure assignedRegions is a subset of requester's regions
      if (assignedRegions && assignedRegions.length > 0) {
        const hasInvalidRegion = assignedRegions.some(rId => !requester.assignedRegions.map(rid => rid.toString()).includes(rId.toString()));
        if (hasInvalidRegion) {
          return forbiddenResponse("You can only assign staff to your own regions");
        }
      } else if (!assignedRegions || assignedRegions.length === 0) {
        // If no regions provided, default to all requester's regions
        body.assignedRegions = requester.assignedRegions;
      }
    } else if (requester.roleName?.toUpperCase() === 'SUPER_ADMIN') {
      // Super Admin creates staff for themselves. 
      // User says: "super admin is not creating the staff for the regional admin he create the staff only for the super admin"
      // So if creating STAFF, ensure assignedRegions is empty (All Access/Super Admin context) 
      // unless they explicitly want to assign a region.
      if (roleName === 'STAFF' && (!assignedRegions || assignedRegions.length === 0)) {
        body.assignedRegions = []; 
      }
    }

    // 3️⃣ Check if email or mobile already exists
    const existingAdmin = await AdminUserModel.findOne({
      $or: [{ emailAddress }, { mobileNo }],
    });
    if (existingAdmin) {
      return Response.json(
        { message: "Email or Mobile number already in use" },
        { status: 400 }
      );
    }

    // 4️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Handle profile image upload if provided
    let profileImageUrl = null;
    if (profileImage) {
      const fileName = `admin-${Date.now()}`;
      profileImageUrl = await uploadBase64(profileImage, fileName);
      
      if (!profileImageUrl) {
        return Response.json(
          { message: "Failed to upload profile image" },
          { status: 500 }
        );
      }
    }

    // 5️⃣ Create admin
    const newAdmin = await AdminUserModel.create({
      fullName,
      emailAddress,
      mobileNo,
      address,
      designation,
      profileImage: profileImageUrl || null,
      password: hashedPassword,
      roleName,
      permissions: permissions || [],
      assignedRegions: body.assignedRegions || assignedRegions || [],
    });

    const adminData = newAdmin.toObject();
    delete adminData.password;

    return Response.json(
      { message: "Admin created successfully", admin: adminData },
      { status: 201 }
    );
  },
  ["SUPER_ADMIN", "REGIONAL_ADMIN", "ADMIN"],
  "admin-roles:edit"
);


export const GET = authMiddlewareAdmin(
  async (req) => {
    const requester = req.user;
    let query = {};

    if (requester.roleName?.toUpperCase() === 'REGIONAL_ADMIN' || requester.roleName?.toUpperCase() === 'ADMIN') {
      // Regional admins see staff (not super admins) assigned to their regions
      query = {
        roleName: { $ne: 'SUPER_ADMIN' },
        assignedRegions: { $in: (requester.assignedRegions || []).map(id => id.toString()) }
      };
    } else if (requester.roleName?.toUpperCase() === 'STAFF') {
      // Staff see only themselves
      query = { _id: requester.userId };
    }

    const admins = await AdminUserModel.find(query).select("-password");
    return Response.json(admins);
  },
  ["SUPER_ADMIN", "REGIONAL_ADMIN", "ADMIN", "STAFF"],
  "admin-roles:view"
);

export const PUT = authMiddlewareAdmin(
  async (req) => {
    const url = new URL(req.url);
    const adminId = url.searchParams.get('id');
    const requester = req.user;
    
    let _id, body;
    const bodyData = await req.json();
    if (adminId) {
      _id = adminId;
      body = bodyData;
    } else {
      _id = bodyData._id || bodyData.id;
      const { _id: id, id: id2, ...rest } = bodyData;
      body = rest;
    }

    const targetAdmin = await AdminUserModel.findById(_id);
    if (!targetAdmin) {
      return Response.json({ message: "Admin not found" }, { status: 404 });
    }

    const isTargetSuperAdmin = targetAdmin.roleName?.toUpperCase() === 'SUPER_ADMIN';
    const isRequesterSuperAdmin = requester.roleName?.toUpperCase() === 'SUPER_ADMIN';

    // Role-based validation: Non-Super Admin cannot edit or reset Super Admin password
    if (isTargetSuperAdmin && !isRequesterSuperAdmin) {
      return forbiddenResponse("You do not have permission to edit or reset password for Super Admin");
    }

    if (requester.roleName?.toUpperCase() === 'REGIONAL_ADMIN' || requester.roleName?.toUpperCase() === 'ADMIN') {
      if (isTargetSuperAdmin) {
        return forbiddenResponse("Admin cannot edit or reset password for Super Admin");
      }

      // If editing self
      if (requester.userId.toString() === targetAdmin._id.toString()) {
        // Prevent Admin from upgrading themselves or changing their own regions/permissions
        delete body.roleName;
        delete body.permissions;
        delete body.assignedRegions;
      } else {
        // Editing someone else (presumably STAFF)
        if (targetAdmin.roleName?.toUpperCase() === 'REGIONAL_ADMIN' || targetAdmin.roleName?.toUpperCase() === 'ADMIN') {
          return forbiddenResponse("Admin cannot edit other Admins");
        }

        // Check if target admin is in requester's region
        const hasOverlap = targetAdmin.assignedRegions.some(rId => (requester.assignedRegions || []).map(rid => rid.toString()).includes(rId.toString()));
        if (!hasOverlap && targetAdmin.assignedRegions.length > 0) {
          return forbiddenResponse("You don't have permission to edit this admin");
        }

        // Ensure new assignedRegions are also within requester's regions
        if (body.assignedRegions) {
          const hasInvalidRegion = body.assignedRegions.some(rId => !(requester.assignedRegions || []).map(rid => rid.toString()).includes(rId.toString()));
          if (hasInvalidRegion) {
            return forbiddenResponse("You can only assign staff to your own regions");
          }
        }
      }
    }

    if (body.password) {
      body.password = await bcrypt.hash(body.password, 10);
    } else {
      delete body.password;
    }

    if (body.profileImage !== undefined) {
      if (body.profileImage && body.profileImage.startsWith('data:image')) {
        const fileName = `admin-${Date.now()}`;
        const imageUrl = await uploadBase64(body.profileImage, fileName);
        if (imageUrl) {
          if (targetAdmin.profileImage) await deleteFile(targetAdmin.profileImage);
          body.profileImage = imageUrl;
        }
      } else if (!body.profileImage) {
        if (targetAdmin.profileImage) await deleteFile(targetAdmin.profileImage);
        body.profileImage = null;
      }
    }

    const updatedAdmin = await AdminUserModel.findByIdAndUpdate(
      _id,
      { ...body, updatedAt: Date.now() },
      { new: true }
    ).select("-password");

    return Response.json(updatedAdmin);
  },
  ["SUPER_ADMIN", "REGIONAL_ADMIN", "ADMIN"],
  "admin-roles:edit"
);

export const DELETE = authMiddlewareAdmin(
  async (req) => {
    const url = new URL(req.url);
    const adminId = url.searchParams.get('id');
    const requester = req.user;
    
    let targetId = adminId;
    if (!targetId) {
      const body = await req.json();
      targetId = body.id || body._id;
    }

    if (!targetId) {
      return Response.json({ message: "Admin ID is required" }, { status: 400 });
    }

    const targetAdmin = await AdminUserModel.findById(targetId);
    if (!targetAdmin) {
      return Response.json({ message: "Admin not found" }, { status: 404 });
    }

    // Role-based validation: Non-Super Admin cannot delete Super Admin
    if (targetAdmin.roleName?.toUpperCase() === 'SUPER_ADMIN' && requester.roleName?.toUpperCase() !== 'SUPER_ADMIN') {
      return forbiddenResponse("Admin cannot delete Super Admin");
    }

    if (requester.roleName?.toUpperCase() === 'REGIONAL_ADMIN' || requester.roleName?.toUpperCase() === 'ADMIN') {
      if (targetAdmin.roleName?.toUpperCase() === 'SUPER_ADMIN' || targetAdmin.roleName?.toUpperCase() === 'REGIONAL_ADMIN' || targetAdmin.roleName?.toUpperCase() === 'ADMIN') {
        return forbiddenResponse("Admin cannot delete other Admins");
      }
      
      const hasOverlap = targetAdmin.assignedRegions.some(rId => (requester.assignedRegions || []).map(rid => rid.toString()).includes(rId.toString()));
      if (!hasOverlap && targetAdmin.assignedRegions.length > 0) {
        return forbiddenResponse("You don't have permission to delete this admin");
      }
    }

    if (targetAdmin.profileImage) {
      await deleteFile(targetAdmin.profileImage);
    }

    await AdminUserModel.findByIdAndDelete(targetId);
    return Response.json({ message: "Admin deleted successfully" });
  },
  ["SUPER_ADMIN", "REGIONAL_ADMIN", "ADMIN"],
  "admin-roles:delete"
);