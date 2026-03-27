const express = require("express");
const { getPool } = require("../db/client");
const {
  createRoom,
  getRoom,
  listRooms,
  joinSlot,
  leaveSlot,
  toggleReady,
  startGame,
  rollDice,
} = require("../game/roomStorePg");

const router = express.Router();

router.get("/rooms", async (_req, res) => {
  try {
    const rooms = await listRooms();
    return res.json(rooms);
  } catch (error) {
    return res.status(500).json({ message: error.message || "LIST_ROOMS_FAILED" });
  }
});

router.post("/rooms", async (req, res) => {
  try {
    const name = req.body?.name || "Phong moi";
    const room = await createRoom(name);
    return res.status(201).json(room);
  } catch (error) {
    return res.status(500).json({ message: error.message || "CREATE_ROOM_FAILED" });
  }
});

router.get("/rooms/:roomId", async (req, res) => {
  try {
    const room = await getRoom(String(req.params.roomId || "").toUpperCase());
    if (!room) return res.status(404).json({ message: "Room not found" });
    return res.json(room);
  } catch (error) {
    return res.status(500).json({ message: error.message || "GET_ROOM_FAILED" });
  }
});

router.post("/rooms/:roomId/slots/:slotId/join", async (req, res) => {
  try {
    const room = await joinSlot({
      roomId: String(req.params.roomId || "").toUpperCase(),
      slotId: Number(req.params.slotId),
      playerName: String(req.body?.playerName || ""),
      socketId: req.body?.socketId ? String(req.body.socketId) : null,
    });
    return res.json(room);
  } catch (error) {
    return res.status(400).json({ message: error.message || "JOIN_SLOT_FAILED" });
  }
});

router.post("/rooms/:roomId/slots/:slotId/leave", async (req, res) => {
  try {
    const room = await leaveSlot({
      roomId: String(req.params.roomId || "").toUpperCase(),
      slotId: Number(req.params.slotId),
      socketId: req.body?.socketId ? String(req.body.socketId) : null,
    });
    return res.json(room);
  } catch (error) {
    return res.status(400).json({ message: error.message || "LEAVE_SLOT_FAILED" });
  }
});

router.post("/rooms/:roomId/slots/:slotId/ready", async (req, res) => {
  try {
    const room = await toggleReady({
      roomId: String(req.params.roomId || "").toUpperCase(),
      slotId: Number(req.params.slotId),
      socketId: req.body?.socketId ? String(req.body.socketId) : null,
    });
    return res.json(room);
  } catch (error) {
    return res.status(400).json({ message: error.message || "TOGGLE_READY_FAILED" });
  }
});

router.post("/rooms/:roomId/start", async (req, res) => {
  try {
    const room = await startGame(String(req.params.roomId || "").toUpperCase());
    return res.json(room);
  } catch (error) {
    return res.status(400).json({ message: error.message || "START_GAME_FAILED" });
  }
});

router.post("/rooms/:roomId/roll-dice", async (req, res) => {
  try {
    const room = await rollDice(String(req.params.roomId || "").toUpperCase());
    return res.json(room);
  } catch (error) {
    return res.status(400).json({ message: error.message || "ROLL_DICE_FAILED" });
  }
});

router.get("/challenges", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit || 20), 100));
    const pool = getPool();
    const result = await pool.query(
      `
      SELECT id, question, option_a AS "optionA", option_b AS "optionB", option_c AS "optionC", option_d AS "optionD", correct_option AS "correctOption"
      FROM challenge_questions
      WHERE is_active = TRUE
      ORDER BY id ASC
      LIMIT $1
    `,
      [limit],
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: error.message || "LIST_CHALLENGES_FAILED" });
  }
});

router.get("/challenges/random", async (_req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `
      SELECT id, question, option_a AS "optionA", option_b AS "optionB", option_c AS "optionC", option_d AS "optionD", correct_option AS "correctOption"
      FROM challenge_questions
      WHERE is_active = TRUE
      ORDER BY random()
      LIMIT 1
    `,
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "NO_CHALLENGES_FOUND" });
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message || "RANDOM_CHALLENGE_FAILED" });
  }
});

module.exports = router;
