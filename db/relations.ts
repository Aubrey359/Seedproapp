import { relations } from "drizzle-orm";
import { users, listings, orders, marketPrices, ratings, cropGuides, spraySchedules, diagnoses, advisoryMessages, zones, priceAlerts, crops } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  listings: many(listings),
  ordersAsBuyer: many(orders, { relationName: "buyer" }),
  ratingsGiven: many(ratings, { relationName: "reviewer" }),
  ratingsReceived: many(ratings, { relationName: "reviewee" }),
  diagnoses: many(diagnoses),
  advisoryMessages: many(advisoryMessages),
  priceAlerts: many(priceAlerts),
}));

export const cropsRelations = relations(crops, ({ many }) => ({
  listings: many(listings),
  guides: many(cropGuides),
  schedules: many(spraySchedules),
  diagnoses: many(diagnoses),
  marketPrices: many(marketPrices),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  farmer: one(users, { fields: [listings.farmerId], references: [users.id] }),
  crop: one(crops, { fields: [listings.cropId], references: [crops.id] }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  listing: one(listings, { fields: [orders.listingId], references: [listings.id] }),
  buyer: one(users, { fields: [orders.buyerId], references: [users.id], relationName: "buyer" }),
  farmer: one(users, { fields: [orders.farmerId], references: [users.id] }),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  reviewer: one(users, { fields: [ratings.reviewerId], references: [users.id], relationName: "reviewer" }),
  reviewee: one(users, { fields: [ratings.revieweeId], references: [users.id], relationName: "reviewee" }),
}));

export const cropGuidesRelations = relations(cropGuides, ({ one }) => ({
  crop: one(crops, { fields: [cropGuides.cropId], references: [crops.id] }),
}));

export const spraySchedulesRelations = relations(spraySchedules, ({ one }) => ({
  crop: one(crops, { fields: [spraySchedules.cropId], references: [crops.id] }),
}));

export const diagnosesRelations = relations(diagnoses, ({ one }) => ({
  farmer: one(users, { fields: [diagnoses.farmerId], references: [users.id] }),
}));

export const advisoryMessagesRelations = relations(advisoryMessages, ({ one }) => ({
  user: one(users, { fields: [advisoryMessages.userId], references: [users.id] }),
}));

export const zonesRelations = relations(zones, ({ one }) => ({
  aggregator: one(users, { fields: [zones.aggregatorId], references: [users.id] }),
}));

export const priceAlertsRelations = relations(priceAlerts, ({ one }) => ({
  user: one(users, { fields: [priceAlerts.userId], references: [users.id] }),
}));
