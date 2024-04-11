import express from "express";

const app = express();
const port = +(process.env.PORT ?? "8000");

app.get("/", (req, res) => {
    const name = req.query.name || "World";
    res.send(`Hello ${name}!`);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

