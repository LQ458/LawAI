# 📱 GitHub Codespace OAuth配置指南

## 当前Codespace信息
- **Codespace名称**: jubilant-bassoon-g47gwwq6vv46cvj9x
- **访问URL**: https://jubilant-bassoon-g47gwwq6vv46cvj9x-3000.app.github.dev
- **OAuth回调URI**: https://jubilant-bassoon-g47gwwq6vv46cvj9x-3000.app.github.dev/api/auth/callback/google

## Google Cloud Console配置步骤

### 1. 访问Google Cloud Console
打开 https://console.cloud.google.com/

### 2. 导航到OAuth凭据
1. 选择项目
2. 左侧菜单：**API和服务** > **凭据**
3. 找到OAuth 2.0客户端ID：`217993483661-qtjt5d8m3jdo4r5u1bkui16gtkda83u8.apps.googleusercontent.com`
4. 点击编辑按钮

### 3. 更新重定向URI
在 **已获授权的重定向URI** 部分：

**删除或注释掉**：
```
http://localhost:3000/api/auth/callback/google
```

**添加新的URI**：
```
https://jubilant-bassoon-g47gwwq6vv46cvj9x-3000.app.github.dev/api/auth/callback/google
```

### 4. 保存配置
点击 **保存** 按钮，等待配置生效（通常1-2分钟）

## 环境变量已更新
✅ NEXTAUTH_URL 已更新为 Codespace URL

## 验证步骤

### 1. 重启开发服务器
```bash
# 停止当前服务器 (Ctrl+C)
pnpm dev
```

### 2. 访问应用
在浏览器中打开：
```
https://jubilant-bassoon-g47gwwq6vv46cvj9x-3000.app.github.dev
```

### 3. 测试Google登录
1. 点击Google登录按钮
2. 应该正常跳转到Google授权页面
3. 完成授权后返回应用

## 🚨 重要提醒

### Codespace重启后
如果你重启或重新创建Codespace，域名可能会变化，需要：
1. 检查新的Codespace名称：`echo $CODESPACE_NAME`
2. 更新Google Cloud Console中的重定向URI
3. 更新 .env.local 中的 NEXTAUTH_URL

### 生产部署时
部署到Vercel时，记得添加生产环境的重定向URI：
```
https://your-vercel-app.vercel.app/api/auth/callback/google
```

## 故障排除

### 仍然出现 redirect_uri_mismatch 错误
1. 检查URI拼写是否完全匹配（注意大小写和特殊字符）
2. 确认已保存Google Cloud Console的更改
3. 等待几分钟让配置生效
4. 清除浏览器缓存

### 无法访问Codespace URL
1. 确认端口3000已正确转发
2. 检查Codespace的端口设置
3. 确认开发服务器正在运行

---

**配置完成后，请重新测试Google OAuth功能！**