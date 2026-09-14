import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import EventEmitter from 'events';

interface CacheEntry {
  statusCode: number;
  body: any;
  timestamp: number;
}

const bus = new EventEmitter();
bus.setMaxListeners(100);

const inFlight = new Set<string>();
const completedCache = new Map<string, CacheEntry>();

// Clean up stale cached entries older than 3 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of completedCache.entries()) {
    if (now - entry.timestamp > 3000) {
      completedCache.delete(key);
    }
  }
}, 5000);

function generateFingerprint(req: Request): string {
  const method = req.method.toUpperCase();
  const url = req.originalUrl || req.url;
  const userIdentifier = (req.headers.authorization || req.ip || 'anonymous').slice(-32);
  const bodyString = JSON.stringify(req.body ?? {});

  return crypto
    .createHash('sha256')
    .update(`${method}:${url}:${userIdentifier}:${bodyString}`)
    .digest('hex');
}

export function preventDuplicateSubmissions(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const method = req.method.toUpperCase();
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  // Skip read-only requests or auth authentication endpoints
  if (
    !isMutation ||
    req.originalUrl.includes('/auth/login') ||
    req.originalUrl.includes('/auth/refresh') ||
    req.originalUrl.includes('/auth/logout')
  ) {
    return next();
  }

  const fingerprint = generateFingerprint(req);

  // Check if identical request just finished in the last 1500ms
  const cached = completedCache.get(fingerprint);
  if (cached && Date.now() - cached.timestamp < 1500) {
    res.setHeader('X-Duplicate-Prevented', 'true');
    res.status(cached.statusCode).json(cached.body);
    return;
  }

  // If another identical request is currently processing in-flight:
  if (inFlight.has(fingerprint)) {
    // Wait for the in-flight request to complete and return its result
    const onFinish = (entry: CacheEntry) => {
      res.setHeader('X-Duplicate-Prevented', 'true');
      res.status(entry.statusCode).json(entry.body);
    };

    bus.once(`done:${fingerprint}`, onFinish);

    // Safety timeout in case original request hangs
    const timer = setTimeout(() => {
      bus.off(`done:${fingerprint}`, onFinish);
      if (!res.headersSent) {
        res.status(409).json({
          success: false,
          error: 'Duplicate request already in-progress. Please wait a moment.'
        });
      }
    }, 8000);

    res.on('close', () => {
      clearTimeout(timer);
      bus.off(`done:${fingerprint}`, onFinish);
    });

    return;
  }

  // Mark as in-flight
  inFlight.add(fingerprint);

  // Intercept the response to cache and notify waiting duplicates
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  let capturedBody: any = null;

  res.json = function (body: any): Response {
    capturedBody = body;
    return originalJson(body);
  };

  res.send = function (body: any): Response {
    if (!capturedBody) {
      try {
        capturedBody = JSON.parse(body);
      } catch {
        capturedBody = body;
      }
    }
    return originalSend(body);
  };

  res.on('finish', () => {
    inFlight.delete(fingerprint);

    const entry: CacheEntry = {
      statusCode: res.statusCode,
      body: capturedBody,
      timestamp: Date.now()
    };

    // Cache successful and client-error responses briefly to block rapid duplicate clicks
    if (res.statusCode < 500) {
      completedCache.set(fingerprint, entry);
    }

    // Broadcast to any waiting identical requests
    bus.emit(`done:${fingerprint}`, entry);
  });

  res.on('close', () => {
    inFlight.delete(fingerprint);
  });

  next();
}
