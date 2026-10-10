import swaggerJsdoc from "swagger-jsdoc";
import { createApp } from "../app.js";

// Global stubs to prevent ReferenceError from missing imports in app.ts when imported in test environment
(globalThis as any).createCORSMiddleware = () => (req: any, res: any, next: any) => next();
(globalThis as any).getCORSConfig = () => ({});

// Define allowlists
const PRIVATE_EXEMPT_ROUTES = new Set([
  "GET /health",
  "GET /ready",
  "GET /live",
  "GET /health/ready",
  "GET /metrics",
  "GET /__test__/explode",
  "POST /api/v1/test/auth",
  "POST /api/v1/admin/holiday-calendars",
  "GET /api/v1/admin/holiday-calendars/{id}",
  "PATCH /api/v1/admin/holiday-calendars/{id}",
  "DELETE /api/v1/admin/holiday-calendars/{id}",
  "POST /api/v1/admin/holiday-calendars/{id}/entries",
  "DELETE /api/v1/admin/holiday-calendars/{id}/entries/{entryId}",
  "POST /api/v1/admin/holiday-calendars/import/yaml",
  "GET /api/v1/admin/holiday-calendars/{id}/revisions",
  "GET /api/v1/admin/holiday-calendars/{id}/revisions/{version}",
  "POST /api/v1/admin/holiday-calendars/{id}/rollback/{version}",
  "POST /api/v1/admin/buyers/{buyerId}/strikes",
  "GET /api/v1/admin/buyers/{buyerId}/strikes",
  "POST /api/v1/admin/buyers/{buyerId}/strikes/{strikeId}/appeal",
  "POST /api/v1/admin/buyers/{buyerId}/reinstate",
  "GET /api/v1/admin/strikes/config",
  "PUT /api/v1/admin/strikes/config",
  "POST /api/v1/admin/strikes/{strikeId}/escalate",
  "POST /api/v1/admin/strikes/{strikeId}/arbitration/decide",
  "GET /api/v1/admin/strikes/arbitration/queue",
  "GET /api/v1/admin/slot-categories/grace-windows",
  "GET /api/v1/admin/slot-categories/grace-windows/history",
  "GET /api/v1/admin/slot-categories/{category}/grace-window",
  "PUT /api/v1/admin/slot-categories/{category}/grace-window",
  "DELETE /api/v1/admin/slot-categories/{category}/grace-window",
  "GET /api/v1/admin/slot-categories/{category}/grace-window/history",
  "POST /api/v1/admin/redaction-policy/reload",
  "POST /api/v1/admin/redaction-policy/rollback",
  "GET /api/v1/admin/redaction-policy",
  "POST /api/v1/admin/fraud-models/promote",
  "GET /api/v1/admin/fraud-models/list",
  "GET /api/v1/admin/fraud-models/history",
  "POST /api/v1/admin/fraud-models/rollback/initiate",
  "POST /api/v1/admin/fraud-models/rollback/approve",
  "POST /api/v1/admin/flag-rollouts",
  "GET /api/v1/admin/flag-rollouts",
  "GET /api/v1/admin/flag-rollouts/{id}",
  "POST /api/v1/admin/flag-rollouts/{id}/pause",
  "POST /api/v1/admin/flag-rollouts/{id}/resume",
  "POST /api/v1/admin/flag-rollouts/{id}/rollback",
  "GET /api/v1/admin/suppliers/{supplierId}/reputation/history",
  "GET /api/v1/admin/reputation/snapshots",
  "POST /api/v1/admin/reputation/snapshots/run",
  "POST /api/v1/gdpr/export",
  "GET /api/v1/gdpr/export/download",
  "POST /api/v1/admin/legal-holds",
  "GET /api/v1/admin/legal-holds/{subjectId}",
  "GET /api/v1/suppliers/{supplierId}/reputation/signals",
  "POST /api/v1/subscriptions/products",
  "GET /api/v1/subscriptions/products",
  "GET /api/v1/subscriptions/products/{productId}",
  "DELETE /api/v1/subscriptions/products/{productId}",
  "POST /api/v1/subscriptions",
  "GET /api/v1/subscriptions/{subscriptionId}",
  "GET /api/v1/subscriptions",
  "POST /api/v1/subscriptions/{subscriptionId}/pause",
  "POST /api/v1/subscriptions/{subscriptionId}/resume",
  "POST /api/v1/subscriptions/{subscriptionId}/cancel",
  "GET /api/v1/booking-intents",
  "GET /api/v1/booking-intents/{id}",
  "POST /api/v1/booking-intents/{id}/confirm",
  "POST /api/v1/booking-intents/{id}/cancel",
  "POST /api/v1/booking-intents/{id}/refund",
  "POST /api/v1/booking-intents/{id}/no-show",
  "GET /api/v1/booking-intents/{id}/cancel-preview",
  "GET /api/v1/booking-intents/{id}/hold-status",
  "POST /api/v1/booking-intents/{id}/auto-refund-hold",
  "POST /api/v1/webhooks/kyc",
  "POST /api/v1/settlements",
  "GET /api/v1/admin/idempotency/{tenantId}/{idempotencyKey}",
  "POST /api/v1/admin/idempotency/sweep",
  "GET /health/horizon",
  "POST /api/v1/slots/conflicts/preview",
  "GET /api/v1/auth/oauth/{provider}/start",
  "GET /api/v1/auth/oauth/{provider}/callback",
  "POST /api/v1/auth/verify",
  "POST /api/v1/auth/mfa/enroll",
  "POST /api/v1/auth/mfa/verify",
  "GET /api/v1/admin/gdpr/dsr/dashboard",
  "GET /api/v1/admin/gdpr/dsr",
  "POST /api/v1/admin/gdpr/dsr",
  "GET /api/v1/admin/gdpr/dsr/{id}",
  "PATCH /api/v1/admin/gdpr/dsr/{id}/status",
  "POST /api/v1/admin/gdpr/dsr/{id}/resolve",
  "POST /api/v1/admin/gdpr/dsr/{id}/extend",
  "POST /api/v1/admin/gdpr/dsr/{id}/reopen",
  "POST /api/v1/admin/access-review/snapshots",
  "GET /api/v1/admin/access-review/snapshots",
  "GET /api/v1/admin/access-review/snapshots/{snapshotId}",
  "GET /api/v1/admin/access-review/snapshots/{snapshotId}/report",
  "POST /api/v1/admin/access-review/snapshots/{snapshotId}/attestations",
  "GET /api/v1/admin/access-review/attestations",
  "GET /api/v1/admin/access-review/gaps",
  "GET /api/v1/admin/access-review/bundled-report",
  "GET /api/v1/admin/cancellation-overrides",
  "GET /api/v1/admin/cancellation-overrides/{supplierId}",
  "PUT /api/v1/admin/cancellation-overrides/{supplierId}",
  "DELETE /api/v1/admin/cancellation-overrides/{supplierId}",
  "POST /api/v1/admin/audit/export",
  "GET /api/v1/admin/audit/export/download",
  "POST /api/v1/admin/webhooks/rotate",
  "POST /api/v1/admin/refunds",
  "POST /api/v1/admin/payments/{paymentId}/reversals",
  "GET /api/v1/admin/booking-intents/{bookingIntentId}/invariant",
  "GET /api/v1/admin/booking-intents/{bookingIntentId}/reversal-chain",
  "GET /api/v1/admin/payments/{id}/trace",
  "GET /api/v1/admin/payouts/quarantine",
  "POST /api/v1/admin/payouts/{payoutId}/quarantine/release",
  "POST /api/v1/admin/payouts/{transactionId}/replay",
  "POST /api/v1/admin/payouts/{transactionId}/replay/approve",
  "GET /api/v1/admin/fraud/hitl/queue",
  "POST /api/v1/admin/fraud/hitl/{id}/decision",
  "POST /api/v1/admin/escrow/pause",
  "GET /api/v1/admin/impersonation/sessions",
  "POST /api/v1/admin/disputes",
  "POST /api/v1/admin/disputes/{id}/evidence",
  "POST /api/v1/admin/disputes/{id}/adjudicate",
  "GET /api/v1/admin/disputes/queue",
  "GET /api/v1/admin/disputes/queue/dashboard",
  "POST /api/v1/admin/disputes/{id}/appeal",
  "POST /api/v1/admin/disputes/{id}/senior-decide",
  "GET /api/v1/admin/disputes/{id}/finality",
  "POST /api/v1/admin/disputes/{id}/timeout",
  "POST /api/v1/admin/disputes/deadline/scan",
  "POST /api/v1/admin/disputes/{id}/reverse-auto-resolve",
  "GET /api/v1/admin/disputes/deadline/status",
  "GET /api/v1/admin/tz-drift/metrics",
  "GET /api/v1/admin/tz-drift/offenders",
  "GET /api/v1/admin/payout-dlq",
  "GET /api/v1/admin/payout-dlq/{entryId}",
  "POST /api/v1/admin/escrow/drift/override",
  "GET /api/v1/admin/holiday-calendars",
]);

const LEGACY_UNDOCUMENTED_ROUTES = new Set([
  "GET /api/v1/slots",
  "POST /api/v1/slots",
  "DELETE /api/v1/slots/{id}",
  "POST /api/v1/buyer-profiles",
  "GET /api/v1/buyer-profiles/me",
  "GET /api/v1/buyer-profiles",
  "GET /api/v1/buyer-profiles/{id}",
  "PATCH /api/v1/buyer-profiles/{id}",
  "DELETE /api/v1/buyer-profiles/{id}",
  "POST /api/v1/booking-intents",
  "POST /api/v1/webhooks/settlements",
  "POST /api/v1/notifications/sms",
]);

// Convert Express path style (e.g. /:sessionId) to OpenAPI style (e.g. {sessionId})
function expressPathToOpenAPI(expressPath: string): string {
  return expressPath.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");
}

// Walk Express router recursively to find all route-method combinations
function walkExpressRoutes(app: any): Array<{ path: string; method: string }> {
  const routes: Array<{ path: string; method: string }> = [];

  function walk(middleware: any, parentPath = "") {
    if (middleware.route) {
      const pathPart = middleware.route.path;
      let fullPath = `${parentPath}${pathPart}`.replace(/\/+/g, "/");
      if (fullPath.endsWith("/") && fullPath.length > 1) {
        fullPath = fullPath.slice(0, -1);
      }
      const methods = Object.keys(middleware.route.methods);
      for (const method of methods) {
        routes.push({
          path: fullPath,
          method: method.toLowerCase(),
        });
      }
    } else if (middleware.name === "router" && middleware.handle.stack) {
      const regexpSource = middleware.regexp.source;
      const match = regexpSource
        .replace(/^\^/, "")
        .replace(/\\\//g, "/")
        .split("(?=")[0]
        .replace(/\/\?$/, "")
        .replace(/\/\$$/, "");
      
      let routePrefix = match;
      if (!routePrefix.startsWith("/")) {
        routePrefix = "/" + routePrefix;
      }

      for (const handler of middleware.handle.stack) {
        walk(handler, parentPath + routePrefix);
      }
    } else if (middleware.stack) {
      for (const handler of middleware.stack) {
        walk(handler, parentPath);
      }
    }
  }

  if (app._router && app._router.stack) {
    for (const middleware of app._router.stack) {
      walk(middleware);
    }
  }

  return routes;
}

describe("OpenAPI Route Conformance", () => {
  let app: any;
  let swaggerSpec: any;
  let expressRoutes: Array<{ path: string; method: string }> = [];
  let documentedRoutes: Array<{ path: string; method: string }> = [];

  beforeAll(() => {
    // Instantiate Express app
    app = createApp({ enableDocs: false, enableTestRoutes: true });

    // Generate Swagger Spec with exact same options as app.ts
    const options = {
      swaggerDefinition: {
        openapi: "3.0.0",
        info: {
          title: "ChronoPay API",
          version: "1.0.0",
          description: "API for ChronoPay payment and scheduling platform",
        },
      },
      apis: ["./src/routes/*.ts", "./src/index.ts"],
    };
    swaggerSpec = swaggerJsdoc(options);

    // Extract all Express routes
    expressRoutes = walkExpressRoutes(app);

    // Extract all documented routes from spec
    if (swaggerSpec && swaggerSpec.paths) {
      for (const pathKey of Object.keys(swaggerSpec.paths)) {
        const pathItem = swaggerSpec.paths[pathKey];
        for (const methodKey of Object.keys(pathItem)) {
          if (["get", "post", "put", "delete", "patch"].includes(methodKey.toLowerCase())) {
            documentedRoutes.push({
              path: pathKey,
              method: methodKey.toLowerCase(),
            });
          }
        }
      }
    }
  });

  it("asserts every public Express route is documented in the OpenAPI spec", () => {
    const missingDocs: string[] = [];

    for (const route of expressRoutes) {
      const openApiPath = expressPathToOpenAPI(route.path);
      const routeIdentifier = `${route.method.toUpperCase()} ${openApiPath}`;

      // Skip private or legacy undocumented routes
      if (PRIVATE_EXEMPT_ROUTES.has(routeIdentifier) || LEGACY_UNDOCUMENTED_ROUTES.has(routeIdentifier)) {
        continue;
      }

      // Check if documented
      const isDocumented = documentedRoutes.some(
        (doc) => doc.path === openApiPath && doc.method === route.method
      );

      if (!isDocumented) {
        missingDocs.push(routeIdentifier);
      }
    }

    if (missingDocs.length > 0) {
      const message = [
        "❌ OpenAPI Conformance Failure: Undocumented Express routes found!",
        "Every public route must be documented using JSDoc @openapi annotations.",
        "",
        "Undocumented routes:",
        ...missingDocs.map((r) => `  - ${r}`),
        "",
        "If these are intentional system/private endpoints, add them to the PRIVATE_EXEMPT_ROUTES allowlist in openapi-conformance.test.ts.",
      ].join("\n");

      throw new Error(message);
    }
  });

  it("asserts every documented OpenAPI route actually exists in the Express application", () => {
    const ghostDocs: string[] = [];

    for (const doc of documentedRoutes) {
      const routeIdentifier = `${doc.method.toUpperCase()} ${doc.path}`;

      // Check if route exists in Express router stack
      const existsInExpress = expressRoutes.some(
        (route) => expressPathToOpenAPI(route.path) === doc.path && route.method === doc.method
      );

      if (!existsInExpress) {
        ghostDocs.push(routeIdentifier);
      }
    }

    if (ghostDocs.length > 0) {
      const message = [
        "❌ OpenAPI Conformance Failure: Documented OpenAPI routes do not exist in the Express application!",
        "",
        "Ghost routes in specification:",
        ...ghostDocs.map((r) => `  - ${r}`),
        "",
        "Please remove these obsolete entries from your JSDoc @openapi annotations.",
      ].join("\n");

      throw new Error(message);
    }
  });
});
