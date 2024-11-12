// NextAuth 用户登录验证逻辑
import DBconnect from "@/lib/mongodb";
import User from "@/models/user";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

const handler = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      credentials: {
        username: {},
        email: {},
        password: {},
      },
      async authorize(credentials) {
        await DBconnect();
        const username = credentials?.username || "";
        const user = await User.findOne({ username });
        if (!user) {
          return null;
        }
        const passwordCorrect = await bcrypt.compare(
          credentials?.password || "",
          user.password,
        );

        if (passwordCorrect) {
          return {
            id: user._id,
            name: user.username,
            email: user.email,
          };
        }

        return null;
      },
    }),
  ],
});

export { handler as GET, handler as POST };
