'use client';
import { useEffect,useRef,useState } from 'react';
import type * as Leaflet from 'leaflet';
import { LocateFixed, RefreshCw } from 'lucide-react';
import { center,type Report } from '@/lib/streetfix';
type Props={reports:Report[];selected?:string|null;onSelect?:(id:string)=>void;pin?:[number,number]|null;onPin?:(pin:[number,number])=>void;compact?:boolean};
export function StreetMap({reports,selected,onSelect,pin,onPin,compact}:Props){
 const container=useRef<HTMLDivElement>(null),map=useRef<Leaflet.Map|null>(null),L=useRef<typeof Leaflet|null>(null),markers=useRef<Leaflet.LayerGroup|null>(null),tile=useRef<Leaflet.TileLayer|null>(null);
 const callbacks=useRef({onSelect,onPin});callbacks.current={onSelect,onPin};
 const [ready,setReady]=useState(false),[fallback,setFallback]=useState(false);
 useEffect(()=>{let cancelled=false;let timeout:ReturnType<typeof setTimeout>;let observer:ResizeObserver;
 import('leaflet').then(lib=>{if(cancelled||!container.current)return;L.current=lib;const m=lib.map(container.current,{zoomControl:false,scrollWheelZoom:true,attributionControl:true}).setView(center,15);map.current=m;lib.control.zoom({position:'bottomright'}).addTo(m);markers.current=lib.layerGroup().addTo(m);
 const tiles=lib.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19});tile.current=tiles;
 let loaded=false,errors=0;tiles.on('tileload',()=>{loaded=true;setFallback(false);});tiles.on('tileerror',()=>{if(++errors>4&&!loaded)setFallback(true);});tiles.addTo(m);timeout=setTimeout(()=>{if(!loaded)setFallback(true);},6000);
 m.on('click',(e:Leaflet.LeafletMouseEvent)=>callbacks.current.onPin?.([Number(e.latlng.lat.toFixed(6)),Number(e.latlng.lng.toFixed(6))]));
 observer=new ResizeObserver(()=>m.invalidateSize());observer.observe(container.current);setReady(true);
 }).catch(()=>setFallback(true));
 return()=>{cancelled=true;clearTimeout(timeout);observer?.disconnect();map.current?.remove();map.current=null;};
 },[]);
 useEffect(()=>{const lib=L.current,m=map.current,group=markers.current;if(!ready||!lib||!m||!group)return;group.clearLayers();
 reports.forEach(r=>{const color=r.review==='awaiting'?'unreviewed':r.status==='Fixed'?'fixed':r.status==='In progress'?'progress':'reported';const icon=lib.divIcon({className:'street-marker-wrap',html:`<span class="street-marker ${color} ${selected===r.id?'selected':''}">${r.category==='Pothole'?'▰':r.category==='Broken streetlight'?'☼':r.category==='Damaged sign'?'⚑':r.category==='Sidewalk / accessibility'?'♿':'•'}</span>`,iconSize:[40,44],iconAnchor:[20,42]});const marker=lib.marker([r.lat,r.lng],{icon,title:`Open ${r.id}: ${r.title}`,alt:r.title,keyboard:true}).addTo(group);marker.on('click',()=>callbacks.current.onSelect?.(r.id));const tip=document.createElement('span');tip.textContent=`${r.title} · ${r.review==='awaiting'?'Awaiting review':r.status}`;marker.bindTooltip(tip,{direction:'top',offset:[0,-36]});});
 if(pin)lib.marker(pin,{icon:lib.divIcon({className:'street-marker-wrap',html:'<span class="street-marker selected">＋</span>',iconSize:[40,44],iconAnchor:[20,42]})}).addTo(group);
 },[reports,selected,pin,ready]);
 useEffect(()=>{const r=reports.find(r=>r.id===selected);if(r&&map.current)map.current.panTo([r.lat,r.lng]);},[selected,ready]);
 useEffect(()=>{if(pin&&map.current)map.current.panTo(pin);},[pin,ready]);
 return <div className={`map-frame ${compact?'compact':''}`}>
 <div ref={container} className={`leaflet-surface ${fallback?'map-tiles-hidden':''}`} aria-label={onPin?'Select a location on the map':'Neighborhood issue map'} />
 {fallback&&<div className="map-fallback"><strong>Map tiles unavailable</strong><span>Coordinate view · schematic, no street geometry</span><p>Markers and map pin selection still work. Use the list for report details or enter coordinates manually.</p><button onClick={()=>{setFallback(false);tile.current?.redraw();}}><RefreshCw size={14}/> Retry tiles</button></div>}
 {!compact&&<><div className="map-place"><span className="map-place-icon"><LocateFixed size={19}/></span><div><strong>Harborview</strong><span>Fictional neighborhood · Portland base map</span></div></div><button className="map-reset" title="Return to neighborhood" onClick={()=>map.current?.setView(center,15)}><LocateFixed size={18}/> Recenter</button><div className="map-legend"><span><i className="legend-review"/>Awaiting review</span><span><i className="legend-reported"/>Reported / planned</span><span><i className="legend-progress"/>In progress</span><span><i className="legend-fixed"/>Fixed</span></div></>}
 </div>;
}
