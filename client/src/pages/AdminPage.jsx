import { useEffect, useState } from "react";
import api from "../services/api";

function AdminPage() {
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loyaltyLeaderboard, setLoyaltyLeaderboard] = useState([]);
  const [messages, setMessages] = useState([]);
  const [cashierKitchenAssistEnabled, setCashierKitchenAssistEnabled] = useState(false);
  const [updatingMode, setUpdatingMode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedLogoName, setSelectedLogoName] = useState("");
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [showDailySales, setShowDailySales] = useState(false);
  const [showMonthlySales, setShowMonthlySales] = useState(false);
  const [showLoyaltyLeaderboard, setShowLoyaltyLeaderboard] = useState(false);
  const [orderFilters, setOrderFilters] = useState({
    status: "",
    phone: "",
    token: "",
    from: "",
    to: "",
  });
  const [salesSummary, setSalesSummary] = useState({ daily: [], monthly: [] });
  const [promoCodes, setPromoCodes] = useState([]);
  const [users, setUsers] = useState([]);
  const [backups, setBackups] = useState([]);
  const [promoForm, setPromoForm] = useState({
    code: "",
    discount_type: "percentage",
    discount_value: "",
    min_order_amount: "",
  });
  const [userForm, setUserForm] = useState({
    username: "",
    password: "",
    role: "cashier",
  });

  const [businessSettings, setBusinessSettings] = useState({
    business_name: "",
    logo_url: "",
    contact_number: "",
    address: "",
  });

  const [messageForm, setMessageForm] = useState({
    content: "",
    audience: "all",
  });

  const [form, setForm] = useState({
    name: "",
    price: "",
    category: "",
    is_available: true,
  });

  const [editingId, setEditingId] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        menuRes,
        ordersRes,
        modeRes,
        settingsRes,
        leaderboardRes,
        messagesRes,
        summaryRes,
        promoRes,
        usersRes,
        backupsRes,
      ] = await Promise.all([
        api.get("/menu-items", { params: { include_unavailable: true } }),
        api.get("/orders", { params: orderFilters }),
        api.get("/orders/kitchen-assist-mode"),
        api.get("/settings"),
        api.get("/loyalty/leaderboard"),
        api.get("/messages", { params: { audience: "admin" } }),
        api.get("/orders/summary", { params: orderFilters }),
        api.get("/promotions/codes"),
        api.get("/users"),
        api.get("/backups"),
      ]);

      setMenuItems(menuRes.data);
      setOrders(ordersRes.data || []);
      setCashierKitchenAssistEnabled(Boolean(modeRes.data?.enabled));
      setBusinessSettings({
        business_name: settingsRes.data?.business_name || "",
        logo_url: settingsRes.data?.logo_url || "",
        contact_number: settingsRes.data?.contact_number || "",
        address: settingsRes.data?.address || "",
      });
      setSelectedLogoName("");
      setLoyaltyLeaderboard(leaderboardRes.data || []);
      setMessages(messagesRes.data || []);
      setSalesSummary(summaryRes.data || { daily: [], monthly: [] });
      setPromoCodes(promoRes.data || []);
      setUsers(usersRes.data || []);
      setBackups(backupsRes.data || []);
    } catch (err) {
      setError("Failed to load admin data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const applyOrderFilters = async (e) => {
    e.preventDefault();
    fetchData();
  };

  const exportOrders = async (format) => {
    try {
      const response = await api.get("/orders/export", {
        params: { ...orderFilters, format },
        responseType: "blob",
      });

      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = format === "pdf" ? "orders-report.pdf" : "orders-report.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError("Failed to export orders");
      console.error(err);
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      price: "",
      category: "",
      is_available: true,
    });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setError("");

      if (!form.name || !form.price) {
        setError("Name and price are required");
        return;
      }

      if (editingId) {
        await api.put(`/menu-items/${editingId}`, {
          ...form,
          price: Number(form.price),
        });
      } else {
        await api.post("/menu-items", {
          ...form,
          price: Number(form.price),
        });
      }

      resetForm();
      fetchData();
    } catch (err) {
      setError("Failed to save menu item");
      console.error(err);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      price: item.price,
      category: item.category || "",
      is_available: item.is_available,
    });
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/menu-items/${id}`);
      fetchData();
    } catch (err) {
      setError("Failed to delete menu item");
      console.error(err);
    }
  };

  const toggleCashierKitchenAssist = async () => {
    try {
      setError("");
      setUpdatingMode(true);

      const nextEnabled = !cashierKitchenAssistEnabled;
      const res = await api.patch("/orders/kitchen-assist-mode", {
        enabled: nextEnabled,
      });

      setCashierKitchenAssistEnabled(Boolean(res.data?.enabled));
    } catch (err) {
      setError("Failed to update kitchen assist mode");
      console.error(err);
    } finally {
      setUpdatingMode(false);
    }
  };

  const saveBusinessSettings = async (e) => {
    e.preventDefault();

    try {
      setError("");
      setSavingSettings(true);

      await api.put("/settings", businessSettings);
      fetchData();
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to save business settings");
      console.error(err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogoFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload JPG, PNG, WEBP, or GIF image.");
      event.target.value = "";
      return;
    }

    const maxFileSize = 5 * 1024 * 1024;
    if (file.size > maxFileSize) {
      setError("Logo file is too large. Please use an image under 5MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setError("");
      setSelectedLogoName(file.name);
      setBusinessSettings((prev) => ({
        ...prev,
        logo_url: String(reader.result || ""),
      }));
    };

    reader.onerror = () => {
      setError("Failed to read logo file.");
    };

    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setSelectedLogoName("");
    setBusinessSettings((prev) => ({
      ...prev,
      logo_url: "",
    }));
  };

  const sendMessage = async (e) => {
    e.preventDefault();

    try {
      setError("");
      await api.post("/messages", messageForm);
      setMessageForm({ content: "", audience: "all" });
      fetchData();
    } catch (err) {
      setError("Failed to send message");
      console.error(err);
    }
  };

  const archiveMessage = async (id) => {
    try {
      await api.patch(`/messages/${id}/archive`);
      fetchData();
    } catch (err) {
      setError("Failed to archive message");
      console.error(err);
    }
  };

  const createPromoCode = async (e) => {
    e.preventDefault();

    try {
      await api.post("/promotions/codes", {
        ...promoForm,
        discount_value: Number(promoForm.discount_value),
        min_order_amount: Number(promoForm.min_order_amount || 0),
      });

      setPromoForm({ code: "", discount_type: "percentage", discount_value: "", min_order_amount: "" });
      fetchData();
    } catch (err) {
      setError("Failed to create promo code");
      console.error(err);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();

    try {
      await api.post("/users", userForm);
      setUserForm({ username: "", password: "", role: "cashier" });
      fetchData();
    } catch (err) {
      setError("Failed to create user");
      console.error(err);
    }
  };

  const updateUser = async (id, payload) => {
    try {
      await api.patch(`/users/${id}`, payload);
      fetchData();
    } catch (err) {
      setError("Failed to update user");
      console.error(err);
    }
  };

  const resetPassword = async (id) => {
    const newPassword = window.prompt("Enter new password");
    if (!newPassword) {
      return;
    }

    try {
      await api.patch(`/users/${id}/password`, { new_password: newPassword });
      fetchData();
    } catch (err) {
      setError("Failed to reset password");
      console.error(err);
    }
  };

  const runBackupNow = async () => {
    try {
      await api.post("/backups/run");
      fetchData();
    } catch (err) {
      setError("Failed to run backup");
      console.error(err);
    }
  };

  const restoreBackup = async (fileName) => {
    if (!window.confirm(`Restore from ${fileName}? This can overwrite existing data.`)) {
      return;
    }

    try {
      await api.post("/backups/restore", { file_name: fileName });
      fetchData();
    } catch (err) {
      setError("Failed to restore backup");
      console.error(err);
    }
  };

  const downloadBackup = async (fileName) => {
    try {
      const response = await api.get(`/backups/download/${encodeURIComponent(fileName)}`, {
        responseType: "blob",
      });

      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError("Failed to download backup");
      console.error(err);
    }
  };

  const deleteBackup = async (fileName) => {
    if (!window.confirm(`Delete backup ${fileName}? This cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/backups/file/${encodeURIComponent(fileName)}`);
      fetchData();
    } catch (err) {
      setError("Failed to delete backup");
      console.error(err);
    }
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <h2 className="screen-title">Admin Panel</h2>
        <p className="screen-subtitle">Manage menu items and monitor all orders from one place.</p>
      </header>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {loading ? (
        <p>Loading admin data...</p>
      ) : (
        <>
          <div className="card card-muted" style={{ marginBottom: "20px" }}>
            <h2>Operations Controls</h2>
            <p className="mini-row" style={{ marginTop: "6px", marginBottom: "12px" }}>
              Allow cashier to perform kitchen status updates when kitchen is busy.
            </p>

            <div className="btn-row">
              <button
                className={cashierKitchenAssistEnabled ? "btn btn-danger" : "btn btn-success"}
                onClick={toggleCashierKitchenAssist}
                disabled={updatingMode}
              >
                {updatingMode
                  ? "Updating..."
                  : cashierKitchenAssistEnabled
                    ? "Disable Kitchen Assist on Cashier"
                    : "Enable Kitchen Assist on Cashier"}
              </button>
            </div>

            <p className="mini-row" style={{ marginTop: "10px" }}>
              Current Mode: {cashierKitchenAssistEnabled ? "Enabled" : "Disabled"}
            </p>

            <div className="btn-row" style={{ marginTop: "10px" }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowAllOrders(true)}
                type="button"
              >
                View All Orders
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowDailySales(true)}
                type="button"
              >
                View Daily Sales
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowMonthlySales(true)}
                type="button"
              >
                View Monthly Sales
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowLoyaltyLeaderboard(true)}
                type="button"
              >
                View Loyalty Leaderboard
              </button>
            </div>
          </div>

          <div className="card card-muted" style={{ marginBottom: "20px" }}>
            <h2>Business Details</h2>

            <form onSubmit={saveBusinessSettings}>
              <div className="stack" style={{ maxWidth: "580px", marginTop: "10px" }}>
                <input
                  type="text"
                  placeholder="Business name"
                  value={businessSettings.business_name}
                  onChange={(e) =>
                    setBusinessSettings({ ...businessSettings, business_name: e.target.value })
                  }
                  className="field"
                />

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleLogoFileChange}
                  className="field"
                />

                {(selectedLogoName || businessSettings.logo_url) && (
                  <div className="card" style={{ padding: "10px" }}>
                    {selectedLogoName && (
                      <p className="mini-row" style={{ marginBottom: "8px" }}>
                        Selected file: {selectedLogoName}
                      </p>
                    )}

                    {businessSettings.logo_url && (
                      <img
                        src={businessSettings.logo_url}
                        alt="Business logo preview"
                        style={{ maxWidth: "220px", maxHeight: "120px", objectFit: "contain" }}
                      />
                    )}

                    <div className="btn-row" style={{ marginTop: "8px" }}>
                      <button className="btn btn-soft" type="button" onClick={clearLogo}>
                        Remove Logo
                      </button>
                    </div>
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Contact number"
                  value={businessSettings.contact_number}
                  onChange={(e) =>
                    setBusinessSettings({ ...businessSettings, contact_number: e.target.value })
                  }
                  className="field"
                />

                <textarea
                  placeholder="Address"
                  value={businessSettings.address}
                  onChange={(e) =>
                    setBusinessSettings({ ...businessSettings, address: e.target.value })
                  }
                  className="field"
                  rows={3}
                />

                <button className="btn btn-primary" type="submit" disabled={savingSettings}>
                  {savingSettings ? "Saving..." : "Save Business Details"}
                </button>
              </div>
            </form>
          </div>

          <div className="card card-muted" style={{ marginBottom: "20px" }}>
            <h2>{editingId ? "Edit Menu Item" : "Add Menu Item"}</h2>

            <form onSubmit={handleSubmit}>
              <div className="stack" style={{ maxWidth: "450px", marginTop: "10px" }}>
                <input
                  type="text"
                  placeholder="Item name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  className="field"
                />

                <input
                  type="number"
                  placeholder="Price"
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: e.target.value })
                  }
                  className="field"
                />

                <input
                  type="text"
                  placeholder="Category"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="field"
                />

                <label>
                  <input
                    type="checkbox"
                    checked={form.is_available}
                    onChange={(e) =>
                      setForm({ ...form, is_available: e.target.checked })
                    }
                  />{" "}
                  Available
                </label>

                <div className="btn-row">
                  <button className="btn btn-primary" type="submit">
                    {editingId ? "Update Item" : "Add Item"}
                  </button>

                  {editingId && (
                    <button className="btn btn-soft" type="button" onClick={resetForm}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          <div className="card card-muted" style={{ marginBottom: "20px" }}>
            <h2>Menu Items</h2>

            {menuItems.length === 0 ? (
              <p>No menu items found</p>
            ) : (
              <div className="menu-grid" style={{ marginTop: "10px" }}>
                {menuItems.map((item) => (
                  <div key={item.id} className="card">
                    <p><strong>{item.name}</strong></p>
                    <p className="mini-row">Price: Rs. {item.price}</p>
                    <p className="mini-row">Category: {item.category || "N/A"}</p>
                    <p className="mini-row">Status: {item.is_available ? "Available" : "Unavailable"}</p>

                    <div className="btn-row" style={{ marginTop: "8px" }}>
                      <button className="btn btn-soft" onClick={() => handleEdit(item)}>Edit</button>
                      <button className="btn btn-danger" onClick={() => handleDelete(item.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showAllOrders && (
            <div className="modal-overlay" onClick={() => setShowAllOrders(false)}>
              <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="All orders">
                <div className="card-header" style={{ marginBottom: "4px" }}>
                  <h2 style={{ margin: 0 }}>All Orders</h2>
                  <button className="btn btn-soft" type="button" onClick={() => setShowAllOrders(false)}>
                    Close
                  </button>
                </div>

                <form className="stack" style={{ marginTop: "10px", marginBottom: "12px" }} onSubmit={applyOrderFilters}>
                  <div className="grid-columns-2">
                    <select
                      className="field"
                      value={orderFilters.status}
                      onChange={(e) => setOrderFilters({ ...orderFilters, status: e.target.value })}
                    >
                      <option value="">All Statuses</option>
                      <option value="PENDING">Pending</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="READY">Ready</option>
                      <option value="COMPLETED">Completed</option>
                    </select>

                    <input
                      className="field"
                      placeholder="Phone contains"
                      value={orderFilters.phone}
                      onChange={(e) => setOrderFilters({ ...orderFilters, phone: e.target.value })}
                    />

                    <input
                      className="field"
                      placeholder="Token contains"
                      value={orderFilters.token}
                      onChange={(e) => setOrderFilters({ ...orderFilters, token: e.target.value })}
                    />

                    <input
                      className="field"
                      type="datetime-local"
                      value={orderFilters.from}
                      onChange={(e) => setOrderFilters({ ...orderFilters, from: e.target.value })}
                    />

                    <input
                      className="field"
                      type="datetime-local"
                      value={orderFilters.to}
                      onChange={(e) => setOrderFilters({ ...orderFilters, to: e.target.value })}
                    />
                  </div>

                  <div className="btn-row">
                    <button className="btn btn-primary" type="submit">Apply Filters</button>
                    <button type="button" className="btn btn-soft" onClick={() => exportOrders("csv")}>Export CSV</button>
                    <button type="button" className="btn btn-soft" onClick={() => exportOrders("pdf")}>Export PDF</button>
                  </div>
                </form>

                {orders.length === 0 ? (
                  <p>No orders found</p>
                ) : (
                  <div className="list" style={{ marginTop: "10px" }}>
                    {orders.map((order) => (
                      <article key={order.id} className="card">
                        <p><strong>Token:</strong> {order.token_number}</p>
                        <p className="mini-row"><strong>Phone:</strong> {order.customer_phone || "N/A"}</p>
                        <p className="mini-row"><strong>Total:</strong> Rs. {order.total_amount}</p>
                        <p className="mini-row"><strong>Status:</strong> {order.status}</p>
                        <p className="mini-row"><strong>Points Earned:</strong> {order.points_earned || 0}</p>
                        <p className="mini-row"><strong>Special Notes:</strong> {order.special_notes || "-"}</p>
                        <p className="mini-row"><strong>Created:</strong> {new Date(order.created_at).toLocaleString()}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {showDailySales && (
            <div className="modal-overlay" onClick={() => setShowDailySales(false)}>
              <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Daily sales">
                <div className="card-header" style={{ marginBottom: "4px" }}>
                  <h2 style={{ margin: 0 }}>Daily Sales</h2>
                  <button className="btn btn-soft" type="button" onClick={() => setShowDailySales(false)}>
                    Close
                  </button>
                </div>

                {(salesSummary.daily || []).length === 0 ? (
                  <p style={{ marginTop: "10px" }}>No daily sales data found</p>
                ) : (
                  <div className="list" style={{ marginTop: "10px" }}>
                    {(salesSummary.daily || []).map((row) => (
                      <div key={row.day} className="card">
                        <p><strong>{row.day}</strong></p>
                        <p className="mini-row">Orders: {row.orders_count}</p>
                        <p className="mini-row">Sales: Rs. {row.sales_total}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {showMonthlySales && (
            <div className="modal-overlay" onClick={() => setShowMonthlySales(false)}>
              <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Monthly sales">
                <div className="card-header" style={{ marginBottom: "4px" }}>
                  <h2 style={{ margin: 0 }}>Monthly Sales</h2>
                  <button className="btn btn-soft" type="button" onClick={() => setShowMonthlySales(false)}>
                    Close
                  </button>
                </div>

                {(salesSummary.monthly || []).length === 0 ? (
                  <p style={{ marginTop: "10px" }}>No monthly sales data found</p>
                ) : (
                  <div className="list" style={{ marginTop: "10px" }}>
                    {(salesSummary.monthly || []).map((row) => (
                      <div key={row.month} className="card">
                        <p><strong>{row.month}</strong></p>
                        <p className="mini-row">Orders: {row.orders_count}</p>
                        <p className="mini-row">Sales: Rs. {row.sales_total}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {showLoyaltyLeaderboard && (
            <div className="modal-overlay" onClick={() => setShowLoyaltyLeaderboard(false)}>
              <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Loyalty leaderboard">
                <div className="card-header" style={{ marginBottom: "4px" }}>
                  <h2 style={{ margin: 0 }}>Loyalty Leaderboard</h2>
                  <button className="btn btn-soft" type="button" onClick={() => setShowLoyaltyLeaderboard(false)}>
                    Close
                  </button>
                </div>

                {loyaltyLeaderboard.length === 0 ? (
                  <p className="mini-row" style={{ marginTop: "10px" }}>No loyalty members yet</p>
                ) : (
                  <div className="list" style={{ marginTop: "10px" }}>
                    {loyaltyLeaderboard.map((member) => (
                      <div key={member.customer_phone} className="card">
                        <p><strong>{member.customer_phone}</strong></p>
                        <p className="mini-row">Points: {member.points}</p>
                        <p className="mini-row">Lifetime: {member.lifetime_points}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid-columns-2" style={{ marginBottom: "20px" }}>
            <div className="card card-muted">
              <h2>Promo Codes</h2>
              <form className="stack" style={{ marginTop: "10px" }} onSubmit={createPromoCode}>
                <input className="field" placeholder="Code" value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value })} />
                <select className="field" value={promoForm.discount_type} onChange={(e) => setPromoForm({ ...promoForm, discount_type: e.target.value })}>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed</option>
                </select>
                <input className="field" type="number" placeholder="Discount value" value={promoForm.discount_value} onChange={(e) => setPromoForm({ ...promoForm, discount_value: e.target.value })} />
                <input className="field" type="number" placeholder="Minimum order" value={promoForm.min_order_amount} onChange={(e) => setPromoForm({ ...promoForm, min_order_amount: e.target.value })} />
                <button className="btn btn-primary" type="submit">Create Promo</button>
              </form>

              <div className="list" style={{ marginTop: "12px" }}>
                {promoCodes.slice(0, 8).map((promo) => (
                  <div className="card" key={promo.id}>
                    <p><strong>{promo.code}</strong></p>
                    <p className="mini-row">Type: {promo.discount_type}</p>
                    <p className="mini-row">Value: {promo.discount_value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid-columns-2" style={{ marginBottom: "20px" }}>
            <div className="card card-muted">
              <h2>User Management</h2>

              <form className="stack" style={{ marginTop: "10px" }} onSubmit={createUser}>
                <input
                  className="field"
                  placeholder="Username"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                />
                <input
                  className="field"
                  placeholder="Password"
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                />
                <select
                  className="field"
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                >
                  <option value="admin">Admin</option>
                  <option value="cashier">Cashier</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="display">Display</option>
                </select>
                <button className="btn btn-primary" type="submit">Create User</button>
              </form>

              <div className="list" style={{ marginTop: "12px" }}>
                {users.map((user) => (
                  <div className="card" key={user.id}>
                    <p><strong>{user.username}</strong></p>
                    <p className="mini-row">Role: {user.role}</p>
                    <p className="mini-row">Status: {user.is_active ? "Active" : "Disabled"}</p>
                    <div className="btn-row" style={{ marginTop: "8px" }}>
                      <select
                        className="field"
                        value={user.role}
                        onChange={(e) => updateUser(user.id, { role: e.target.value })}
                        style={{ maxWidth: "150px" }}
                      >
                        <option value="admin">Admin</option>
                        <option value="cashier">Cashier</option>
                        <option value="kitchen">Kitchen</option>
                        <option value="display">Display</option>
                      </select>
                      <button
                        className="btn btn-soft"
                        onClick={() => updateUser(user.id, { is_active: !user.is_active })}
                      >
                        {user.is_active ? "Disable" : "Enable"}
                      </button>
                      <button className="btn btn-soft" onClick={() => resetPassword(user.id)}>
                        Reset Password
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card card-muted">
              <h2>Backup and Restore</h2>
              <p className="mini-row" style={{ marginTop: "8px" }}>
                Run database backup now, or restore from a previous backup file.
              </p>

              <div className="btn-row" style={{ marginTop: "10px" }}>
                <button className="btn btn-primary" onClick={runBackupNow}>Run Backup Now</button>
              </div>

              <div className="list" style={{ marginTop: "12px" }}>
                {backups.length === 0 ? (
                  <p className="mini-row">No backups found</p>
                ) : (
                  backups.map((backup) => (
                    <div className="card" key={backup.fileName}>
                      <p><strong>{backup.fileName}</strong></p>
                      <p className="mini-row">Size: {backup.sizeBytes} bytes</p>
                      <p className="mini-row">Modified: {new Date(backup.modifiedAt).toLocaleString()}</p>
                      <div className="btn-row" style={{ marginTop: "8px" }}>
                        <button className="btn btn-soft" onClick={() => downloadBackup(backup.fileName)}>
                          Download
                        </button>
                        <button className="btn btn-danger" onClick={() => restoreBackup(backup.fileName)}>
                          Restore
                        </button>
                        <button className="btn btn-danger" onClick={() => deleteBackup(backup.fileName)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card card-muted" style={{ marginBottom: "20px" }}>
              <h2>Messaging</h2>

              <form onSubmit={sendMessage} className="stack" style={{ marginTop: "10px" }}>
                <textarea
                  placeholder="Type a message"
                  value={messageForm.content}
                  onChange={(e) =>
                    setMessageForm({ ...messageForm, content: e.target.value })
                  }
                  className="field"
                  rows={3}
                />

                <select
                  value={messageForm.audience}
                  onChange={(e) =>
                    setMessageForm({ ...messageForm, audience: e.target.value })
                  }
                  className="field"
                >
                  <option value="all">All Screens</option>
                  <option value="cashier">Cashier</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="display">Display</option>
                  <option value="admin">Admin</option>
                </select>

                <button className="btn btn-primary" type="submit">Send Message</button>
              </form>

              <div className="list" style={{ marginTop: "12px" }}>
                {messages.slice(0, 8).map((msg) => (
                  <div key={msg.id} className="card">
                    <p>{msg.content}</p>
                    <p className="mini-row">Audience: {msg.audience}</p>
                    <button className="btn btn-soft" onClick={() => archiveMessage(msg.id)}>
                      Archive
                    </button>
                  </div>
                ))}
              </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminPage;
