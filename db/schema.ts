import {
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Users ───
export const users = sqliteTable("users", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  unionId:     text("unionId").notNull().unique(),
  name:        text("name"),
  email:       text("email"),
  avatar:      text("avatar"),
  role:        text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  userType:    text("userType", { enum: ["farmer", "buyer", "aggregator"] }).default("farmer").notNull(),
  phone:       text("phone"),
  location:    text("location"),
  bio:         text("bio"),
  verified:    integer("verified", { mode: "boolean" }).default(false),
  rating:      real("rating").default(0.0),
  reviewCount: integer("reviewCount").default(0),
  createdAt:   text("createdAt").default(sql`(datetime('now'))`).notNull(),
  updatedAt:   text("updatedAt").default(sql`(datetime('now'))`).notNull(),
  lastSignInAt:text("lastSignInAt").default(sql`(datetime('now'))`).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Crops ───
export const crops = sqliteTable("crops", {
  id:            integer("id").primaryKey({ autoIncrement: true }),
  name:          text("name").notNull(),
  category:      text("category", { enum: ["vegetables", "grains", "cash_crops", "fruits", "legumes"] }).notNull(),
  icon:          text("icon"),
  image:         text("image"),
  description:   text("description"),
  growingPeriod: integer("growingPeriod"),
  typicalYield:  text("typicalYield"),
  createdAt:     text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type Crop = typeof crops.$inferSelect;

// ─── Listings ───
export const listings = sqliteTable("listings", {
  id:           integer("id").primaryKey({ autoIncrement: true }),
  farmerId:     integer("farmerId").notNull(),
  cropId:       integer("cropId").notNull(),
  cropName:     text("cropName").notNull(),
  quantity:     integer("quantity").notNull(),
  quantityUnit: text("quantityUnit").default("kg"),
  location:     text("location").notNull(),
  harvestDate:  text("harvestDate"),
  expectedPrice:real("expectedPrice").notNull(),
  currency:     text("currency").default("KES"),
  description:  text("description"),
  images:       text("images", { mode: "json" }).$type<string[]>(),
  status:       text("status", { enum: ["active", "sold", "reserved", "expired"] }).default("active").notNull(),
  createdAt:    text("createdAt").default(sql`(datetime('now'))`).notNull(),
  updatedAt:    text("updatedAt").default(sql`(datetime('now'))`).notNull(),
});

export type Listing = typeof listings.$inferSelect;

// ─── Orders ───
export const orders = sqliteTable("orders", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  listingId:      integer("listingId").notNull(),
  buyerId:        integer("buyerId").notNull(),
  farmerId:       integer("farmerId").notNull(),
  quantity:       integer("quantity").notNull(),
  price:          real("price").notNull(),
  totalAmount:    real("totalAmount").notNull(),
  deliveryMethod: text("deliveryMethod", { enum: ["pickup", "delivery"] }).default("pickup"),
  notes:          text("notes"),
  status:         text("status", { enum: ["pending", "confirmed", "in_transit", "delivered", "cancelled"] }).default("pending").notNull(),
  createdAt:      text("createdAt").default(sql`(datetime('now'))`).notNull(),
  updatedAt:      text("updatedAt").default(sql`(datetime('now'))`).notNull(),
});

export type Order = typeof orders.$inferSelect;

// ─── Market Prices ───
export const marketPrices = sqliteTable("market_prices", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  cropId:         integer("cropId").notNull(),
  cropName:       text("cropName").notNull(),
  town:           text("town").notNull(),
  wholesalePrice: real("wholesalePrice").notNull(),
  retailPrice:    real("retailPrice").notNull(),
  currency:       text("currency").default("KES"),
  trend:          text("trend", { enum: ["up", "down", "stable"] }).default("stable"),
  trendPercent:   real("trendPercent").default(0),
  priceDate:      text("priceDate").notNull(),
  createdAt:      text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type MarketPrice = typeof marketPrices.$inferSelect;

// ─── Ratings ───
export const ratings = sqliteTable("ratings", {
  id:         integer("id").primaryKey({ autoIncrement: true }),
  reviewerId: integer("reviewerId").notNull(),
  revieweeId: integer("revieweeId").notNull(),
  orderId:    integer("orderId"),
  rating:     integer("rating").notNull(),
  review:     text("review"),
  tags:       text("tags", { mode: "json" }).$type<string[]>(),
  createdAt:  text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type Rating = typeof ratings.$inferSelect;

// ─── Crop Guides ───
export const cropGuides = sqliteTable("cropGuides", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  cropId:      integer("cropId").notNull(),
  stage:       text("stage").notNull(),
  stageOrder:  integer("stageOrder").notNull(),
  title:       text("title").notNull(),
  description: text("description").notNull(),
  tasks:       text("tasks", { mode: "json" }).$type<string[]>(),
  tips:        text("tips", { mode: "json" }).$type<string[]>(),
  warnings:    text("warnings", { mode: "json" }).$type<string[]>(),
  createdAt:   text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type CropGuide = typeof cropGuides.$inferSelect;

// ─── Spray Schedules ───
export const spraySchedules = sqliteTable("spraySchedules", {
  id:           integer("id").primaryKey({ autoIncrement: true }),
  cropId:       integer("cropId").notNull(),
  stage:        text("stage").notNull(),
  dayFrom:      integer("dayFrom").notNull(),
  dayTo:        integer("dayTo"),
  activityType: text("activityType", { enum: ["fertilizer", "pesticide", "fungicide", "herbicide", "irrigation", "pruning", "harvest"] }).notNull(),
  productName:  text("productName"),
  dosage:       text("dosage"),
  instructions: text("instructions"),
  reminderSent: integer("reminderSent", { mode: "boolean" }).default(false),
  createdAt:    text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type SpraySchedule = typeof spraySchedules.$inferSelect;

// ─── Diagnoses ───
export const diagnoses = sqliteTable("diagnoses", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  farmerId:    integer("farmerId").notNull(),
  cropId:      integer("cropId"),
  cropName:    text("cropName"),
  photoUrl:    text("photoUrl").notNull(),
  description: text("description"),
  diagnosis:   text("diagnosis"),
  treatment:   text("treatment"),
  status:      text("status", { enum: ["pending", "diagnosed", "resolved"] }).default("pending"),
  createdAt:   text("createdAt").default(sql`(datetime('now'))`).notNull(),
  updatedAt:   text("updatedAt").default(sql`(datetime('now'))`).notNull(),
});

export type Diagnosis = typeof diagnoses.$inferSelect;

// ─── Advisory Messages ───
export const advisoryMessages = sqliteTable("advisoryMessages", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  userId:      integer("userId").notNull(),
  cropId:      integer("cropId"),
  direction:   text("direction", { enum: ["incoming", "outgoing"] }).notNull(),
  content:     text("content").notNull(),
  messageType: text("messageType", { enum: ["text", "image", "quick_reply", "product_card", "guide"] }).default("text"),
  metadata:    text("metadata", { mode: "json" }),
  createdAt:   text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type AdvisoryMessage = typeof advisoryMessages.$inferSelect;

// ─── Zones ───
export const zones = sqliteTable("zones", {
  id:           integer("id").primaryKey({ autoIncrement: true }),
  name:         text("name").notNull(),
  aggregatorId: integer("aggregatorId").notNull(),
  towns:        text("towns", { mode: "json" }).$type<string[]>(),
  description:  text("description"),
  active:       integer("active", { mode: "boolean" }).default(true),
  createdAt:    text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type Zone = typeof zones.$inferSelect;

// ─── Price Alerts ───
export const priceAlerts = sqliteTable("priceAlerts", {
  id:                 integer("id").primaryKey({ autoIncrement: true }),
  userId:             integer("userId").notNull(),
  cropName:           text("cropName").notNull(),
  town:               text("town"),
  condition:          text("condition", { enum: ["above", "below"] }).notNull(),
  targetPrice:        real("targetPrice").notNull(),
  notificationMethod: text("notificationMethod", { enum: ["whatsapp", "sms", "in_app"] }).default("in_app"),
  active:             integer("active", { mode: "boolean" }).default(true),
  triggered:          integer("triggered", { mode: "boolean" }).default(false),
  createdAt:          text("createdAt").default(sql`(datetime('now'))`).notNull(),
});

export type PriceAlert = typeof priceAlerts.$inferSelect;

// ─── M-Pesa Payments ───
export const mpesaPayments = sqliteTable("mpesa_payments", {
  id:                integer("id").primaryKey({ autoIncrement: true }),
  orderId:           integer("orderId"),
  checkoutRequestId: text("checkoutRequestId").unique(),
  merchantRequestId: text("merchantRequestId"),
  phone:             text("phone").notNull(),
  amount:            real("amount").notNull(),
  accountRef:        text("accountRef"),
  status:            text("status", { enum: ["pending", "completed", "failed", "cancelled"] }).default("pending").notNull(),
  mpesaReceiptNumber:text("mpesaReceiptNumber"),
  transactionDate:   text("transactionDate"),
  resultCode:        integer("resultCode"),
  resultDesc:        text("resultDesc"),
  rawCallback:       text("rawCallback", { mode: "json" }),
  createdAt:         text("createdAt").default(sql`(datetime('now'))`).notNull(),
  updatedAt:         text("updatedAt").default(sql`(datetime('now'))`).notNull(),
});

export type MpesaPayment = typeof mpesaPayments.$inferSelect;
