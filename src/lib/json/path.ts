export type PathSeg = string | number

/** Canonical, collision-free key used to index nodes by path. */
export function pathKey(path: PathSeg[]): string {
  let out = '$'
  for (const seg of path) {
    out += typeof seg === 'number' ? '#' + seg : '.' + seg
  }
  return out
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** Human-readable path, e.g. `user.age`, `items[3].id`, `["odd key"]`. */
export function pathLabel(path: PathSeg[]): string {
  if (path.length === 0) return '(root)'
  let out = ''
  for (const seg of path) {
    if (typeof seg === 'number') out += '[' + seg + ']'
    else if (IDENT.test(seg)) out += (out ? '.' : '') + seg
    else out += '[' + JSON.stringify(seg) + ']'
  }
  return out
}
