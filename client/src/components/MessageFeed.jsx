import { useEffect, useState } from "react";
import api from "../services/api";
import socket from "../services/socket";

function MessageFeed({ audience }) {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");

  const fetchMessages = async () => {
    try {
      const res = await api.get("/messages", { params: { audience } });
      setMessages(res.data || []);
    } catch (err) {
      setError("Failed to load messages");
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMessages();

    const onMessageCreated = () => {
      fetchMessages();
    };

    socket.on("message_created", onMessageCreated);

    return () => {
      socket.off("message_created", onMessageCreated);
    };
  }, [audience]);

  return (
    <div className="card card-muted" style={{ marginTop: "18px" }}>
      <div className="card-header">
        <h3>Announcements</h3>
      </div>

      {error && <p className="mini-row">{error}</p>}

      {messages.length === 0 ? (
        <p className="mini-row">No active messages</p>
      ) : (
        <div className="list">
          {messages.slice(0, 5).map((msg) => (
            <div key={msg.id} className="card">
              <p>{msg.content}</p>
              <p className="mini-row">
                Audience: {msg.audience} | {new Date(msg.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MessageFeed;
