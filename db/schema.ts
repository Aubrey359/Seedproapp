import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  int,
  decimal,
  bigint,
  json,
  boolean,
  date,
} from "drizzle-orm/mysql-core";

// ─── Users ───
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // SeedPro-specific fields
  userType: mysqlEnum("userType", ["farmer", "buyer", "aggregator"]).default("farmer").notNull(),
  phone: varchar("phone", { length: 20 }),
  location: varchar("location", { length: 255 }),
  bio: text("bio"),
  verified: boolean("verified").default(false),
  rating: decimal("rating", { precision: 2, scale: 1 }).default("0.0"),
  reviewCount: int("reviewCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Crops ───
export const crops = mysqlTable("crops", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  category: mysqlEnum("category", ["vegetables", "grains", "cash_crops", "fruits", "legumes"]).notNull(),
  icon: varchar("icon", { length: 50 }),
  image: text("image"),
  description: text("description"),
  growingPeriod: int("growingPeriod"), // days
  typicalYield: varchar("typicalYield", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Crop = typeof crops.$inferSelect;

// ─── Listings (Crop Postings) ───
export const listings = mysqlTable("listings", {
  id: serial("id").primaryKey(),
  farmerId: bigint("farmerId", { mode: "number", unsigned: true }).notNull(),
  cropId: bigint("cropId", { mode: "number", unsigned: true }).notNull(),
  cropName: varchar("cropName", { length: 100 }).notNull(),
  quantity: int("quantity").notNull(), // kg
  quantityUnit: varchar("quantityUnit", { length: 20 }).default("kg"),
  location: varchar("location", { length: 255 }).notNull(),
  harvestDate: date("harvestDate"),
  expectedPrice: decimal("expectedPrice", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("KES"),
  description: text("description"),
  images: json("images").$type<string[]>(),
  status: mysqlEnum("status", ["active", "sold", "reserved", "expired"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Listing = typeof listings.$inferSelect;

// ─── Orders ───
export const orders = mysqlTable("orders", {
  id: serial("id").primaryKey(),
  listingId: bigint("listingId", { mode: "number", unsigned: true }).notNull(),
  buyerId: bigint("buyerId", { mode: "number", unsigned: true }).notNull(),
  farmerId: bigint("farmerId", { mode: "number", unsigned: true }).notNull(),
  quantity: int("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  deliveryMethod: mysqlEnum("deliveryMethod", ["pickup", "delivery"]).default("pickup"),
  notes: text("notes"),
  status: mysqlEnum("status", ["pending", "confirmed", "in_transit", "delivered", "cancelled"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Order = typeof orders.$inferSelect;

// ─── Market Prices ───
export const marketPrices = mysqlTable("market_prices", {
  id: serial("id").primaryKey(),
  cropId: bigint("cropId", { mode: "number", unsigned: true }).notNull(),
  cropName: varchar("cropName", { length: 100 }).notNull(),
  town: varchar("town", { length: 100 }).notNull(),
  wholesalePrice: decimal("wholesalePrice", { precision: 10, scale: 2 }).notNull(),
  retailPrice: decimal("retailPrice", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("KES"),
  trend: mysqlEnum("trend", ["up", "down", "stable"]).default("stable"),
  trendPercent: decimal("trendPercent", { precision: 5, scale: 2 }).default("0.00"),
  priceDate: date("priceDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MarketPrice = typeof marketPrices.$inferSelect;

// ─── Ratings ───
export const ratings = mysqlTable("ratings", {
  id: serial("id").primaryKey(),
  reviewerId: bigint("reviewerId", { mode: "number", unsigned: true }).notNull(),
  revieweeId: bigint("revieweeId", { mode: "number", unsigned: true }).notNull(),
  orderId: bigint("orderId", { mode: "number", unsigned: true }),
  rating: int("rating").notNull(), // 1-5
  review: text("review"),
  tags: json("tags").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Rating = typeof ratings.$inferSelect;

// ─── Crop Guides (Step-by-step advisory) ───
export const cropGuides = mysqlTable("cropGuides", {
  id: serial("id").primaryKey(),
  cropId: bigint("cropId", { mode: "number", unsigned: true }).notNull(),
  stage: mysqlEnum("stage", ["nursery", "vegetative", "flowering", "fruiting", "harvest", "post_harvest", "bulbing", "tasseling", "berry_development", "pruning", "tuber_initiation", "tuber_bulking"]).notNull(),
  stageOrder: int("stageOrder").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  tasks: json("tasks").$type<string[]>(),
  tips: json("tips").$type<string[]>(),
  warnings: json("warnings").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CropGuide = typeof cropGuides.$inferSelect;

// ─── Spray Schedules ───
export const spraySchedules = mysqlTable("spraySchedules", {
  id: serial("id").primaryKey(),
  cropId: bigint("cropId", { mode: "number", unsigned: true }).notNull(),
  stage: varchar("stage", { length: 50 }).notNull(),
  dayFrom: int("dayFrom").notNull(),
  dayTo: int("dayTo"),
  activityType: mysqlEnum("activityType", ["fertilizer", "pesticide", "fungicide", "herbicide", "irrigation", "pruning", "harvest"]).notNull(),
  productName: varchar("productName", { length: 255 }),
  dosage: varchar("dosage", { length: 100 }),
  instructions: text("instructions"),
  reminderSent: boolean("reminderSent").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SpraySchedule = typeof spraySchedules.$inferSelect;

// ─── Diagnoses (Crop problem uploads) ───
export const diagnoses = mysqlTable("diagnoses", {
  id: serial("id").primaryKey(),
  farmerId: bigint("farmerId", { mode: "number", unsigned: true }).notNull(),
  cropId: bigint("cropId", { mode: "number", unsigned: true }),
  cropName: varchar("cropName", { length: 100 }),
  photoUrl: text("photoUrl").notNull(),
  description: text("description"),
  diagnosis: text("diagnosis"),
  treatment: text("treatment"),
  status: mysqlEnum("status", ["pending", "diagnosed", "resolved"]).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Diagnosis = typeof diagnoses.$inferSelect;

// ─── Advisory Messages ───
export const advisoryMessages = mysqlTable("advisoryMessages", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  cropId: bigint("cropId", { mode: "number", unsigned: true }),
  direction: mysqlEnum("direction", ["incoming", "outgoing"]).notNull(),
  content: text("content").notNull(),
  messageType: mysqlEnum("messageType", ["text", "image", "quick_reply", "product_card", "guide"]).default("text"),
  metadata: json("metadata"), // quick reply options, product info, etc.
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdvisoryMessage = typeof advisoryMessages.$inferSelect;

// ─── Zones (Aggregator collection zones) ───
export const zones = mysqlTable("zones", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  aggregatorId: bigint("aggregatorId", { mode: "number", unsigned: true }).notNull(),
  towns: json("towns").$type<string[]>(),
  description: text("description"),
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Zone = typeof zones.$inferSelect;

// ─── Price Alerts ───
export const priceAlerts = mysqlTable("priceAlerts", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  cropName: varchar("cropName", { length: 100 }).notNull(),
  town: varchar("town", { length: 100 }),
  condition: mysqlEnum("condition", ["above", "below"]).notNull(),
  targetPrice: decimal("targetPrice", { precision: 10, scale: 2 }).notNull(),
  notificationMethod: mysqlEnum("notificationMethod", ["whatsapp", "sms", "in_app"]).default("in_app"),
  active: boolean("active").default(true),
  triggered: boolean("triggered").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PriceAlert = typeof priceAlerts.$inferSelect;
