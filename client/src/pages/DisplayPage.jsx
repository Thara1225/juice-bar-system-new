import { useEffect, useState } from "react";
import api from "../services/api";
import socket from "../services/socket";
import MessageFeed from "../components/MessageFeed";

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
    <div className="screen">
      <section className="token-board">
        <header className="screen-header" style={{ marginBottom: "24px" }}>
          <h2 className="screen-title" style={{ color: "white" }}>Ready Orders</h2>
          <p className="screen-subtitle" style={{ color: "rgba(255,255,255,0.9)" }}>
            Call these token numbers for pickup.
          </p>
        </header>

        {error && <div className="alert alert-error">{error}</div>}

        {readyOrders.length === 0 ? (
          <p style={{ fontSize: "1.35rem", fontWeight: 700 }}>No ready orders yet</p>
        ) : (
          <div className="token-grid">
            {readyOrders.map((order) => (
              <div key={order.id} className="token-pill">
                {order.token_number}
              </div>
            ))}
          </div>
        )}
      </section>

      <MessageFeed audience="display" />
    </div>
  );
}

export default DisplayPage;