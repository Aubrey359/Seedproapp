import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { listings, orders, crops, users } from "@db/schema";
import { eq, desc, and, like, sql } from "drizzle-orm";
import { CURRENCY } from "@contracts/kenya";

export const marketRouter = createRouter({
  // ─── Listings ───
  list: publicQuery
    .input(
      z.object({
        cropType: z.string().optional(),
        location: z.string().optional(),
        category: z.string().optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];

      if (input?.cropType && input.cropType !== "all") {
        conditions.push(eq(listings.cropName, input.cropType));
      }
      if (input?.location) {
        conditions.push(like(listings.location, `%${input.location}%`));
      }
      if (input?.search) {
        conditions.push(
          sql`${listings.cropName} LIKE ${`%${input.search}%`} OR ${listings.location} LIKE ${`%${input.search}%`}`
        );
      }

      conditions.push(eq(listings.status, "active"));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const result = await db
        .select({
          id: listings.id,
          farmerId: listings.farmerId,
          cropId: listings.cropId,
          cropName: listings.cropName,
          quantity: listings.quantity,
          quantityUnit: listings.quantityUnit,
          location: listings.location,
          harvestDate: listings.harvestDate,
          expectedPrice: listings.expectedPrice,
          currency: listings.currency,
          description: listings.description,
          images: listings.images,
          status: listings.status,
          createdAt: listings.createdAt,
          updatedAt: listings.updatedAt,
          farmerName: users.name,
          farmerRating: users.rating,
          farmerVerified: users.verified,
          farmerAvatar: users.avatar,
        })
        .from(listings)
        .leftJoin(users, eq(listings.farmerId, users.id))
        .where(where)
        .orderBy(desc(listings.createdAt));

      return result;
    }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select({
          id: listings.id,
          farmerId: listings.farmerId,
          cropId: listings.cropId,
          cropName: listings.cropName,
          quantity: listings.quantity,
          quantityUnit: listings.quantityUnit,
          location: listings.location,
          harvestDate: listings.harvestDate,
          expectedPrice: listings.expectedPrice,
          currency: listings.currency,
          description: listings.description,
          images: listings.images,
          status: listings.status,
          createdAt: listings.createdAt,
          updatedAt: listings.updatedAt,
          farmerName: users.name,
          farmerRating: users.rating,
          farmerVerified: users.verified,
          farmerPhone: users.phone,
        })
        .from(listings)
        .leftJoin(users, eq(listings.farmerId, users.id))
        .where(eq(listings.id, input.id));
      return result[0] ?? null;
    }),

  create: authedQuery
    .input(
      z.object({
        cropName: z.string().min(1),
        quantity: z.number().positive(),
        quantityUnit: z.string().default("kg"),
        location: z.string().min(1),
        harvestDate: z.string().optional(),
        expectedPrice: z.number().positive(),
        currency: z.string().default(CURRENCY),
        description: z.string().optional(),
        images: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const farmerId = ctx.user.id;

      const cropResult = await db
        .select()
        .from(crops)
        .where(eq(crops.name, input.cropName));

      const cropId = cropResult[0]?.id ?? 1;

      const result = await db.insert(listings).values({
        farmerId,
        cropId,
        cropName: input.cropName,
        quantity: input.quantity,
        quantityUnit: input.quantityUnit,
        location: input.location,
        harvestDate: input.harvestDate ? new Date(input.harvestDate) : null,
        expectedPrice: input.expectedPrice.toString(),
        currency: input.currency,
        description: input.description ?? null,
        images: input.images ?? [],
        status: "active",
      });

      return { id: Number(result[0].insertId) };
    }),

  myListings: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const result = await db
      .select()
      .from(listings)
      .where(eq(listings.farmerId, ctx.user.id))
      .orderBy(desc(listings.createdAt));

    return result;
  }),

  // ─── Orders ───
  createOrder: authedQuery
    .input(
      z.object({
        listingId: z.number(),
        quantity: z.number().positive(),
        price: z.number().positive(),
        deliveryMethod: z.enum(["pickup", "delivery"]).default("pickup"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const buyerId = ctx.user.id;

      const listingResult = await db
        .select()
        .from(listings)
        .where(eq(listings.id, input.listingId));

      const listing = listingResult[0];
      if (!listing) throw new Error("Listing not found");

      const totalAmount = input.quantity * input.price;

      const result = await db.insert(orders).values({
        listingId: input.listingId,
        buyerId,
        farmerId: listing.farmerId,
        quantity: input.quantity,
        price: input.price.toString(),
        totalAmount: totalAmount.toString(),
        deliveryMethod: input.deliveryMethod,
        notes: input.notes ?? null,
        status: "pending",
      });

      return { id: Number(result[0].insertId) };
    }),

  myOrders: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;

    const result = await db
      .select()
      .from(orders)
      .where(
        sql`${orders.buyerId} = ${userId} OR ${orders.farmerId} = ${userId}`
      )
      .orderBy(desc(orders.createdAt));

    return result;
  }),

  updateOrderStatus: authedQuery
    .input(
      z.object({
        orderId: z.number(),
        status: z.enum(["pending", "confirmed", "in_transit", "delivered", "cancelled"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(orders)
        .set({ status: input.status })
        .where(eq(orders.id, input.orderId));

      return { success: true };
    }),
});
