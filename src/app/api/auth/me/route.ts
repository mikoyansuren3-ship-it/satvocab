import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/server/auth";
import { NO_STORE } from "@/server/http";
import { getStorage } from "@/server/storage";

export async function GET(request: NextRequest) {
  const storage = getStorage();
  if (!storage) return NextResponse.json({ configured: false, user: null }, { headers: NO_STORE });
  return NextResponse.json({ configured: true, user: await readSession(request, storage) }, { headers: NO_STORE });
}
