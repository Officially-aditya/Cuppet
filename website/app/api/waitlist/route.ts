import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function waitlistApiUrl() {
  const baseUrl =
    process.env.WAITLIST_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'https://sydney-production.up.railway.app'

  return new URL('/waitlist', baseUrl)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const response = await fetch(waitlistApiUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => ({
      error: { message: 'The waitlist service returned an invalid response.' },
    }))

    return NextResponse.json(payload, { status: response.status })
  } catch (error) {
    console.error('Waitlist proxy failed', error)
    return NextResponse.json(
      {
        error: {
          code: 'WAITLIST_UNAVAILABLE',
          message: 'We could not save your email right now. Please try again.',
        },
      },
      { status: 502 },
    )
  }
}
