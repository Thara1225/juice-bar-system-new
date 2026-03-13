import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import CashierPage from "./pages/CashierPage";
import KitchenPage from "./pages/KitchenPage";
import DisplayPage from "./pages/DisplayPage";

function App() {
  return (
    <BrowserRouter>
      <div style={{ padding: "16px", display: "flex", gap: "16px", borderBottom: "1px solid #ccc" }}>
        <Link to="/cashier">Cashier</Link>
        <Link to="/kitchen">Kitchen</Link>
        <Link to="/display">Display</Link>
      </div>

      <Routes>
        <Route path="/" element={<Navigate to="/cashier" replace />} />
        <Route path="/cashier" element={<CashierPage />} />
        <Route path="/kitchen" element={<KitchenPage />} />
        <Route path="/display" element={<DisplayPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;