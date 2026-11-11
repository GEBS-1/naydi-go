// PostgreSQL prepared-statement interface. Legacy SQL syntax is translated; no SQLite database is opened.
export function postgresSQL(input,args=[],previousChanges=0){
 let sql=input.replace(/`([^`]+)`/g,'"$1"');
 sql=sql.replace(/json_extract\(([^,()]+),\s*'\$\.([^']+)'\)/g,(_,column,path)=>{
  const value=`(${column}::jsonb #>> '{${path.split('.').join(',')}}')`;
  return ['demo','testOnly'].includes(path)?`(CASE ${value} WHEN 'true' THEN 1 WHEN 'false' THEN 0 ELSE NULL END)`:path==='count'?`(${value}::bigint)`:value;
 });
 sql=sql.replace(/json_each\(([^,()]+),\s*'\$\.([^']+)'\)/g,(_,column,path)=>`jsonb_array_elements_text(COALESCE(${column}::jsonb #> '{${path.split('.').join(',')}}','[]'::jsonb))`);
 // jsonb_array_elements_text's default output column is value, matching json_each.
 sql=sql.replace(/\bMIN\(10,/g,'LEAST(10,');
 const ignore=/^\s*INSERT OR IGNORE\b/i.test(sql);
 sql=sql.replace(/\bINSERT OR IGNORE\b/gi,'INSERT');
 if(ignore)sql+=' ON CONFLICT DO NOTHING';
 sql=sql.replace(/\bchanges\(\)/g,String(previousChanges));
 // PostgreSQL requires target qualification on ON CONFLICT expressions.
 const table=sql.match(/^\s*INSERT INTO\s+([a-z_]+)/i)?.[1];
 if(table&&sql.includes(' DO UPDATE SET ')){
  const at=sql.indexOf(' DO UPDATE SET '),head=sql.slice(0,at),tail=sql.slice(at);
  sql=head+tail.replace(/(?<![.\w])([a-z_]+)(?=\s*(?:[+<>=]|\bIN\b))/g,(word,field,offset)=>{
   const rest=tail.slice(offset+word.length);if(/^\s*=(?!=)/.test(rest)&&!tail.slice(0,offset).includes(' WHERE '))return word;
   return `${table}.${field}`;
  }).replace(/(=)\s*([a-z_]+)(?=\s*(?:WHERE|,|$))/g,'$1 '+table+'.$2');
 }
 sql=sql.replace(/\bAS\s+([a-zA-Z_]*[A-Z][a-zA-Z_]*)/g,'AS "$1"');
 // Only replace placeholders outside quoted SQL strings/identifiers.
 let n=0;sql=sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g,part=>part==='?'?`$${++n}`:part);
 if(n!==args.length)throw Error('SQL parameter count mismatch');
 return {text:sql,values:args};
}

export function postgresDB(pool){
 async function execute(client,statement,changes=0){
  const query=postgresSQL(statement.sql,statement.args,changes);
  const result=await client.query(query.text,query.values);
  const rows=result.rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,typeof value==='bigint'?Number(value):value])));
  return {success:true,results:rows,meta:{changes:result.rowCount??result.affectedRows??0}};
 }
 class Statement{
  constructor(sql,args=[]){this.sql=sql;this.args=args;}
  bind(...args){return new Statement(this.sql,args);}
  async first(column){const row=(await execute(pool,this)).results[0];return column?row?.[column]??null:row??null;}
  all(){return execute(pool,this);}
  run(){return execute(pool,this);}
 }
 return {prepare:sql=>new Statement(sql),async batch(statements){
  const client=await pool.connect();
  try{await client.query('BEGIN');const results=[];let changes=0;
   for(const statement of statements){const result=await execute(client,statement,changes);results.push(result);changes=result.meta.changes;}
   await client.query('COMMIT');return results;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }};
}
