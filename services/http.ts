import type { ApiResponse } from '@/lambda/types'

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
}

export function jsonResponse(statusCode: number, data: unknown): ApiResponse {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(data),
  }
}

export function errorResponse(statusCode: number, message: string): ApiResponse {
  return jsonResponse(statusCode, { message })
}

export function parseJsonBody<T>(body: string | null): T {
  if (!body) {
    throw new Error('Request body is required')
  }

  return JSON.parse(body) as T
}
