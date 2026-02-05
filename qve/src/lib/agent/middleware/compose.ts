/**
 * Middleware Composition Utilities
 *
 * Provides functions to compose multiple middleware into a single chain.
 */

import type { Middleware, ActionHandler } from './types';

/**
 * Compose multiple middleware functions into a single middleware.
 * Middleware is applied right-to-left (last middleware wraps first).
 *
 * @example
 * const composed = compose(
 *   withErrorHandling,
 *   withRetryTracking,
 *   withValidation
 * );
 * // Execution order: validation → retry tracking → error handling → handler
 *
 * @param middlewares - Middleware functions to compose
 * @returns A single middleware that applies all provided middleware
 */
export function compose(...middlewares: Middleware[]): Middleware {
  if (middlewares.length === 0) {
    return (handler) => handler;
  }

  if (middlewares.length === 1) {
    return middlewares[0];
  }

  return (handler) =>
    middlewares.reduceRight(
      (wrappedHandler, middleware) => middleware(wrappedHandler),
      handler
    );
}

/**
 * Apply middleware to a handler, returning the wrapped handler.
 *
 * @example
 * const wrappedHandler = applyMiddleware(
 *   myHandler,
 *   withErrorHandling,
 *   withValidation
 * );
 *
 * @param handler - The base handler to wrap
 * @param middlewares - Middleware to apply
 * @returns The wrapped handler
 */
export function applyMiddleware(
  handler: ActionHandler,
  ...middlewares: Middleware[]
): ActionHandler {
  const composed = compose(...middlewares);
  return composed(handler);
}

/**
 * Create a middleware pipeline that can be extended.
 *
 * @example
 * const pipeline = createPipeline()
 *   .use(withErrorHandling)
 *   .use(withValidation)
 *   .build();
 *
 * const wrappedHandler = pipeline(myHandler);
 */
export function createPipeline(): MiddlewarePipeline {
  return new MiddlewarePipeline();
}

class MiddlewarePipeline {
  private middlewares: Middleware[] = [];

  /**
   * Add middleware to the pipeline.
   * Middleware is applied in the order added (first added = outermost wrapper).
   */
  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Build the composed middleware.
   */
  build(): Middleware {
    // Reverse so first added is outermost (applied last in reduceRight)
    return compose(...this.middlewares);
  }

  /**
   * Apply the pipeline to a handler.
   */
  apply(handler: ActionHandler): ActionHandler {
    return this.build()(handler);
  }
}
