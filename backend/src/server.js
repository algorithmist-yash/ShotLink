require("dotenv").config();

const connectDB = require("../config/db");
const { validateProductionEnv } = require("./config/env");
const app = require("./app");

validateProductionEnv();
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
