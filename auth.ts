import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // 自前ホスティング(Vercel以外)を想定。リバースプロキシ配下でホスト検証をしないため、
  // 本番ではプロキシ/ロードバランサ側で Host ヘッダを検証すること。
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        username: { label: "ユーザー名", type: "text" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        const username = typeof credentials?.username === "string" ? credentials.username : null;
        const password = typeof credentials?.password === "string" ? credentials.password : null;
        if (!username || !password) return null;

        const staff = await prisma.staff.findUnique({ where: { username } });
        if (!staff || !staff.passwordHash || !staff.active) return null;

        const valid = await bcrypt.compare(password, staff.passwordHash);
        if (!valid) return null;

        return { id: staff.id, name: staff.name, role: staff.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.staffId = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.staffId as string;
        (session.user as { role?: string }).role = token.role as string | undefined;
      }
      return session;
    },
  },
});
