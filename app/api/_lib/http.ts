import { NextResponse } from "next/server";

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message
      }
    },
    { status }
  );
}

export function unauthorized() {
  return apiError(401, "unauthorized", "Authentication required.");
}

export function notFound(message = "Resource not found.") {
  return apiError(404, "not_found", message);
}

export function badRequest(message: string) {
  return apiError(400, "bad_request", message);
}
