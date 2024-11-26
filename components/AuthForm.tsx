"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import axios from "axios";

interface AuthFormProps {
  toast: React.MutableRefObject<Toast | null>;
  onSuccess: () => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ toast, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);

    try {
      if (isLogin) {
        const res = await signIn("credentials", {
          username,
          password,
          redirect: false,
        });

        if (res?.error) {
          toast.current?.show({
            severity: "error",
            summary: "错误",
            detail: "用户名或密码错误",
            life: 3000,
          });
        } else {
          onSuccess();
        }
      } else {
        await axios.post("/api/register", {
          username,
          password,
          email,
        });

        toast.current?.show({
          severity: "success",
          summary: "注册成功",
          detail: "请登录",
          life: 3000,
        });

        setUsername("");
        setPassword("");
        setEmail("");
        setIsLogin(true);
      }
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: "错误",
        detail: "操作失败,请重试",
        life: 3000,
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const result = await signIn("google", {
        callbackUrl: window.location.origin,
        redirect: true,
      });

      if (result?.error) {
        toast.current?.show({
          severity: "error",
          summary: "登录失败",
          detail: "Google登录失败，请重试",
          life: 3000,
        });
      }
    } catch (error) {
      console.error("Google login error:", error);
      toast.current?.show({
        severity: "error",
        summary: "错误",
        detail: "登录过程中发生错误，请稍后重试",
        life: 3000,
      });
    }
  };

  const switchMode = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLogin(!isLogin);
    setUsername("");
    setPassword("");
    setEmail("");
  };

  return (
    <div className="w-[450px]">
      <div className="surface-card p-4 border-round">
        <h2 className="text-center text-primary font-bold text-3xl mb-6">
          {isLogin ? "登录" : "注册"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <span className="p-float-label">
            <InputText
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full"
              required
            />
            <label htmlFor="username">用户名</label>
          </span>

          <span className="p-float-label">
            <InputText
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full"
              required
            />
            <label htmlFor="password">密码</label>
          </span>

          {!isLogin && (
            <span className="p-float-label">
              <InputText
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
                required
              />
              <label htmlFor="email">邮箱</label>
            </span>
          )}

          <Button
            label={isLogin ? "登录" : "注册"}
            type="submit"
            loading={loading}
            raised
            className="w-full"
          />

          <Button
            label="使用Google账号登录"
            icon="pi pi-google"
            onClick={handleGoogleLogin}
            severity="secondary"
            outlined
            className="w-full"
          />

          <Button
            label={isLogin ? "没有账号?注册" : "已有账号?登录"}
            onClick={switchMode}
            link
            className="w-full"
          />
        </form>
      </div>
    </div>
  );
};

export default AuthForm;
