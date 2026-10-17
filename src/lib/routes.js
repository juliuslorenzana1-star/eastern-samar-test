// Match the dedicated static entry both locally and under a Pages project path.
export function isOperationsPath(pathname, base = '/') {
  const prefix = base.replace(/\/+$/, '');
  return pathname.replace(/\/+$/, '') === `${prefix}/operations`;
}
