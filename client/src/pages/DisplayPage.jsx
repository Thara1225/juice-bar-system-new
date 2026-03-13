import { useEffect, useState } from "react";
import api from "../services/api";
import socket from "../services/socket";

function DisplayPage() {
  const [readyOrders, setReadyOrders] = useState([]);
  const [error, setError] = useState("");

  const fetchReadyOrders = async () => {
    try {
      const res = await api.get("/orders/ready");
      setReadyOrders(res.data);
    } catch (err) {
      setError("Failed to load ready orders");
      console.error(err);
    }
  };

  useEffect(() => {
    fetchReadyOrders();

    socket.on("order_status_updated", () => {
      fetchReadyOrders();
    });

    socket.on("order_created", () => {
      fetchReadyOrders();
    });

    return () => {
      socket.off("order_status_updated");
      socket.off("order_created");
    };
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "pink",
        color: "white",
        padding: "40px",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "48px", marginBottom: "30px" }}>Ready Orders</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {readyOrders.length === 0 ? (
        <p style={{ fontSize: "28px" }}>No ready orders yet</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "20px",
            marginTop: "30px",
          }}
        >
          {readyOrders.map((order) => (
            <div
              key={order.id}
              style={{
                border: "2px solid white",
                borderRadius: "12px",
                padding: "30px",
                fontSize: "40px",
                fontWeight: "bold",
              }}
            >
              {order.token_number}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DisplayPage;