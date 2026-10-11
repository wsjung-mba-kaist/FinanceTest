import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

type PropsOf<T> = T extends ComponentType<infer P> ? P : never

/**
 * `React.lazy` for a *named* export, typed from the module it loads. The static import graph
 * does not distinguish "might be needed" from "needed now": the help sheet can open on every
 * screen, so its six tabs — and the engine, the knowledge cards and the markdown renderer under
 * them — rode into the first chunk of every route. A lazy boundary at each tab, chart and sheet
 * means a visitor downloads what the path they actually take needs.
 */
export function lazyNamed<M extends object, K extends keyof M>(
  load: () => Promise<M>,
  name: K,
): LazyExoticComponent<ComponentType<PropsOf<M[K]>>> {
  return lazy(() =>
    load().then((m) => {
      const component = m[name]
      if (!component) throw new Error(`lazyNamed: ${String(name)} is not exported by the module`)
      return { default: component as ComponentType<PropsOf<M[K]>> }
    }),
  )
}
