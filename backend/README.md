# Backend - Cờ Cá Ngựa

Backend realtime bằng Node.js cho game Cờ Cá Ngựa 4.0.

## Công nghệ

- Express REST API
- Socket.IO realtime events
- In-memory room store (dễ thay bằng Redis/DB sau)

## Chạy local

```bash
npm install
npm run dev
```

Server mặc định chạy ở `http://localhost:4000`.

## REST API

- `GET /health`
- `GET /api/rooms`
- `POST /api/rooms` body: `{ "name": "Phòng 1" }`
- `GET /api/rooms/:roomId`

## Socket Events

Client emit:

- `room:join` `{ roomId }`
- `slot:join` `{ roomId, slotId, playerName }`
- `slot:leave` `{ roomId, slotId }`
- `slot:ready` `{ roomId, slotId }`
- `game:start` `{ roomId }`
- `dice:roll` `{ roomId }`

Server emit:

- `room:updated` `(roomState)`
- `rooms:updated` `(rooms[])`
- `server:error` `{ message }`
