import { users, nextSeq } from "@db/schema";
import type { InsertUser } from "@db/schema";
import { env } from "../lib/env";

export async function findUserByUnionId(unionId: string) {
  const user = await users.findOne({ unionId }).lean();
  return user ?? undefined;
}

export async function upsertUser(data: InsertUser) {
  const isOwner = !!data.unionId && data.unionId === env.ownerUnionId;
  const existing = await users.findOne({ unionId: data.unionId });

  if (existing) {
    const update: Record<string, unknown> = { ...data, lastSignInAt: new Date() };
    if (isOwner) update.role = "admin";
    await users.updateOne({ unionId: data.unionId }, { $set: update });
    return;
  }

  const id = await nextSeq("users");
  await users.create({
    id,
    ...data,
    role: isOwner ? "admin" : data.role ?? "user",
    lastSignInAt: new Date(),
  });
}
