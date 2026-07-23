"use client";
import { useEffect } from "react";
import { Button } from "primereact/button";
import { useAuth } from "@/hooks/useAuth";

interface AuthFormProps {
  onSuccess: () => void;
  setInitChat: (initChat: boolean) => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ onSuccess, setInitChat }) => {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      onSuccess();
      setInitChat(true);
    }
  }, [isAuthenticated, onSuccess, setInitChat]);

  const handleLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = "/auth/login";
  };

  const handleSignup = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = "/auth/login?screen_hint=signup";
  };

  return (
    <div className="w-[450px]">
      <div className="surface-card p-4 border-round">
        <h2 className="text-center text-primary font-bold text-3xl mb-6">
          法律AI
        </h2>
        <p className="text-center text-gray-500 mb-4">
          一般法律信息与授权检索原型
        </p>
        <p className="text-center text-xs text-gray-500 mb-4">
          不构成正式法律意见；高风险事项请咨询合格律师或官方法律援助机构。
        </p>

        <div className="flex flex-col gap-4">
          <Button
            label="登录"
            icon="pi pi-sign-in"
            onClick={handleLogin}
            raised
            className="w-full"
          />
          <Button
            label="注册新账号"
            icon="pi pi-user-plus"
            onClick={handleSignup}
            severity="secondary"
            outlined
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
