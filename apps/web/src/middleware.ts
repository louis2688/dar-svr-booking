import nextAuthMiddleware from "next-auth/middleware";

export default nextAuthMiddleware;

export const config = {
  matcher: ["/admin/:path*", "/request/:path*", "/requests/:path*"]
};

