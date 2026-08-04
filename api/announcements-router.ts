import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { announcements, omitMongo } from "@db/schema";

export const announcementsRouter = createRouter({
  // Ads always show; events quietly stop showing once their date has
  // passed (undated events are treated as evergreen) — a farmer should
  // never see "upcoming" pointing at something already over.
  list: publicQuery
    .input(z.object({ type: z.enum(["ad", "event"]).optional() }).optional())
    .query(async ({ input }) => {
      const now = new Date();
      const upcoming = { $or: [{ eventDate: { $gte: now } }, { eventDate: null }] };
      let filter: any = { active: true };
      if (input?.type === "ad") filter.type = "ad";
      else if (input?.type === "event") filter = { ...filter, type: "event", ...upcoming };
      else filter.$or = [{ type: "ad" }, { type: "event", eventDate: { $gte: now } }, { type: "event", eventDate: null }];

      return omitMongo(await announcements.find(filter).sort({ createdAt: -1 }).lean());
    }),
});
