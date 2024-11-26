// NextAuth 用户登录验证逻辑
import DBconnect from "@/lib/mongodb";
import User from "@/models/user";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import GoogleProvider from "next-auth/providers/google";
import clientPromise from "@/lib/mongodb-adapter";

interface Account {
  provider: string;
  providerAccountId: string;
  type: string;
}

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
          access_type: "offline",
          response_type: "code",
          prompt: "consent",
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
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider === "google") {
          await DBconnect();

          const existingUser = await User.findOne({ email: user.email });

          if (existingUser) {
            if (
              !existingUser.accounts ||
              !existingUser.accounts.find(
                (acc: Account) => acc.provider === "google",
              )
            ) {
              existingUser.accounts = existingUser.accounts || [];
              existingUser.accounts.push({
                provider: "google",
                providerAccountId: profile?.sub,
                type: "oauth",
              });
              await existingUser.save();
            }
            return true;
          } else {
            const username = `${user.email?.split("@")[0]}_${Math.random().toString(36).slice(2, 6)}`;
            const randomPassword =
              Math.random().toString(36).slice(2) +
              Math.random().toString(36).toUpperCase().slice(2);
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            await User.create({
              username,
              email: user.email,
              password: hashedPassword,
              originalPassword: hashedPassword,
              provider: "google",
              image: user.image || "",
              admin: false,
              accounts: [
                {
                  provider: "google",
                  providerAccountId: profile?.sub,
                  type: "oauth",
                },
              ],
            });
          }
          return true;
        }
        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
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
        return session;
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
