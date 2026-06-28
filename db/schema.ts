// MongoDB / Mongoose model layer for SeedPro.
// Mongoose is loaded via createRequire so it resolves correctly inside Vite's
// SSR module context (same pattern used elsewhere in this codebase).
import { createRequire } from "module";

const require = createRequire(process.cwd() + "/package.json");
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Re-register-safe model factory (Vite HMR re-imports this module repeatedly).
function model(name: string, schema: any) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

// ─── Auto-increment numeric ids ───
// Documents keep a numeric `id` so the existing numeric foreign keys
// (farmerId, cropId, …) and z.number() tRPC inputs work unchanged.
const counterSchema = new Schema({
  _id: String,
  seq: { type: Number, default: 0 },
});
export const counters = model("Counter", counterSchema);

export async function nextSeq(name: string): Promise<number> {
  const doc = await counters.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc.seq as number;
}

// Strip Mongo internals so API responses look like the old SQL rows.
const toJSON = {
  virtuals: false,
  versionKey: false,
  transform(_doc: any, ret: any) {
    delete ret._id;
    return ret;
  },
};

// ─── Users ───
const userSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    unionId: { type: String, required: true, unique: true },
    name: String,
    email: String,
    avatar: String,
    role: { type: String, enum: ["user", "admin"], default: "user" },
    userType: { type: String, enum: ["farmer", "buyer", "aggregator"], default: "farmer" },
    phone: String,
    location: String,
    bio: String,
    verified: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    lastSignInAt: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON },
);
export const users = model("User", userSchema);

// ─── Crops ───
const cropSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String, required: true },
    category: { type: String, enum: ["vegetables", "grains", "cash_crops", "fruits", "legumes"] },
    icon: String,
    image: String,
    description: String,
    growingPeriod: Number,
    typicalYield: String,
  },
  { timestamps: true, toJSON },
);
export const crops = model("Crop", cropSchema);

// ─── Listings ───
const listingSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    farmerId: { type: Number, required: true },
    cropId: { type: Number, required: true },
    cropName: { type: String, required: true },
    quantity: { type: Number, required: true },
    quantityUnit: { type: String, default: "kg" },
    location: { type: String, required: true },
    harvestDate: Date,
    expectedPrice: { type: Number, required: true },
    currency: { type: String, default: "KES" },
    description: String,
    images: { type: [String], default: [] },
    status: { type: String, enum: ["active", "sold", "reserved", "expired"], default: "active" },
  },
  { timestamps: true, toJSON },
);
export const listings = model("Listing", listingSchema);

// ─── Orders ───
const orderSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    listingId: { type: Number, required: true },
    buyerId: { type: Number, required: true },
    farmerId: { type: Number, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    deliveryMethod: { type: String, enum: ["pickup", "delivery"], default: "pickup" },
    notes: String,
    status: { type: String, enum: ["pending", "confirmed", "in_transit", "delivered", "cancelled"], default: "pending" },
  },
  { timestamps: true, toJSON },
);
export const orders = model("Order", orderSchema);

// ─── Market Prices ───
const marketPriceSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    cropId: { type: Number, required: true },
    cropName: { type: String, required: true },
    town: { type: String, required: true },
    wholesalePrice: { type: Number, required: true },
    retailPrice: { type: Number, required: true },
    currency: { type: String, default: "KES" },
    trend: { type: String, enum: ["up", "down", "stable"], default: "stable" },
    trendPercent: { type: Number, default: 0 },
    priceDate: { type: String, required: true },
  },
  { timestamps: true, toJSON },
);
export const marketPrices = model("MarketPrice", marketPriceSchema);

// ─── Ratings ───
const ratingSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    reviewerId: { type: Number, required: true },
    revieweeId: { type: Number, required: true },
    orderId: Number,
    rating: { type: Number, required: true },
    review: String,
    tags: { type: [String], default: [] },
  },
  { timestamps: true, toJSON },
);
export const ratings = model("Rating", ratingSchema);

// ─── Crop Guides ───
const cropGuideSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    cropId: { type: Number, required: true },
    stage: { type: String, required: true },
    stageOrder: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    tasks: { type: [String], default: [] },
    tips: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
  },
  { timestamps: true, toJSON },
);
export const cropGuides = model("CropGuide", cropGuideSchema);

// ─── Spray Schedules ───
const sprayScheduleSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    cropId: { type: Number, required: true },
    stage: { type: String, required: true },
    dayFrom: { type: Number, required: true },
    dayTo: Number,
    activityType: { type: String, enum: ["fertilizer", "pesticide", "fungicide", "herbicide", "irrigation", "pruning", "harvest"] },
    productName: String,
    dosage: String,
    instructions: String,
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON },
);
export const spraySchedules = model("SpraySchedule", sprayScheduleSchema);

// ─── Diagnoses ───
const diagnosisSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    farmerId: { type: Number, required: true },
    cropId: Number,
    cropName: String,
    photoUrl: { type: String, required: true },
    description: String,
    diagnosis: String,
    treatment: String,
    status: { type: String, enum: ["pending", "diagnosed", "resolved"], default: "pending" },
  },
  { timestamps: true, toJSON },
);
export const diagnoses = model("Diagnosis", diagnosisSchema);

// ─── Advisory Messages ───
const advisoryMessageSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    userId: { type: Number, required: true },
    cropId: Number,
    direction: { type: String, enum: ["incoming", "outgoing"], required: true },
    content: { type: String, required: true },
    messageType: { type: String, enum: ["text", "image", "quick_reply", "product_card", "guide"], default: "text" },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true, toJSON },
);
export const advisoryMessages = model("AdvisoryMessage", advisoryMessageSchema);

// ─── Zones ───
const zoneSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    name: { type: String, required: true },
    aggregatorId: { type: Number, required: true },
    towns: { type: [String], default: [] },
    description: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON },
);
export const zones = model("Zone", zoneSchema);

// ─── Price Alerts ───
const priceAlertSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    userId: { type: Number, required: true },
    cropName: { type: String, required: true },
    town: String,
    condition: { type: String, enum: ["above", "below"], required: true },
    targetPrice: { type: Number, required: true },
    notificationMethod: { type: String, enum: ["whatsapp", "sms", "in_app"], default: "in_app" },
    active: { type: Boolean, default: true },
    triggered: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON },
);
export const priceAlerts = model("PriceAlert", priceAlertSchema);

// ─── M-Pesa Payments ───
const mpesaPaymentSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    orderId: Number,
    checkoutRequestId: { type: String, unique: true, sparse: true },
    merchantRequestId: String,
    phone: { type: String, required: true },
    amount: { type: Number, required: true },
    accountRef: String,
    status: { type: String, enum: ["pending", "completed", "failed", "cancelled"], default: "pending" },
    mpesaReceiptNumber: String,
    transactionDate: String,
    resultCode: Number,
    resultDesc: String,
    rawCallback: Schema.Types.Mixed,
  },
  { timestamps: true, toJSON },
);
export const mpesaPayments = model("MpesaPayment", mpesaPaymentSchema);

// ─── Types used across the API ───
export interface User {
  id: number;
  unionId: string;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  role: "user" | "admin";
  userType: "farmer" | "buyer" | "aggregator";
  phone?: string | null;
  location?: string | null;
  bio?: string | null;
  verified?: boolean;
  rating?: number;
  reviewCount?: number;
  lastSignInAt?: Date;
}

export interface InsertUser {
  unionId: string;
  name?: string | null;
  avatar?: string | null;
  role?: "user" | "admin";
  userType?: "farmer" | "buyer" | "aggregator";
  lastSignInAt?: Date;
}

export { mongoose };
