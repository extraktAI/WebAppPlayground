import dotenv from "dotenv";
dotenv.config();

import express from "express";
import morgan from "morgan";
import { ICache, RedisCache, createBlobService, createCache } from "./services";

///////////////////////////////////////////////////////////////////////////

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

///////////////////////////////////////////////////////////////////////////

let counter = 0;
const cache: ICache = createCache("counter:");
const blob_storage = createBlobService();
const blob_container = "attachments";
const blob_name = "my-blob";

///////////////////////////////////////////////////////////////////////////

// json parser for POST body
app.use(express.json({ limit: "50mb" }));

app.get("/", async (req, res) => {
    const name = "" + (req.query.name || "World");
    const val = await cache.getStr(name);
    res.send(`Hello ${name}! counter=${counter} val=${val ?? "null"}`);
});

// curl -X POST http://localhost:PORT/inc -d '{"name":"Alice"}' -H "Content-Type: application/json"
app.post("/inc", async (req, res) => {
    counter++;
    const name = "" + (req.body.name || "World");
    const val = await cache.setStr(name, "" + counter, 10);
    res.send({ counter, name, val });
});

// curl -X POST http://localhost:PORT/blob-store -d '{}' -H "Content-Type: application/json"
app.post("/blob-store", async (req, res) => {
    await blob_storage.uploadBufferToBlob(blob_container, blob_name, {}, Buffer.from("Hello, World! " + (new Date().toISOString())));
    res.send({});
});
// curl http://localhost:PORT/blob-store
app.get("/blob-store", async (req, res) => {
    const data = await blob_storage.downloadBufferFromBlob(blob_container, blob_name);
    res.send("Data=" + data.toString());
});


///////////////////////////////////////////////////////////////////////////

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
