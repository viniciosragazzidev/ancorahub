export function RouteViewTransition({ children }: { children: React.ReactNode }) {
  // React ViewTransition wraps every App Router navigation. In production this
  // can cancel concurrent RSC requests, leaving the route-level loading UI
  // mounted indefinitely. Keep motion local to controls and overlays until the
  // experimental integration is stable for streamed routes.
  return children;
}
