import { authRouter } from "./auth-router";
import { marketRouter } from "./market-router";
import { advisoryRouter } from "./advisory-router";
import { pricesRouter } from "./prices-router";
import { ratingsRouter } from "./ratings-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  market: marketRouter,
  advisory: advisoryRouter,
  prices: pricesRouter,
  ratings: ratingsRouter,
});

export type AppRouter = typeof appRouter;
