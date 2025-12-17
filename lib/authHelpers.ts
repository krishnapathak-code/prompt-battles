// lib/authHelpers.ts
// Purpose: Helpers to check if user is logged in.

import { supabase } from "./supabase";

export async function getUserSession() {
	const {
		data: { session },
	} = await supabase.auth.getSession();
	return session;
}
