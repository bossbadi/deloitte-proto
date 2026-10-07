import { z } from 'zod';
export const categories = ['Pothole', 'Damaged sign', 'Broken streetlight', 'Sidewalk / accessibility', 'Other'] as const;
export const statuses = ['Reported', 'Planned', 'In progress', 'Fixed'] as const;
export const priorities = ['Urgent', 'Normal', 'Low'] as const;
export const teams = ['Unassigned', 'Roads', 'Street Lighting', 'Sidewalks', 'Signs & Signals', 'Public Works'] as const;
export type Category = typeof categories[number];
export type Status = typeof statuses[number];
export type Team = typeof teams[number];
export const center: [number, number] = [45.5165, -122.6535];
export const routing: Record<Category, Team> = { Pothole: 'Roads', 'Damaged sign': 'Signs & Signals', 'Broken streetlight': 'Street Lighting', 'Sidewalk / accessibility': 'Sidewalks', Other: 'Public Works' };
const photoSchema = z.object({ id: z.string(), src: z.string(), alt: z.string(), kind: z.enum(['before', 'after']), provenance: z.string().optional() });
const reportSchema = z.object({
 id: z.string(), title: z.string(), description: z.string(), residentContext: z.string(), observations: z.string(), category: z.enum(categories),
 lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), location: z.string(), photos: z.array(photoSchema), submittedAt: z.string(),
 review: z.enum(['awaiting', 'confirmed', 'duplicate']), canonicalId: z.string().optional(), status: z.enum(statuses), priority: z.enum(priorities),
 priorityReason: z.string(), team: z.enum(teams), targetDate: z.string(), accessConcern: z.string(),
 timeline: z.array(z.object({ id: z.string(), at: z.string(), text: z.string(), actor: z.enum(['Resident', 'City staff']), status: z.enum(statuses).optional() })),
});
export const snapshotSchema = z.object({ version: z.literal(1), reports: z.array(reportSchema), supports: z.array(z.object({ reportId: z.string(), residentId: z.string() })) });
export type Photo = z.infer<typeof photoSchema>;
export type Report = z.infer<typeof reportSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export const draftSchema = z.object({ title: z.string().min(1).max(100), category: z.enum(categories), description: z.string().max(2000), observations: z.string().max(2000), residentFacts: z.string().max(2000), questions: z.array(z.string().max(250)).max(5), suggestedTeam: z.enum(teams) });
export type Draft = z.infer<typeof draftSchema>;
export function supportCount(s: Snapshot, id: string) { return new Set(s.supports.filter(v => v.reportId === id).map(v => v.residentId)).size; }
export function hasSupport(s: Snapshot, id: string, resident: string) { return s.supports.some(v => v.reportId === id && v.residentId === resident); }
export function toggleSupport(s: Snapshot, id: string, resident: string): Snapshot {
 const report=s.reports.find(r=>r.id===id);if(!report)return s;
 if(hasSupport(s,id,resident))return {...s,supports:s.supports.filter(v=>!(v.reportId===id&&v.residentId===resident))};
 if(report.review==='duplicate')return s;
 return { ...s, supports: [...s.supports, { reportId: id, residentId: resident }] };
}
export type StaffPatch = Pick<Report, 'title' | 'description' | 'category' | 'priority' | 'priorityReason' | 'team' | 'targetDate' | 'status'> & { note: string; reviewAction: 'keep' | 'confirm' | 'duplicate'; canonicalId?: string; completionPhoto?: Photo };
export function applyStaff(s: Snapshot, id: string, p: StaffPatch, now = new Date().toISOString()): Snapshot {
 const old = s.reports.find(r => r.id === id);
 if (!old) throw new Error('Report no longer exists.');
 if (old.review === 'duplicate') throw new Error('Update the canonical report instead.');
 if (!p.title.trim() || !p.description.trim()) throw new Error('Add a title and description.');
 if (!p.priorityReason.trim()) throw new Error('Explain the staff priority.');
 const nextIndex = statuses.indexOf(p.status), oldIndex = statuses.indexOf(old.status);
 if (nextIndex < oldIndex || nextIndex > oldIndex + 1) throw new Error('Move through the repair stages one at a time.');
 if (p.status !== 'Reported' && old.review !== 'confirmed' && p.reviewAction !== 'confirm') throw new Error('Confirm the report before planning work.');
 if (p.status === 'Fixed' && !p.note.trim()) throw new Error('Add a public completion update.');
 if (p.completionPhoto && p.status !== 'Fixed') throw new Error('Completion photos belong to fixed reports.');
 if (p.reviewAction === 'duplicate' && !s.reports.some(r => r.id === p.canonicalId && r.id !== id && r.review !== 'duplicate')) throw new Error('Choose an existing canonical report.');
 const changes: string[] = [];
 if (p.title !== old.title || p.description !== old.description || p.category !== old.category) changes.push('Report details reviewed and corrected.');
 if (p.reviewAction === 'confirm' && old.review !== 'confirmed') changes.push('Report confirmed by city staff.');
 if (p.reviewAction === 'duplicate') changes.push(`Marked as a duplicate of ${p.canonicalId}. Supports remain on the original records; no votes were combined.`);
 if (p.priority !== old.priority || p.priorityReason !== old.priorityReason) changes.push(`Staff priority: ${p.priority}. ${p.priorityReason.trim()}`);
 if (p.team !== old.team) changes.push(`Assigned team: ${p.team}.`);
 if (p.targetDate !== old.targetDate) changes.push(p.targetDate ? `Target date: ${p.targetDate} (a planning estimate).` : 'Target date removed.');
 if (p.status !== old.status) changes.push(`Repair status changed to ${p.status}.`);
 if (p.note.trim()) changes.push(p.note.trim());
 if (p.completionPhoto) changes.push('Completion photo added.');
 if (!changes.length) throw new Error('There are no changes to save.');
 const { note: _note, reviewAction, completionPhoto, ...fields } = p;
 const report: Report = { ...old, ...fields, canonicalId: reviewAction === 'duplicate' ? p.canonicalId : undefined, review: reviewAction === 'duplicate' ? 'duplicate' : reviewAction === 'confirm' ? 'confirmed' : old.review,
 photos: completionPhoto ? [...old.photos, completionPhoto] : old.photos,
 timeline: [...old.timeline, { id: crypto.randomUUID(), at: now, actor: 'City staff', text: changes.join('\n'), status: p.status }] };
 return { ...s, reports: s.reports.map(r => r.id === id ? report : r) };
}
export function filterReports(s: Snapshot, category: string, status: string, queue: string, sort: string) {
 const effectiveSort=queue==='supported'?'supported':queue==='urgent'||queue==='review'?'oldest':sort;
 return s.reports.filter(r => (category === 'all' || r.category === category) && (status === 'all' || (status === 'awaiting' ? r.review === 'awaiting' : r.status === status)) &&
 (queue === 'all' || (queue === 'review' ? r.review === 'awaiting' : queue === 'urgent' ? r.priority === 'Urgent' && r.review !== 'duplicate' && r.status !== 'Fixed' : queue === 'progress' ? r.status === 'In progress' && r.review !== 'duplicate' : r.review !== 'duplicate')))
 .sort((a, b) => effectiveSort === 'supported' ? supportCount(s, b.id) - supportCount(s, a.id) || a.submittedAt.localeCompare(b.submittedAt) : effectiveSort === 'oldest' ? a.submittedAt.localeCompare(b.submittedAt) : b.submittedAt.localeCompare(a.submittedAt));
}
export function localDraft(context: string, category: Category, title: string): Draft {
 return { title: title.trim() || `${category === 'Other' ? 'Public-space issue' : category} reported`, category, description: context.trim(), observations: 'Photo not analyzed. Add only what you can see.', residentFacts: context.trim(), questions: category === 'Sidewalk / accessibility' ? ['Is there room for a wheelchair to pass?', 'Is there another accessible path?'] : ['Where exactly is the issue relative to a nearby landmark?', 'When did you first notice it?'], suggestedTeam: routing[category] };
}
export function seedSnapshot(): Snapshot {
 const definitions: [string, Category, string, number, number, number, Status, 'awaiting' | 'confirmed', typeof priorities[number], string, string, string][] = [
 ['Pothole near the morning bus stop','Pothole','SE Hawthorne Blvd & 12th Ave',45.5128,-122.6538,63,'Planned','confirmed','Normal','Scheduled with the next road maintenance visit.','','pothole'],
 ['Sidewalk blocked beside the crossing','Sidewalk / accessibility','SE Salmon St & 15th Ave',45.5147,-122.6502,4,'Reported','confirmed','Urgent','Resident reports the accessible route is blocked. Staff inspection requested today.','Resident reports no room for a wheelchair to pass.','sidewalk'],
 ['Streetlight leaning on the walk home','Broken streetlight','SE Belmont St & 11th Ave',45.5165,-122.6545,28,'In progress','confirmed','Normal','Lighting team is checking the column.','','streetlight'],
 ['A clear sidewalk on Alder','Sidewalk / accessibility','SE Alder St & 14th Ave',45.5181,-122.6517,36,'Fixed','confirmed','Normal','Sidewalk repair completed after inspection.','','paving'],
 ['Street sign faded at the corner','Damaged sign','SE Morrison St & 16th Ave',45.5173,-122.6492,17,'Reported','awaiting','Normal','Awaiting staff assessment.','','sign'],
 ['Lifted paving by the corner shop','Sidewalk / accessibility','SE Stark St & 13th Ave',45.5193,-122.6529,22,'Planned','confirmed','Normal','Sidewalks team to inspect paving.','Resident reports an uneven walking surface.','paving'],
 ['Litter collecting beside the bin','Other','SE Taylor St & 10th Ave',45.5142,-122.6555,12,'Reported','awaiting','Low','Awaiting staff assessment.','','other'],
 ['Pothole along the cycle lane','Pothole','SE Washington St & 17th Ave',45.5188,-122.6481,31,'Reported','confirmed','Normal','Roads team will assess the surface.','','pothole'],
 ['Faded crossing sign','Damaged sign','SE Oak St & 12th Ave',45.5207,-122.6538,9,'Planned','confirmed','Low','Sign replacement included in routine maintenance.','','sign'],
 ['Streetlight needs an inspection','Broken streetlight','SE Yamhill St & 18th Ave',45.5159,-122.6471,6,'Reported','awaiting','Normal','Awaiting staff assessment.','','streetlight'],
 ['Obstruction beside a curb ramp','Sidewalk / accessibility','SE Main St & 17th Ave',45.5135,-122.6482,8,'In progress','confirmed','Urgent','Staff confirmed an obstruction at a curb ramp; work assigned.','Resident reports curb ramp access is obstructed.','sidewalk'],
 ];
 const reports: Report[] = definitions.map((d, i) => {
 const [title,category,location,lat,lng,,status,review,priority,priorityReason,accessConcern,asset] = d;
 const submittedAt = new Date(Date.UTC(2026,9,6-i,14)).toISOString();
 const timeline: Report['timeline'] = [{ id: `seed-${i}-0`, at: submittedAt, actor:'Resident', text:'Photo and confirmed map pin submitted.', status:'Reported' }];
 if(review === 'confirmed') timeline.push({ id:`seed-${i}-1`, at:new Date(Date.parse(submittedAt)+3600000).toISOString(),actor:'City staff',text:'Report reviewed and confirmed.',status:'Reported' });
 if(statuses.indexOf(status)>0) timeline.push({id:`seed-${i}-2`,at:new Date(Date.parse(submittedAt)+86400000).toISOString(),actor:'City staff',text:'Work planned and assigned to the maintenance team.',status:'Planned'});
 if(statuses.indexOf(status)>1) timeline.push({id:`seed-${i}-3`,at:new Date(Date.parse(submittedAt)+2*86400000).toISOString(),actor:'City staff',text:'The assigned team has started work.',status:'In progress'});
 if(status==='Fixed') timeline.push({id:`seed-${i}-4`,at:new Date(Date.parse(submittedAt)+3*86400000).toISOString(),actor:'City staff',text:'The sidewalk has been repaired and cleared. The crew inspected the finished work and reopened the walking route.',status:'Fixed'});
 return {id:`SF-${String(i+1).padStart(3,'0')}`,title,category,location,lat,lng,submittedAt,review,status,priority,priorityReason,team:review==='confirmed'?routing[category]:'Unassigned',targetDate:status==='Planned'?'2026-10-12':'',accessConcern,
 description: category==='Pothole'?'A resident reports a damaged patch of road surface at this location. Please inspect and arrange a repair.':category==='Sidewalk / accessibility'?'A resident reports an obstruction or uneven surface on the sidewalk. The walking route needs an inspection.':category==='Broken streetlight'?'A resident reports a damaged streetlight column. Please inspect the fixture and mounting.':category==='Damaged sign'?'A resident reports a sign that needs attention at this corner. Please inspect the sign and mounting.':'A resident reports litter in this public space. Please review for collection.',
 residentContext:accessConcern || 'I noticed this on my usual walk through the neighborhood.',observations:'Representative seed photo. Fictional report details are supplied for the demo; the photo does not establish the report location.',
 photos:[{id:`seed-photo-${i}`,src:`/photos/${asset}.jpg`,alt:`Representative photo for ${category.toLowerCase()}`,kind:'before',provenance:'Representative licensed photo; see image provenance.'}, ...(status==='Fixed'?[{id:'seed-after',src:'/photos/repaired.jpg',alt:'Illustrative completed sidewalk fixture, separate scene',kind:'after' as const,provenance:'Illustrative completion fixture; different scene, not an actual before/after pair.'}]:[])],timeline};
 });
 return {version:1,reports,supports:definitions.flatMap((d,i)=>Array.from({length:d[5]},(_,n)=>({reportId:reports[i].id,residentId:`seed-resident-${n+1}`})))};
}
