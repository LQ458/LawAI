import mongoose from "mongoose";

const accountSchema = new mongoose.Schema({
  provider: String,
  providerAccountId: String,
  type: String,
});

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function (v: string) {
        return /^[a-zA-Z0-9_]+$/.test(v);
      },
      message: "用户名只能包含字母、数字和下划线",
    },
  },
  email: {
    type: String,
    unique: true,
  },
  auth0Id: {
    type: String,
    unique: true,
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
    enum: ["auth0", "credentials", "google"],
    default: "auth0",
  },
  accounts: [accountSchema],
});

export default mongoose.models.User || mongoose.model("User", userSchema);
