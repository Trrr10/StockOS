import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './context/AuthContext'
import LoadingScreen             from './pages/LoadingScreen'
import LoginPage                 from './pages/LoginPage'
import HomePage                  from './pages/HomePage'
import InventoryLayout           from './components/layout/InventoryLayout'
import ProcurementLayout         from './components/layout/ProcurementLayout'
import SalesLayout               from './components/layout/SalesLayout'
import AdminLayout               from './components/layout/AdminLayout'
import InventoryDashboard        from './pages/inventory/InventoryDashboard'
import ProductsPage              from './pages/inventory/ProductsPage'
import StockAdjustmentPage       from './pages/inventory/StockAdjustmentPage'
import AuditTrailPage            from './pages/inventory/AuditTrailPage'
import GroupChatPage             from './pages/inventory/GroupChatPage'
import BarcodeGenerator          from './pages/inventory/Barcodegenerator'
import BarcodeScanner            from './pages/inventory/BarCodeScanner'
import AnonymousReportPage       from './pages/inventory/AnonymousReportPage'
import AiAssistantPage           from './pages/inventory/AiAssistantPage'
import TrafficLightPanel         from './pages/inventory/TrafficLightPanel'
import DemandForecast            from './pages/inventory/DemandForecast'
import ProcurementDashboard      from './pages/procurement/ProcurementDashboard'
import PurchaseOrders            from './pages/procurement/PurchaseOrders'
import Suppliers                 from './pages/procurement/Suppliers'
import AutoGeneratePO            from './pages/procurement/AutoGeneratePo'
import SalesManagerDashboard     from './pages/salesdispatch/SalesManagerDashboard'
import Manufacturing             from './pages/salesdispatch/Manufacturing'
import Orders                    from './pages/salesdispatch/Orders'
import TrackingMap               from './pages/salesdispatch/TrackingMap'
import Dashboard                 from './pages/admin/Dashboard'
import Broadcast                 from './pages/admin/Broadcast'
import AnonymousReports          from './pages/admin/AnonymousReports'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user)   return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ session, profile, onLogout }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user)   return <Navigate to="/login" replace />
  return <AdminLayout session={session} profile={profile} onLogout={onLogout} />
}

export default function App() {
  const { session, profile, handleLogout } = useAuth()

  return (
    <>
      <Toaster
        position="bottom-right"
        gutter={8}
        toastOptions={{
          duration: 3500,
          style: {
            background: '#12131f',
            color: '#e2e8f0',
            border: '1px solid rgba(126,255,212,0.15)',
            borderRadius: '12px',
            fontSize: '13px',
            fontFamily: 'DM Sans, sans-serif',
          },
          success: { iconTheme: { primary: '#7effd4', secondary: '#07080f' } },
          error:   { iconTheme: { primary: '#ff4d6d', secondary: '#07080f' } },
        }}
      />

      <Routes>
        <Route path="/"      element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* ── Admin ── */}
        <Route path="/admin" element={
          <AdminRoute session={session} profile={profile} onLogout={handleLogout} />
        }>
          <Route index                      element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"           element={<Dashboard />} />
          <Route path="broadcast"           element={<Broadcast />} />
          <Route path="anonymous-reports"   element={<AnonymousReports />} />
        </Route>

        {/* ── Inventory ── */}
        <Route path="/inventory" element={
          <ProtectedRoute>
            <InventoryLayout />
          </ProtectedRoute>
        }>
          <Route index                    element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"         element={<InventoryDashboard />} />
          <Route path="products"          element={<ProductsPage />} />
          <Route path="adjustments"       element={<StockAdjustmentPage />} />
          <Route path="barcode-generator" element={<BarcodeGenerator />} />
          <Route path="barcode"           element={<BarcodeScanner />} />
          <Route path="audit"             element={<AuditTrailPage />} />
          <Route path="chat"              element={<GroupChatPage />} />
          <Route path="ai"                element={<AiAssistantPage />} />
          <Route path="report"            element={<AnonymousReportPage />} />
          <Route path="traffic-lights"    element={<TrafficLightPanel />} />
          <Route path="demand-forecast"   element={<DemandForecast />} />
        </Route>

        {/* ── Procurement ── */}
        <Route path="/procurement" element={
          <ProtectedRoute>
            <ProcurementLayout />
          </ProtectedRoute>
        }>
          <Route index                      element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"           element={<ProcurementDashboard />} />
          <Route path="purchase-orders"     element={<PurchaseOrders />} />
          <Route path="purchase-orders/:id" element={<PurchaseOrders />} />
          <Route path="suppliers"           element={<Suppliers />} />
          <Route path="auto-generate"       element={<AutoGeneratePO />} />
        </Route>

        {/* ── Sales & Dispatch ── */}
        <Route path="/sales" element={
          <ProtectedRoute>
            <SalesLayout />
          </ProtectedRoute>
        }>
          <Route index                element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"     element={<SalesManagerDashboard />} />
          <Route path="orders"        element={<Orders />} />
          <Route path="manufacturing" element={<Manufacturing />} />
          <Route path="tracking"      element={<TrackingMap />} />
        </Route>

        {/* ── Legacy redirects ── */}
        <Route path="/procurement-dashboard"      element={<Navigate to="/procurement/dashboard" replace />} />
        <Route path="/inventory/manufacturing"    element={<Navigate to="/sales/manufacturing"   replace />} />
        <Route path="/inventory/orders"           element={<Navigate to="/sales/orders"          replace />} />
        <Route path="/inventory/tracking-map"     element={<Navigate to="/sales/tracking"        replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}