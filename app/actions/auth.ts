"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export async function authenticate(_prevState: string | undefined, formData: FormData) {
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: String(formData.get("callbackUrl") || "/dashboard"),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "ユーザー名またはパスワードが正しくありません。";
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
