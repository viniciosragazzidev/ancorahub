import "server-only";

import { createHash, createHmac } from "node:crypto";

export class R2StorageConfigurationError extends Error {
  constructor() {
    super(
      "Armazenamento R2 não configurado. Defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_BUCKET no servidor.",
    );
    this.name = "R2StorageConfigurationError";
  }
}

export class R2StorageRequestError extends Error {
  constructor(operation: "upload" | "download", status: number) {
    super(
      operation === "upload"
        ? "Não foi possível gravar o arquivo no armazenamento."
        : "Não foi possível ler o arquivo no armazenamento.",
    );
    this.name = "R2StorageRequestError";
    this.cause = { status };
  }
}

type R2Configuration = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

function getR2Configuration(): R2Configuration {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket)
    throw new R2StorageConfigurationError();
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}
function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}
function encodeKey(storageKey: string) {
  return storageKey.split("/").map(encodeURIComponent).join("/");
}
function amzDate(now: Date) {
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function createR2SignedHeaders({
  method,
  accountId,
  accessKeyId,
  secretAccessKey,
  bucket,
  storageKey,
  body = Buffer.alloc(0),
  contentType,
  now = new Date(),
}: {
  method: "GET" | "PUT";
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  storageKey: string;
  body?: Buffer;
  contentType?: string;
  now?: Date;
}) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${encodeURIComponent(bucket)}/${encodeKey(storageKey)}`;
  const requestDate = amzDate(now);
  const dateStamp = requestDate.slice(0, 8);
  const payloadHash = sha256(body);
  const headerEntries = [
    ...(contentType ? [["content-type", contentType] as const] : []),
    ["host", host] as const,
    ["x-amz-content-sha256", payloadHash] as const,
    ["x-amz-date", requestDate] as const,
  ];
  const canonicalHeaders = headerEntries.map(([name, value]) => `${name}:${value}\n`).join("");
  const signedHeaders = headerEntries.map(([name]) => name).join(";");
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    requestDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), "auto"), "s3"),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return {
    url: `https://${host}${canonicalUri}`,
    headers: {
      ...(contentType ? { "content-type": contentType } : {}),
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": requestDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

export async function uploadR2Object(storageKey: string, body: Buffer, contentType: string) {
  const request = createR2SignedHeaders({
    method: "PUT",
    ...getR2Configuration(),
    storageKey,
    body,
    contentType,
  });
  const response = await fetch(request.url, {
    method: "PUT",
    headers: request.headers,
    body: new Uint8Array(body),
  });
  if (!response.ok) throw new R2StorageRequestError("upload", response.status);
}

export async function downloadR2Object(storageKey: string) {
  const request = createR2SignedHeaders({ method: "GET", ...getR2Configuration(), storageKey });
  const response = await fetch(request.url, { headers: request.headers, cache: "no-store" });
  if (!response.ok) throw new R2StorageRequestError("download", response.status);
  return response.blob();
}
