# MCP Integration Guide (Backend)

Tai lieu nay dung de MCP client/agent goi API backend `game-ludo` thong qua HTTP.

## 1) Base URL

- Local: `http://localhost:4000`
- Vercel: `https://<your-backend-domain>`

Tat ca endpoint ben duoi deu co prefix `/api`.

## 2) Yeu cau moi truong

Can khai bao trong backend:

```env
SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<DB_PASSWORD>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

## 3) Health / DB check

### GET `/api/status`
- Muc dich: check backend online.
- Response:

```json
{
  "status": "Online",
  "level": "Industrialization 4.0"
}
```

### GET `/api/db-status`
- Muc dich: check ket noi Postgres/Supabase.
- Success:

```json
{
  "ok": true,
  "database": "connected",
  "now": "2026-03-27T05:36:40.123Z"
}
```

## 4) Room APIs (DB-backed)

### GET `/api/rooms`
- Danh sach phong.

### POST `/api/rooms`
- Tao phong moi.
- Body:

```json
{
  "name": "Phong nhanh"
}
```

### GET `/api/rooms/:roomId`
- Lay chi tiet phong theo ma phong.

### POST `/api/rooms/:roomId/slots/:slotId/join`
- Join vao slot.
- Body:

```json
{
  "playerName": "Laith",
  "socketId": "optional-socket-id"
}
```

### POST `/api/rooms/:roomId/slots/:slotId/leave`
- Roi slot.
- Body:

```json
{
  "socketId": "optional-socket-id"
}
```

### POST `/api/rooms/:roomId/slots/:slotId/ready`
- Toggle trang thai ready.
- Body:

```json
{
  "socketId": "optional-socket-id"
}
```

### POST `/api/rooms/:roomId/start`
- Bat dau game.

### POST `/api/rooms/:roomId/roll-dice`
- Tung xuc xac.

## 5) Challenge APIs

### GET `/api/challenges?limit=20`
- Lay danh sach cau hoi challenge.

### GET `/api/challenges/random`
- Lay ngau nhien 1 cau hoi challenge.

## 6) Error conventions

API tra loi loi dang:

```json
{
  "message": "ROOM_NOT_FOUND"
}
```

Ma loi thuong gap:
- `ROOM_NOT_FOUND`
- `SLOT_NOT_FOUND`
- `SLOT_OCCUPIED`
- `FORBIDDEN_SLOT_OWNER`
- `MIN_2_PLAYERS_REQUIRED`
- `ALL_PLAYERS_MUST_READY`
- `ROOM_NOT_PLAYING`
- `NO_CHALLENGES_FOUND`

## 7) MCP Tool mapping goi nhanh

Neu MCP co HTTP tool, map nhu sau:

- `create_room(name)` -> `POST /api/rooms`
- `list_rooms()` -> `GET /api/rooms`
- `get_room(roomId)` -> `GET /api/rooms/:roomId`
- `join_slot(roomId, slotId, playerName)` -> `POST /api/rooms/:roomId/slots/:slotId/join`
- `leave_slot(roomId, slotId)` -> `POST /api/rooms/:roomId/slots/:slotId/leave`
- `toggle_ready(roomId, slotId)` -> `POST /api/rooms/:roomId/slots/:slotId/ready`
- `start_game(roomId)` -> `POST /api/rooms/:roomId/start`
- `roll_dice(roomId)` -> `POST /api/rooms/:roomId/roll-dice`
- `random_challenge()` -> `GET /api/challenges/random`

## 8) Quick test cURL

```bash
curl http://localhost:4000/api/db-status
curl -X POST http://localhost:4000/api/rooms -H "content-type: application/json" -d "{\"name\":\"Phong MCP\"}"
curl http://localhost:4000/api/challenges/random
```
