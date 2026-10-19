// Mobile keyboards, restored tabs, and hidden containers can change Leaflet's
// viewport without a window resize. Wait for a usable size before fitting.
export function observeMapViewport(map, bounds, environment = window) {
  const container = map.getContainer();
  let frame;
  let fitted = false;
  let stopped = false;
  const refresh = () => {
    environment.cancelAnimationFrame(frame);
    frame = environment.requestAnimationFrame(() => {
      if (stopped || !container.clientWidth || !container.clientHeight) return;
      map.invalidateSize({ animate: false, pan: true, debounceMoveend: true });
      if (!fitted) {
        map.fitBounds(bounds, { padding: [18, 18], animate: false });
        fitted = true;
      }
    });
  };
  const observer = environment.ResizeObserver ? new environment.ResizeObserver(refresh) : null;
  observer?.observe(container);
  environment.addEventListener('resize', refresh);
  environment.addEventListener('pageshow', refresh);
  environment.visualViewport?.addEventListener('resize', refresh);
  environment.document.addEventListener('visibilitychange', refresh);
  refresh();
  return () => {
    stopped = true;
    observer?.disconnect();
    environment.cancelAnimationFrame(frame);
    environment.removeEventListener('resize', refresh);
    environment.removeEventListener('pageshow', refresh);
    environment.visualViewport?.removeEventListener('resize', refresh);
    environment.document.removeEventListener('visibilitychange', refresh);
  };
}
