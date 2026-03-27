# Database design (PostgreSQL)

File chinh: `db/schema.sql`

## Bang chinh

- `rooms`: thong tin phong, trang thai choi, turn, dice hien tai.
- `room_slots`: trang thai 4 slot trong phong (joined, ready, player_name, socket_id).
- `matches`: moi van choi duoc tao khi room bat dau game.
- `match_players`: snapshot nguoi choi cua van.
- `pawns`: trang thai tung quan co trong van.
- `dice_rolls`: log tung lan tung xuc xac.
- `challenge_questions`: ngan hang cau hoi challenge.
- `challenge_attempts`: log tra loi challenge trong van.
- `users`: thong tin user co ban (co the mo rong auth sau).

## Chay schema

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

## Ket noi Supabase

1. Tao file `.env` trong thu muc `backend` theo mau `.env.example`.
2. Dien mat khau DB that vao `SUPABASE_DB_URL`.
3. Kiem tra ket noi:

```bash
npm run start
# mo http://localhost:4000/api/db-status
```

Tren Vercel, them env var `SUPABASE_DB_URL` trong Project Settings -> Environment Variables.

## API theo DB

- `GET /api/rooms`
- `POST /api/rooms` body: `{ "name": "Phong moi" }`
- `GET /api/rooms/:roomId`
- `POST /api/rooms/:roomId/slots/:slotId/join` body: `{ "playerName": "Laith", "socketId": "optional" }`
- `POST /api/rooms/:roomId/slots/:slotId/leave` body: `{ "socketId": "optional" }`
- `POST /api/rooms/:roomId/slots/:slotId/ready` body: `{ "socketId": "optional" }`
- `POST /api/rooms/:roomId/start`
- `POST /api/rooms/:roomId/roll-dice`
- `GET /api/challenges?limit=20`
- `GET /api/challenges/random`

## Goi y mapping tu backend hien tai

- `createRoom` -> insert `rooms` + tao 4 dong `room_slots`
- `joinSlot/leaveSlot/toggleReady` -> update `room_slots`
- `startGame` -> update `rooms.status='playing'` + tao `matches`, `match_players`, `pawns`
- `rollDice` -> update `rooms.dice_value`, `rooms.turn` + insert `dice_rolls`
- challenge event -> doc random `challenge_questions`, ghi `challenge_attempts`
