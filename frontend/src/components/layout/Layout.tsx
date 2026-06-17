/**
 * Layout Component
 * Wraps authenticated pages with Sidebar + Header + main content area.
 */
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  return (
    <div className="min-h-screen bg-surface-900 text-slate-100">
      <Sidebar />
      <div className="ml-64 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
