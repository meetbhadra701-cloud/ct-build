import { eq } from "drizzle-orm";

import { users } from "@/db/schema";
import { db } from "@/lib/db/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthenticatedAccount = {
  userId: string;
  accountId: string;
  email: string;
};

export async function getAuthenticatedAccount(): Promise<AuthenticatedAccount | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const [appUser] = await db
    .select({
      userId: users.id,
      accountId: users.accountId,
      email: users.email
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!appUser) {
    return null;
  }

  return appUser;
}
