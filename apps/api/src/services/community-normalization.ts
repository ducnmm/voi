import { Prisma, type CommunityListing, type CommunitySkillRequirement, type Venue } from "@prisma/client";
import { normalizeSkillText, SKILL_RANKS, SKILL_ALIASES, SKILL_SCALE_CODE, SKILL_NORMALIZATION_VERSION, type SkillNormalization, type SkillRequirement } from "@voi/shared";
import { communityPayloadHash } from "./community-validation.js";
import { resolveVenue, VENUE_RESOLVER_VERSION } from "./venue-catalog.js";

type Db=Prisma.TransactionClient;
export function skillInputHash(row:Pick<CommunityListing,"skillText">) {return communityPayloadHash({skillText:row.skillText});}
export function venueInputHash(row:Pick<CommunityListing,"venueName"|"venueAddress"|"areaCode"|"venueMapsUrl">) {return communityPayloadHash({name:row.venueName,address:row.venueAddress,area:row.areaCode,maps:row.venueMapsUrl});}
export async function ensureSkillCatalog(db:Db) {
  const scale=await db.skillScale.findUnique({where:{code:SKILL_SCALE_CODE}});
  if(scale?.version===SKILL_NORMALIZATION_VERSION&&await db.skillRank.count({where:{scaleCode:SKILL_SCALE_CODE}})===SKILL_RANKS.length&&await db.skillAlias.count({where:{version:SKILL_NORMALIZATION_VERSION}})===SKILL_ALIASES.length)return;
  await db.skillScale.upsert({where:{code:SKILL_SCALE_CODE},create:{code:SKILL_SCALE_CODE,version:SKILL_NORMALIZATION_VERSION,label:"Trình độ cộng đồng Voi"},update:{version:SKILL_NORMALIZATION_VERSION}});
  for(const rank of SKILL_RANKS) await db.skillRank.upsert({where:{code:rank.code},create:{...rank,scaleCode:SKILL_SCALE_CODE},update:{label:rank.label,order:rank.order}});
  for(const alias of SKILL_ALIASES)await db.skillAlias.upsert({where:{token_scope:{token:alias.token,scope:""}},create:{...alias,scope:"",version:SKILL_NORMALIZATION_VERSION},update:{rankCode:alias.rankCode,version:SKILL_NORMALIZATION_VERSION}});
}
export function presentSkillNormalization(row:CommunityListing & {skillRequirements?:CommunitySkillRequirement[]}):SkillNormalization {
  if(!row.skillNormalizationVersion) return normalizeSkillText(row.skillText);
  return {version:row.skillNormalizationVersion,scaleCode:SKILL_SCALE_CODE,status:row.skillNormalizationStatus as SkillNormalization["status"],requirements:(row.skillRequirements??[]).map(({audience,mode,minRank,maxRank,minInclusive,maxInclusive,alternative,evidence})=>({audience,mode,minRank,maxRank,minInclusive,maxInclusive,alternative,evidence} as SkillRequirement)),recruitmentAudience:row.skillRecruitmentAudience as SkillNormalization["recruitmentAudience"],notes:row.skillNormalizationNotes,reasons:row.skillNormalizationReasons};
}
export async function normalizeCommunityRow(db:Db,row:CommunityListing,options:{dryRun?:boolean;now?:Date;force?:boolean}={}) {
  const now=options.now??new Date(), skillHash=skillInputHash(row),venueHash=venueInputHash(row);
  const skill=normalizeSkillText(row.skillText);
  const resolution=await resolveVenue(db,{venueName:row.venueName,venueAddress:row.venueAddress,areaCode:row.areaCode,sourceId:row.sourceId});
  const skillPreserved=row.skillNormalizationManual && row.skillNormalizationInputHash===skillHash;
  const venuePreserved=row.venueResolutionManual && row.venueResolutionInputHash===venueHash;
  const skillChanged=!skillPreserved&&(options.force||row.skillNormalizationInputHash!==skillHash||row.skillNormalizationVersion!==skill.version);
  const venueChanged=!venuePreserved&&(options.force||row.venueResolutionInputHash!==venueHash||row.venueResolverVersion!==VENUE_RESOLVER_VERSION||row.venueId!==resolution.venueId||row.venueResolutionStatus!==resolution.status||JSON.stringify(row.venueCandidateIds)!==JSON.stringify(resolution.candidateIds));
  const data={...(skillChanged?{skillNormalizationStatus:skill.status,skillNormalizationVersion:skill.version,skillNormalizationInputHash:skillHash,skillNormalizedAt:now,skillRecruitmentAudience:skill.recruitmentAudience,skillNormalizationNotes:skill.notes,skillNormalizationReasons:skill.reasons,skillNormalizationManual:false}:{}),...(venueChanged?{venueId:resolution.venueId,venueResolutionStatus:resolution.status,venueResolverVersion:VENUE_RESOLVER_VERSION,venueResolutionInputHash:venueHash,venueResolvedAt:now,venueCandidateIds:resolution.candidateIds,venueResolutionManual:false}:{})};
  if(!options.dryRun&&(skillChanged||venueChanged)) {
    await db.communityListing.update({where:{id:row.id},data:{...data,updatedAt:row.updatedAt}});
    if(skillChanged){
      await ensureSkillCatalog(db);
      await db.communitySkillRequirement.deleteMany({where:{listingId:row.id}});
      if(skill.requirements.length) await db.communitySkillRequirement.createMany({data:skill.requirements.map(rule=>({...rule,listingId:row.id}))});
    }
  }
  return {skill,resolution,skillChanged,venueChanged,data};
}

export const normalizationInclude = {source:true,area:true,skillRequirements:true,venue:{include:{externalRefs:true}}} as const;
