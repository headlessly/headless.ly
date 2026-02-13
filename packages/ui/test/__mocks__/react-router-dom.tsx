/**
 * Stub mock for react-router-dom — required by @mdxui/admin layout/admin components.
 * Our @headlessly/ui components don't use routing; this just prevents import failures.
 */
import * as React from 'react'

export const BrowserRouter = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const MemoryRouter = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const Routes = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const Route = () => null
export const Navigate = () => null
export const Link = ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
  <a href={to} {...props}>{children}</a>
)
export const NavLink = Link
export const useNavigate = () => () => {}
export const useLocation = () => ({ pathname: '/', search: '', hash: '', state: null, key: 'default' })
export const useParams = () => ({})
export const Outlet = () => null
