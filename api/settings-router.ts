// Public read-only access to the admin-editable site content (hero copy,
// social links, footer text). Writes happen through the admin REST API.
import { createRouter, publicQuery } from "./middleware";
import { siteSettings } from "@db/schema";

export const settingsRouter = createRouter({
  get: publicQuery.query(async () => {
    const s: any = await siteSettings.findOne({ key: "main" }).lean();
    if (!s) return null;
    return {
      heroHeadline: s.heroHeadline ?? null,
      heroSubtext: s.heroSubtext ?? null,
      whatsappNumber: s.whatsappNumber ?? null,
      instagramUrl: s.instagramUrl ?? null,
      xUrl: s.xUrl ?? null,
      facebookUrl: s.facebookUrl ?? null,
      footerTagline: s.footerTagline ?? null,
      footerAddress: s.footerAddress ?? null,
    };
  }),
});
