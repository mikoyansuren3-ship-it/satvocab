import { NextResponse, type NextRequest } from "next/server";
import { progressKey, readSession } from "@/server/auth";
import { NO_STORE, jsonError, notConfigured, readJson } from "@/server/http";
import { getStorage } from "@/server/storage";

interface ProgressDoc {
  data: unknown;
  updatedAt: string;
}

export async function GET(request: NextRequest) {
  const storage = getStorage();
  if (!storage) return notConfigured();
  const user = await readSession(request, storage);
  if (!user) return jsonError(401, "Sign in to load your progress.");
  const doc = await storage.read<ProgressDoc>(progressKey(user.id));
  return NextResponse.json({ data: doc?.data ?? null, updatedAt: doc?.updatedAt ?? null }, { headers: NO_STORE });
}

export async function PUT(request: NextRequest) {
  const storage = getStorage();
  if (!storage) return notConfigured();
  const user = await readSession(request, storage);
  if (!user) return jsonError(401, "Your sign-in expired. Sign in again to keep saving.");
  const body = await readJson(request, 1_500_000);
  if (body instanceof NextResponse) return body;
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) return jsonError(400, "Missing progress data.");
  const updatedAt = new Date().toISOString();
  await storage.write(progressKey(user.id), { data: body.data, updatedAt });
  return NextResponse.json({ updatedAt }, { headers: NO_STORE });
}
