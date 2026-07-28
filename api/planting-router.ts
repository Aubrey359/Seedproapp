import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { plantings, crops, cropGuides, spraySchedules, nextSeq } from "@db/schema";

const UPCOMING_WINDOW_DAYS = 10;

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
    status: p.status,
    notes: p.notes ?? null,
    daysSincePlanting: daysSince,
    hasGuideContent: !!stage,
    stage: stage
      ? { title: stage.title, description: stage.description, tasks: stage.tasks, tips: stage.tips, warnings: stage.warnings }
      : null,
    currentTasks: currentTasks.map((t: any) => ({
      activityType: t.activityType, productName: t.productName ?? null, dosage: t.dosage ?? null, instructions: t.instructions,
    })),
    upcomingTasks: upcomingTasks.map((t: any) => ({
      activityType: t.activityType, productName: t.productName ?? null, dosage: t.dosage ?? null, instructions: t.instructions, daysUntil: t.dayFrom - daysSince,
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
});
