// NextAuth 用户登录验证逻辑
import DBconnect from "@/lib/mongodb";
import User from "@/models/user";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import GoogleProvider from "next-auth/providers/google";
import clientPromise from "@/lib/mongodb-adapter";

// interface Account {
//   provider: string;
//   providerAccountId: string;
//   type: string;
// }

const handler = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/",
    error: "/",
    signOut: "/",
  },
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID || "",
      clientSecret: process.env.GOOGLE_SECRET || "",
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    CredentialsProvider({
      credentials: {
        username: {},
        password: {},
      },
      async authorize(credentials) {
        await DBconnect();
        const username = credentials?.username || "";
        const user = await User.findOne({ username });
        if (!user) {
          throw new Error("用户不存在");
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

        throw new Error("密码错误");
      },
    }),
  ],
  callbacks: {
    async signIn({ account }) {
      try {
        if (account?.provider === "google") {
          return true;
        }
        return true;
      } catch (error) {
        console.error("Google sign in error:", error);
        return false;
      }
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session }) {
      try {
        if (session?.user?.email) {
          const user = await User.findOne({ email: session.user.email });
          if (user) {
            session.user.name = user.username;
            session.user.image = user.image || null;
          }
        }
        return session;
      } catch (error) {
        console.error("Error in session callback:", error);
        throw new Error("会话处理失败，请稍后重试");
      }
    },
  },
  events: {
    async signIn(message) {
      console.log("Successful sign in", message);
    },
    async signOut(message) {
      console.log("Successful sign out", message);
    },
  },
  debug: process.env.NODE_ENV === "development",
});

export { handler as GET, handler as POST };
