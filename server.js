const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const app = express();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: 'zomato_clone_secret',
  resave: false,
  saveUninitialized: true
}));

const usersPath = "./data/users.json";
const adminsPath = "./data/admins.json";
const itemsPath = "./data/items.json";
const cartsPath = "./data/carts.json";
const ordersPath = "./data/orders.json";

function readJSON(path) {
  return JSON.parse(fs.readFileSync(path));
}

function writeJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

// ✅ Load existing orders from JSON safely
let orders = [];
if (fs.existsSync(ordersPath)) {
  try {
    const raw = fs.readFileSync(ordersPath, "utf8");
    orders = JSON.parse(raw);
    if (!Array.isArray(orders)) orders = [];
  } catch {
    orders = [];
  }
}

// -------- USER REGISTER --------
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(usersPath);
  if (users.find(u => u.username === username)) {
    return res.status(400).send("User already exists");
  }
  users.push({ username, password });
  writeJSON(usersPath, users);
  res.send("Registered successfully");
});

// -------- USER LOGIN --------
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(usersPath);
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).send("Invalid credentials");
  req.session.user = username;
  res.send("Login successful");
});

// -------- ADMIN LOGIN --------
app.post("/admin-login", (req, res) => {
  const { username, password } = req.body;
  const admins = readJSON(adminsPath);
  const admin = admins.find(a => a.username === username && a.password === password);
  if (!admin) return res.status(401).send("Invalid admin credentials");
  req.session.admin = username;
  res.send("Admin login successful");
});

// -------- LOGOUT --------
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.send("Logged out");
});

// -------- GET ITEMS --------
app.get("/items", (req, res) => {
  const items = readJSON(itemsPath);
  res.json(items);
});

// -------- ADD ITEM (ADMIN) --------
app.post("/add-item", (req, res) => {
  if (!req.session.admin) return res.status(403).send("Not authorized");
  const { title, price, image } = req.body;
  const items = readJSON(itemsPath);
  items.push({ id: Date.now(), title, price, image });
  writeJSON(itemsPath, items);
  res.send("Item added");
});

// -------- DELETE ITEM (ADMIN) --------
app.delete("/delete-item/:id", (req, res) => {
  if (!req.session.admin) return res.status(403).send("Not authorized");
  let items = readJSON(itemsPath);
  items = items.filter(item => item.id != req.params.id);
  writeJSON(itemsPath, items);
  res.send("Item deleted");
});

// -------- ADD TO CART --------
app.post("/cart", (req, res) => {
  if (!req.session.user) return res.status(401).send("Login required");

  const { id, quantity } = req.body;
  const carts = readJSON(cartsPath);
  const userCart = carts[req.session.user] || [];

  const existing = userCart.find(item => item.id === id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    userCart.push({ id, quantity });
  }

  carts[req.session.user] = userCart;
  writeJSON(cartsPath, carts);
  res.send("Item added to cart");
});

// -------- GET USER CART --------
app.get("/cart", (req, res) => {
  if (!req.session.user) return res.status(401).send("Login required");
  const carts = readJSON(cartsPath);
  const cartItems = carts[req.session.user] || [];
  const allItems = readJSON(itemsPath);
  const result = cartItems.map(ci => {
    const item = allItems.find(i => i.id === ci.id);
    return { ...item, quantity: ci.quantity };
  });
  res.json(result);
});

// -------- UPDATE ITEM QUANTITY IN CART --------
app.post("/cart/update", (req, res) => {
  if (!req.session.user) return res.status(401).send("Login required");
  const { id, quantity } = req.body;
  const carts = readJSON(cartsPath);
  const userCart = carts[req.session.user] || [];
  const item = userCart.find(i => i.id === id);
  if (item) {
    item.quantity = quantity;
  }
  carts[req.session.user] = userCart;
  writeJSON(cartsPath, carts);
  res.send("Cart updated");
});

// -------- REMOVE ITEM FROM CART --------
app.delete("/cart/remove/:id", (req, res) => {
  if (!req.session.user) return res.status(401).send("Login required");
  const id = parseInt(req.params.id);
  const carts = readJSON(cartsPath);
  let userCart = carts[req.session.user] || [];
  userCart = userCart.filter(item => item.id !== id);
  carts[req.session.user] = userCart;
  writeJSON(cartsPath, carts);
  res.send("Item removed from cart");
});

// -------- PLACE ORDER --------
app.post("/place-order", (req, res) => {
  const order = {
    id: Date.now(),
    ...req.body,
    status: "Pending",
    user: req.session.user || "guest",
    placedAt: new Date().toLocaleString()
  };

  orders.push(order);
  writeJSON(ordersPath, orders);

  // Clear user's cart after placing order
  const carts = readJSON(cartsPath);
  carts[req.session.user] = [];
  writeJSON(cartsPath, carts);

  res.send("✅ Order placed successfully!");
});

// -------- GET ALL ORDERS (ADMIN) --------
app.get("/admin-orders", (req, res) => {
  if (!req.session.admin) return res.status(403).send("Not authorized");
  const allOrders = readJSON(ordersPath);  // ✅ Don't overwrite `orders`
  res.json(allOrders);
});

// -------- Start Server --------
app.listen(3000, () => {
  console.log("✅ Server running on http://localhost:3000");
});
