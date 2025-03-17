"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import axios, { AxiosError } from "axios";
import { useAuth } from "@/hooks/useAuth";

interface AuthFormProps {
  toast: React.MutableRefObject<Toast | null>;
  onSuccess: () => void;
  setInitChat: (initChat: boolean) => void;
}

const AuthForm: React.FC<AuthFormProps> = ({
  toast,
  onSuccess,
  setInitChat,
}) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [isChina, setIsChina] = useState(false); // Add state to track if user is in China
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Detect user location using ipinfo
    fetch(`https://ipinfo.io/?token=${process.env.NEXT_PUBLIC_IPINFO_TOKEN}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.country === "CN") {
          setIsChina(true);
        }
      })
      .catch((error) => console.error("Error fetching IP location:", error));
  }, []);

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
          setInitChat(true);
        }
      } else {
        await axios.post("/api/register", {
          username,
          password,
          email: email ?? "",
        });

        toast.current?.show({
          severity: "success",
          summary: "注册成功",
          detail: "自动登录中",
          life: 3000,
        });
        localStorage.setItem("showTour", "true");

        await signIn("credentials", {
          username,
          password,
          redirect: false,
        });
        onSuccess();
        setInitChat(true);
        setUsername("");
        setPassword("");
        setEmail("");
        setIsLogin(true);
      }
    } catch (error: unknown) {
      console.log(error);
      const errorMessage =
        (error instanceof AxiosError && error.response?.data?.message) ||
        "发生未知错误";
      toast.current?.show({
        severity: "error",
        summary: "错误",
        detail: errorMessage,
        life: 3000,
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      onSuccess();
      setInitChat(true);
    }
  }, [isAuthenticated, onSuccess, setInitChat]);

  const handleGoogleLogin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setLoading(true);

    try {
      const result = await signIn("google", {
        callbackUrl: window.location.origin,
        redirect: true,
        prompt: "select_account",
      });

      if (result?.error) {
        console.error("Google login error:", result.error);
        toast.current?.show({
          severity: "error",
          summary: "登录失败",
          detail: "Google登录失败: " + (result.error || "请重试"),
          life: 5000,
        });
      }
    } catch (error) {
      console.error("Google login error:", error);
      toast.current?.show({
        severity: "error",
        summary: "登录失败",
        detail: "请检查网络连接后重试",
        life: 5000,
      });
    } finally {
      setLoading(false);
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

          {!isChina && (
            <Button
              label="使用Google账号登录"
              icon="pi pi-google"
              onClick={handleGoogleLogin}
              severity="secondary"
              outlined
              className="w-full"
            />
          )}

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
