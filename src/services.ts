import Redis from "ioredis";
import { Client } from "pg";
import {
    BlobServiceClient,
    Metadata
} from "@azure/storage-blob";

const AZURE_BLOB_CONNECTION_STRING = process.env.AZURE_BLOB_CONNECTION_STRING || "";

const REDIS_HOST = process.env.REDIS_HOST || "";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6380", 10);
const REDIS_KEY_PRIMARY = process.env.REDIS_KEY_PRIMARY || "";
const REDIS_USE_TLS = (process.env.REDIS_USE_TLS ?? "true").toLowerCase() === "true";

const newRedisClient = (): Redis => {
    return new Redis({
        port: REDIS_PORT,
        host: REDIS_HOST,
        password: REDIS_KEY_PRIMARY,
        tls: !REDIS_USE_TLS ? undefined : {
            servername: REDIS_HOST
        },
        name: "redis"
    });
};

///////////////////////////////////////////////////////
// CACHE
export interface ICache {

    name(): string;
    prefix(): string;

    // setters
    setStr(key: string, value: string, ttl_sec: number): Promise<void>;
    setNum(key: string, value: number, ttl_sec: number): Promise<void>;
    setObj(key: string, value: object, ttl_sec: number): Promise<void>;

    // getters
    getStr(key: string): Promise<string | null>;
    getNum(key: string): Promise<number | null>;
    getObj<T>(key: string): Promise<T | null>;

    // deleters
    del(key: string): Promise<void>;

    // misc
    exists(key: string): Promise<boolean>;
}
export function canRunRedis(): boolean {
    return REDIS_HOST.length > 0;
}

/** Factory method for creating blob storage, according to env settings */
export function createCache(prefix: string): ICache {
    if (canRunRedis()) {
        console.log("creating redis client...");
        return new RedisCache(prefix);
    } else {
        console.log("creating dummy blob storage...");
        return new DummyCache(prefix);
    }
}

export class DummyCache implements ICache {

    private map: Map<string, string | number | object> = new Map<string, string | number | object>();
    private prefix_: string;

    constructor(prefix: string) {
        console.log("DummyCache: creating with prefix", prefix);
        this.prefix_ = prefix;
    }

    name(): string {
        return "DummyCache";
    }
    prefix(): string {
        return this.prefix_;
    }
    async setStr(key: string, value: string, ttl_sec: number): Promise<void> {
        console.log("DummyCache: setting key", key, "to", value, "with ttl", ttl_sec, "seconds");
        this.map.set(this.prefix_ + key, value);
    }
    async setNum(key: string, value: number, ttl_sec: number): Promise<void> {
        console.log("DummyCache: setting key", key, "to", value, "with ttl", ttl_sec, "seconds");
        this.map.set(this.prefix_ + key, value);
    }
    async setObj(key: string, value: object, ttl_sec: number): Promise<void> {
        console.log("DummyCache: setting key", key, "to", value, "with ttl", ttl_sec, "seconds");
        this.map.set(this.prefix_ + key, value);
    }
    async getStr(key: string): Promise<string | null> {
        console.log("DummyCache: getting key", key);
        return this.map.get(this.prefix_ + key) as string | null;
    }
    async getNum(key: string): Promise<number | null> {
        console.log("DummyCache: getting key", key);
        return this.map.get(this.prefix_ + key) as number | null;
    }
    async getObj<T>(key: string): Promise<T | null> {
        console.log("DummyCache: getting key", key);
        return this.map.get(this.prefix_ + key) as T | null;
    }
    async del(key: string): Promise<void> {
        console.log("DummyCache: deleting key", key);
        this.map.delete(this.prefix_ + key);
    }
    async exists(key: string): Promise<boolean> {
        console.log("DummyCache: checking if key exists", key);
        return this.map.has(this.prefix_ + key);
    }
}

export class RedisCache implements ICache {
    private redis: Redis;
    private prefix_: string;

    constructor(prefix: string) {
        console.log("RedisCache: creating with prefix", prefix);
        this.redis = newRedisClient();
        this.prefix_ = prefix;
    }

    public name(): string {
        return "RedisCache";
    }
    public prefix(): string {
        return this.prefix_;
    }

    public async setStr(key: string, value: string, ttl_sec: number): Promise<void> {
        console.log(`RedisCache: Setting key ${key} to ${value} with ttl ${ttl_sec} seconds`);
        await this.redis.set(this.prefix_ + key, value, "EX", ttl_sec);
    }

    public async setNum(key: string, value: number, ttl_sec: number): Promise<void> {
        console.log(`RedisCache: Setting key ${key} to ${value} with ttl ${ttl_sec} seconds`);
        await this.redis.set(this.prefix_ + key, value.toString(), "EX", ttl_sec);
    }

    public async setObj(key: string, value: object, ttl_sec: number): Promise<void> {
        console.log(`RedisCache: Setting key ${key} to ${value} with ttl ${ttl_sec} seconds`);
        await this.redis.set(this.prefix_ + key, JSON.stringify(value), "EX", ttl_sec);
    }

    public async getStr(key: string): Promise<string | null> {
        console.log(`RedisCache: Getting key ${key}`);
        return await this.redis.get(this.prefix_ + key);
    }

    public async getNum(key: string): Promise<number | null> {
        console.log(`RedisCache: Getting key ${key}`);
        const value = await this.redis.get(this.prefix_ + key);
        return value ? parseInt(value, 10) : null;
    }

    public async getObj<T>(key: string): Promise<T | null> {
        console.log(`RedisCache: Getting key ${key}`);
        const value = await this.redis.get(this.prefix_ + key);
        return value ? JSON.parse(value) : null;
    }

    public async del(key: string): Promise<void> {
        console.log(`RedisCache: Deleting key ${key}`);
        await this.redis.del(this.prefix_ + key);
    }

    public async exists(key: string): Promise<boolean> {
        console.log(`RedisCache: Checking if key ${key} exists`);
        return await this.redis.exists(this.prefix_ + key) === 1;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////

export interface IBlobService {
    name(): string;
    uploadBufferToBlob(container_name: string, blob_name: string, metadata: Metadata, buffer: Buffer): Promise<void>;
    downloadBufferFromBlob(container_name: string, blob_name: string): Promise<Buffer>;
}

export function canRunAzureBlob(): boolean {
    return AZURE_BLOB_CONNECTION_STRING.length > 0;
}

/** Factory method for creating blob storage, according to env settings */
export function createBlobService(): IBlobService {
    if (canRunAzureBlob()) {
        console.log("creating azure blob storage...");
        return new AzureBlobService();
    } else {
        console.log("creating dummy blob storage...");
        return new DummyBlobService();
    }
}

/** Simple implementation of IBlobService that throws error when any method is called */
export class DummyBlobService implements IBlobService {
    map: Map<string, Buffer> = new Map<string, Buffer>();
    public async uploadBufferToBlob(container_name: string, blob_name: string, metadata: Metadata, buffer: Buffer): Promise<void> { // eslint-disable-line @typescript-eslint/no-unused-vars
        this.map.set(blob_name, buffer);
    }
    public async downloadBufferFromBlob(container_name: string, blob_name: string): Promise<Buffer> { // eslint-disable-line @typescript-eslint/no-unused-vars
        return this.map.get(blob_name) || Buffer.from("");
    }
    public name(): string {
        return "DummyBlobService";
    }
}

/** Blob service that stores data in Azure BLOB storage */
export class AzureBlobService implements IBlobService {

    private con_str: string;

    constructor(con_str?: string) {
        this.con_str = con_str ?? AZURE_BLOB_CONNECTION_STRING;
    }

    public name(): string {
        return "AzureBlobService";
    }
    public async uploadBufferToBlob(container_name: string, blob_name: string, metadata: Metadata, buffer: Buffer): Promise<void> {
        console.log(`Uploading ${blob_name} to ${container_name}`);
        const blob_service_client = BlobServiceClient.fromConnectionString(this.con_str);
        const container_client = blob_service_client.getContainerClient(container_name);
        await container_client.createIfNotExists();
        // upload blob
        const blockBlobClient = container_client.getBlockBlobClient(blob_name);
        await blockBlobClient.upload(buffer, buffer.length);
        // add metadata
        await blockBlobClient.setMetadata(metadata);
        console.log(`Upload of ${blob_name} to ${container_name} complete`);
    }

    public async downloadBufferFromBlob(container_name: string, blob_name: string): Promise<Buffer> {
        console.log(`Downloading ${blob_name} from ${container_name}`);
        const blob_service_client = BlobServiceClient.fromConnectionString(this.con_str);
        const container_client = blob_service_client.getContainerClient(container_name);
        const block_blob_client = container_client.getBlockBlobClient(blob_name);
        // get stream
        const res = await block_blob_client.download();
        if (!res.readableStreamBody) {
            throw new Error("Downloaded stream is undefined");
        }
        // download to buffer
        const buffer = await streamToBuffer(res.readableStreamBody);
        console.log(`Download of ${blob_name} from ${container_name} complete`);
        return buffer;
    }
}


// Helper function to convert a readable stream to a Buffer
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (data) => {
            chunks.push(data instanceof Buffer ? data : Buffer.from(data));
        });
        stream.on("end", () => {
            resolve(Buffer.concat(chunks));
        });
        stream.on("error", reject);
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////

export interface IDb {
    init(): Promise<void>;
    items(): Promise<number[]>;
}

export function createDb(): IDb {
    if (process.env.DB_HOST !== undefined) {
        console.log("creating sql db...");

        const DB_HOST = process.env.DB_HOST || "";
        const DB_PORT = parseInt(process.env.DB_PORT || "5432", 10);
        const DB_USER = process.env.DB_USER || "";
        const DB_PASS = process.env.DB_PASS || "";
        const DB_NAME = process.env.DB_NAME || "";
        const DB_SKIP_SSL = (process.env.DB_SKIP_SSL ?? "false") === "true";

        const CONNECTION_STRING = `postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;

        console.log(`connecting to ${DB_HOST} ...`);
        return new SqlDb(CONNECTION_STRING, false);
    } else {
        console.log("creating mock db...");
        return new MockDb();
    }
}

export class MockDb implements IDb {
    private data: number[] = [];
    private init_called = false;

    public async init(): Promise<void> {
        this.data = [1, 2, 3, 4, 5];
        this.init_called = true;
    }

    public async items(): Promise<number[]> {
        if (!this.init_called) {
            await this.init();
        }
        return this.data.slice();
    }
}

export class SqlDb implements IDb {
    private conn_str: string;
    private skip_ssl: boolean;
    private init_called = false;

    constructor(conn_str: string, skip_ssl: boolean) {
        this.conn_str = conn_str;
        this.skip_ssl = skip_ssl;
    }

    public async init(): Promise<void> {

        if (this.init_called) {
            return;
        }
        const sql_create = `CREATE TABLE IF NOT EXISTS items (
            id SERIAL PRIMARY KEY,
            version NUMERIC NOT NULL
        )`;
        await this.query(sql_create, []);

        // insert data if needed
        const sql_cnt = `select count(*) as cnt from items;`;
        const data_cnt = await this.query(sql_cnt, []);
        console.log(`Data count: `, data_cnt);
        const cnt = data_cnt[0].cnt;
        if (cnt == 0) {
            const d = new Date();
            const values = [
                d.getFullYear(),
                d.getMonth() + 1,
                d.getDate(),
                d.getHours(),
                d.getMinutes(),
                d.getSeconds(),
                d.getMilliseconds()
            ].map(x => "(" + x + ")").join(", ");
            const sql_insert = `insert into items (version) values ${values};`;
            await this.query(sql_insert, []);
        }

        this.init_called = true;
    }

    public async items(): Promise<number[]> {
        if (!this.init_called) {
            await this.init();
        }
        const sql = `select * from items;`;
        const data = await this.query(sql, []);
        return data.map(x => x.version);
    }

    private async query(sql: string, params: any[]): Promise<any[]> {
        console.log(`Running query: ${sql}`);
        console.log(`Params: ${params}`);
        const client = new Client({
            connectionString: this.conn_str,
            ssl: this.skip_ssl ? undefined : { rejectUnauthorized: false }
        });
        const rows: any[] = [];
        try {
            await client.connect();
            const results = await client.query(sql, params);
            console.log(`Received ${results.rowCount} rows`);
            for (const row of results.rows) {
                rows.push(row);
            }
        } catch (err: any) {
            console.error("Error running query", err);
            console.error(`Query: ${sql}, Params: ${params}`);
            console.error(`Current CallStack: ${new Error().stack}`);
        } finally {
            await client.end();
        }
        return rows;
    }
}
