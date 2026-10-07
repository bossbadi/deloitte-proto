import { snapshotSchema, type Snapshot } from './streetfix';
const DB = 'streetfix-local-v1';
function open(): Promise<IDBDatabase> {
 return new Promise((resolve,reject)=>{
 if(typeof indexedDB==='undefined') return reject(new Error('Storage unavailable'));
 let expired=false;const request=indexedDB.open(DB,1);const timeout=setTimeout(()=>{expired=true;reject(new Error('Storage did not respond'));},3000);
 request.onupgradeneeded=()=>request.result.createObjectStore('snapshot');
 request.onsuccess=()=>{clearTimeout(timeout);if(expired)request.result.close();else resolve(request.result);};request.onerror=()=>{clearTimeout(timeout);reject(request.error);};request.onblocked=()=>{clearTimeout(timeout);expired=true;reject(new Error('Close other StreetFix tabs and retry.'));};
 });
}
export async function readSnapshot():Promise<Snapshot|null> {
 const db=await open();
 try { return await new Promise((resolve,reject)=>{const tx=db.transaction('snapshot','readonly');const r=tx.objectStore('snapshot').get('current');r.onsuccess=()=>{try{resolve(r.result?snapshotSchema.parse(r.result):null);}catch(e){reject(e);}};r.onerror=()=>reject(r.error);}); } finally {db.close();}
}
export async function writeSnapshot(snapshot:Snapshot):Promise<void> {
 const db=await open();
 try { await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshot','readwrite');tx.objectStore('snapshot').put(snapshotSchema.parse(snapshot),'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);}); } finally {db.close();}
}
export async function readPhoto(file:File):Promise<string> {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP photo. HEIC and SVG are not supported.');
 if(file.size>5*1024*1024) throw new Error('That photo is larger than 5 MB. Choose a smaller image.');
 if(!file.size) throw new Error('This file is empty. Choose another photo.');
 const url=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Could not read this photo. Try again.'));reader.readAsDataURL(file);});
 const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('This file could not be opened as a photo. Choose another image.'));im.src=url;});
 if(img.width*img.height>50_000_000) throw new Error('That image is too large to process. Resize it first.');
 const scale=Math.min(1,1600/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
 const ctx=canvas.getContext('2d');if(!ctx) throw new Error('Photo processing is unavailable in this browser.');ctx.drawImage(img,0,0,canvas.width,canvas.height);
 return canvas.toDataURL('image/jpeg',0.85);
}
