require("dotenv").config();

const connectDB = require("../config/db");
const { validateProductionEnv } = require("./config/env");
const app = require("./app");

validateProductionEnv();
connectDB();

// DEBUG
console.log("ENV PORT:", process.env.PORT);

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});