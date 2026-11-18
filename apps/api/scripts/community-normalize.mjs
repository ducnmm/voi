#!/usr/bin/env node
import {readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {planCommunityNormalization,applyCommunityNormalization,undoCommunityNormalization,correctCommunityNormalization} from "../dist/services/community-normalization-admin.js";
import {prisma} from "../dist/db/prisma.js";
const args=process.argv.slice(2),command=args[0];
const option=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const load=async name=>{const path=option(name);if(!path)throw new Error(`Missing ${name}`);return JSON.parse(await readFile(resolve(path),"utf8"));};
try{
  let result;
  if(command==="plan")result=await planCommunityNormalization(await load("--manifest"));
  else if(command==="apply")result=await applyCommunityNormalization(await load("--plan"),option("--actor")??"operator");
  else if(command==="undo")result=await undoCommunityNormalization(await load("--report"),option("--actor")??"operator");
  else if(command==="correct"){const id=option("--id");if(!id)throw new Error("Missing --id");result=await correctCommunityNormalization(id,await load("--input"),option("--actor")??"operator");}
  else throw new Error("Usage: community-normalize.mjs plan --manifest FILE [--out FILE] | apply --plan FILE [--actor NAME] [--out FILE] | undo --report FILE [--actor NAME] [--out FILE]");
  const json=JSON.stringify(result,null,2)+"\n",out=option("--out");
  if(out){await writeFile(resolve(out),json);console.log(JSON.stringify({file:resolve(out),counts:result.counts,changed:result.changed,unchanged:result.unchanged,skipped:result.skipped?.length}));}
  else process.stdout.write(json);
}catch(error){console.error(error instanceof Error?error.message:"Normalization failed");process.exitCode=1;}finally{await prisma.$disconnect();}
