import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering so env vars are read at runtime
export const dynamic = 'force-dynamic'

function getBackendUrl(): string {
  return process.env.VEXIL_API_URL || 'http://localhost:8090'
}

async function proxyRequest(request: NextRequest, params: { path: string[] }) {
  const path = params.path.join('/')
  const url = new URL(request.url)
  const backendUrl = `${getBackendUrl()}/api/v1/${path}${url.search}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const authHeader = request.headers.get('Authorization')
  if (authHeader) {
    headers['Authorization'] = authHeader
  }

  const init: RequestInit = {
    method: request.method,
    headers,
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body = await request.text()
    if (body) {
      init.body = body
    }
  }

  try {
    const response = await fetch(backendUrl, init)
    const data = await response.text()

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to API server' },
      { status: 502 }
    )
  }
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params)
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params)
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params)
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params)
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params)
}
