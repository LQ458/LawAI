# 🔧 Google OAuth配置修复指南

## 问题描述
错误提示：`您无法登录此应用，因为它不符合 Google 的 OAuth 2.0 政策的规定`

这个错误表示在Google Cloud Console中缺少正确的重定向URI配置。

## 修复步骤

### 1. 访问Google Cloud Console
打开 https://console.cloud.google.com/

### 2. 选择正确的项目
确保选择了包含你OAuth凭据的项目

### 3. 导航到OAuth配置
1. 左侧菜单：**API和服务** > **凭据**
2. 找到你的OAuth 2.0客户端ID（客户端ID: `217993483661-qtjt5d8m3jdo4r5u1bkui16gtkda83u8.apps.googleusercontent.com`）
3. 点击编辑按钮（铅笔图标）

### 4. 添加重定向URI
在 **已获授权的重定向URI** 部分，点击 **添加URI** 并输入：

```
http://localhost:3000/api/auth/callback/google
```

### 5. 保存配置
点击 **保存** 按钮

### 6. 等待生效
Google的配置更改可能需要几分钟时间生效

## 验证步骤

### 重启本地开发服务器
```bash
# 停止当前服务器 (Ctrl+C)
# 重新启动
pnpm dev
```

### 测试OAuth登录
1. 访问 http://localhost:3000
2. 点击Google登录按钮
3. 应该能正常跳转到Google授权页面

## 常见问题

### Q: 仍然出现相同错误
**A:** 
1. 确认URI拼写完全正确（注意http vs https）
2. 等待5-10分钟让配置生效
3. 清除浏览器缓存和cookies

### Q: 找不到OAuth客户端ID
**A:**
1. 确认已选择正确的Google Cloud项目
2. 检查是否在正确的项目中创建了OAuth凭据
3. 如果没有，需要重新创建OAuth 2.0客户端ID

### Q: 重定向URI无法添加
**A:**
1. 确保选择的应用类型是 **Web应用**
2. 确保URI格式正确，不包含多余空格

## 完整的重定向URI列表

为了同时支持本地开发和生产环境，建议配置以下URI：

```bash
# 本地开发环境
http://localhost:3000/api/auth/callback/google

# 生产环境（稍后Vercel部署时需要）
https://your-app-name.vercel.app/api/auth/callback/google
```

## 成功标志

配置成功后，你应该看到：
1. Google授权页面正常显示
2. 能够选择Google账户
3. 授权后自动重定向回应用
4. 用户信息正确显示在应用中

---

**修复完成后，请重新测试OAuth功能！**