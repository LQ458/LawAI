"use client";
import React from "react";
import { useState, useEffect, useRef } from "react";
import { FloatLabel } from "primereact/floatlabel";
import { InputText } from "primereact/inputtext";
import { Card } from "primereact/card";
import { signIn } from "next-auth/react";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";

const Login = () => {
  const toast = useRef<Toast>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (res && res.error) {
        setErrorMessage("用户名或密码错误");
        toast.current?.show({
          severity: "error",
          summary: "发生错误",
          detail: "用户名或密码错误",
          life: 3000,
        });
        setTimeout(() => {
          setErrorMessage("");
        }, 3000);
      } else {
        toast.current?.show({
          severity: "success",
          summary: "登录成功",
          detail: "登录有效期为7天",
          life: 3000,
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
        toast.current?.show({
          severity: "error",
          summary: "发生错误",
          detail: "请重试",
          life: 3000,
        });
      } else {
        setErrorMessage("未知错误");
        toast.current?.show({
          severity: "error",
          summary: "发生错误",
          detail: "未知错误",
          life: 3000,
        });
      }
      setTimeout(() => {
        setErrorMessage("");
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col justify-center">
      <Toast ref={toast} />
      <Card className="self-center rounded-[18px]" style={{ width: "450px" }}>
        <h1 className="text-center m-0 mb-3 text-4xl">
          <i className="pi pi-slack text-3xl mr-2"></i>
          法律AI
        </h1>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col justify-center gap-4"
        >
          <FloatLabel className="self-center w-[90%]">
            <InputText
              id="username"
              className="w-full"
              value={username}
              required
              onChange={(e) => setUsername(e.target.value)}
            />
            <label htmlFor="username">用户名</label>
          </FloatLabel>
          <FloatLabel className="self-center w-[90%]">
            <InputText
              id="password"
              className="w-full"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
            <label htmlFor="password">密码</label>
          </FloatLabel>
          <Button
            label="登录"
            className="w-[30%] self-center"
            icon="pi pi-sign-in"
            rounded
            type="submit"
            raised
            loading={loading}
          />
        </form>
      </Card>
    </div>
  );
};

export default Login;
