import { useEffect, useState } from "react";
import api from "../services/api";

function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/orders");
      setOrders(res.data || []);
    } catch (err) {
      setError("Failed to load orders");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="screen">
      <header className="screen-header">
        <h2 className="screen-title">Admin Orders</h2>
        <p className="screen-subtitle">Full order history in one place.</p>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card card-muted">
        {loading ? (
          <p>Loading orders...</p>
        ) : orders.length === 0 ? (
          <p>No orders found</p>
        ) : (
          <div className="list">
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
  );
}

export default AdminOrdersPage;
