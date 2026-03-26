const trimTrailingSlash = (value?: string) => value?.replace(/\/+$/, '')
const splitCsv = (value?: string) =>
  value
    ?.split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean) ?? []

export const apiConfig = {
  apiBaseUrl:
    trimTrailingSlash(process.env.NEXT_PUBLIC_API_BASE_URL) ??
    'http://localhost:3001',
  cloudFrontBaseUrl: trimTrailingSlash(
    process.env.NEXT_PUBLIC_CLOUDFRONT_BASE_URL
  ),
  useMockAuth: process.env.NEXT_PUBLIC_USE_MOCK_AUTH !== 'false',
  useMocks:
    process.env.NEXT_PUBLIC_USE_MOCKS !== 'false' ||
    !process.env.NEXT_PUBLIC_API_BASE_URL,
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '',
  adminEmails: splitCsv(process.env.NEXT_PUBLIC_ADMIN_EMAILS),
}

export function buildApiUrl(path: string) {
  return `${apiConfig.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}
