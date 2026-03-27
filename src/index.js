require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("node:http");
const { Server } = require("socket.io");
const {
  createRoom,
  getRoom,
  listRooms,
  joinSlot,
  leaveSlot,
  toggleReady,
  startGame,
  rollDice,
  disconnectSocket,
} = require("./game/roomStorePg");
const { checkDbConnection } = require("./db/client");
const roomRoutes = require("./routes/roomRoutes");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_, res) => {
  res.json({ ok: true });
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

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

async function emitRoomUpdate(roomId) {
  const room = await getRoom(roomId);
  if (!room) return;
  io.to(roomId).emit("room:updated", room);
}

function safeSocketHandler(handler) {
  return async (...args) => {
    try {
      await handler(...args);
    } catch (error) {
      const socket = args[0];
      socket.emit("server:error", {
        message: error instanceof Error ? error.message : "Unknown server error",
      });
    }
  };
}

io.on("connection", (socket) => {
  socket.on(
    "room:join",
    safeSocketHandler(async (payload) => {
      const roomId = String(payload.roomId || "").toUpperCase();
      const room = await getRoom(roomId);
      if (!room) throw new Error("ROOM_NOT_FOUND");
      socket.join(roomId);
      socket.emit("room:updated", room);
    }),
  );

  socket.on(
    "slot:join",
    safeSocketHandler(async (payload) => {
      const roomId = String(payload.roomId || "").toUpperCase();
      const slotId = Number(payload.slotId);
      const playerName = String(payload.playerName || "");
      await joinSlot({ roomId, slotId, playerName, socketId: socket.id });
      socket.join(roomId);
      await emitRoomUpdate(roomId);
    }),
  );

  socket.on(
    "slot:leave",
    safeSocketHandler(async (payload) => {
      const roomId = String(payload.roomId || "").toUpperCase();
      const slotId = Number(payload.slotId);
      await leaveSlot({ roomId, slotId, socketId: socket.id });
      await emitRoomUpdate(roomId);
    }),
  );

  socket.on(
    "slot:ready",
    safeSocketHandler(async (payload) => {
      const roomId = String(payload.roomId || "").toUpperCase();
      const slotId = Number(payload.slotId);
      await toggleReady({ roomId, slotId, socketId: socket.id });
      await emitRoomUpdate(roomId);
    }),
  );

  socket.on(
    "game:start",
    safeSocketHandler(async (payload) => {
      const roomId = String(payload.roomId || "").toUpperCase();
      await startGame(roomId);
      await emitRoomUpdate(roomId);
    }),
  );

  socket.on(
    "dice:roll",
    safeSocketHandler(async (payload) => {
      const roomId = String(payload.roomId || "").toUpperCase();
      await rollDice(roomId);
      await emitRoomUpdate(roomId);
    }),
  );

  socket.on("disconnect", async () => {
    await disconnectSocket(socket.id);
    io.emit("rooms:updated", await listRooms());
  });
});

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, () => {
  console.log(`Backend is running at http://localhost:${PORT}`);
});
