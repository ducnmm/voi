import { randomUUID } from "node:crypto";
import { Prisma, type CommunityListing, type CommunitySkillRequirement } from "@prisma/client";
import { z } from "zod";
import { normalizeSkillText, SKILL_NORMALIZATION_VERSION, SkillRequirementProposalSchema, validateSkillRequirement, type SkillRequirement } from "@voi/shared";
import { prisma } from "../db/prisma.js";
import { communityPayloadHash } from "./community-validation.js";
import { normalizeCommunityRow, ensureSkillCatalog, skillInputHash, venueInputHash } from "./community-normalization.js";
import { normalizeVenueToken, VENUE_RESOLVER_VERSION } from "./venue-catalog.js";

export const VenueManifestSchema=z.object({version:z.literal(1),venues:z.array(z.object({
  id:z.string().min(1).max(128).optional(),name:z.string().min(1).max(200),address:z.string().max(500).nullable(),areaCode:z.string().min(1).max(80),status:z.literal("VERIFIED").default("VERIFIED"),
  aliases:z.array(z.object({name:z.string().min(1).max(200),address:z.string().max(500).nullable().optional(),sourceId:z.string().max(128).optional()}).strict()).min(1),
  latitude:z.number().min(-90).max(90).nullable().optional(),longitude:z.number().min(-180).max(180).nullable().optional(),locationSource:z.string().max(100).nullable().optional()
}).strict()).max(1000)}).strict().superRefine((manifest,ctx)=>{for(const [index,v] of manifest.venues.entries())if((v.latitude==null)!==(v.longitude==null)||v.latitude!=null&&!v.locationSource)ctx.addIssue({code:"custom",path:["venues",index],message:"Coordinate pair requires explicit provenance"});});
type Manifest=z.infer<typeof VenueManifestSchema>;
type Row=CommunityListing & {skillRequirements:CommunitySkillRequirement[]};
const metaKeys=["venueId","venueResolutionStatus","venueResolverVersion","venueResolutionInputHash","venueResolvedAt","venueCandidateIds","venueResolutionManual","skillNormalizationStatus","skillNormalizationVersion","skillNormalizationInputHash","skillNormalizedAt","skillRecruitmentAudience","skillNormalizationNotes","skillNormalizationReasons","skillNormalizationManual"] as const;
function normalizedSnapshot(row:Row){return {metadata:Object.fromEntries(metaKeys.map(key=>[key,row[key]])),requirements:row.skillRequirements.map(({audience,mode,minRank,maxRank,minInclusive,maxInclusive,alternative,evidence})=>({audience,mode,minRank,maxRank,minInclusive,maxInclusive,alternative,evidence})).sort((a,b)=>a.audience.localeCompare(b.audience)||a.alternative-b.alternative)};}
function manifestWithIds(raw:unknown){const manifest=VenueManifestSchema.parse(raw);return {...manifest,venues:manifest.venues.map(v=>({...v,id:v.id??`venue_${communityPayloadHash({name:v.name,address:v.address,area:v.areaCode}).slice(0,24)}`}))};}
function plannedVenue(row:CommunityListing,manifest:ReturnType<typeof manifestWithIds>){
  const name=normalizeVenueToken(row.venueName),address=normalizeVenueToken(row.venueAddress);
  const candidates=manifest.venues.filter(v=>v.areaCode===row.areaCode&&v.aliases.some(a=>normalizeVenueToken(a.name)===name&&(!a.sourceId||a.sourceId===row.sourceId)));
  const matched=candidates.filter(v=>v.aliases.some(a=>normalizeVenueToken(a.name)===name&&(!a.sourceId||a.sourceId===row.sourceId)&&(a.address===null?(!address||normalizeVenueToken(v.address)===address):Boolean(address)&&normalizeVenueToken(a.address??v.address)===address)));
  return {venueId:matched.length===1?matched[0]!.id:null,status:matched.length===1?"MATCHED":candidates.length>1?"AMBIGUOUS":candidates.length?"SUGGESTED":"UNRESOLVED",candidateIds:matched.length===1?[]:candidates.map(v=>v.id)};
}
export async function planCommunityNormalization(rawManifest:unknown){
  const manifest=manifestWithIds(rawManifest),rows=await prisma.communityListing.findMany({where:{anonymizedAt:null,sourceStatus:{not:"DELETED"},publicationStatus:{not:"SUPPRESSED"}},include:{skillRequirements:true},orderBy:{id:"asc"}});
  const entries=rows.map(row=>({id:row.id,version:row.version,snapshotHash:row.snapshotHash,normalizationFingerprint:communityPayloadHash(normalizedSnapshot(row)),title:row.title,skillText:row.skillText,venueName:row.venueName,venueAddress:row.venueAddress,areaCode:row.areaCode,skill:normalizeSkillText(row.skillText),venue:plannedVenue(row,manifest)}));
  const counts:Record<string,number>={total:entries.length};for(const entry of entries){counts[`skill_${entry.skill.status}`]=(counts[`skill_${entry.skill.status}`]??0)+1;counts[`venue_${entry.venue.status}`]=(counts[`venue_${entry.venue.status}`]??0)+1;}
  return {formatVersion:1,planId:randomUUID(),createdAt:new Date().toISOString(),skillVersion:SKILL_NORMALIZATION_VERSION,venueVersion:VENUE_RESOLVER_VERSION,manifest,counts,entries};
}
export type NormalizationPlan=Awaited<ReturnType<typeof planCommunityNormalization>>;
async function installManifest(tx:Prisma.TransactionClient,manifest:ReturnType<typeof manifestWithIds>,actor:string){
  for(const v of manifest.venues){
    const current=await tx.venue.findUnique({where:{id:v.id}});
    if(current&&(current.name!==v.name||current.address!==v.address||current.areaCode!==v.areaCode))throw new Error(`Venue identity conflict: ${v.id}`);
    await tx.venue.upsert({where:{id:v.id},create:{id:v.id,name:v.name,address:v.address,areaCode:v.areaCode,status:"VERIFIED",verifiedAt:new Date(),latitude:v.latitude??null,longitude:v.longitude??null,locationSource:v.locationSource??null,locationVerifiedAt:v.latitude!=null?new Date():null},update:{}});
    for(const alias of v.aliases){const data={venueId:v.id,name:alias.name,normalizedName:normalizeVenueToken(alias.name),normalizedAddress:alias.address===null?"":normalizeVenueToken(alias.address??v.address),areaCode:v.areaCode,sourceId:alias.sourceId??""};await tx.venueAlias.upsert({where:{venueId_normalizedName_normalizedAddress_areaCode_sourceId:{venueId:data.venueId,normalizedName:data.normalizedName,normalizedAddress:data.normalizedAddress,areaCode:data.areaCode,sourceId:data.sourceId}},create:data,update:{}});}
  }
  await ensureSkillCatalog(tx);
  const manifestHash=communityPayloadHash(manifest);
  const previous=await tx.communityAuditLog.findFirst({where:{action:"normalization.catalog",targetId:manifestHash}});
  if(!previous)await tx.communityAuditLog.create({data:{actor,action:"normalization.catalog",targetType:"venue-catalog",targetId:manifestHash,details:{venueIds:manifest.venues.map(v=>v.id)}}});
}
export async function applyCommunityNormalization(plan:NormalizationPlan,actor:string){
  if(plan.formatVersion!==1||plan.skillVersion!==SKILL_NORMALIZATION_VERSION||plan.venueVersion!==VENUE_RESOLVER_VERSION)throw new Error("Plan version differs; generate a fresh dry run");
  const manifest=manifestWithIds(plan.manifest);await prisma.$transaction(tx=>installManifest(tx,manifest,actor),{timeout:60000});
  const auditIds:string[]=[],skipped:{id:string;reason:string}[]=[];let unchanged=0;
  for(const entry of plan.entries){const result=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM community_listings WHERE id=${entry.id} FOR UPDATE`;
    const row=await tx.communityListing.findUnique({where:{id:entry.id},include:{skillRequirements:true}});
    if(!row||row.anonymizedAt||row.publicationStatus==="SUPPRESSED"||row.sourceStatus==="DELETED")return {reason:"UNAVAILABLE"};
    if(row.version!==entry.version||row.snapshotHash!==entry.snapshotHash)return {reason:"SOURCE_CHANGED"};
    const before=normalizedSnapshot(row),fingerprint=communityPayloadHash(before);
    // An identical re-run is safe; a newer correction must never be overwritten.
    const applied=await normalizeCommunityRow(tx,row,{dryRun:true});
    if(!applied.skillChanged&&!applied.venueChanged)return {unchanged:true};
    if(fingerprint!==entry.normalizationFingerprint)return {reason:"NORMALIZATION_CHANGED"};
    await normalizeCommunityRow(tx,row);
    const after=await tx.communityListing.findUniqueOrThrow({where:{id:row.id},include:{skillRequirements:true}});
    const audit=await tx.communityAuditLog.create({data:{actor,action:"normalization.apply",targetType:"community-listing",targetId:row.id,details:JSON.parse(JSON.stringify({planId:plan.planId,version:row.version,snapshotHash:row.snapshotHash,before,afterFingerprint:communityPayloadHash(normalizedSnapshot(after))}))}});
    return {auditId:audit.id};
  },{timeout:30000});if("auditId"in result&&result.auditId)auditIds.push(result.auditId);else if("unchanged"in result)unchanged++;else skipped.push({id:entry.id,reason:result.reason??"UNKNOWN"});}
  return {formatVersion:1,planId:plan.planId,appliedAt:new Date().toISOString(),changed:auditIds.length,unchanged,skipped,auditIds};
}
export async function undoCommunityNormalization(report:{auditIds:string[]},actor:string){
  const undone:string[]=[],skipped:{id:string;reason:string}[]=[];
  for(const auditId of report.auditIds){const result=await prisma.$transaction(async tx=>{
    const audit=await tx.communityAuditLog.findUnique({where:{id:auditId}});if(!audit||audit.action!=="normalization.apply")return {id:auditId,reason:"AUDIT_NOT_FOUND"};
    const details=audit.details as unknown as {version:number;snapshotHash:string|null;afterFingerprint:string;before:ReturnType<typeof normalizedSnapshot>};
    await tx.$queryRaw`SELECT id FROM community_listings WHERE id=${audit.targetId} FOR UPDATE`;
    const row=await tx.communityListing.findUnique({where:{id:audit.targetId},include:{skillRequirements:true}});
    if(!row||row.version!==details.version||row.snapshotHash!==details.snapshotHash||communityPayloadHash(normalizedSnapshot(row))!==details.afterFingerprint)return {id:audit.targetId,reason:"CHANGED_SINCE_APPLY"};
    const metadata={...details.before.metadata};for(const key of ["venueResolvedAt","skillNormalizedAt"]){if(metadata[key])metadata[key]=new Date(metadata[key] as string);}
    await tx.communityListing.update({where:{id:row.id},data:{...metadata,updatedAt:row.updatedAt}});
    await tx.communitySkillRequirement.deleteMany({where:{listingId:row.id}});if(details.before.requirements.length)await tx.communitySkillRequirement.createMany({data:details.before.requirements.map(rule=>({...rule,listingId:row.id}))});
    await tx.communityAuditLog.create({data:{actor,action:"normalization.undo",targetType:"community-listing",targetId:row.id,details:{auditId}}});return {id:row.id};
  });if(result.reason)skipped.push({id:result.id,reason:result.reason});else undone.push(result.id);}
  return {undone,skipped};
}

const CorrectionSchema=z.object({
  note:z.string().trim().min(1).max(500),
  skill:z.object({requirements:z.array(SkillRequirementProposalSchema).min(1).max(30),recruitmentAudience:z.enum(["UNKNOWN","ANY","MALE_ONLY","FEMALE_ONLY"]),notes:z.array(z.string().max(500)).max(10).default([])}).strict().optional(),
  venueId:z.string().min(1).max(128).nullable().optional()
}).strict();
/** Operator correction is separate from Muse proposals and is kept until source evidence changes. */
export async function correctCommunityNormalization(id:string,input:unknown,actor:string){
  const correction=CorrectionSchema.parse(input);
  if(!correction.skill&&correction.venueId===undefined)throw new Error("Correction needs skill or venueId");
  if(correction.skill){const alternatives=new Set<string>();for(const rule of correction.skill.requirements){const errors=validateSkillRequirement(rule as SkillRequirement);if(errors.length)throw new Error(errors.join(","));const key=`${rule.audience}:${rule.alternative}`;if(alternatives.has(key))throw new Error("Duplicate audience/alternative");alternatives.add(key);}}
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM community_listings WHERE id=${id} FOR UPDATE`;
    const row=await tx.communityListing.findUniqueOrThrow({where:{id},include:{skillRequirements:true}});
    if(row.anonymizedAt||row.sourceStatus==="DELETED"||row.publicationStatus==="SUPPRESSED")throw new Error("Unavailable listing cannot be corrected");
    const before=normalizedSnapshot(row),now=new Date();
    if(correction.skill){
      await ensureSkillCatalog(tx);
      const unknowns=correction.skill.requirements.filter(rule=>rule.mode==="UNKNOWN").length;
      await tx.communityListing.update({where:{id},data:{skillNormalizationStatus:unknowns===correction.skill.requirements.length?"UNRESOLVED":unknowns?"PARTIAL":"COMPLETE",skillNormalizationVersion:SKILL_NORMALIZATION_VERSION,skillNormalizationInputHash:skillInputHash(row),skillNormalizedAt:now,skillRecruitmentAudience:correction.skill.recruitmentAudience,skillNormalizationNotes:correction.skill.notes,skillNormalizationReasons:[],skillNormalizationManual:true,updatedAt:row.updatedAt}});
      await tx.communitySkillRequirement.deleteMany({where:{listingId:id}});await tx.communitySkillRequirement.createMany({data:correction.skill.requirements.map(rule=>({...rule,listingId:id}))});
    }
    if(correction.venueId!==undefined){
      const venue=correction.venueId?await tx.venue.findFirst({where:{id:correction.venueId,status:"VERIFIED"}}):null;
      if(correction.venueId&&!venue)throw new Error("Select an existing verified venue");
      await tx.communityListing.update({where:{id},data:{venueId:venue?.id??null,venueResolutionStatus:venue?"MATCHED":"UNRESOLVED",venueResolutionInputHash:venueInputHash(row),venueResolverVersion:VENUE_RESOLVER_VERSION,venueResolvedAt:now,venueCandidateIds:[],venueResolutionManual:true,updatedAt:row.updatedAt}});
      if(venue&&row.venueName&&row.areaCode===venue.areaCode){const data={venueId:venue.id,name:row.venueName,normalizedName:normalizeVenueToken(row.venueName),normalizedAddress:normalizeVenueToken(row.venueAddress),areaCode:row.areaCode??"",sourceId:row.sourceId};await tx.venueAlias.upsert({where:{venueId_normalizedName_normalizedAddress_areaCode_sourceId:{venueId:data.venueId,normalizedName:data.normalizedName,normalizedAddress:data.normalizedAddress,areaCode:data.areaCode,sourceId:data.sourceId}},create:data,update:{}});}
    }
    const after=await tx.communityListing.findUniqueOrThrow({where:{id},include:{skillRequirements:true}});
    const audit=await tx.communityAuditLog.create({data:{actor,action:"normalization.apply",targetType:"community-listing",targetId:id,details:JSON.parse(JSON.stringify({note:correction.note,manual:true,version:row.version,snapshotHash:row.snapshotHash,before,afterFingerprint:communityPayloadHash(normalizedSnapshot(after))}))}});
    return {formatVersion:1,changed:1,auditIds:[audit.id]};
  });
}
