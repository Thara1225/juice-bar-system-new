import { useEffect, useState } from "react";
import api from "../services/api";
import socket from "../services/socket";

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
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "10px",
        padding: "16px",
        marginBottom: "14px",
        backgroundColor: "#fff",
        boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <h3 style={{ margin: 0 }}>Token: {order.token_number}</h3>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: "20px",
            backgroundColor:
              order.status === "PENDING" ? "#fff3cd" : "#d1e7dd",
            color: order.status === "PENDING" ? "#856404" : "#0f5132",
            fontWeight: "bold",
            fontSize: "14px",
          }}
        >
          {order.status}
        </span>
      </div>

      <p style={{ margin: "6px 0" }}>
        <strong>Phone:</strong> {order.customer_phone || "N/A"}
      </p>
      <p style={{ margin: "6px 0" }}>
        <strong>Total:</strong> Rs. {order.total_amount}
      </p>
      <p style={{ margin: "6px 0" }}>
        <strong>Created At:</strong> {formatDateTime(order.created_at)}
      </p>

      <div
        style={{
          marginTop: "12px",
          marginBottom: "12px",
          padding: "12px",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          border: "1px solid #eee",
        }}
      >
        <p style={{ marginTop: 0, marginBottom: "10px" }}>
          <strong>Items</strong>
        </p>

        {order.items && order.items.length > 0 ? (
          order.items.map((item, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "6px",
                paddingBottom: "6px",
                borderBottom: "1px solid #eee",
              }}
            >
              <span>{item.name}</span>
              <span>x {item.quantity}</span>
            </div>
          ))
        ) : (
          <p style={{ margin: 0 }}>No items found</p>
        )}
      </div>

      <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {type === "pending" && (
          <button
            onClick={() => markReady(order.id)}
            disabled={updatingOrderId === order.id}
            style={{
              padding: "10px 16px",
              border: "none",
              borderRadius: "6px",
              backgroundColor: "#1976d2",
              color: "white",
              cursor: updatingOrderId === order.id ? "not-allowed" : "pointer",
              fontWeight: "bold",
            }}
          >
            {updatingOrderId === order.id ? "Updating..." : "Mark Ready"}
          </button>
        )}

        {type === "ready" && (
          <button
            onClick={() => markCompleted(order.id)}
            disabled={updatingOrderId === order.id}
            style={{
              padding: "10px 16px",
              border: "none",
              borderRadius: "6px",
              backgroundColor: "#2e7d32",
              color: "white",
              cursor: updatingOrderId === order.id ? "not-allowed" : "pointer",
              fontWeight: "bold",
            }}
          >
            {updatingOrderId === order.id ? "Updating..." : "Mark Completed"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "1200px",
        margin: "0 auto",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: "20px" }}>Kitchen Screen</h1>

      {error && (
        <div
          style={{
            backgroundColor: "#ffe5e5",
            color: "#b00020",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            border: "1px solid #ffb3b3",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading kitchen orders...</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
            alignItems: "start",
          }}
        >
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "12px",
              padding: "16px",
              backgroundColor: "#fafafa",
              minHeight: "300px",
            }}
          >
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

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "12px",
              padding: "16px",
              backgroundColor: "#fafafa",
              minHeight: "300px",
            }}
          >
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
      )}
    </div>
  );
}

export default KitchenPage;