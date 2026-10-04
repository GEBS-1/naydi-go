import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';

type Config={AUTH_ACCESS_ISSUER?:string;AUTH_ACCESS_AUD?:string};
const resolvers=new Map<string,JWTVerifyGetKey>();
// Only server configuration chooses the issuer. JWT headers cannot choose a URL.
export async function verifiedAdminIdentity(assertion:string|null,config:Config,keys?:JWTVerifyGetKey){
 const issuer=config.AUTH_ACCESS_ISSUER,audience=config.AUTH_ACCESS_AUD;
 if(!assertion||assertion.length>16384||!issuer||!audience)return null;
 if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer))return null;
 try{
  let resolver=keys||resolvers.get(issuer);
  if(!resolver){resolver=createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'),{timeoutDuration:4000,cooldownDuration:30000,cacheMaxAge:600000});resolvers.set(issuer,resolver);}
  const {payload}=await jwtVerify(assertion,resolver,{issuer,audience,algorithms:['RS256'],requiredClaims:['sub','exp','iat','email'],clockTolerance:5});
  if(typeof payload.sub!=='string'||!payload.sub||typeof payload.email!=='string'||!payload.email.includes('@')||payload.type!=='app')return null;
  return {userId:'access:'+payload.sub,email:payload.email,displayName:payload.email,fullName:null};
 }catch{return null;} // Bad/expired token or unavailable JWKS never grants access.
}
