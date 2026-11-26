import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const method = (req.method || 'GET').toUpperCase();
    const rawUrl: string = req.originalUrl || req.url || '/';

    // Skip CORS preflight and silent audit viewer self-polling (prevents recursive spam)
    if (method === 'OPTIONS' || req.headers?.['x-audit-silent'] === '1') {
      req.__auditLogged = true;
      return next.handle();
    }

    const startTime = Date.now();
    const routeCtx = this.auditService.parseRouteContext(method, rawUrl, req.params, req.body);

    // Capture pre-mutation DB state for PATCH / PUT / DELETE and Setting upsert POST
    const shouldFetchOld =
      method === 'PATCH' ||
      method === 'PUT' ||
      method === 'DELETE' ||
      (method === 'POST' && routeCtx.entityType === 'SystemSetting') ||
      (method === 'POST' && routeCtx.entityType === 'Role' && rawUrl.includes('/permissions'));

    return from(
      shouldFetchOld
        ? this.auditService.fetchEntitySnapshot(routeCtx.entityType, routeCtx.entityId, req.body)
        : Promise.resolve(null),
    ).pipe(
      switchMap((oldValues) =>
        next.handle().pipe(
          tap({
            next: (responseBody) => {
              req.__auditLogged = true;
              const durationMs = Date.now() - startTime;
              const statusCode = res.statusCode || (method === 'POST' ? 201 : 200);
              const resolvedEntityId =
                routeCtx.entityId ||
                (responseBody && typeof responseBody === 'object' && responseBody.id
                  ? String(responseBody.id)
                  : null);

              void this.persistSuccessAudit({
                req,
                method,
                rawUrl,
                routeCtx: { ...routeCtx, entityId: resolvedEntityId },
                statusCode,
                durationMs,
                oldValues,
                responseBody,
              });
            },
            error: (err) => {
              req.__auditLogged = true;
              const durationMs = Date.now() - startTime;
              const statusCode = err?.getStatus?.() || err?.status || 500;
              const errorMessage =
                typeof err?.response?.message === 'string'
                  ? err.response.message
                  : Array.isArray(err?.response?.message)
                    ? err.response.message.join('; ')
                    : err?.message || 'Unhandled error';

              void this.persistErrorAudit({
                req,
                method,
                rawUrl,
                routeCtx,
                statusCode,
                durationMs,
                oldValues,
                errorMessage,
              });
            },
          }),
        ),
      ),
    );
  }

  private extractIp(req: any): string {
    const fwd = req?.headers?.['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim();
    return req?.ip || req?.socket?.remoteAddress || '127.0.0.1';
  }

  private async persistSuccessAudit(opts: {
    req: any;
    method: string;
    rawUrl: string;
    routeCtx: ReturnType<AuditService['parseRouteContext']>;
    statusCode: number;
    durationMs: number;
    oldValues: Record<string, unknown> | null;
    responseBody: any;
  }) {
    const actor = await this.auditService.resolveActor(opts.req, opts.responseBody);

    let newValues: Record<string, unknown> | null = null;
    if (opts.method === 'POST' || opts.method === 'PATCH' || opts.method === 'PUT') {
      // For updated/created domain entities, fetch the normalized post-mutation snapshot when possible
      // so nested fields (like Claim netPayout/fraudScore or Role permissionSlugs) diff cleanly!
      if (opts.routeCtx.entityType && opts.routeCtx.entityId) {
        newValues = await this.auditService.fetchEntitySnapshot(
          opts.routeCtx.entityType,
          opts.routeCtx.entityId,
          opts.req.body,
        );
      }
      if (!newValues && opts.responseBody && typeof opts.responseBody === 'object' && !Array.isArray(opts.responseBody)) {
        newValues = this.auditService.sanitizeValue(opts.responseBody) as Record<string, unknown>;
      }
    }

    const changedFields = this.auditService.computeFieldDiffs(opts.method, opts.oldValues, newValues);

    await this.auditService.recordActivity({
      method: opts.method,
      path: opts.rawUrl,
      routePattern: opts.routeCtx.routePattern,
      module: opts.routeCtx.module,
      entityType: opts.routeCtx.entityType,
      entityId: opts.routeCtx.entityId,
      action: opts.routeCtx.action,
      statusCode: opts.statusCode,
      success: opts.statusCode < 400,
      durationMs: opts.durationMs,
      actor,
      ipAddress: this.extractIp(opts.req),
      userAgent: opts.req.headers?.['user-agent'] || null,
      queryParams: opts.req.query,
      requestBody: opts.req.body,
      oldValues: opts.oldValues,
      newValues,
      changedFields,
    });
  }

  private async persistErrorAudit(opts: {
    req: any;
    method: string;
    rawUrl: string;
    routeCtx: ReturnType<AuditService['parseRouteContext']>;
    statusCode: number;
    durationMs: number;
    oldValues: Record<string, unknown> | null;
    errorMessage: string;
  }) {
    const actor = await this.auditService.resolveActor(opts.req);

    await this.auditService.recordActivity({
      method: opts.method,
      path: opts.rawUrl,
      routePattern: opts.routeCtx.routePattern,
      module: opts.routeCtx.module,
      entityType: opts.routeCtx.entityType,
      entityId: opts.routeCtx.entityId,
      action: opts.routeCtx.action,
      statusCode: opts.statusCode,
      success: false,
      durationMs: opts.durationMs,
      actor,
      ipAddress: this.extractIp(opts.req),
      userAgent: opts.req.headers?.['user-agent'] || null,
      queryParams: opts.req.query,
      requestBody: opts.req.body,
      oldValues: opts.oldValues,
      newValues: null,
      changedFields: [],
      errorMessage: opts.errorMessage,
    });
  }
}
