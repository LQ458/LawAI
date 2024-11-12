/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import React from "react";
import { useState, useEffect, useRef } from "react";
import { FloatLabel } from "primereact/floatlabel";
import { InputText } from "primereact/inputtext";
import { Card } from "primereact/card";
import axios, { AxiosError } from "axios";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";

const Register = () => {
  const toast = useRef<Toast>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (
        !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/.test(
          password,
        )
      ) {
        toast.current?.show({
          severity: "error",
          summary: "请重试",
          detail: "密码必须包含大小写字母、数字、特殊字符，长度在8-16位",
          life: 3000,
        });
        setLoading(false);
        return;
      }
      await axios.post("/api/register", {
        username,
        password,
        email,
      });
      toast.current?.show({
        severity: "success",
        summary: "注册成功",
        detail: "欢迎",
        life: 3000,
      });
    } catch (error) {
      if (error instanceof AxiosError) {
        setErrorMessage(error.response?.data.message);
        toast.current?.show({
          severity: "error",
          summary: "发生错误",
          detail: error.response?.data.message,
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
  }; // 用户注册逻辑

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
          className="flex flex-col justify-center gap-5"
        >
          <FloatLabel className="self-center w-[90%]">
            <InputText
              id="username"
              className="w-full"
              value={username}
              keyfilter={/^[^\W_]+$/}
              required
              onChange={(e) => setUsername(e.target.value)}
            />
            <label htmlFor="username">请输入用户名</label>
          </FloatLabel>
          <div className="self-center w-[90%]">
            <FloatLabel aria-describedby="password-help">
              <InputText
                id="password"
                className="w-full"
                type="password"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
              />
              <label htmlFor="password">请输入密码</label>
            </FloatLabel>
            <small id="password-help">
              密码必须包含大小写字母、数字、特殊字符，长度在8-16位
            </small>
          </div>
          <FloatLabel className="self-center w-[90%]">
            <InputText
              id="email"
              className="w-full"
              type="email"
              value={email}
              keyfilter="email"
              required
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="email">请输入邮箱（可选）</label>
          </FloatLabel>
          <Button
            label="注册"
            className="w-[30%] self-center"
            icon="pi pi-user-plus"
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

export default Register;
