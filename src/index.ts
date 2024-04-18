import express from "express";
import morgan from "morgan";

const app = express();
const port = +(process.env.PORT ?? "80");

morgan.format("myformat", ":method :url :status len=:res[content-length] - time=:response-time ms");
app.use(morgan("myformat", {
    stream: {
        write: (message: string) => {
            console.log(message.trim());
        }
    }
}));

let counter = 0;

app.get("/", (req, res) => {
    const name = req.query.name || "World";
    res.send(`Hello ${name}! counter=${counter}`);
});


// curl -X POST http://localhost:PORT/inc
app.post("/inc", (req, res) => {
    counter++;
    res.send(`counter=${counter}`);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
