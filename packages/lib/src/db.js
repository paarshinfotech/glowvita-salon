import { MONGODB_URI } from "../../config/config.js";
import mongoose from "mongoose";

// Cache the connection to prevent multiple connections
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const _db = async () => {
  // Don't connect during build time — check all known build-phase signals
  const isBuildPhase =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-export' ||
    process.env.NODE_ENV === 'production' && typeof window === 'undefined' && !process.env.MONGODB_URI;

  if (isBuildPhase) {
    console.log("Skipping MongoDB connection during build phase");
    mongoose.set('bufferCommands', false); // Disable buffering to prevent hanging
    return null;
  }


  // If already connected, return the existing connection
  if (cached.conn) {
    console.log("Using existing MongoDB connection");
    return cached.conn;
  }

  // Check if MONGODB_URI is defined
  if (!MONGODB_URI) {
    console.warn("MONGODB_URI is not defined, skipping database connection");
    return null;
  }
  console.log("Connecting with MONGODB_URI:", MONGODB_URI.substring(0, 20) + "...");

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,  // 5s — fail fast so builds don't hang
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10, // Connection pool size
      minPoolSize: 2,
      maxIdleTimeMS: 60000, // Close idle connections after 60s
      retryWrites: true,
      retryReads: true,
      family: 4, // Force IPv4 (fixes IPv6 issues)
    };

    try {
      
      if (!MONGODB_URI) {
        throw new Error("MONGODB_URI is not defined. Check your environment variables.");
      }
      
      cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
        console.log("MongoDB connected successfully");
        return mongoose;
      }).catch((error) => {
        console.error("MongoDB connection error:", error);
        throw error;
      });
    } catch (error) {
      console.error("MongoDB connection error:", error);
      throw error;
    }
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
};

export default _db;