// Same origin as the Pages site once pit.ink is bound — Worker route
// pit.ink/api/* serves the API, Pages serves /p/* and static assets.
export const SHARE_API = import.meta.env.VITE_SHARE_API ?? 'https://pit.ink'
