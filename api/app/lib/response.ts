import { NextResponse } from 'next/server';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T) {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function unauthorized() {
  return err('Unauthorized', 401);
}

export function notFound(resource = 'Resource') {
  return err(`${resource} not found`, 404);
}

export function serverError(e: unknown) {
  console.error(e);
  return err('Internal server error', 500);
}
