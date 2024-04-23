import Redis from "ioredis";

const REDIS_HOST = process.env.REDIS_HOST || "";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6380", 10);
const REDIS_KEY_PRIMARY = process.env.REDIS_KEY_PRIMARY || "";
const REDIS_USE_TLS = (process.env.REDIS_USE_TLS ?? "true").toLowerCase() === "true";

export const newRedisClient = (): Redis => {
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
