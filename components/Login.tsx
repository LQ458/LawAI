"use client";
import React from "react";
import { useState } from "react";
import { InputText } from "primereact/inputtext";
import { signIn } from "next-auth/react";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";

interface LoginProps {
  hide: (e: React.FormEvent | React.MouseEvent) => void; // Union type for the event parameter
  toast: React.MutableRefObject<Toast | null>;
}

const Login: React.FC<LoginProps> = ({ hide, toast }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (res && res.error) {
        toast.current?.show({
          severity: "error",
          summary: "发生错误",
          detail: "用户名或密码错误",
          life: 3000,
        });
      } else {
        toast.current?.show({
          severity: "success",
          summary: "登录成功",
          detail: "登录有效期为7天",
          life: 3000,
        });
        hide(e);
      }
    } catch (error) {
      if (error instanceof Error) {
        toast.current?.show({
          severity: "error",
          summary: "发生错误",
          detail: "请重试",
          life: 3000,
        });
      } else {
        toast.current?.show({
          severity: "error",
          summary: "发生错误",
          detail: "未知错误",
          life: 3000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-[450px] rounded-none flex flex-col justify-center">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col justify-center gap-4"
      >
        <div
          className="flex flex-column px-8 py-5 gap-4"
          style={{
            borderRadius: "12px",
            backgroundImage:
              "radial-gradient(circle at left top, var(--primary-400), var(--primary-700))",
          }}
        >
          <h1 className="text-center m-0 mb-3 text-4xl text-white">
            <i className="pi pi-slack text-3xl mr-2"></i>
            法律AI
          </h1>
          <div className="inline-flex flex-column gap-2">
            <label htmlFor="username" className="text-primary-50 font-semibold">
              用户名
            </label>
            <InputText
              id="username"
              className="bg-white-alpha-20 border-none p-3 text-primary-50"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="inline-flex flex-column gap-2">
            <label htmlFor="password" className="text-primary-50 font-semibold">
              密码
            </label>
            <InputText
              id="password"
              className="bg-white-alpha-20 border-none p-3 text-primary-50"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex align-items-center gap-2">
            <Button
              label="登录"
              type="submit"
              text
              className="p-3 w-full text-primary-50 border-1 border-white-alpha-30 hover:bg-white-alpha-10"
              loading={loading}
            />
            <Button
              label="退出"
              onClick={(e) => hide(e)}
              text
              className="p-3 w-full text-primary-50 border-1 border-white-alpha-30 hover:bg-white-alpha-10"
            />
          </div>
        </div>
      </form>
    </div>
  );
};

export default Login;
