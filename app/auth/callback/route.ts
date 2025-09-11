import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Normalize callbacks to our existing email confirm route
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/";
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  if (token_hash) params.set("token_hash", token_hash);
  if (type) params.set("type", type!);
  if (code) params.set("code", code!);
  return NextResponse.redirect(new URL(`/auth/confirm?${params.toString()}`, request.url));
}

