import "dotenv/config";

import express from "express";
import morgan from "morgan";
import { promises as fs } from "fs";
import { ICache, IDb, RedisCache, createBlobService, createCache, createDb, getCleanTextFromOcr } from "./services";

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
const db: IDb = createDb();

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

app.get("/status", async (req, res) => {
    const msgs = [
        `counter=${counter}`,
        `cache=${cache.name()}`,
        `blob_storage=${blob_storage.name()}`
    ];
    res.send(msgs.join("\n"));
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
    res.send("Data=" + data.toString() + "\n");
});
// curl http://localhost:PORT/items
app.get("/items", async (req, res) => {
    const data = await db.items();
    res.send("Items=" + data.toString() + "\n");
});
// curl http://localhost:PORT/ocr
app.get("/ocr", async (req, res) => {
    const bf = await fs.readFile(__dirname + "/../sample.pdf");
    const content = await getCleanTextFromOcr(bf);
    res.send("OCR result=" + content);
});

///////////////////////////////////////////////////////////////////////////

app.listen(port, () => {
    console.log(`Server running at port ${port} - http://localhost:${port}`);
});
