import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {generateKeyPair,SignJWT,createLocalJWKSet,exportJWK} from 'jose';
// Unit security tests use signed test tokens, not mocked browser search responses.
const js=ts.transpileModule(readFileSync('lib/admin-identity.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("from 'jose'",`from '${import.meta.resolve('jose')}'`);
const {verifiedAdminIdentity:verify}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const {privateKey,publicKey}=await generateKeyPair('RS256'),jwk=await exportJWK(publicKey);jwk.kid='test';
const keys=createLocalJWKSet({keys:[jwk]}),config={AUTH_ACCESS_ISSUER:'https://test.cloudflareaccess.com',AUTH_ACCESS_AUD:'test-audience'};
const sign=(extra={},aud='test-audience',expiry='5m')=>new SignJWT({email:'admin@example.invalid',type:'app',...extra}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer(config.AUTH_ACCESS_ISSUER).setAudience(aud).setSubject('123').setIssuedAt().setExpirationTime(expiry).sign(privateKey);
assert.equal((await verify(await sign(),config,keys)).email,'admin@example.invalid');
assert.equal(await verify(await sign({},'wrong'),config,keys),null);
assert.equal(await verify(await sign({},'test-audience','-1m'),config,keys),null);
assert.equal(await verify(await sign({type:'service'}),config,keys),null);
assert.equal(await verify('unsigned-email',config,keys),null);
assert.equal(await verify(await sign(),{},keys),null);
const token=await sign();assert.equal(await verify(token.slice(0,-8)+'AAAAAAAA',config,keys),null);
console.log('PASS: valid signature; wrong audience, expiry, token type, unsigned input, missing config, tampering rejected');
