import { useEffect, useState } from "react";
import api from "../services/api";
import socket from "../services/socket";
import MessageFeed from "../components/MessageFeed";

function KitchenPage() {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [readyOrders, setReadyOrders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");

      const [pendingRes, readyRes] = await Promise.all([
        api.get("/orders/pending"),
        api.get("/orders/ready"),
      ]);

      setPendingOrders(pendingRes.data);
      setReadyOrders(readyRes.data);
    } catch (err) {
      setError("Failed to load kitchen orders");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    socket.on("order_created", () => {
      fetchOrders();
    });

    socket.on("order_status_updated", () => {
      fetchOrders();
    });

    return () => {
      socket.off("order_created");
      socket.off("order_status_updated");
    };
  }, []);

  const markReady = async (id) => {
    try {
      setError("");
      setUpdatingOrderId(id);
      await api.patch(`/orders/${id}/status`, { status: "READY" });
      fetchOrders();
    } catch (err) {
      setError("Failed to mark order as READY");
      console.error(err);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const markInProgress = async (id) => {
    try {
      setError("");
      setUpdatingOrderId(id);
      await api.patch(`/orders/${id}/status`, { status: "IN_PROGRESS" });
      fetchOrders();
    } catch (err) {
      setError("Failed to mark order as IN_PROGRESS");
      console.error(err);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const markCompleted = async (id) => {
    try {
      setError("");
      setUpdatingOrderId(id);
      await api.patch(`/orders/${id}/status`, { status: "COMPLETED" });
      fetchOrders();
    } catch (err) {
      setError("Failed to mark order as COMPLETED");
      console.error(err);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  const OrderCard = ({ order, type }) => (
    <div className="card">
      <div className="card-header">
        <h3 style={{ margin: 0 }}>Token: {order.token_number}</h3>
        <span className={`chip ${order.status === "PENDING" ? "chip-pending" : "chip-ready"}`}>
          {order.status}
        </span>
      </div>

      <p className="mini-row">
        <strong>Phone:</strong> {order.customer_phone || "N/A"}
      </p>
      <p className="mini-row">
        <strong>Total:</strong> Rs. {order.total_amount}
      </p>
      <p className="mini-row">
        <strong>Priority:</strong> {order.priority || "normal"}
      </p>
      <p className="mini-row">
        <strong>Created At:</strong> {formatDateTime(order.created_at)}
      </p>
      <p className="mini-row">
        <strong>Special Notes:</strong> {order.special_notes || "-"}
      </p>

      <div className="card card-muted" style={{ marginTop: "12px", marginBottom: "12px" }}>
        <p style={{ marginBottom: "10px" }}>
          <strong>Items</strong>
        </p>

        {order.items && order.items.length > 0 ? (
          <div className="list">
            {order.items.map((item, index) => (
              <div key={index} className="order-item">
                <span>{item.name}</span>
                <span>x {item.quantity}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0 }}>No items found</p>
        )}
      </div>

      <div className="btn-row">
        {type === "pending" && (
          <>
            {order.status === "PENDING" && (
              <button
                onClick={() => markInProgress(order.id)}
                disabled={updatingOrderId === order.id}
                className="btn btn-soft"
              >
                {updatingOrderId === order.id ? "Updating..." : "Start Prep"}
              </button>
            )}

            <button
              onClick={() => markReady(order.id)}
              disabled={updatingOrderId === order.id}
              className="btn btn-primary"
            >
              {updatingOrderId === order.id ? "Updating..." : "Mark Ready"}
            </button>
          </>
        )}

        {type === "ready" && (
          <button
            onClick={() => markCompleted(order.id)}
            disabled={updatingOrderId === order.id}
            className="btn btn-success"
          >
            {updatingOrderId === order.id ? "Updating..." : "Mark Completed"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="screen">
      <header className="screen-header">
        <h2 className="screen-title">Kitchen Screen</h2>
        <p className="screen-subtitle">Track pending drinks and move them through preparation states.</p>
      </header>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {loading ? (
        <p>Loading kitchen orders...</p>
      ) : (
        <>
          <div className="grid-columns-2">
            <div className="card card-muted" style={{ minHeight: "300px" }}>
              <h2 style={{ marginTop: 0, marginBottom: "14px" }}>
                Pending Orders ({pendingOrders.length})
              </h2>

              {pendingOrders.length === 0 ? (
                <p>No pending orders</p>
              ) : (
                pendingOrders.map((order) => (
                  <OrderCard key={order.id} order={order} type="pending" />
                ))
              )}
            </div>

            <div className="card card-muted" style={{ minHeight: "300px" }}>
              <h2 style={{ marginTop: 0, marginBottom: "14px" }}>
                Ready Orders ({readyOrders.length})
              </h2>

              {readyOrders.length === 0 ? (
                <p>No ready orders</p>
              ) : (
                readyOrders.map((order) => (
                  <OrderCard key={order.id} order={order} type="ready" />
                ))
              )}
            </div>
          </div>

          <MessageFeed audience="kitchen" />
        </>
      )}
    </div>
  );
}

export default KitchenPage;