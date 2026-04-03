import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import CashierPage from "./pages/CashierPage";
import KitchenPage from "./pages/KitchenPage";
import DisplayPage from "./pages/DisplayPage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import api from "./services/api";
import CompanyFooter from "./components/CompanyFooter";
import "./App.css";
  

function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("authToken");
    const userRaw = localStorage.getItem("authUser");

    if (!token || !userRaw) {
      return null;
    }

    try {
      return {
        token,
        user: JSON.parse(userRaw),
      };
    } catch {
      return null;
    }
  });

  const [businessSettings, setBusinessSettings] = useState({
    business_name: "Juice Bar",
    logo_url: "",
    contact_number: "",
    address: "",
  });

  const allNavItems = [
    { to: "/cashier", label: "Cashier", roles: ["cashier", "admin"] },
    { to: "/kitchen", label: "Kitchen", roles: ["kitchen", "admin"] },
    { to: "/display", label: "Display", roles: ["display", "admin"] },
    { to: "/admin", label: "Admin", roles: ["admin"] },
  ];

  const userRole = auth?.user?.role || null;
  const navItems = allNavItems.filter((item) => userRole && item.roles.includes(userRole));

  useEffect(() => {
    const fetchBusinessSettings = async () => {
      try {
        const res = await api.get("/settings");
        setBusinessSettings((prev) => ({ ...prev, ...(res.data || {}) }));
      } catch (err) {
        console.error("Failed to load business settings:", err);
      }
    };

    fetchBusinessSettings();
  }, []);

  const handleLogin = (payload) => {
    localStorage.setItem("authToken", payload.token);
    localStorage.setItem("authUser", JSON.stringify(payload.user));
    setAuth(payload);
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    setAuth(null);
  };

  const homeRouteByRole = {
    admin: "/admin",
    cashier: "/cashier",
    kitchen: "/kitchen",
    display: "/display",
  };

  const defaultRoute = userRole ? homeRouteByRole[userRole] : "/login";

  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-inner">
            <div className="app-header-top">
              <div className="app-brand">
                <p className="app-eyebrow">{businessSettings.business_name} System</p>
                <div className="app-brand-main">
                  {businessSettings.logo_url && (
                    <img
                      src={businessSettings.logo_url}
                      alt={`${businessSettings.business_name} logo`}
                      className="brand-logo"
                    />
                  )}
                  <div className="app-brand-copy">
                    <h1>Operations Dashboard</h1>
                    <p className="mini-row">Fast service control for cashier, kitchen, display, and admin.</p>
                  </div>
                </div>
              </div>

              <div className="header-business-details" aria-label="Business details">
                <p><strong>Contact:</strong> {businessSettings.contact_number || "Not set"}</p>
                <p><strong>Address:</strong> {businessSettings.address || "Address not set"}</p>
              </div>
            </div>

            {auth ? (
              <>
                <nav className="app-nav" aria-label="Main navigation">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        isActive ? "app-nav-link is-active" : "app-nav-link"
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>

                <div className="auth-strip" style={{ marginTop: "12px" }}>
                  <span className="mini-row">Signed in as: {auth.user.username} ({auth.user.role})</span>
                  <button className="btn btn-soft" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to={defaultRoute} replace />} />
            <Route
              path="/login"
              element={auth ? <Navigate to={defaultRoute} replace /> : <LoginPage onLogin={handleLogin} />}
            />
            <Route
              path="/cashier"
              element={auth && ["cashier", "admin"].includes(userRole) ? <CashierPage /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/kitchen"
              element={auth && ["kitchen", "admin"].includes(userRole) ? <KitchenPage /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/display"
              element={auth && ["display", "admin"].includes(userRole) ? <DisplayPage /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/admin"
              element={auth && userRole === "admin" ? <AdminPage /> : <Navigate to="/login" replace />}
            />
          </Routes>
        </main>

        <CompanyFooter />
      </div>
    </BrowserRouter>
  );
}

export default App;