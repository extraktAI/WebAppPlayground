import Redis from "ioredis";
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
        this.prefix_ = prefix;
    }

    prefix(): string {
        return this.prefix_;
    }
    async setStr(key: string, value: string, ttl_sec: number): Promise<void> {
        this.map.set(this.prefix_ + key, value);
    }
    async setNum(key: string, value: number, ttl_sec: number): Promise<void> {
        this.map.set(this.prefix_ + key, value);
    }
    async setObj(key: string, value: object, ttl_sec: number): Promise<void> {
        this.map.set(this.prefix_ + key, value);
    }
    async getStr(key: string): Promise<string | null> {
        return this.map.get(this.prefix_ + key) as string | null;
    }
    async getNum(key: string): Promise<number | null> {
        return this.map.get(this.prefix_ + key) as number | null;
    }
    async getObj<T>(key: string): Promise<T | null> {
        return this.map.get(this.prefix_ + key) as T | null;
    }
    async del(key: string): Promise<void> {
        this.map.delete(this.prefix_ + key);
    }
    async exists(key: string): Promise<boolean> {
        return this.map.has(this.prefix_ + key);
    }
}

export class RedisCache implements ICache {
    private redis: Redis;
    private prefix_: string;

    constructor(prefix: string) {
        this.redis = newRedisClient();
        this.prefix_ = prefix;
    }

    public prefix(): string {
        return this.prefix_;
    }

    public async setStr(key: string, value: string, ttl_sec: number): Promise<void> {
        await this.redis.set(this.prefix_ + key, value, "EX", ttl_sec);
    }

    public async setNum(key: string, value: number, ttl_sec: number): Promise<void> {
        await this.redis.set(this.prefix_ + key, value.toString(), "EX", ttl_sec);
    }

    public async setObj(key: string, value: object, ttl_sec: number): Promise<void> {
        await this.redis.set(this.prefix_ + key, JSON.stringify(value), "EX", ttl_sec);
    }

    public async getStr(key: string): Promise<string | null> {
        return await this.redis.get(this.prefix_ + key);
    }

    public async getNum(key: string): Promise<number | null> {
        const value = await this.redis.get(this.prefix_ + key);
        return value ? parseInt(value, 10) : null;
    }

    public async getObj<T>(key: string): Promise<T | null> {
        const value = await this.redis.get(this.prefix_ + key);
        return value ? JSON.parse(value) : null;
    }

    public async del(key: string): Promise<void> {
        await this.redis.del(this.prefix_ + key);
    }

    public async exists(key: string): Promise<boolean> {
        return await this.redis.exists(this.prefix_ + key) === 1;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////

export interface IBlobService {
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
}

/** Blob service that stores data in Azure BLOB storage */
export class AzureBlobService implements IBlobService {

    private con_str: string;

    constructor(con_str?: string) {
        this.con_str = con_str ?? AZURE_BLOB_CONNECTION_STRING;
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

