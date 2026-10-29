// Lo pequeño y compartido del mundo de mentira (Fase 0.0, 29 oct 2026): ayudantes y el vocabulario de `P`, que también usa la oficina servida
// (src/tasks.js, src/main.js). El resto de v1data.js (los 35 personajes, las muestras de archivos, las cifras de ejemplo) es SOLO de la demo file://
// y viaja aparte, en dist/v1demo.js (build.mjs lo arma; la página lo trae con un <script> solo si se abre como archivo).
import { applyV1 } from './profile.js';
export const clockStr = () => new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit",hour12:false});
export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g,"-");
export const P = {
  first:['Sarah','Mike','Priya','Tom','Aroha','Ben','Chloe','Dev','Emma','Finn','Grace','Hemi','Isla','Jake','Kiri','Liam','Mia','Nikau','Olivia','Pete','Ruby','Sam','Tane','Zoe','Harper','Josh','Nina','Ravi','Sofia','Callum'],
  last:['Walker','Patel','Thompson','Ngata','Chen','Murphy','Kaur','Wilson','Fraser','Hohepa','Brooks','Sharma','Reid','Tui','Marsh','Oduya','King','Parata','Lowe','Baxter'],
  co:['Harbour City Roofing','Southern Cross Fitness','Kea Logistics','Fern & Field Landscaping','Ridgeline Property Group','BlueWater Marine','Totara Legal','Summit HVAC','GoldCoast Solar','Pounamu Recruitment','Marlborough Wines Direct','UrbanNest Realty','Silver Fern Security','Bay Plumbing Co','Crestline Finance','Mako Digital','Kauri Dental Group','Westhaven Charters','Alpine Freight','Nectar Foods'],
  plan:['Starter','Growth','Scale','Enterprise'],
  competitor:['CallForge','RingPilot','Quotient CRM','DialAxis','Velora'],
  city:['Auckland','Wellington','Christchurch','Sydney','Melbourne','Brisbane','Hamilton','Tauranga','Perth','Dunedin'],
};
export const rnd = a => a[Math.floor(Math.random()*a.length)];
export const ri = (a,b) => a + Math.floor(Math.random()*(b-a+1));
export const person = () => rnd(P.first)+' '+rnd(P.last);
export const money = n => '$'+n.toLocaleString('en-NZ');
applyV1({ P, V1: [], FILE_GEN: {}, clockStr }); // INDUSTRY PROFILE: el vocabulario del mundo (clientes, ciudades) sigue el perfil también en la oficina; sin perfil no hace nada
