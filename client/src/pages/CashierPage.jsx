import { useEffect, useState } from "react";
import api from "../services/api";
import socket from "../services/socket";
import MessageFeed from "../components/MessageFeed";

function CashierPage() {
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [priority, setPriority] = useState("normal");
  const [createdOrder, setCreatedOrder] = useState(null);
  const [error, setError] = useState("");
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [cashierKitchenAssistEnabled, setCashierKitchenAssistEnabled] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [readyOrders, setReadyOrders] = useState([]);
  const [loadingKitchenOrders, setLoadingKitchenOrders] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [loyaltyInfo, setLoyaltyInfo] = useState(null);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);
  const [redeemingPoints, setRedeemingPoints] = useState(false);

  useEffect(() => {
    fetchMenuItems();
    fetchKitchenAssistMode();
  }, []);

  useEffect(() => {
    if (!cashierKitchenAssistEnabled) {
      return;
    }

    fetchKitchenOrders();
  }, [cashierKitchenAssistEnabled]);

  useEffect(() => {
    if (!customerPhone || customerPhone.trim().length < 5) {
      setLoyaltyInfo(null);
      return;
    }

    const timeout = setTimeout(() => {
      fetchLoyalty(customerPhone.trim());
    }, 350);

    return () => clearTimeout(timeout);
  }, [customerPhone]);

  useEffect(() => {
    const handleOrderCreated = () => {
      if (cashierKitchenAssistEnabled) {
        fetchKitchenOrders();
      }
    };

    const handleOrderStatusUpdated = () => {
      if (cashierKitchenAssistEnabled) {
        fetchKitchenOrders();
      }
    };

    const handleKitchenAssistModeUpdated = (payload) => {
      setCashierKitchenAssistEnabled(Boolean(payload?.enabled));
    };

    socket.on("order_created", handleOrderCreated);
    socket.on("order_status_updated", handleOrderStatusUpdated);
    socket.on("kitchen_assist_mode_updated", handleKitchenAssistModeUpdated);

    return () => {
      socket.off("order_created", handleOrderCreated);
      socket.off("order_status_updated", handleOrderStatusUpdated);
      socket.off("kitchen_assist_mode_updated", handleKitchenAssistModeUpdated);
    };
  }, [cashierKitchenAssistEnabled]);

  const fetchMenuItems = async () => {
    try {
      setLoadingMenu(true);
      setError("");
      const res = await api.get("/menu-items");
      setMenuItems(res.data);
    } catch (err) {
      setError("Failed to load menu items");
      console.error(err);
    } finally {
      setLoadingMenu(false);
    }
  };

  const addToCart = (item) => {
    setCreatedOrder(null);

    const existing = cart.find((c) => c.menu_item_id === item.id);

    if (existing) {
      setCart(
        cart.map((c) =>
          c.menu_item_id === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        )
      );
    } else {
      setCart([
        ...cart,
        {
          menu_item_id: item.id,
          name: item.name,
          quantity: 1,
          price: item.price,
        },
      ]);
    }
  };

  const increaseQuantity = (menuItemId) => {
    setCreatedOrder(null);
    setCart(
      cart.map((item) =>
        item.menu_item_id === menuItemId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const decreaseQuantity = (menuItemId) => {
    setCreatedOrder(null);
    const updatedCart = cart
      .map((item) =>
        item.menu_item_id === menuItemId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      )
      .filter((item) => item.quantity > 0);

    setCart(updatedCart);
  };

  const removeFromCart = (menuItemId) => {
    setCreatedOrder(null);
    setCart(cart.filter((item) => item.menu_item_id !== menuItemId));
  };

  const clearCart = () => {
    setCreatedOrder(null);
    setCart([]);
  };

  const getTotal = () => {
    return cart.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );
  };

  const placeOrder = async () => {
    try {
      setError("");
      setCreatedOrder(null);

      if (cart.length === 0) {
        setError("Cart is empty");
        return;
      }

      setPlacingOrder(true);

      const payload = {
        customer_phone: customerPhone,
        customer_email: customerEmail,
        special_notes: specialNotes,
        promo_code: promoCode,
        priority,
        items: cart.map((item) => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
        })),
      };

      const res = await api.post("/orders", payload);
      setCreatedOrder(res.data);
      setCart([]);
      setCustomerPhone("");
      setCustomerEmail("");
      setSpecialNotes("");
      setPromoCode("");
      setPriority("normal");
      setLoyaltyInfo(null);
    } catch (err) {
      setError("Failed to place order");
      console.error(err);
    } finally {
      setPlacingOrder(false);
    }
  };

  const fetchKitchenAssistMode = async () => {
    try {
      const res = await api.get("/orders/kitchen-assist-mode");
      setCashierKitchenAssistEnabled(Boolean(res.data?.enabled));
    } catch (err) {
      console.error("Failed to load kitchen assist mode:", err);
    }
  };

  const fetchKitchenOrders = async () => {
    try {
      setLoadingKitchenOrders(true);

      const [pendingRes, readyRes] = await Promise.all([
        api.get("/orders/pending"),
        api.get("/orders/ready"),
      ]);

      setPendingOrders(pendingRes.data || []);
      setReadyOrders(readyRes.data || []);
    } catch (err) {
      setError("Failed to load kitchen queue on cashier");
      console.error(err);
    } finally {
      setLoadingKitchenOrders(false);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      setError("");
      setUpdatingOrderId(orderId);
      await api.patch(`/orders/${orderId}/status`, { status });
      fetchKitchenOrders();
    } catch (err) {
      setError(`Failed to mark order as ${status}`);
      console.error(err);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const fetchLoyalty = async (phone) => {
    try {
      setLoadingLoyalty(true);
      const res = await api.get(`/loyalty/${encodeURIComponent(phone)}`);
      setLoyaltyInfo(res.data);
    } catch (err) {
      console.error("Failed to fetch loyalty points:", err);
    } finally {
      setLoadingLoyalty(false);
    }
  };

  const redeemPoints = async () => {
    try {
      if (!customerPhone || !loyaltyInfo?.points) {
        return;
      }

      setRedeemingPoints(true);
      await api.post("/loyalty/redeem", {
        customer_phone: customerPhone,
        points: 10,
      });

      fetchLoyalty(customerPhone);
    } catch (err) {
      setError("Failed to redeem points");
      console.error(err);
    } finally {
      setRedeemingPoints(false);
    }
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <h2 className="screen-title">Cashier Screen</h2>
        <p className="screen-subtitle">Build orders quickly and send them to the kitchen queue.</p>
      </header>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {createdOrder && (
        <div className="alert alert-success">
          <strong>Order created successfully.</strong> Token:{" "}
          {createdOrder.token_number}
        </div>
      )}

      <div className="grid-split">
        <div>
          <div className="card card-muted">
            <div className="card-header">
              <h3>Menu</h3>
            </div>

            {loadingMenu ? (
              <p>Loading menu items...</p>
            ) : menuItems.length === 0 ? (
              <p>No menu items available.</p>
            ) : (
              <div className="menu-grid">
                {menuItems.map((item) => (
                  <article key={item.id} className="card">
                    <h3>{item.name}</h3>
                    <p className="mini-row">Category: {item.category || "N/A"}</p>
                    <p className="mini-row">Rs. {item.price}</p>
                    <button
                      onClick={() => addToCart(item)}
                      className="btn btn-primary"
                    >
                      Add to Cart
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="card card-muted">
          <div className="card-header">
            <h3>Cart</h3>
          </div>

          {cart.length === 0 ? (
            <p>No items yet</p>
          ) : (
            <>
              {cart.map((item) => (
                <div key={item.menu_item_id} className="card">
                  <div>
                    <strong>{item.name}</strong>
                  </div>

                  <div className="mini-row">
                    Rs. {item.price} x {item.quantity} = Rs.{" "}
                    {Number(item.price) * item.quantity}
                  </div>

                  <div className="btn-row">
                    <button
                      onClick={() => decreaseQuantity(item.menu_item_id)}
                      className="btn btn-soft"
                    >
                      -
                    </button>

                    <button
                      onClick={() => increaseQuantity(item.menu_item_id)}
                      className="btn btn-soft"
                    >
                      +
                    </button>

                    <button
                      onClick={() => removeFromCart(item.menu_item_id)}
                      className="btn btn-danger"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={clearCart}
                className="btn btn-soft"
              >
                Clear Cart
              </button>
            </>
          )}

          <p style={{ marginTop: "12px", marginBottom: "10px", fontWeight: 700 }}>
            <strong>Total:</strong> Rs. {getTotal()}
          </p>

          <input
            type="text"
            placeholder="Customer phone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="field"
          />

          <input
            type="email"
            placeholder="Customer email (optional)"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="field"
            style={{ marginTop: "10px" }}
          />

          <input
            type="text"
            placeholder="Promo code (optional)"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            className="field"
            style={{ marginTop: "10px" }}
          />

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="field"
            style={{ marginTop: "10px" }}
          >
            <option value="normal">Normal Priority</option>
            <option value="urgent">Urgent</option>
            <option value="vip">VIP</option>
            <option value="bulk">Bulk</option>
          </select>

          <textarea
            placeholder="Special notes (e.g. extra cheese, less sugar)"
            value={specialNotes}
            onChange={(e) => setSpecialNotes(e.target.value)}
            className="field"
            rows={3}
            style={{ marginTop: "10px" }}
          />

          <div className="card" style={{ marginTop: "10px" }}>
            <p><strong>Loyalty</strong></p>
            {loadingLoyalty ? (
              <p className="mini-row">Checking points...</p>
            ) : (
              <p className="mini-row">Current points: {loyaltyInfo?.points || 0}</p>
            )}

            <button
              onClick={redeemPoints}
              className="btn btn-soft"
              disabled={redeemingPoints || !loyaltyInfo?.points || loyaltyInfo.points < 10}
              style={{ marginTop: "8px" }}
            >
              {redeemingPoints ? "Redeeming..." : "Redeem 10 points"}
            </button>
          </div>

          <button
            onClick={placeOrder}
            disabled={cart.length === 0 || placingOrder}
            className="btn btn-success"
            style={{ width: "100%", marginTop: "10px", padding: "12px" }}
          >
            {placingOrder ? "Placing Order..." : "Place Order"}
          </button>
        </aside>
      </div>

      {cashierKitchenAssistEnabled && (
        <section style={{ marginTop: "20px" }}>
          <div className="card card-muted">
            <div className="card-header">
              <h3>Kitchen Assist on Cashier</h3>
              <span className="chip chip-ready">Enabled by Admin</span>
            </div>

            {loadingKitchenOrders ? (
              <p>Loading kitchen queue...</p>
            ) : (
              <div className="grid-columns-2">
                <div className="card">
                  <h3 style={{ marginBottom: "10px" }}>Pending Orders ({pendingOrders.length})</h3>
                  {pendingOrders.length === 0 ? (
                    <p>No pending orders</p>
                  ) : (
                    <div className="list">
                      {pendingOrders.map((order) => (
                        <div key={order.id} className="card card-muted">
                          <p><strong>Token:</strong> {order.token_number}</p>
                          <p className="mini-row">Total: Rs. {order.total_amount}</p>
                          <button
                            className="btn btn-primary"
                            onClick={() => updateOrderStatus(order.id, "READY")}
                            disabled={updatingOrderId === order.id}
                          >
                            {updatingOrderId === order.id ? "Updating..." : "Mark Ready"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card">
                  <h3 style={{ marginBottom: "10px" }}>Ready Orders ({readyOrders.length})</h3>
                  {readyOrders.length === 0 ? (
                    <p>No ready orders</p>
                  ) : (
                    <div className="list">
                      {readyOrders.map((order) => (
                        <div key={order.id} className="card card-muted">
                          <p><strong>Token:</strong> {order.token_number}</p>
                          <p className="mini-row">Total: Rs. {order.total_amount}</p>
                          <button
                            className="btn btn-success"
                            onClick={() => updateOrderStatus(order.id, "COMPLETED")}
                            disabled={updatingOrderId === order.id}
                          >
                            {updatingOrderId === order.id ? "Updating..." : "Mark Completed"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <MessageFeed audience="cashier" />
    </div>
  );
}

export default CashierPage;