const express = require("express");
const { checkDbConnection } = require("../src/db/client");
const roomRoutes = require("../src/routes/roomRoutes");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("../src/config/swagger");

const app = express();

app.use(express.json());

app.get("/api", (_req, res) => {
  res.send("Chao mung ban den voi Backend Ca Ngua 4.0!");
});

app.get("/api/status", (_req, res) => {
  res.json({ status: "Online", level: "Industrialization 4.0" });
});

app.use("/api", roomRoutes);

app.get("/api/db-status", async (_req, res) => {
  try {
    const result = await checkDbConnection();
    return res.json({ ok: true, database: "connected", now: result.now });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      database: "disconnected",
      message: error instanceof Error ? error.message : "Unknown DB error",
    });
  }
});

app.use("/api/docs", swaggerUi.serve);
app.get("/api/docs", swaggerUi.setup(swaggerSpec));

module.exports = app;
