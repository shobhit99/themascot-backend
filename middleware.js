import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isPublicRoute = createRouteMatcher(["/login", "/favicon.ico"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (isPublicRoute(request)) return;

  if (!(await convexAuth.isAuthenticated())) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Sign in to use the mascot studio." }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    return nextjsMiddlewareRedirect(request, "/login");
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
