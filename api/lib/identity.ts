// Shared "phone number = identity" helper. Used by the WhatsApp bot and by
// public web endpoints (like the Sell form) that have no login system to
// rely on — both find-or-create the same farmer record by phone.
import { users, nextSeq } from "@db/schema";

export async function findOrCreateFarmerByPhone(phone: string, name?: string): Promise<any> {
  let user: any = await users.findOne({ phone }).lean();
  if (!user) {
    const id = await nextSeq("users");
    const created = await users.create({
      id,
      unionId: "wa_" + phone,
      phone,
      name: name || null,
      userType: "farmer",
    });
    user = created.toObject();
  } else if (name && !user.name) {
    await users.updateOne({ phone }, { $set: { name } });
    user.name = name;
  }
  return user;
}
