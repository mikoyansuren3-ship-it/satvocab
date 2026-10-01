import { NextResponse } from "next/server";
import { clearSession } from "@/server/auth";
import { NO_STORE } from "@/server/http";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  clearSession(response);
  return response;
}
