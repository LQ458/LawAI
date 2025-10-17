/**
 * 统一认证工具
 * 支持已登录用户和临时用户的双模式认证
 */

import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { UserIdentity } from "@/types";

const cookieName =
  process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

/**
 * 从请求中获取用户身份 (支持已登录用户和临时用户)
 * @param req Next.js 请求对象
 * @param allowGuest 是否允许临时用户访问 (默认true)
 * @returns 用户身份信息
 */
export async function getUserIdentity(
  req: NextRequest,
  allowGuest: boolean = true
): Promise<UserIdentity | null> {
  // 尝试获取已登录用户token
  const token = await getToken({
    req,
    cookieName,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // 如果已登录,返回真实用户身份
  if (token?.email) {
    return {
      userId: token.email as string,
      isGuest: false,
      identifier: token.email as string,
    };
  }

  // 如果允许临时用户,尝试从请求头获取guestId
  if (allowGuest) {
    const guestId = req.headers.get('x-guest-id');
    
    if (guestId && guestId.startsWith('guest_')) {
      return {
        guestId,
        isGuest: true,
        identifier: guestId,
      };
    }
  }

  return null;
}

/**
 * 从请求体中获取用户身份 (支持已登录用户和临时用户)
 * 用于POST请求中包含guestId的场景
 */
export async function getUserIdentityFromBody(
  req: NextRequest,
  body: any,
  allowGuest: boolean = true
): Promise<UserIdentity | null> {
  // 先尝试获取已登录用户
  const identity = await getUserIdentity(req, false);
  
  if (identity) {
    return identity;
  }

  // 如果允许临时用户且请求体包含guestId
  if (allowGuest && body.guestId && body.guestId.startsWith('guest_')) {
    return {
      guestId: body.guestId,
      isGuest: true,
      identifier: body.guestId,
    };
  }

  return null;
}

/**
 * 验证用户身份 (支持已登录用户和临时用户)
 * @param req Next.js 请求对象
 * @param requireAuth 是否必须认证 (false时允许临时用户)
 * @returns 用户身份信息或null
 */
export async function verifyUserIdentity(
  req: NextRequest,
  requireAuth: boolean = false
): Promise<UserIdentity | null> {
  const identity = await getUserIdentity(req, !requireAuth);

  // 如果要求必须认证,则拒绝临时用户
  if (requireAuth && (!identity || identity.isGuest)) {
    return null;
  }

  return identity;
}

/**
 * 检查是否为已登录用户
 */
export function isAuthenticatedUser(identity: UserIdentity | null): boolean {
  return !!identity && !identity.isGuest && !!identity.userId;
}

/**
 * 检查是否为临时用户
 */
export function isGuestUser(identity: UserIdentity | null): boolean {
  return !!identity && identity.isGuest && !!identity.guestId;
}

/**
 * 获取用户标识符 (userId 或 guestId)
 */
export function getUserIdentifier(identity: UserIdentity | null): string | null {
  return identity?.identifier || null;
}
