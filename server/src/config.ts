import {z} from 'zod';
export type ServerConfig={port:number;host:string;nodeEnv:'development'|'production'|'test'};
const ServerConfigSchema=z.object({
 PORT:z.coerce.number().int().min(1).max(65535).default(3000),
 HOST:z.string().min(1).default('127.0.0.1'),
 NODE_ENV:z.enum(['development','production','test']).default('development'),
});
const result=ServerConfigSchema.safeParse(process.env);
if(!result.success)throw new Error(`Invalid server environment: ${result.error.message}`);
export const config={port:result.data.PORT,host:result.data.HOST,nodeEnv:result.data.NODE_ENV} satisfies ServerConfig;
