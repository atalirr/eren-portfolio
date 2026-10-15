/**
 * React Router Configuration
 */

import { createHashRouter as createBrowserRouter, RouterProvider, useRouteError, isRouteErrorResponse, Link, Navigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { LoginPage } from '../features/auth/components/LoginPage';
import { SalesPage } from '../features/sales/components/SalesPage';
import { InventoryPage } from '../features/inventory/components/InventoryPage';
import { CashAndFinancePage } from '../features/finance/components/CashAndFinancePage';
import { ReportsPage } from '../features/reports/components/ReportsPage';
import { SettingsPage } from '../features/settings/components/SettingsPage';
import { InvoicePage } from '../features/invoices/components/InvoicePage';
import { EcommercePage } from '../features/ecommerce/EcommercePage';
import { PersonnelPage } from '../features/personnel/components/PersonnelPage';
import { CustomerStaffPage } from '../features/customers/components/CustomerStaffPage';
import { DashboardPage } from '../features/dashboard/components/DashboardPage';
import { SuppliersView } from '../features/suppliers/components/SuppliersView';

// Error component for better UX
function ErrorBoundary() {
  const error = useRouteError();
  
  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center bg-white rounded-xl shadow-lg p-8 max-w-md">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{error.status}</h1>
          <p className="text-slate-500 mb-4">{error.statusText || 'Sayfa Bulunamadı'}</p>
          <Link to="/" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center bg-white rounded-xl shadow-lg p-8 max-w-md">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Bir Hata Oluştu</h1>
        <p className="text-slate-500 mb-4">Sayfa yüklenirken bir sorun oluştu.</p>
        <Link to="/" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}

// Routes tanımları
const router = createBrowserRouter([
    // Giriş sayfası (Layout dışında, herkese açık)
    {
      path: '/login',
      element: <LoginPage />,
    },
    {
      path: '/',
      element: <MainLayout />,
      errorElement: <ErrorBoundary />,
      children: [
        {
          index: true,
          element: <Navigate to="/sales" replace />,
        },
        {
          path: 'dashboard',
          element: <DashboardPage />,
        },
        {
          path: 'sales',
          element: <SalesPage />,
        },
        {
          path: 'inventory',
          element: <InventoryPage />,
        },
        {
          path: 'transactions',
          element: <CashAndFinancePage />,
        },
        {
          path: 'reports',
          element: <CashAndFinancePage />,
        },
        {
          path: 'settings',
          element: <SettingsPage />,
        },
        {
          path: 'invoices',
          element: <InvoicePage />,
        },
        {
          path: 'suppliers',
          element: <SuppliersView />,
        },
        {
          path: 'ecommerce',
          element: <EcommercePage />,
        },
        {
          path: 'personnel',
          element: <PersonnelPage />,
        },
        {
          path: 'customers-staff',
          element: <CustomerStaffPage />,
        },
      ],
    },
  ]
);

export function AppRouter() {
  // React Router v7 geçiş uyarısını susturmak için future flag'i burada açıyoruz
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}

