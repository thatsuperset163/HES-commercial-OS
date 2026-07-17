import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SalesProvider } from './store/SalesContext'
import { Layout } from './components/Layout'
import { Today } from './pages/Today'
import { Pipeline } from './pages/Pipeline'
import { Prospects } from './pages/Prospects'
import { ProspectDetail } from './pages/ProspectDetail'
import { Emails } from './pages/Emails'
import { Analytics } from './pages/Analytics'

export default function App() {
  return (
    <SalesProvider>
      <BrowserRouter basename="/work/sales">
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Today />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="prospects" element={<Prospects />} />
            <Route path="prospects/:id" element={<ProspectDetail />} />
            <Route path="emails" element={<Emails />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SalesProvider>
  )
}
