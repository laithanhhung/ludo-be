const { getPool } = require("../db/client");
const { PLAYER_PRESETS } = require("./constants");

const DEFAULT_MAX_SLOTS = 4;

function generateRoomCode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function findRoomByCode(client, roomCode) {
  const roomResult = await client.query(
    `
    SELECT id, code, name, status, max_slots, current_player_index, dice_value, turn, created_at, updated_at
    FROM rooms
    WHERE code = $1
  `,
    [roomCode],
  );
  const room = roomResult.rows[0];
  if (!room) return null;

  const slotsResult = await client.query(
    `
    SELECT
      slot_index AS "slotId",
      joined,
      ready,
      player_name AS "playerName",
      socket_id AS "socketId"
    FROM room_slots
    WHERE room_id = $1
    ORDER BY slot_index ASC
  `,
    [room.id],
  );

  return {
    id: room.code,
    name: room.name,
    status: room.status,
    maxSlots: room.max_slots,
    currentPlayerIndex: room.current_player_index,
    diceValue: room.dice_value,
    turn: room.turn,
    createdAt: room.created_at,
    updatedAt: room.updated_at,
    slots: slotsResult.rows,
  };
}

async function createRoom(name = "Phong moi") {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let room;
    for (let i = 0; i < 5; i += 1) {
      const code = generateRoomCode();
      try {
        const result = await client.query(
          `
          INSERT INTO rooms(code, name, max_slots)
          VALUES ($1, $2, $3)
          RETURNING id, code
        `,
          [code, name, DEFAULT_MAX_SLOTS],
        );
        room = result.rows[0];
        break;
      } catch (error) {
        if (error && error.code === "23505") continue;
        throw error;
      }
    }

    if (!room) throw new Error("ROOM_CODE_GENERATION_FAILED");

    await client.query(
      `
      INSERT INTO room_slots(room_id, slot_index)
      SELECT $1, gs
      FROM generate_series(0, $2 - 1) AS gs
    `,
      [room.id, DEFAULT_MAX_SLOTS],
    );

    await client.query("COMMIT");
    return await findRoomByCode(client, room.code);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getRoom(roomCode) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await findRoomByCode(client, roomCode);
  } finally {
    client.release();
  }
}

async function listRooms() {
  const pool = getPool();
  const result = await pool.query(`
    SELECT
      r.code AS id,
      r.name,
      r.status,
      r.created_at AS "createdAt",
      r.updated_at AS "updatedAt",
      COUNT(*) FILTER (WHERE s.joined) AS players
    FROM rooms r
    LEFT JOIN room_slots s ON s.room_id = r.id
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `);
  return result.rows;
}

async function joinSlot({ roomId, slotId, playerName, socketId }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const roomResult = await client.query("SELECT id, status FROM rooms WHERE code = $1 FOR UPDATE", [roomId]);
    const room = roomResult.rows[0];
    if (!room) throw new Error("ROOM_NOT_FOUND");
    if (room.status !== "waiting") throw new Error("ROOM_ALREADY_STARTED");

    const slotResult = await client.query(
      "SELECT id, joined FROM room_slots WHERE room_id = $1 AND slot_index = $2 FOR UPDATE",
      [room.id, slotId],
    );
    const slot = slotResult.rows[0];
    if (!slot) throw new Error("SLOT_NOT_FOUND");
    if (slot.joined) throw new Error("SLOT_OCCUPIED");

    await client.query(
      `
      UPDATE room_slots
      SET joined = TRUE,
          ready = FALSE,
          player_name = $1,
          socket_id = $2,
          joined_at = NOW(),
          updated_at = NOW()
      WHERE id = $3
    `,
      [playerName || `Nguoi choi ${slotId + 1}`, socketId || null, slot.id],
    );

    await client.query("UPDATE rooms SET updated_at = NOW() WHERE id = $1", [room.id]);
    await client.query("COMMIT");
    return await findRoomByCode(client, roomId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function leaveSlot({ roomId, slotId, socketId }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const roomResult = await client.query("SELECT id FROM rooms WHERE code = $1 FOR UPDATE", [roomId]);
    const room = roomResult.rows[0];
    if (!room) throw new Error("ROOM_NOT_FOUND");

    const slotResult = await client.query(
      "SELECT id, socket_id FROM room_slots WHERE room_id = $1 AND slot_index = $2 FOR UPDATE",
      [room.id, slotId],
    );
    const slot = slotResult.rows[0];
    if (!slot) throw new Error("SLOT_NOT_FOUND");
    if (socketId && slot.socket_id && slot.socket_id !== socketId) throw new Error("FORBIDDEN_SLOT_OWNER");

    await client.query(
      `
      UPDATE room_slots
      SET joined = FALSE,
          ready = FALSE,
          player_name = '',
          socket_id = NULL,
          joined_at = NULL,
          updated_at = NOW()
      WHERE id = $1
    `,
      [slot.id],
    );

    await client.query("UPDATE rooms SET updated_at = NOW() WHERE id = $1", [room.id]);
    await client.query("COMMIT");
    return await findRoomByCode(client, roomId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function toggleReady({ roomId, slotId, socketId }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const roomResult = await client.query("SELECT id FROM rooms WHERE code = $1 FOR UPDATE", [roomId]);
    const room = roomResult.rows[0];
    if (!room) throw new Error("ROOM_NOT_FOUND");

    const slotResult = await client.query(
      "SELECT id, joined, ready, socket_id FROM room_slots WHERE room_id = $1 AND slot_index = $2 FOR UPDATE",
      [room.id, slotId],
    );
    const slot = slotResult.rows[0];
    if (!slot) throw new Error("SLOT_NOT_FOUND");
    if (socketId && slot.socket_id && slot.socket_id !== socketId) throw new Error("FORBIDDEN_SLOT_OWNER");
    if (!slot.joined) throw new Error("SLOT_EMPTY");

    await client.query("UPDATE room_slots SET ready = $1, updated_at = NOW() WHERE id = $2", [!slot.ready, slot.id]);
    await client.query("UPDATE rooms SET updated_at = NOW() WHERE id = $1", [room.id]);
    await client.query("COMMIT");
    return await findRoomByCode(client, roomId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function startGame(roomId) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const roomResult = await client.query("SELECT id FROM rooms WHERE code = $1 FOR UPDATE", [roomId]);
    const room = roomResult.rows[0];
    if (!room) throw new Error("ROOM_NOT_FOUND");

    const slotsResult = await client.query(
      `
      SELECT slot_index, player_name
      FROM room_slots
      WHERE room_id = $1 AND joined = TRUE
      ORDER BY slot_index ASC
    `,
      [room.id],
    );
    const joinedSlots = slotsResult.rows;
    if (joinedSlots.length < 2) throw new Error("MIN_2_PLAYERS_REQUIRED");

    const readyResult = await client.query(
      `
      SELECT COUNT(*)::int AS not_ready_count
      FROM room_slots
      WHERE room_id = $1 AND joined = TRUE AND ready = FALSE
    `,
      [room.id],
    );
    if (readyResult.rows[0].not_ready_count > 0) throw new Error("ALL_PLAYERS_MUST_READY");

    await client.query(
      `
      UPDATE rooms
      SET status = 'playing',
          turn = 1,
          current_player_index = 0,
          dice_value = 1,
          updated_at = NOW()
      WHERE id = $1
    `,
      [room.id],
    );

    const matchResult = await client.query(
      `
      INSERT INTO matches(room_id, status)
      VALUES ($1, 'active')
      RETURNING id
    `,
      [room.id],
    );
    const matchId = matchResult.rows[0].id;

    const insertedPlayersResult = await client.query(
      `
      INSERT INTO match_players(match_id, slot_index, player_name, color_hex, start_index)
      SELECT
        $1,
        rs.slot_index,
        rs.player_name,
        $2::text,
        $3::smallint
      FROM room_slots rs
      WHERE rs.room_id = $4 AND rs.joined = TRUE
      ORDER BY rs.slot_index
      RETURNING id, slot_index
    `,
      [matchId, null, 0, room.id],
    );

    for (const player of insertedPlayersResult.rows) {
      const preset = PLAYER_PRESETS[player.slot_index] || PLAYER_PRESETS[0];
      await client.query(
        `
        UPDATE match_players
        SET color_hex = $1, start_index = $2, updated_at = NOW()
        WHERE id = $3
      `,
        [preset.color, preset.startIndex, player.id],
      );

      for (let i = 1; i <= 4; i += 1) {
        await client.query(
          `
          INSERT INTO pawns(match_player_id, pawn_code, level, position, goal_lane_index, shield_turns, is_active, finished)
          VALUES ($1, $2, 1, NULL, NULL, 0, FALSE, FALSE)
        `,
          [player.id, `H${i}`],
        );
      }
    }

    await client.query("COMMIT");
    return await findRoomByCode(client, roomId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function rollDice(roomId) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const roomResult = await client.query(
      `
      SELECT id, status, turn, current_player_index
      FROM rooms
      WHERE code = $1
      FOR UPDATE
    `,
      [roomId],
    );
    const room = roomResult.rows[0];
    if (!room) throw new Error("ROOM_NOT_FOUND");
    if (room.status !== "playing") throw new Error("ROOM_NOT_PLAYING");

    const diceValue = Math.floor(Math.random() * 6) + 1;
    const nextTurn = room.turn + 1;

    await client.query(
      `
      UPDATE rooms
      SET dice_value = $1,
          turn = $2,
          updated_at = NOW()
      WHERE id = $3
    `,
      [diceValue, nextTurn, room.id],
    );

    const matchResult = await client.query(
      `
      SELECT id
      FROM matches
      WHERE room_id = $1 AND status = 'active'
      ORDER BY started_at DESC
      LIMIT 1
    `,
      [room.id],
    );
    const activeMatch = matchResult.rows[0];
    if (activeMatch) {
      await client.query(
        `
        INSERT INTO dice_rolls(match_id, room_id, slot_index, turn_number, value)
        VALUES ($1, $2, $3, $4, $5)
      `,
        [activeMatch.id, room.id, room.current_player_index, nextTurn, diceValue],
      );
    }

    await client.query("COMMIT");
    return await findRoomByCode(client, roomId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function disconnectSocket(socketId) {
  if (!socketId) return;
  const pool = getPool();
  await pool.query(
    `
    UPDATE room_slots
    SET joined = FALSE,
        ready = FALSE,
        player_name = '',
        socket_id = NULL,
        joined_at = NULL,
        updated_at = NOW()
    WHERE socket_id = $1
  `,
    [socketId],
  );
}

module.exports = {
  createRoom,
  getRoom,
  listRooms,
  joinSlot,
  leaveSlot,
  toggleReady,
  startGame,
  rollDice,
  disconnectSocket,
};
