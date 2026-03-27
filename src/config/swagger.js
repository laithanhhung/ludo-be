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
        servers: [{ url: "/api" }],
    },
    apis: [
        path.resolve(process.cwd(), "src/index.js"),
        path.resolve(process.cwd(), "src/routes/*.js"),
    ],
};

module.exports = swaggerJsdoc(options);