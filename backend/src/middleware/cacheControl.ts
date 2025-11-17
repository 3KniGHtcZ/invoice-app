import { Request, Response, NextFunction } from 'express'

interface CacheOptions {
  maxAge?: number // seconds
  sMaxAge?: number // seconds (shared/CDN cache)
  staleWhileRevalidate?: number // seconds
  staleIfError?: number // seconds
  public?: boolean
  private?: boolean
  noCache?: boolean
  noStore?: boolean
  mustRevalidate?: boolean
  immutable?: boolean
}

export function cacheControl(options: CacheOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const directives: string[] = []

    if (options.noStore) {
      directives.push('no-store')
    } else if (options.noCache) {
      directives.push('no-cache')
    } else {
      if (options.public) directives.push('public')
      if (options.private) directives.push('private')
      if (options.maxAge !== undefined) directives.push(`max-age=${options.maxAge}`)
      if (options.sMaxAge !== undefined) directives.push(`s-maxage=${options.sMaxAge}`)
      if (options.staleWhileRevalidate !== undefined) {
        directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`)
      }
      if (options.staleIfError !== undefined) {
        directives.push(`stale-if-error=${options.staleIfError}`)
      }
      if (options.mustRevalidate) directives.push('must-revalidate')
      if (options.immutable) directives.push('immutable')
    }

    if (directives.length > 0) {
      res.setHeader('Cache-Control', directives.join(', '))
    }

    next()
  }
}

// Preset configurations for common caching scenarios
export const cachePresets = {
  // For frequently changing data (emails list)
  shortCache: cacheControl({
    private: true,
    maxAge: 60, // 1 minute
    staleWhileRevalidate: 30,
  }),

  // For semi-static data (attachments metadata)
  mediumCache: cacheControl({
    private: true,
    maxAge: 300, // 5 minutes
    staleWhileRevalidate: 60,
  }),

  // For static content (PDF files, extracted data)
  longCache: cacheControl({
    private: true,
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 300,
  }),

  // For immutable content
  immutableCache: cacheControl({
    public: true,
    maxAge: 31536000, // 1 year
    immutable: true,
  }),

  // Never cache
  noCache: cacheControl({
    noStore: true,
  }),
}
