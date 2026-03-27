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

/**
 * @swagger
 * /api/rooms:
 *   get:
 *     summary: Get all rooms
 *     tags: [Rooms]
 *     responses:
 *       200:
 *         description: List of rooms
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Room'
 *       500:
 *         description: Failed to list rooms
 */
router.get("/rooms", async (_req, res) => {
  try {
    const rooms = await listRooms();
    return res.json(rooms);
  } catch (error) {
    return res.status(500).json({ message: error.message || "LIST_ROOMS_FAILED" });
  }
});

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: Create new room
 *     tags: [Rooms]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Phong 1
 *     responses:
 *       201:
 *         description: Room created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       500:
 *         description: Create failed
 */
router.post("/rooms", async (req, res) => {
  try {
    const name = req.body?.name || "Phong moi";
    const room = await createRoom(name);
    return res.status(201).json(room);
  } catch (error) {
    return res.status(500).json({ message: error.message || "CREATE_ROOM_FAILED" });
  }
});

/**
 * @swagger
 * /api/rooms/{roomId}:
 *   get:
 *     summary: Get room by ID
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       404:
 *         description: Room not found
 */
router.get("/rooms/:roomId", async (req, res) => {
  try {
    const room = await getRoom(String(req.params.roomId || "").toUpperCase());
    if (!room) return res.status(404).json({ message: "Room not found" });
    return res.json(room);
  } catch (error) {
    return res.status(500).json({ message: error.message || "GET_ROOM_FAILED" });
  }
});

/**
 * @swagger
 * /api/rooms/{roomId}/slots/{slotId}/join:
 *   post:
 *     summary: Join a slot in a room
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               playerName:
 *                 type: string
 *               socketId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated room
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       400:
 *         description: Join failed
 */
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

/**
 * @swagger
 * /api/rooms/{roomId}/slots/{slotId}/leave:
 *   post:
 *     summary: Leave a slot
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               socketId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated room
 *       400:
 *         description: Leave failed
 */
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

/**
 * @swagger
 * /api/rooms/{roomId}/slots/{slotId}/ready:
 *   post:
 *     summary: Toggle ready state
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Updated room
 *       400:
 *         description: Toggle failed
 */
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

/**
 * @swagger
 * /api/rooms/{roomId}/start:
 *   post:
 *     summary: Start game
 *     tags: [Game]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Game started
 *       400:
 *         description: Start failed
 */
router.post("/rooms/:roomId/start", async (req, res) => {
  try {
    const room = await startGame(String(req.params.roomId || "").toUpperCase());
    return res.json(room);
  } catch (error) {
    return res.status(400).json({ message: error.message || "START_GAME_FAILED" });
  }
});

/**
 * @swagger
 * /api/rooms/{roomId}/roll-dice:
 *   post:
 *     summary: Roll dice
 *     tags: [Game]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dice rolled
 *       400:
 *         description: Roll failed
 */
router.post("/rooms/:roomId/roll-dice", async (req, res) => {
  try {
    const room = await rollDice(String(req.params.roomId || "").toUpperCase());
    return res.json(room);
  } catch (error) {
    return res.status(400).json({ message: error.message || "ROLL_DICE_FAILED" });
  }
});

/**
 * @swagger
 * /api/challenges:
 *   get:
 *     summary: Get challenge questions
 *     tags: [Challenges]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of questions (1-100)
 *     responses:
 *       200:
 *         description: List of challenges
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
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

/**
 * @swagger
 * /api/challenges/random:
 *   get:
 *     summary: Get random challenge
 *     tags: [Challenges]
 *     responses:
 *       200:
 *         description: Random challenge
 *       404:
 *         description: No challenge found
 */
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
