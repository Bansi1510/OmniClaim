import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuditService } from './audit.service';

/**
 * Fallback middleware capturing requests rejected BEFORE the NestJS Interceptor runs
 * (e.g., 403 Forbidden from Guards, 404 Not Found routes, or malformed requests).
 * Skips any request already recorded by AuditLoggingInterceptor (`req.__auditLogged === true`).
 */
@Injectable()
export class AuditFallbackMiddleware implements NestMiddleware {
  constructor(private readonly auditService: AuditService) {}

  use(req: Request & { __auditLogged?: boolean }, res: Response, next: NextFunction) {
    const method = (req.method || 'GET').toUpperCase();
    const rawUrl = req.originalUrl || req.url || '/';

    // Skip CORS preflight, swagger static UI assets, and silent audit viewer self-polling
    if (
      method === 'OPTIONS' ||
      rawUrl.startsWith('/api/docs') ||
      req.headers?.['x-audit-silent'] === '1'
    ) {
      return next();
    }

    const startTime = Date.now();

    res.on('finish', () => {
      if (req.__auditLogged) return;
      req.__auditLogged = true;

      const durationMs = Date.now() - startTime;
      const statusCode = res.statusCode || 500;
      const routeCtx = this.auditService.parseRouteContext(method, rawUrl, req.params as any, req.body);

      void (async () => {
        const actor = await this.auditService.resolveActor(req);
        const fwd = req.headers?.['x-forwarded-for'];
        const ip =
          typeof fwd === 'string' && fwd.trim()
            ? fwd.split(',')[0].trim()
            : req.ip || req.socket?.remoteAddress || '127.0.0.1';

        await this.auditService.recordActivity({
          method,
          path: rawUrl,
          routePattern: routeCtx.routePattern,
          module: routeCtx.module,
          entityType: routeCtx.entityType,
          entityId: routeCtx.entityId,
          action: routeCtx.action,
          statusCode,
          success: statusCode < 400,
          durationMs,
          actor,
          ipAddress: ip,
          userAgent: (req.headers?.['user-agent'] as string) || null,
          queryParams: req.query,
          requestBody: req.body,
          oldValues: null,
          newValues: null,
          changedFields: [],
          errorMessage: statusCode >= 400 ? `HTTP ${statusCode} (${res.statusMessage || 'Blocked / Rejected'})` : null,
        });
      })();
    });

    next();
  }
}
