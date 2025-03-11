"use server";

import readUserSession from "@/lib/actions";
import createSupabaseServerClient from "@/lib/supabase/server";

export async function signUpWithEmailAndPassword(
  data: FormData
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  try {
    const { data: FetchedUser, error } = await supabase.auth.signUp({
      email: data.get("email") as string,
      password: data.get("password") as string,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    if (FetchedUser.user) {
      const { role } = FetchedUser.user;
      if (role === "authenticated") {
        return { success: true };
      } else {
        return {
          success: false,
          error: "Email already exist, Please sign in ",
        };
      }
    } else {
      return { success: false, error: "Unexpected error" };
    }
  } catch (err) {
    return { success: false, error: "Unexpected error" };
  }
}
export async function verifyEmailUsingOTP(data: FormData) {
  const supabase = await createSupabaseServerClient();
  try {
    const result = await supabase.auth.verifyOtp({
      email: data.get("email") as string,
      token: data.get("code") as string,
      type: "email",
    });
    if (result) {
      return { success: true };
    } else {
      return { success: false };
    }
  } catch (err) {
    console.log(err);
    return { success: false };
  }
}
export async function signInWithEmailAndPassword(
  data: FormData
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  try {
    const { data: FetchedUser, error } = await supabase.auth.signInWithPassword(
      {
        email: data.get("email") as string,
        password: data.get("password") as string,
      }
    );
    if (error) {
      return { success: false, error: error.message };
    }
    if (FetchedUser.user) {
      return { success: true };
    } else {
      return { success: false, error: "Unexpected error" };
    }
  } catch (err) {
    return { success: false };
  }
}

export async function logOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

export async function checkLogin() {
  const { data } = await readUserSession();
  return data.session ? true : false;
}
