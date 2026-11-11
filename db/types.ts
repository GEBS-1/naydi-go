export type WriteResult={meta:{changes:number}};
export interface PreparedStatement{
 bind(...values:unknown[]):PreparedStatement;
 first<T=Record<string,unknown>>(column?:string):Promise<T|null>;
 all<T=Record<string,unknown>>():Promise<{results:T[]}>;
 run():Promise<WriteResult>;
}
export interface Database{
 prepare(sql:string):PreparedStatement;
 batch(statements:PreparedStatement[]):Promise<WriteResult[]>;
}
export interface PhotoStore{
 put(key:string,bytes:Uint8Array,options?:{httpMetadata?:{contentType?:string}}):Promise<void>;
 get(key:string):Promise<{body:BodyInit;httpMetadata?:{contentType?:string}}|null>;
}
