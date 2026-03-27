const { randomUUID } = require("node:crypto");
const { MAX_SLOTS } = require("./constants");

const rooms = new Map();

function createLobbySlots() {
  return Array.from({ length: MAX_SLOTS }, (_, index) => ({
    slotId: index,
    joined: false,
    ready: false,
    playerName: "",
    socketId: null,
  }));
}

function createRoom(name = "Phong moi") {
  const roomId = randomUUID().slice(0, 8).toUpperCase();
  const now = new Date().toISOString();
  const room = {
    id: roomId,
    name,
    status: "waiting",
    createdAt: now,
    updatedAt: now,
    currentPlayerIndex: 0,
    diceValue: 1,
    turn: 1,
    slots: createLobbySlots(),
  };

  rooms.set(roomId, room);
  return room;
}

function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

function listRooms() {
  return Array.from(rooms.values()).map((room) => ({
    id: room.id,
    name: room.name,
    status: room.status,
    players: room.slots.filter((slot) => slot.joined).length,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  }));
}

function touchRoom(room) {
  room.updatedAt = new Date().toISOString();
}

function joinSlot({ roomId, slotId, playerName, socketId }) {
  const room = getRoom(roomId);
  if (!room) throw new Error("ROOM_NOT_FOUND");
  if (room.status !== "waiting") throw new Error("ROOM_ALREADY_STARTED");

  const slot = room.slots.find((s) => s.slotId === slotId);
  if (!slot) throw new Error("SLOT_NOT_FOUND");
  if (slot.joined) throw new Error("SLOT_OCCUPIED");

  slot.joined = true;
  slot.ready = false;
  slot.playerName = playerName || `Nguoi choi ${slotId + 1}`;
  slot.socketId = socketId;
  touchRoom(room);
  return room;
}

function leaveSlot({ roomId, slotId, socketId }) {
  const room = getRoom(roomId);
  if (!room) throw new Error("ROOM_NOT_FOUND");

  const slot = room.slots.find((s) => s.slotId === slotId);
  if (!slot) throw new Error("SLOT_NOT_FOUND");
  if (slot.socketId !== socketId) throw new Error("FORBIDDEN_SLOT_OWNER");

  slot.joined = false;
  slot.ready = false;
  slot.playerName = "";
  slot.socketId = null;
  touchRoom(room);
  return room;
}

function toggleReady({ roomId, slotId, socketId }) {
  const room = getRoom(roomId);
  if (!room) throw new Error("ROOM_NOT_FOUND");

  const slot = room.slots.find((s) => s.slotId === slotId);
  if (!slot) throw new Error("SLOT_NOT_FOUND");
  if (slot.socketId !== socketId) throw new Error("FORBIDDEN_SLOT_OWNER");
  if (!slot.joined) throw new Error("SLOT_EMPTY");

  slot.ready = !slot.ready;
  touchRoom(room);
  return room;
}

function startGame(roomId) {
  const room = getRoom(roomId);
  if (!room) throw new Error("ROOM_NOT_FOUND");

  const joinedSlots = room.slots.filter((slot) => slot.joined);
  if (joinedSlots.length < 2) throw new Error("MIN_2_PLAYERS_REQUIRED");
  if (!joinedSlots.every((slot) => slot.ready)) throw new Error("ALL_PLAYERS_MUST_READY");

  room.status = "playing";
  room.turn = 1;
  room.currentPlayerIndex = 0;
  room.diceValue = 1;
  touchRoom(room);
  return room;
}

function rollDice(roomId) {
  const room = getRoom(roomId);
  if (!room) throw new Error("ROOM_NOT_FOUND");
  if (room.status !== "playing") throw new Error("ROOM_NOT_PLAYING");

  room.diceValue = Math.floor(Math.random() * 6) + 1;
  room.turn += 1;
  touchRoom(room);
  return room;
}

function disconnectSocket(socketId) {
  for (const room of rooms.values()) {
    for (const slot of room.slots) {
      if (slot.socketId === socketId) {
        slot.joined = false;
        slot.ready = false;
        slot.playerName = "";
        slot.socketId = null;
        touchRoom(room);
      }
    }
  }
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
