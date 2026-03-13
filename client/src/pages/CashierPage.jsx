import { useEffect, useState } from "react";
import api from "../services/api";

function CashierPage() {
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerPhone, setCustomerPhone] = useState("");
  const [createdOrder, setCreatedOrder] = useState(null);
  const [error, setError] = useState("");
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);

  useEffect(() => {
    fetchMenuItems();
  }, []);

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
        items: cart.map((item) => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
        })),
      };

      const res = await api.post("/orders", payload);
      setCreatedOrder(res.data);
      setCart([]);
      setCustomerPhone("");
    } catch (err) {
      setError("Failed to place order");
      console.error(err);
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "1100px",
        margin: "0 auto",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: "20px" }}>Cashier Screen</h1>

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

      {createdOrder && (
        <div
          style={{
            marginBottom: "20px",
            padding: "14px",
            border: "1px solid #2e7d32",
            backgroundColor: "#e8f5e9",
            borderRadius: "8px",
            color: "#1b5e20",
          }}
        >
          <strong>Order created successfully.</strong> Token:{" "}
          {createdOrder.token_number}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        <div>
          <h2 style={{ marginBottom: "12px" }}>Menu</h2>

          {loadingMenu ? (
            <p>Loading menu items...</p>
          ) : menuItems.length === 0 ? (
            <p>No menu items available.</p>
          ) : (
            menuItems.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "10px",
                  padding: "16px",
                  marginBottom: "12px",
                  backgroundColor: "#fff",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                }}
              >
                <p style={{ margin: "0 0 8px 0", fontSize: "18px" }}>
                  <strong>{item.name}</strong>
                </p>
                <p style={{ margin: "0 0 8px 0" }}>Category: {item.category}</p>
                <p style={{ margin: "0 0 12px 0" }}>Rs. {item.price}</p>
                <button
                  onClick={() => addToCart(item)}
                  style={{
                    padding: "8px 14px",
                    backgroundColor: "#1976d2",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Add to Cart
                </button>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "10px",
            padding: "16px",
            backgroundColor: "#fafafa",
            boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            position: "sticky",
            top: "20px",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "12px" }}>Cart</h2>

          {cart.length === 0 ? (
            <p>No items yet</p>
          ) : (
            <>
              {cart.map((item) => (
                <div
                  key={item.menu_item_id}
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    padding: "10px",
                    marginBottom: "10px",
                    backgroundColor: "white",
                  }}
                >
                  <div style={{ marginBottom: "8px" }}>
                    <strong>{item.name}</strong>
                  </div>

                  <div style={{ marginBottom: "8px" }}>
                    Rs. {item.price} x {item.quantity} = Rs.{" "}
                    {Number(item.price) * item.quantity}
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => decreaseQuantity(item.menu_item_id)}
                      style={{
                        padding: "6px 10px",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        backgroundColor: "#f0f0f0",
                      }}
                    >
                      -
                    </button>

                    <button
                      onClick={() => increaseQuantity(item.menu_item_id)}
                      style={{
                        padding: "6px 10px",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        backgroundColor: "#f0f0f0",
                      }}
                    >
                      +
                    </button>

                    <button
                      onClick={() => removeFromCart(item.menu_item_id)}
                      style={{
                        padding: "6px 10px",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        backgroundColor: "#d32f2f",
                        color: "white",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={clearCart}
                style={{
                  marginTop: "4px",
                  marginBottom: "12px",
                  padding: "8px 12px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  backgroundColor: "#616161",
                  color: "white",
                }}
              >
                Clear Cart
              </button>
            </>
          )}

          <p style={{ fontSize: "18px", marginTop: "12px" }}>
            <strong>Total:</strong> Rs. {getTotal()}
          </p>

          <input
            type="text"
            placeholder="Customer phone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            style={{
              padding: "10px",
              width: "100%",
              boxSizing: "border-box",
              marginBottom: "12px",
              borderRadius: "6px",
              border: "1px solid #ccc",
            }}
          />

          <button
            onClick={placeOrder}
            disabled={cart.length === 0 || placingOrder}
            style={{
              width: "100%",
              padding: "12px",
              border: "none",
              borderRadius: "6px",
              cursor: cart.length === 0 || placingOrder ? "not-allowed" : "pointer",
              backgroundColor:
                cart.length === 0 || placingOrder ? "#bdbdbd" : "#2e7d32",
              color: "white",
              fontSize: "16px",
              fontWeight: "bold",
            }}
          >
            {placingOrder ? "Placing Order..." : "Place Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CashierPage;