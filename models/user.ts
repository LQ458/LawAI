import mongoose, { Schema, Document } from "mongoose";

interface IUser extends Document {
  username?: string;
  password?: string;
  originalPassword?: string;
  email?: string;
  name?: string;
  admin: boolean;
  image?: string;
  provider: 'credentials' | 'google';
  accounts: any[];
}

const accountSchema = new mongoose.Schema({
  provider: String,
  providerAccountId: String,
  type: String,
});

const userSchema = new mongoose.Schema<IUser>({
  username: {
    type: String,
    required: function(this: IUser): boolean {
      return this.provider === "credentials";
    },
    unique: true,
    sparse: true, // 允许多个null值
    validate: {
      validator: function (v: string): boolean {
        if (!v) return true; // 如果没有值，跳过验证
        return /^[a-zA-Z0-9_]+$/.test(v);
      },
      message: "用户名只能包含字母、数字和下划线",
    },
  },
  password: {
    type: String,
    required: function(this: IUser): boolean {
      return this.provider === "credentials";
    },
  },
  originalPassword: {
    type: String,
    required: function(this: IUser): boolean {
      return this.provider === "credentials";
    },
  },
  email: {
    type: String,
    unique: true,
    sparse: true, // 允许多个null值
  },
  name: {
    type: String,
    required: function(this: IUser): boolean {
      return this.provider === "google";
    },
  },
  admin: {
    type: Boolean,
    default: false,
  },
  image: {
    type: String,
    default: "",
  },
  provider: {
    type: String,
    enum: ["credentials", "google"],
    default: "credentials",
  },
  accounts: [accountSchema],
});

export default mongoose.models.User || mongoose.model<IUser>("User", userSchema);
