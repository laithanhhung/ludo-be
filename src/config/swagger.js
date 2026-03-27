const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path");

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Ludo Backend API",
            version: "1.0.0",
            description: "API documentation for Ludo Backend",
        },
        servers: [
            {
                url: "http://localhost:4000",
            },
        ],
        components: {
            schemas: {
                Player: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        slotId: { type: "integer" },
                        ready: { type: "boolean" },
                    },
                },
                Room: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        status: {
                            type: "string",
                            enum: ["waiting", "playing", "finished"],
                        },
                        players: {
                            type: "array",
                            items: {
                                $ref: "#/components/schemas/Player",
                            },
                        },
                        currentTurn: { type: "integer" },
                        diceValue: { type: "integer" },
                    },
                },
            },
        },
    },
    apis: [
        path.join(__dirname, "../index.js"),
        path.join(__dirname, "../routes/*.js"),
    ],
};

module.exports = swaggerJsdoc(options);