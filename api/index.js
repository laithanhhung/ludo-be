const express = require("express");
const { checkDbConnection } = require("../src/db/client");
const roomRoutes = require("../src/routes/roomRoutes");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("../src/config/swagger");

const app = express();

app.use(express.json());

app.use("/docs", swaggerUi.serve);
app.get("/docs", swaggerUi.setup(swaggerSpec, { explorer: true }));

app.get("/", (_req, res) => {
    res.send("Backend running");
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
            message: error.message,
        });
    }
});

module.exports = app;