// Shared "is this farmer currently premium" check. Two ways to be premium:
// an admin grant (premium:true, no expiry — permanent, via the admin panel's
// existing toggle) or a paid self-serve subscription (premium:true with a
// premiumExpiresAt that must still be in the future).
export function isPremiumActive(user: { premium?: boolean; premiumExpiresAt?: Date | string | null }): boolean {
  if (!user?.premium) return false;
  if (!user.premiumExpiresAt) return true;
  return new Date(user.premiumExpiresAt).getTime() > Date.now();
}
