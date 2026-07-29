import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { plantings, crops, cropGuides, spraySchedules, nextSeq } from "@db/schema";

const UPCOMING_WINDOW_DAYS = 10;
const BAG_SIZE_KG = 50; // standard Kenyan agrovet fertilizer bag

// rate x the farmer's own plot size = how much to actually buy, so they
// stop guessing (and overbuying "just in case"). null when either side of
// the calculation is missing — never a fabricated fallback number.
function fertilizerAmount(ratePerAcreKg: number | null | undefined, farmSizeAcres: number | null | undefined) {
  if (ratePerAcreKg == null || !farmSizeAcres) return null;
  const totalKg = Math.round(ratePerAcreKg * farmSizeAcres * 10) / 10;
  return { totalKg, bags: Math.round((totalKg / BAG_SIZE_KG) * 10) / 10 };
}

// A planting's growth stage and current/upcoming tasks, computed from its
// planting date — this is the anchor cropGuides/spraySchedules were always
// missing (day-offsets with nothing to count from). Stages are seeded as
// contiguous, non-overlapping day ranges, so "the stage with the highest
// dayFrom that's still <= daysSince" is always the correct current stage,
// including for a planting that's run past its last defined stage.
async function enrichPlanting(p: any) {
  const daysSince = Math.floor((Date.now() - new Date(p.plantingDate).getTime()) / 86_400_000);

  const stage: any = await cropGuides
    .findOne({ cropId: p.cropId, dayFrom: { $lte: Math.max(daysSince, 0) } })
    .sort({ dayFrom: -1 })
    .lean();

  const [currentTasks, upcomingTasks] = await Promise.all([
    spraySchedules
      .find({ cropId: p.cropId, dayFrom: { $lte: daysSince }, dayTo: { $gte: daysSince } })
      .sort({ dayFrom: 1 })
      .lean(),
    spraySchedules
      .find({ cropId: p.cropId, dayFrom: { $gt: daysSince, $lte: daysSince + UPCOMING_WINDOW_DAYS } })
      .sort({ dayFrom: 1 })
      .lean(),
  ]);

  return {
    id: p.id,
    cropName: p.cropName,
    plantingDate: p.plantingDate,
    location: p.location ?? null,
    farmSizeAcres: p.farmSizeAcres ?? null,
    status: p.status,
    notes: p.notes ?? null,
    daysSincePlanting: daysSince,
    hasGuideContent: !!stage,
    stage: stage
      ? { title: stage.title, description: stage.description, tasks: stage.tasks, tips: stage.tips, warnings: stage.warnings }
      : null,
    currentTasks: currentTasks.map((t: any) => ({
      activityType: t.activityType, productName: t.productName ?? null, dosage: t.dosage ?? null, instructions: t.instructions,
      hasRate: t.ratePerAcreKg != null, amount: fertilizerAmount(t.ratePerAcreKg, p.farmSizeAcres),
    })),
    upcomingTasks: upcomingTasks.map((t: any) => ({
      activityType: t.activityType, productName: t.productName ?? null, dosage: t.dosage ?? null, instructions: t.instructions, daysUntil: t.dayFrom - daysSince,
      hasRate: t.ratePerAcreKg != null, amount: fertilizerAmount(t.ratePerAcreKg, p.farmSizeAcres),
    })),
  };
}

export const plantingRouter = createRouter({
  create: authedQuery
    .input(
      z.object({
        cropName: z.string().min(1),
        // A plain YYYY-MM-DD input parses as UTC midnight, so "today" typed
        // in a UTC+ timezone (Kenya is UTC+3) can technically be a few hours
        // ahead of the server's UTC clock — allow a day of slack rather
        // than rejecting a farmer's legitimate "today" in the early morning.
        plantingDate: z.string().refine((s) => {
          const t = Date.parse(s);
          return !isNaN(t) && t <= Date.now() + 24 * 60 * 60 * 1000;
        }, { message: "Planting date must be a valid date that isn't in the future" }),
        location: z.string().optional(),
        farmSizeAcres: z.number().positive().max(10_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const crop: any = await crops.findOne({ name: input.cropName }).lean();
      const id = await nextSeq("plantings");
      await plantings.create({
        id,
        farmerId: ctx.user.id,
        cropId: crop?.id ?? 0,
        cropName: input.cropName,
        plantingDate: new Date(input.plantingDate),
        location: input.location ?? null,
        farmSizeAcres: input.farmSizeAcres ?? null,
        status: "active",
      });
      return { id };
    }),

  myPlantings: authedQuery.query(async ({ ctx }) => {
    const rows = await plantings.find({ farmerId: ctx.user.id }).sort({ createdAt: -1 }).lean();
    return Promise.all(rows.map(enrichPlanting));
  }),

  updateStatus: authedQuery
    .input(z.object({ plantingId: z.number(), status: z.enum(["active", "harvested", "abandoned"]) }))
    .mutation(async ({ ctx, input }) => {
      const existing: any = await plantings.findOne({ id: input.plantingId }).lean();
      if (!existing) throw new Error("Planting not found");
      if (existing.farmerId !== ctx.user.id) throw new Error("Not authorized to update this planting");
      await plantings.updateOne({ id: input.plantingId }, { $set: { status: input.status } });
      return { success: true };
    }),

  // Lets a farmer add or correct their plot size after the fact — they
  // often won't know it precisely when first logging a planting.
  updateFarmSize: authedQuery
    .input(z.object({ plantingId: z.number(), farmSizeAcres: z.number().positive().max(10_000) }))
    .mutation(async ({ ctx, input }) => {
      const existing: any = await plantings.findOne({ id: input.plantingId }).lean();
      if (!existing) throw new Error("Planting not found");
      if (existing.farmerId !== ctx.user.id) throw new Error("Not authorized to update this planting");
      await plantings.updateOne({ id: input.plantingId }, { $set: { farmSizeAcres: input.farmSizeAcres } });
      return { success: true };
    }),
});
