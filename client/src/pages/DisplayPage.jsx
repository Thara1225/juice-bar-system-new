import { useEffect, useState } from "react";
import api from "../services/api";
import socket from "../services/socket";
import { getMqttClient, getMqttTopicPrefix } from "../services/mqttClient";
import MessageFeed from "../components/MessageFeed";

function DisplayPage() {
  const [readyOrders, setReadyOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [error, setError] = useState("");
  const [mqttState, setMqttState] = useState(
    import.meta.env.VITE_MQTT_BROKER_URL ? "connecting" : "disabled"
  );

  const fetchDisplayOrders = async () => {
    try {
      const res = await api.get("/orders/display");
      setReadyOrders(res.data?.readyOrders || []);
      setCompletedOrders(res.data?.completedOrders || []);
    } catch (err) {
      setError("Failed to load display orders");
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDisplayOrders();

    const handleSocketOrderStatusUpdated = () => {
      fetchDisplayOrders();
    };

    const handleSocketOrderCreated = () => {
      fetchDisplayOrders();
    };

    socket.on("order_status_updated", handleSocketOrderStatusUpdated);
    socket.on("order_created", handleSocketOrderCreated);

    const mqttClient = getMqttClient();
    const mqttTopicPrefix = getMqttTopicPrefix();
    const mqttTopic = `${mqttTopicPrefix}/orders/#`;

    const handleMqttConnect = () => {
      setMqttState("connected");
      mqttClient?.subscribe(mqttTopic, { qos: 1 });
    };

    const handleMqttReconnect = () => {
      setMqttState("reconnecting");
    };

    const handleMqttClose = () => {
      setMqttState("disconnected");
    };

    const handleMqttError = () => {
      setMqttState("error");
    };

    const handleMqttMessage = () => {
      fetchDisplayOrders();
    };

    if (mqttClient) {
      mqttClient.on("connect", handleMqttConnect);
      mqttClient.on("reconnect", handleMqttReconnect);
      mqttClient.on("close", handleMqttClose);
      mqttClient.on("error", handleMqttError);
      mqttClient.on("message", handleMqttMessage);

      if (mqttClient.connected) {
        handleMqttConnect();
      }
    }

    return () => {
      socket.off("order_status_updated", handleSocketOrderStatusUpdated);
      socket.off("order_created", handleSocketOrderCreated);

      if (mqttClient) {
        mqttClient.off("connect", handleMqttConnect);
        mqttClient.off("reconnect", handleMqttReconnect);
        mqttClient.off("close", handleMqttClose);
        mqttClient.off("error", handleMqttError);
        mqttClient.off("message", handleMqttMessage);
      }
    };
  }, []);

  return (
    <div className="screen">
      <section className="token-board">
        <header className="screen-header" style={{ marginBottom: "24px" }}>
          <h2 className="screen-title" style={{ color: "white" }}>LED Display</h2>
          <p className="screen-subtitle" style={{ color: "rgba(255,255,255,0.9)" }}>
            Finished tokens appear here for pickup.
          </p>
          <p className="screen-subtitle" style={{ color: "rgba(255,255,255,0.9)", marginTop: "4px" }}>
            MQTT: {mqttState}
          </p>
        </header>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="card card-muted" style={{ marginBottom: "16px", background: "rgba(255,255,255,0.08)" }}>
          <p style={{ marginTop: 0, marginBottom: "12px", fontWeight: 700, fontSize: "1.05rem" }}>
            Ready for pickup
          </p>
          {readyOrders.length === 0 ? (
            <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600 }}>No ready orders yet</p>
          ) : (
            <div className="token-grid">
              {readyOrders.map((order) => (
                <div key={order.id} className="token-pill">
                  {order.token_number}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card card-muted" style={{ background: "rgba(255,255,255,0.08)" }}>
          <p style={{ marginTop: 0, marginBottom: "12px", fontWeight: 700, fontSize: "1.05rem" }}>
            Recently finished
          </p>
          {completedOrders.length === 0 ? (
            <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600 }}>No finished orders yet</p>
          ) : (
            <div className="token-grid">
              {completedOrders.map((order) => (
                <div key={order.id} className="token-pill">
                  {order.token_number}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <MessageFeed audience="display" />
    </div>
  );
}

export default DisplayPage;