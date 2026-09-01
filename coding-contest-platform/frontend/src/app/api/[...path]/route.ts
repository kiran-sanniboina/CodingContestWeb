import { NextRequest, NextResponse } from "next/server";

export async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const targetPath = (path || []).join("/");
  const url = new URL(req.url);
  const queryString = url.search;

  const envBackend = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;
  const candidateHosts = [
    ...(envBackend ? [envBackend.replace(/\/$/, "")] : []),
    "http://backend:8080",
    "http://contest_backend:8080",
    "http://host.docker.internal:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8080",
  ];

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k !== "host" && k !== "connection" && k !== "content-length") {
      headers.set(key, value);
    }
  });

  const body = req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined;

  let lastError: any = null;

  for (const host of candidateHosts) {
    const targetUrl = `${host}/api/${targetPath}${queryString}`;
    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body,
        cache: "no-store",
      });

      const responseHeaders = new Headers();
      response.headers.forEach((value, key) => {
        const k = key.toLowerCase();
        if (k !== "content-encoding" && k !== "transfer-encoding") {
          responseHeaders.set(key, value);
        }
      });

      const responseBody = await response.arrayBuffer();
      return new NextResponse(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err: any) {
      lastError = err;
    }
  }

  console.error("All backend candidate connections failed for path: /api/" + targetPath, lastError);
  return NextResponse.json(
    { 
      error: "Backend service unreachable (502 Bad Gateway). Please check if contest_backend is running.", 
      details: lastError?.message || String(lastError) 
    },
    { status: 502 }
  );
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
export const OPTIONS = proxyRequest;


