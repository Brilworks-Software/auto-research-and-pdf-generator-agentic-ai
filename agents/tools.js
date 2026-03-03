export async function getOrderStatus(orderId) {
  const orders = {
    "123": "Shipped 🚚",
    "456": "Processing ⏳",
    "789": "Delivered ✅"
  };

  return orders[orderId] || "Order not found ❌";
}
