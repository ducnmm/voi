import {afterAll,beforeAll,beforeEach,describe,expect,it} from "vitest";
import type {FastifyInstance} from "fastify";
import {normalizeSkillText,SKILL_RANKS} from "@voi/shared";
import {auth,buildTestApp,createGroup,createSession,devLogin,prisma,resetDb} from "../helpers.js";
import {AREA,batch,communityFixture,type CommunityFixture,ingest,observation,publicFeed,snapshot} from "../community-helpers.js";
import {applyCommunityNormalization,correctCommunityNormalization,planCommunityNormalization,undoCommunityNormalization} from "../../src/services/community-normalization-admin.js";
import {normalizeCommunityRow} from "../../src/services/community-normalization.js";
import {presentVenue,resolveVenue} from "../../src/services/venue-catalog.js";
let app:FastifyInstance,fixture:CommunityFixture;
beforeAll(async()=>{app=await buildTestApp();});
afterAll(async()=>{await app.close();await prisma.$disconnect();});
beforeEach(async()=>{await resetDb();fixture=await communityFixture();});
const manifest={version:1,venues:[{id:"venue-test-branch",name:"Synthetic badminton court",address:"123 Main Street",areaCode:AREA,status:"VERIFIED",aliases:[{name:"Synthetic badminton court",address:"123 Main Street"},{name:"Synthetic badminton court",address:null}]}]};
async function imported(){const item=snapshot(fixture,{}, {skillText:"Nam TBY đến TB; Nữ Yếu+ đến TB-",venueAddress:"123 Main Street"});const result=await ingest(app,fixture.token,item);return {item,id:result.listingId as string};}
describe("structured community normalization",()=>{
  it("persists v1 requirements and exposes server-side audience/rank filtering with unknown separated",async()=>{
    const {id}=await imported();
    expect(await prisma.communitySkillRequirement.count({where:{listingId:id}})).toBe(2);
    expect(await prisma.skillRank.count()).toBe(SKILL_RANKS.length);
    const row=await prisma.communityListing.findUniqueOrThrow({where:{id}});
    expect(row.skillNormalizationStatus).toBe("COMPLETE");
    expect((await publicFeed(app,"?audience=MALE&rank=TB")).listings.map((r:any)=>r.id)).toContain(id);
    expect((await publicFeed(app,"?audience=FEMALE&rank=TB")).listings).toHaveLength(0);
    expect((await publicFeed(app,"?audience=FEMALE&rank=TB_MINUS")).listings).toHaveLength(1);
    const stats=(await app.inject({method:"GET",url:"/v1/community-listings/statistics"})).json();expect(stats.totalPosts).toBe(1);expect(stats.skillDemand.find((d:any)=>d.audience==="MALE"&&d.rank==="TB").count).toBe(1);expect(stats.skillDemand.find((d:any)=>d.audience==="FEMALE"&&d.rank==="TB").count).toBe(0);
    const unknown=await ingest(app,fixture.token,snapshot(fixture,{}, {skillText:null}));
    expect((await publicFeed(app,"?rank=TB&includeUnknown=true")).listings.map((r:any)=>r.id)).toContain(unknown.listingId);
    expect((await publicFeed(app,"?rank=INVALID").catch(()=>null))).toBeNull();
  });
  it("supports v2 without changing v1 and rejects unsupported skill/venue proposals",async()=>{
    const item=snapshot(fixture,{}, {skillText:"Nam TBY đến TB"});
    const skill=normalizeSkillText(item.listing.skillText);
    const v2={...item,rawText:`${item.rawText} Nam TBY đến TB`,listing:{...item.listing,venueId:null,venueMapsUrl:null,skillProposal:{scaleCode:skill.scaleCode,requirements:skill.requirements,recruitmentAudience:skill.recruitmentAudience}},evidence:{...item.evidence,skill:"Nam TBY đến TB"}};
    const before=await prisma.communityListing.count();
    const dry=(await batch(app,fixture.token,[v2],{schemaVersion:2,dryRun:true})).json().results[0];
    expect(dry.outcome).toBe("created");expect(await prisma.communityListing.count()).toBe(before);expect(await prisma.communitySkillRequirement.count()).toBe(0);
    expect((await batch(app,fixture.token,[{...v2,operationId:`${v2.operationId}-v1`}],{schemaVersion:1})).json().results[0].outcome).toBe("rejected");
    const valid=(await batch(app,fixture.token,[v2],{schemaVersion:2})).json().results[0];expect(valid.outcome).toBe("created");
    const bad=snapshot(fixture);const unsupported={...bad,evidence:{...bad.evidence,skill:"Trung bình"},rawText:`${bad.rawText} Trung bình`,listing:{...bad.listing,skillProposal:{scaleCode:skill.scaleCode,requirements:skill.requirements}}};
    expect((await batch(app,fixture.token,[unsupported],{schemaVersion:2})).json().results[0].errors[0].code).toBe("UNSUPPORTED_SKILL_PROPOSAL");
    const wrong=snapshot(fixture,{}, {skillText:null});expect((await batch(app,fixture.token,[{...wrong,listing:{...wrong.listing,venueId:"invented"}}],{schemaVersion:2})).json().results[0].errors[0].code).toBe("INVALID_VENUE_PROPOSAL");
  });
  it("binds v2 audience and recruitment claims to the complete source evidence",async()=>{
    const item=snapshot(fixture,{}, {skillText:"Nam TB"});
    const skill=normalizeSkillText("Nam TB");
    const forged={...item,rawText:`${item.rawText} Chỉ tuyển nữ TB`,listing:{...item.listing,skillProposal:{scaleCode:skill.scaleCode,requirements:skill.requirements,recruitmentAudience:skill.recruitmentAudience}},evidence:{...item.evidence,skill:"Chỉ tuyển nữ TB"}};
    expect((await batch(app,fixture.token,[forged],{schemaVersion:2})).json().results[0].errors[0].code).toBe("SKILL_EVIDENCE_MISMATCH");
    expect((await batch(app,fixture.token,[{...forged,operationId:`${forged.operationId}-blank`,evidence:{...forged.evidence,skill:" "}}],{schemaVersion:2})).json().results[0].errors[0].code).toBe("MISSING_SKILL_EVIDENCE");
  });
  it("accepts equivalent OR proposals with full gender-labelled source excerpts",async()=>{
    const text="Nam TBY / TB-; Nữ Yếu+ trở lên";
    const item=snapshot(fixture,{}, {skillText:text});
    const skill=normalizeSkillText(text);
    const requirements=[...skill.requirements].reverse().map((rule,index)=>({...rule,alternative:index,evidence:rule.audience==="MALE"?"Nam TBY / TB-":"Nữ Yếu+ trở lên"}));
    const v2={...item,rawText:`${item.rawText} ${text}`,listing:{...item.listing,skillProposal:{scaleCode:skill.scaleCode,requirements}},evidence:{...item.evidence,skill:text}};
    const result=(await batch(app,fixture.token,[v2],{schemaVersion:2})).json().results[0];
    expect(result.outcome).toBe("created");
    const row=await prisma.communityListing.findUniqueOrThrow({where:{id:result.listingId},include:{skillRequirements:true}});
    expect(row.skillRequirements).toHaveLength(3);
  });
  it("backfills idempotently, protects source watermarks, audits and undoes mappings",async()=>{
    const {id}=await imported();const original=await prisma.communityListing.findUniqueOrThrow({where:{id}});
    const plan=await planCommunityNormalization(manifest);expect(plan.counts.venue_MATCHED).toBe(1);
    const report=await applyCommunityNormalization(plan,"test-operator");expect(report.changed).toBe(1);
    const after=await prisma.communityListing.findUniqueOrThrow({where:{id}});
    for(const field of ["observedAt","lastVerifiedAt","receivedAt","version","snapshotHash","updatedAt"] as const)expect(after[field]).toEqual(original[field]);
    expect(after.venueId).toBe("venue-test-branch");
    const rerun=await applyCommunityNormalization(plan,"test-operator");expect(rerun.changed).toBe(0);expect(rerun.unchanged).toBe(1);
    expect((await undoCommunityNormalization(report,"test-operator")).undone).toEqual([id]);
    expect((await prisma.communityListing.findUniqueOrThrow({where:{id}})).venueId).toBeNull();
    expect(await prisma.venue.count()).toBe(1);
  });
  it("keeps manually corrected skills until source evidence changes and refuses stale undo",async()=>{
    const {id,item}=await imported();
    const correction=normalizeSkillText("Nam TB+");
    const report=await correctCommunityNormalization(id,{note:"Synthetic operator review",skill:{requirements:correction.requirements,recruitmentAudience:"MALE_ONLY"}},"operator");
    const row=await prisma.communityListing.findUniqueOrThrow({where:{id}});
    await prisma.$transaction(tx=>normalizeCommunityRow(tx,row));
    expect((await prisma.communityListing.findUniqueOrThrow({where:{id}})).skillNormalizationManual).toBe(true);
    await ingest(app,fixture.token,observation(item,{}, {skillText:"Nam TBY"}));
    const fresh=await prisma.communityListing.findUniqueOrThrow({where:{id}});expect(fresh.skillNormalizationManual).toBe(false);
    expect((await undoCommunityNormalization(report,"operator")).skipped[0]?.reason).toBe("CHANGED_SINCE_APPLY");
  });
  it("does not overwrite a source observation newer than its dry-run plan",async()=>{
    const {id,item}=await imported();const plan=await planCommunityNormalization(manifest);
    await ingest(app,fixture.token,observation(item));
    const report=await applyCommunityNormalization(plan,"operator");expect(report.changed).toBe(0);expect(report.skipped).toEqual([{id,reason:"SOURCE_CHANGED"}]);
  });
  it("requires address context for constrained aliases and keeps branches separate",async()=>{
    await imported();await applyCommunityNormalization(await planCommunityNormalization(manifest),"operator");
    await prisma.venueAlias.deleteMany({where:{normalizedAddress:""}});
    expect((await resolveVenue(prisma,{venueName:"Synthetic badminton court",venueAddress:null,areaCode:AREA})).status).toBe("SUGGESTED");
    expect((await resolveVenue(prisma,{venueName:"Synthetic badminton court",venueAddress:"456 Other Street",areaCode:AREA})).venueId).toBeNull();
    expect((await resolveVenue(prisma,{venueName:"Synthetic badminton court",venueAddress:"123 Main Street",areaCode:AREA})).venueId).toBe("venue-test-branch");
    await prisma.venue.create({data:{id:"other-branch",name:"Other branch",areaCode:AREA,status:"VERIFIED",aliases:{create:{name:"Synthetic badminton court",normalizedName:"synthetic badminton court",normalizedAddress:"456 other street",areaCode:AREA}}}});
    expect((await resolveVenue(prisma,{venueName:"Synthetic badminton court",venueAddress:null,areaCode:AREA})).status).toBe("AMBIGUOUS");
  });
  it("catalog reads are scoped and native selection uses canonical verified venue data",async()=>{
    await imported();await applyCommunityNormalization(await planCommunityNormalization(manifest),"operator");
    const catalog=await app.inject({method:"GET",url:"/v1/integrations/community-listings/catalog",headers:auth(fixture.token)});expect(catalog.statusCode).toBe(200);expect(catalog.json().venues[0].id).toBe("venue-test-branch");
    expect((await app.inject({method:"GET",url:"/v1/community-listings/skills"})).json().ranks).toEqual(SKILL_RANKS);
    const user=await devLogin(app,"venue-user@test.example"),group=await createGroup(app,user.token);
    const session=await createSession(app,user.token,group,{venueId:"venue-test-branch",venueName:"Legacy name",venueLat:1,venueLng:2});
    expect(session.venueName).toBe("Synthetic badminton court");expect(session.venueId).toBe("venue-test-branch");expect(session.venueLat).toBeNull();
    expect((await publicFeed(app,"?venueId=venue-test-branch")).listings).toHaveLength(1);
    await prisma.venueAlias.create({data:{venueId:"venue-test-branch",name:"Sân The B Hòa Bình",normalizedName:"theb hoa binh",areaCode:AREA}});
    expect((await app.inject({method:"GET",url:"/v1/venues?q=the%20b%20hoa%20binh"})).json().venues.map((v:any)=>v.id)).toContain("venue-test-branch");
  });
  it("never exposes unverified, incompatible-provider or expired coordinates",async()=>{
    const base=await prisma.venue.create({data:{name:"Court",status:"VERIFIED",latitude:10,longitude:106,locationSource:"MANUAL",locationVerifiedAt:new Date()}});
    expect(presentVenue(base).locationVerified).toBe(true);
    expect(presentVenue({...base,locationExpiresAt:new Date(0)}).latitude).toBeNull();
    expect(presentVenue({...base,locationSource:"GOOGLE"}).latitude).toBeNull();
    expect(presentVenue({...base,status:"UNVERIFIED"}).latitude).toBeNull();
    await expect(prisma.venue.create({data:{name:"Half coordinate",latitude:10}})).rejects.toBeTruthy();
  });
});
