import { getAuth } from "@/shared/auth";
import { toNextJsHandler } from "better-auth/next-js";

function getHandler() {
  return toNextJsHandler(getAuth());
}

export async function GET(request: Request) {
  return getHandler().GET(request);
}

export async function POST(request: Request) {
  return getHandler().POST(request);
}
