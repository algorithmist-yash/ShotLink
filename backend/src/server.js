require("dotenv").config();

const connectDB = require("../config/db");
const { validateProductionEnv } = require("./config/env");
const app = require("./app");

validateProductionEnv();
connectDB();

// FORCE Railway port usage
const PORT = process.env.PORT;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});