require("dotenv").config();

const connectDB = require("../config/db");
const { validateProductionEnv } = require("./config/env");
const app = require("./app");

validateProductionEnv();
connectDB();

// DO NOT hardcode anything
const PORT = process.env.PORT;

if (!PORT) {
  console.error("PORT not provided by environment");
  process.exit(1);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});