export type ErrorCode =
  | "INVALID_PARAMS"
  | "SSRF_BLOCKED"
  | "RATE_LIMITED"
  | "RENDER_FAILED"
  | "TIMEOUT_EXCEEDED"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "PAYMENT_REQUIRED";

export class ScreenshotError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(message: string, code: ErrorCode, statusCode: number, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}

export class InvalidParamsError extends ScreenshotError {
  constructor(message: string, details?: unknown) {
    super(message, "INVALID_PARAMS", 400, details);
  }
}

export class SSRFBlockedError extends ScreenshotError {
  constructor(message = "The requested URL is blocked for security reasons") {
    super(message, "SSRF_BLOCKED", 400);
  }
}

export class RateLimitedError extends ScreenshotError {
  constructor(message = "Rate limit exceeded", retryAfterSeconds = 60) {
    super(message, "RATE_LIMITED", 429, { retry_after_seconds: retryAfterSeconds });
  }
}

export class RenderFailedError extends ScreenshotError {
  constructor(message: string, details?: unknown) {
    super(message, "RENDER_FAILED", 500, details);
  }
}

export class TimeoutExceededError extends ScreenshotError {
  constructor(message = "The request timed out while rendering") {
    super(message, "TIMEOUT_EXCEEDED", 504);
  }
}

export class NotFoundError extends ScreenshotError {
  constructor(message = "Resource not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export class UnauthorizedError extends ScreenshotError {
  constructor(message = "Invalid or missing API key") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class PaymentRequiredError extends ScreenshotError {
  constructor(message = "Quota exceeded. Please upgrade your plan.") {
    super(message, "PAYMENT_REQUIRED", 402);
  }
}
