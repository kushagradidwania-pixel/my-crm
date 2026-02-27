import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Users, TrendingUp, Mail, Settings, Plus, Search, Upload, Download,
  ChevronRight, X, Send, Paperclip, MoreVertical, Star, ArrowLeft,
  LogOut, RefreshCw, Inbox, Edit2, Trash2, Phone, Building2, Tag,
  DollarSign, Calendar, CheckCircle, XCircle, AlertCircle, BarChart2,
  Filter, Eye, ChevronDown, ExternalLink, FileText, Loader
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const STAGES = ["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];
const STAGE_COLORS = {
  New: "#6366f1", Qualified: "#f59e0b", Proposal: "#3b82f6",
  Negotiation: "#8b5cf6", Won: "#10b981", Lost: "#ef4444"
};

const GMAIL_SCOPES = "https://www.googleapis.com/auth/gmail.modify";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
const fmtShort = (d) => new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric" });

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || [];
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || "").replace(/"/g, "").trim(); });
    return obj;
  });
}

function toCSV(data) {
  if (!data.length) return "";
  const keys = Object.keys(data[0]);
  const rows = data.map(r => keys.map(k => `"${(r[k]||"").toString().replace(/"/g,'""')}"`).join(","));
  return [keys.join(","), ...rows].join("\n");
}

// ─── Storage ──────────────────────────────────────────────────────────────────
async function saveData(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch(e) {}
}
async function loadData(key, fallback) {
  try {
    const r = await window.storage.get(key);
    return r ? JSON.parse(r.value) : fallback;
  } catch(e) { return fallback; }
}

// ─── Gmail API ────────────────────────────────────────────────────────────────
let gapiLoaded = false;
let gisLoaded = false;

function loadGoogleScripts(cb) {
  if (gapiLoaded && gisLoaded) { cb(); return; }
  const s1 = document.createElement("script");
  s1.src = "https://apis.google.com/js/api.js";
  s1.onload = () => { gapiLoaded = true; if (gisLoaded) cb(); };
  document.head.appendChild(s1);

  const s2 = document.createElement("script");
  s2.src = "https://accounts.google.com/gsi/client";
  s2.onload = () => { gisLoaded = true; if (gapiLoaded) cb(); };
  document.head.appendChild(s2);
}

function decodeBase64(str) {
  try {
    return decodeURIComponent(escape(atob(str.replace(/-/g,'+').replace(/_/g,'/'))));
  } catch(e) { return ""; }
}

function getHeader(headers, name) {
  return (headers.find(h => h.name.toLowerCase() === name.toLowerCase()) || {}).value || "";
}

function parseEmail(msg) {
  const headers = msg.payload?.headers || [];
  const subject = getHeader(headers, "subject") || "(no subject)";
  const from = getHeader(headers, "from");
  const to = getHeader(headers, "to");
  const date = getHeader(headers, "date");
  
  let body = "";
  const parts = msg.payload?.parts || [];
  const findBody = (p) => {
    if (p.mimeType === "text/plain" && p.body?.data) return decodeBase64(p.body.data);
    if (p.mimeType === "text/html" && p.body?.data) return decodeBase64(p.body.data);
    if (p.parts) for (const sub of p.parts) { const r = findBody(sub); if (r) return r; }
    return "";
  };
  if (msg.payload?.body?.data) body = decodeBase64(msg.payload.body.data);
  else body = findBody(msg.payload || {});

  const attachments = [];
  const findAttachments = (p) => {
    if (p.filename && p.body?.attachmentId) attachments.push({ name: p.filename, id: p.body.attachmentId, mimeType: p.mimeType, msgId: msg.id });
    if (p.parts) p.parts.forEach(findAttachments);
  };
  findAttachments(msg.payload || {});

  return { id: msg.id, threadId: msg.threadId, subject, from, to, date, body, attachments, labelIds: msg.labelIds || [], snippet: msg.snippet || "" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Badge({ color, children }) {
  return <span style={{ background: color+"20", color, border:`1px solid ${color}40`, fontSize:11, padding:"2px 8px", borderRadius:20, fontWeight:600, whiteSpace:"nowrap" }}>{children}</span>;
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth: wide?860:520, maxHeight:"90vh", overflow:"auto", boxShadow:"0 25px 50px rgba(0,0,0,0.25)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #f0f0f0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontWeight:700, fontSize:18, color:"#111" }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#999" }}><X size={20}/></button>
        </div>
        <div style={{ padding:24 }}>{children}</div>
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom:16 }}>
      {label && <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#444", marginBottom:6 }}>{label}</label>}
      <input style={{ width:"100%", padding:"10px 12px", border:"1.5px solid #e5e7eb", borderRadius:8, fontSize:14, outline:"none", boxSizing:"border-box", fontFamily:"inherit" }} {...props}/>
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom:16 }}>
      {label && <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#444", marginBottom:6 }}>{label}</label>}
      <select style={{ width:"100%", padding:"10px 12px", border:"1.5px solid #e5e7eb", borderRadius:8, fontSize:14, outline:"none", background:"#fff", fontFamily:"inherit" }} {...props}>{children}</select>
    </div>
  );
}

function Btn({ children, variant="primary", onClick, style={}, disabled, icon }) {
  const base = { display:"inline-flex", alignItems:"center", gap:6, padding:"9px 16px", borderRadius:8, fontSize:13, fontWeight:600, cursor:disabled?"not-allowed":"pointer", border:"none", transition:"all 0.15s", fontFamily:"inherit" };
  const variants = {
    primary: { background:"#1a1a2e", color:"#fff" },
    secondary: { background:"#f5f5f7", color:"#333" },
    danger: { background:"#fee2e2", color:"#dc2626" },
    ghost: { background:"transparent", color:"#666", padding:"6px 10px" }
  };
  return <button disabled={disabled} onClick={onClick} style={{...base,...variants[variant],...style}}>{icon}{children}</button>;
}

// ─── Contact Form ─────────────────────────────────────────────────────────────
function ContactForm({ initial={}, onSave, onClose }) {
  const [f, setF] = useState({ name:"", email:"", phone:"", company:"", tags:"", ...initial });
  const set = k => e => setF(p => ({...p, [k]:e.target.value}));
  return (
    <div>
      <Input label="Full Name *" value={f.name} onChange={set("name")} placeholder="Jane Doe"/>
      <Input label="Email" value={f.email} onChange={set("email")} placeholder="jane@example.com" type="email"/>
      <Input label="Phone" value={f.phone} onChange={set("phone")} placeholder="+1 234 567 8900"/>
      <Input label="Company" value={f.company} onChange={set("company")} placeholder="Acme Corp"/>
      <Input label="Tags (comma-separated)" value={f.tags} onChange={set("tags")} placeholder="vip, enterprise"/>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => f.name && onSave(f)}>Save Contact</Btn>
      </div>
    </div>
  );
}

// ─── Lead Form ────────────────────────────────────────────────────────────────
function LeadForm({ contacts, initial={}, onSave, onClose }) {
  const [f, setF] = useState({ title:"", contactId:"", stage:"New", value:"", notes:"", ...initial });
  const set = k => e => setF(p => ({...p, [k]:e.target.value}));
  return (
    <div>
      <Input label="Lead Title *" value={f.title} onChange={set("title")} placeholder="Website Redesign Project"/>
      <Select label="Contact" value={f.contactId} onChange={set("contactId")}>
        <option value="">— Select Contact —</option>
        {contacts.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</option>)}
      </Select>
      <Select label="Stage" value={f.stage} onChange={set("stage")}>
        {STAGES.map(s => <option key={s}>{s}</option>)}
      </Select>
      <Input label="Deal Value ($)" value={f.value} onChange={set("value")} type="number" placeholder="5000"/>
      <div style={{ marginBottom:16 }}>
        <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#444", marginBottom:6 }}>Notes</label>
        <textarea value={f.notes} onChange={set("notes")} rows={3} placeholder="Any notes about this lead..." style={{ width:"100%", padding:"10px 12px", border:"1.5px solid #e5e7eb", borderRadius:8, fontSize:14, resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" }}/>
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => f.title && onSave(f)}>Save Lead</Btn>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ contacts, leads, setView }) {
  const total = leads.length;
  const won = leads.filter(l=>l.stage==="Won").length;
  const revenue = leads.filter(l=>l.stage==="Won").reduce((s,l)=>s+(+l.value||0),0);
  const active = leads.filter(l=>!["Won","Lost"].includes(l.stage)).length;

  const byStage = STAGES.map(s => ({ stage:s, count:leads.filter(l=>l.stage===s).length, val:leads.filter(l=>l.stage===s).reduce((a,l)=>a+(+l.value||0),0) }));
  const recent = [...leads].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,5);

  return (
    <div style={{ padding:32 }}>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:28, fontWeight:800, color:"#111", marginBottom:4 }}>Dashboard</h1>
        <p style={{ color:"#888", fontSize:14 }}>Welcome back. Here's what's happening.</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:32 }}>
        {[
          { label:"Total Contacts", value:contacts.length, icon:<Users size={20}/>, color:"#6366f1" },
          { label:"Active Leads", value:active, icon:<TrendingUp size={20}/>, color:"#f59e0b" },
          { label:"Deals Won", value:won, icon:<CheckCircle size={20}/>, color:"#10b981" },
          { label:"Revenue Won", value:`$${revenue.toLocaleString()}`, icon:<DollarSign size={20}/>, color:"#3b82f6" },
        ].map(c => (
          <div key={c.label} style={{ background:"#fff", borderRadius:14, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
              <span style={{ color:"#888", fontSize:13, fontWeight:600 }}>{c.label}</span>
              <div style={{ background:c.color+"15", color:c.color, padding:8, borderRadius:8 }}>{c.icon}</div>
            </div>
            <div style={{ fontSize:30, fontWeight:800, color:"#111" }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:20 }}>
        <div style={{ background:"#fff", borderRadius:14, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0" }}>
          <h3 style={{ fontWeight:700, marginBottom:16, fontSize:15 }}>Pipeline by Stage</h3>
          {byStage.map(s => (
            <div key={s.stage} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:600, color:STAGE_COLORS[s.stage] }}>{s.stage}</span>
                <span style={{ fontSize:13, color:"#888" }}>{s.count} leads · ${s.val.toLocaleString()}</span>
              </div>
              <div style={{ height:6, background:"#f0f0f0", borderRadius:4 }}>
                <div style={{ height:"100%", width:`${total?Math.round(s.count/total*100):0}%`, background:STAGE_COLORS[s.stage], borderRadius:4, transition:"width 0.5s" }}/>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background:"#fff", borderRadius:14, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0" }}>
          <h3 style={{ fontWeight:700, marginBottom:16, fontSize:15 }}>Recent Activity</h3>
          {recent.length === 0 && <p style={{ color:"#aaa", fontSize:13 }}>No leads yet.</p>}
          {recent.map(l => {
            const c = contacts.find(c=>c.id===l.contactId);
            return (
              <div key={l.id} style={{ display:"flex", gap:10, marginBottom:12, alignItems:"flex-start" }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:STAGE_COLORS[l.stage], marginTop:5, flexShrink:0 }}/>
                <div>
                  <p style={{ fontSize:13, fontWeight:600, color:"#222", margin:0 }}>{l.title}</p>
                  <p style={{ fontSize:12, color:"#888", margin:0 }}>{c?.name || "Unknown"} · {fmtShort(l.updatedAt)}</p>
                </div>
                <Badge color={STAGE_COLORS[l.stage]}>{l.stage}</Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Contacts Page ────────────────────────────────────────────────────────────
function ContactsPage({ contacts, leads, setContacts, setView, setDetailContact }) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editC, setEditC] = useState(null);
  const fileRef = useRef();

  const filtered = contacts.filter(c =>
    `${c.name} ${c.email} ${c.company}`.toLowerCase().includes(search.toLowerCase())
  );

  const addContact = async (f) => {
    const c = { ...f, id:uid(), createdAt:new Date().toISOString(), tags: f.tags ? f.tags.split(",").map(t=>t.trim()) : [] };
    const next = [...contacts, c];
    setContacts(next);
    await saveData("crm_contacts", next);
    setShowAdd(false);
  };

  const updateContact = async (f) => {
    const next = contacts.map(c => c.id===editC.id ? {...c,...f, tags:typeof f.tags==="string"?f.tags.split(",").map(t=>t.trim()):f.tags} : c);
    setContacts(next);
    await saveData("crm_contacts", next);
    setEditC(null);
  };

  const deleteContact = async (id) => {
    if (!confirm("Delete this contact?")) return;
    const next = contacts.filter(c=>c.id!==id);
    setContacts(next);
    await saveData("crm_contacts", next);
  };

  const exportCSV = () => {
    const data = contacts.map(c => ({...c, tags: Array.isArray(c.tags)?c.tags.join(";"):c.tags}));
    const blob = new Blob([toCSV(data)], {type:"text/csv"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="contacts.csv"; a.click();
  };

  const importCSV = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    const imported = rows.filter(r=>r.name).map(r=>({ id:uid(), name:r.name||"", email:r.email||"", phone:r.phone||"", company:r.company||"", tags:(r.tags||"").split(";").filter(Boolean), createdAt:new Date().toISOString() }));
    const next = [...contacts, ...imported];
    setContacts(next);
    await saveData("crm_contacts", next);
    e.target.value = "";
  };

  return (
    <div style={{ padding:32 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:800, color:"#111", marginBottom:4 }}>Contacts</h1>
          <p style={{ color:"#888", fontSize:14 }}>{contacts.length} total contacts</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="secondary" onClick={() => fileRef.current.click()} icon={<Upload size={14}/>}>Import CSV</Btn>
          <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={importCSV}/>
          <Btn variant="secondary" onClick={exportCSV} icon={<Download size={14}/>}>Export</Btn>
          <Btn onClick={() => setShowAdd(true)} icon={<Plus size={14}/>}>Add Contact</Btn>
        </div>
      </div>

      <div style={{ background:"#fff", borderRadius:14, boxShadow:"0 1px 4px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0", overflow:"hidden" }}>
        <div style={{ padding:"14px 20px", borderBottom:"1px solid #f5f5f5", display:"flex", gap:10, alignItems:"center" }}>
          <Search size={16} style={{color:"#aaa"}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, email, company..." style={{border:"none",outline:"none",fontSize:14,flex:1,fontFamily:"inherit"}}/>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #f0f0f0" }}>
              {["Name","Company","Email","Phone","Leads","Tags",""].map(h => (
                <th key={h} style={{ textAlign:"left", padding:"10px 16px", fontSize:12, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const cLeads = leads.filter(l=>l.contactId===c.id);
              return (
                <tr key={c.id} style={{ borderBottom:"1px solid #f9f9f9", cursor:"pointer" }} onMouseEnter={e=>e.currentTarget.style.background="#fafafa"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"12px 16px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:34, height:34, borderRadius:"50%", background:`hsl(${c.name.charCodeAt(0)*5},60%,85%)`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, color:`hsl(${c.name.charCodeAt(0)*5},60%,35%)`, flexShrink:0 }}>
                        {c.name.slice(0,2).toUpperCase()}
                      </div>
                      <button onClick={() => { setDetailContact(c); setView("contact-detail"); }} style={{ background:"none", border:"none", cursor:"pointer", fontWeight:600, fontSize:14, color:"#1a1a2e", textDecoration:"underline" }}>
                        {c.name}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding:"12px 16px", color:"#555", fontSize:13 }}>{c.company || "—"}</td>
                  <td style={{ padding:"12px 16px", color:"#555", fontSize:13 }}>{c.email || "—"}</td>
                  <td style={{ padding:"12px 16px", color:"#555", fontSize:13 }}>{c.phone || "—"}</td>
                  <td style={{ padding:"12px 16px" }}>
                    <span style={{ background:"#e0e7ff", color:"#4f46e5", fontSize:12, padding:"3px 8px", borderRadius:12, fontWeight:600 }}>{cLeads.length}</span>
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {(c.tags||[]).slice(0,2).map(t => <span key={t} style={{ background:"#f3f4f6", color:"#555", fontSize:11, padding:"2px 6px", borderRadius:6 }}>{t}</span>)}
                    </div>
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      <Btn variant="ghost" onClick={() => setEditC({...c, tags:Array.isArray(c.tags)?c.tags.join(", "):c.tags})} icon={<Edit2 size={14}/>}/>
                      <Btn variant="ghost" onClick={() => deleteContact(c.id)} style={{color:"#ef4444"}} icon={<Trash2 size={14}/>}/>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={7} style={{ padding:40, textAlign:"center", color:"#aaa" }}>No contacts found.</td></tr>}
          </tbody>
        </table>
      </div>

      {showAdd && <Modal title="Add Contact" onClose={() => setShowAdd(false)}><ContactForm onSave={addContact} onClose={() => setShowAdd(false)}/></Modal>}
      {editC && <Modal title="Edit Contact" onClose={() => setEditC(null)}><ContactForm initial={editC} onSave={updateContact} onClose={() => setEditC(null)}/></Modal>}
    </div>
  );
}

// ─── Contact Detail ───────────────────────────────────────────────────────────
function ContactDetail({ contact, leads, setLeads, contacts, setView, gmail }) {
  const [showAddLead, setShowAddLead] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const cLeads = leads.filter(l => l.contactId === contact.id);

  const addLead = async (f) => {
    const l = { ...f, id:uid(), contactId:contact.id, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
    const next = [...leads, l];
    setLeads(next);
    await saveData("crm_leads", next);
    setShowAddLead(false);
  };

  const updateLead = async (f) => {
    const next = leads.map(l => l.id===editLead.id ? {...l,...f,updatedAt:new Date().toISOString()} : l);
    setLeads(next);
    await saveData("crm_leads", next);
    setEditLead(null);
  };

  const deleteLead = async (id) => {
    if (!confirm("Delete this lead?")) return;
    const next = leads.filter(l=>l.id!==id);
    setLeads(next);
    await saveData("crm_leads", next);
  };

  return (
    <div style={{ padding:32 }}>
      <button onClick={() => setView("contacts")} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", color:"#666", fontSize:14, marginBottom:20 }}>
        <ArrowLeft size={16}/> Back to Contacts
      </button>

      <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:20 }}>
        {/* Left card */}
        <div style={{ background:"#fff", borderRadius:14, padding:24, boxShadow:"0 1px 4px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0", height:"fit-content" }}>
          <div style={{ textAlign:"center", marginBottom:20 }}>
            <div style={{ width:64, height:64, borderRadius:"50%", background:`hsl(${contact.name.charCodeAt(0)*5},60%,85%)`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:22, color:`hsl(${contact.name.charCodeAt(0)*5},60%,35%)`, margin:"0 auto 12px" }}>
              {contact.name.slice(0,2).toUpperCase()}
            </div>
            <h2 style={{ fontWeight:800, fontSize:18, margin:0 }}>{contact.name}</h2>
            {contact.company && <p style={{ color:"#888", fontSize:13, margin:"4px 0 0" }}>{contact.company}</p>}
          </div>
          <div style={{ borderTop:"1px solid #f5f5f5", paddingTop:16 }}>
            {[
              { icon:<Mail size={14}/>, val:contact.email },
              { icon:<Phone size={14}/>, val:contact.phone },
              { icon:<Building2 size={14}/>, val:contact.company },
            ].map((item,i) => item.val && (
              <div key={i} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10, color:"#555", fontSize:13 }}>
                <span style={{ color:"#aaa" }}>{item.icon}</span> {item.val}
              </div>
            ))}
            {(contact.tags||[]).length > 0 && (
              <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:8 }}>
                {contact.tags.map(t=><span key={t} style={{ background:"#f3f4f6", color:"#555", fontSize:11, padding:"3px 8px", borderRadius:6 }}>{t}</span>)}
              </div>
            )}
          </div>
          <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid #f5f5f5" }}>
            <p style={{ fontSize:12, color:"#aaa" }}>Added {fmt(contact.createdAt)}</p>
          </div>
          {contact.email && gmail.connected && (
            <Btn style={{ width:"100%", justifyContent:"center", marginTop:8 }} onClick={() => gmail.compose(contact.email)} icon={<Mail size={14}/>}>Send Email</Btn>
          )}
        </div>

        {/* Right — leads */}
        <div>
          <div style={{ background:"#fff", borderRadius:14, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ fontWeight:700, fontSize:16 }}>Leads ({cLeads.length})</h3>
              <Btn onClick={() => setShowAddLead(true)} icon={<Plus size={13}/>}>Add Lead</Btn>
            </div>
            {cLeads.length === 0 && <p style={{ color:"#aaa", textAlign:"center", padding:32 }}>No leads yet. Add one!</p>}
            {cLeads.map(l => (
              <div key={l.id} style={{ border:"1.5px solid #f0f0f0", borderRadius:10, padding:16, marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <h4 style={{ fontWeight:700, fontSize:15, margin:"0 0 6px" }}>{l.title}</h4>
                    <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                      <Badge color={STAGE_COLORS[l.stage]}>{l.stage}</Badge>
                      {l.value && <span style={{ fontSize:13, color:"#10b981", fontWeight:600 }}>${Number(l.value).toLocaleString()}</span>}
                      <span style={{ fontSize:12, color:"#aaa" }}>Updated {fmtShort(l.updatedAt)}</span>
                    </div>
                    {l.notes && <p style={{ color:"#666", fontSize:13, marginTop:8, margin:"8px 0 0" }}>{l.notes}</p>}
                  </div>
                  <div style={{ display:"flex", gap:4 }}>
                    <Btn variant="ghost" onClick={() => setEditLead(l)} icon={<Edit2 size={14}/>}/>
                    <Btn variant="ghost" onClick={() => deleteLead(l.id)} style={{color:"#ef4444"}} icon={<Trash2 size={14}/>}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAddLead && <Modal title="Add Lead" onClose={() => setShowAddLead(false)}><LeadForm contacts={contacts} initial={{contactId:contact.id}} onSave={addLead} onClose={() => setShowAddLead(false)}/></Modal>}
      {editLead && <Modal title="Edit Lead" onClose={() => setEditLead(null)}><LeadForm contacts={contacts} initial={editLead} onSave={updateLead} onClose={() => setEditLead(null)}/></Modal>}
    </div>
  );
}

// ─── Leads / Pipeline ─────────────────────────────────────────────────────────
function LeadsPage({ leads, contacts, setLeads }) {
  const [view, setView] = useState("kanban");
  const [showAdd, setShowAdd] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [search, setSearch] = useState("");
  const fileRef = useRef();

  const filtered = leads.filter(l => l.title.toLowerCase().includes(search.toLowerCase()) || (contacts.find(c=>c.id===l.contactId)?.name||"").toLowerCase().includes(search.toLowerCase()));

  const addLead = async (f) => {
    const l = { ...f, id:uid(), createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
    const next = [...leads, l];
    setLeads(next);
    await saveData("crm_leads", next);
    setShowAdd(false);
  };

  const updateStage = async (id, stage) => {
    const next = leads.map(l => l.id===id ? {...l, stage, updatedAt:new Date().toISOString()} : l);
    setLeads(next);
    await saveData("crm_leads", next);
  };

  const exportLeads = () => {
    const blob = new Blob([toCSV(leads)], {type:"text/csv"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="leads.csv"; a.click();
  };

  const importLeads = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const rows = parseCSV(await file.text());
    const imported = rows.filter(r=>r.title).map(r=>({id:uid(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),...r}));
    const next = [...leads,...imported];
    setLeads(next);
    await saveData("crm_leads", next);
    e.target.value="";
  };

  return (
    <div style={{ padding:32 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:800, color:"#111", marginBottom:4 }}>Leads Pipeline</h1>
          <p style={{ color:"#888", fontSize:14 }}>{leads.length} total leads</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="secondary" onClick={() => fileRef.current.click()} icon={<Upload size={14}/>}>Import</Btn>
          <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={importLeads}/>
          <Btn variant="secondary" onClick={exportLeads} icon={<Download size={14}/>}>Export</Btn>
          <Btn variant={view==="kanban"?"primary":"secondary"} onClick={() => setView("kanban")} icon={<BarChart2 size={14}/>}>Kanban</Btn>
          <Btn variant={view==="list"?"primary":"secondary"} onClick={() => setView("list")} icon={<FileText size={14}/>}>List</Btn>
          <Btn onClick={() => setShowAdd(true)} icon={<Plus size={14}/>}>Add Lead</Btn>
        </div>
      </div>

      <div style={{ marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding:"8px 14px", maxWidth:320 }}>
          <Search size={15} style={{color:"#aaa"}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search leads..." style={{border:"none",outline:"none",fontSize:14,flex:1,fontFamily:"inherit"}}/>
        </div>
      </div>

      {view==="kanban" ? (
        <div style={{ display:"flex", gap:14, overflowX:"auto", paddingBottom:16 }}>
          {STAGES.map(stage => {
            const stageleads = filtered.filter(l=>l.stage===stage);
            const stageVal = stageleads.reduce((s,l)=>s+(+l.value||0),0);
            return (
              <div key={stage} style={{ minWidth:240, flex:"0 0 240px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, padding:"8px 2px" }}>
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:STAGE_COLORS[stage] }}/>
                    <span style={{ fontWeight:700, fontSize:13, color:"#333" }}>{stage}</span>
                    <span style={{ background:"#f0f0f0", color:"#777", fontSize:11, padding:"1px 6px", borderRadius:10, fontWeight:600 }}>{stageleads.length}</span>
                  </div>
                  {stageVal > 0 && <span style={{ fontSize:11, color:"#888" }}>${stageVal.toLocaleString()}</span>}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {stageleads.map(l => {
                    const c = contacts.find(x=>x.id===l.contactId);
                    return (
                      <div key={l.id} style={{ background:"#fff", borderRadius:10, padding:14, boxShadow:"0 1px 3px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0", cursor:"pointer" }} onClick={() => setEditLead(l)}>
                        <p style={{ fontWeight:700, fontSize:13, margin:"0 0 6px", color:"#111" }}>{l.title}</p>
                        {c && <p style={{ fontSize:12, color:"#888", margin:"0 0 8px", display:"flex", gap:4, alignItems:"center" }}><Users size={11}/>{c.name}</p>}
                        {l.value && <p style={{ fontSize:13, color:"#10b981", fontWeight:700, margin:0 }}>${Number(l.value).toLocaleString()}</p>}
                        <p style={{ fontSize:11, color:"#ccc", margin:"6px 0 0" }}>{fmtShort(l.updatedAt)}</p>
                        <div style={{ marginTop:8 }}>
                          <Select style={{fontSize:11,padding:"3px 6px",margin:0}} value={l.stage} onChange={e=>{e.stopPropagation();updateStage(l.id,e.target.value)}} onClick={e=>e.stopPropagation()}>
                            {STAGES.map(s=><option key={s}>{s}</option>)}
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                  {stageleads.length === 0 && <div style={{ border:"2px dashed #f0f0f0", borderRadius:10, padding:16, textAlign:"center", color:"#ddd", fontSize:12 }}>Drop here</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background:"#fff", borderRadius:14, boxShadow:"0 1px 4px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #f0f0f0" }}>
                {["Title","Contact","Stage","Value","Updated",""].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"10px 16px", fontSize:12, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const c = contacts.find(x=>x.id===l.contactId);
                return (
                  <tr key={l.id} style={{ borderBottom:"1px solid #f9f9f9", cursor:"pointer" }} onMouseEnter={e=>e.currentTarget.style.background="#fafafa"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"12px 16px", fontWeight:600, fontSize:14 }}>{l.title}</td>
                    <td style={{ padding:"12px 16px", color:"#555", fontSize:13 }}>{c?.name||"—"}</td>
                    <td style={{ padding:"12px 16px" }}><Badge color={STAGE_COLORS[l.stage]}>{l.stage}</Badge></td>
                    <td style={{ padding:"12px 16px", color:"#10b981", fontWeight:600, fontSize:13 }}>{l.value?`$${Number(l.value).toLocaleString()}`:"—"}</td>
                    <td style={{ padding:"12px 16px", color:"#888", fontSize:13 }}>{fmtShort(l.updatedAt)}</td>
                    <td style={{ padding:"12px 16px" }}>
                      <div style={{ display:"flex", gap:4 }}>
                        <Btn variant="ghost" onClick={() => setEditLead(l)} icon={<Edit2 size={14}/>}/>
                        <Btn variant="ghost" onClick={async () => { if(confirm("Delete?")){const n=leads.filter(x=>x.id!==l.id);setLeads(n);await saveData("crm_leads",n);}}} style={{color:"#ef4444"}} icon={<Trash2 size={14}/>}/>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0&&<tr><td colSpan={6} style={{ padding:40, textAlign:"center", color:"#aaa" }}>No leads found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <Modal title="Add Lead" onClose={() => setShowAdd(false)}><LeadForm contacts={contacts} onSave={addLead} onClose={() => setShowAdd(false)}/></Modal>}
      {editLead && <Modal title="Edit Lead" wide onClose={() => setEditLead(null)}>
        <LeadForm contacts={contacts} initial={editLead} onSave={async (f) => {
          const next = leads.map(l=>l.id===editLead.id?{...l,...f,updatedAt:new Date().toISOString()}:l);
          setLeads(next);
          await saveData("crm_leads", next);
          setEditLead(null);
        }} onClose={() => setEditLead(null)}/>
      </Modal>}
    </div>
  );
}

// ─── Gmail Inbox ──────────────────────────────────────────────────────────────
function InboxPage({ gmail }) {
  const { connected, emails, loading, fetchEmails, compose, openEmail, selectedEmail, setSelectedEmail } = gmail;

  if (!connected) return (
    <div style={{ padding:32, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:400 }}>
      <Mail size={48} style={{ color:"#e5e7eb", marginBottom:16 }}/>
      <h2 style={{ fontWeight:700, fontSize:20, marginBottom:8 }}>Connect Gmail</h2>
      <p style={{ color:"#888", textAlign:"center", maxWidth:340, marginBottom:24 }}>Link your Gmail account to send and receive emails directly in the CRM.</p>
      <p style={{ color:"#aaa", fontSize:13, textAlign:"center" }}>Go to <strong>Settings</strong> to enter your Google Client ID and connect.</p>
    </div>
  );

  if (selectedEmail) return (
    <div style={{ padding:32 }}>
      <button onClick={() => setSelectedEmail(null)} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", color:"#666", fontSize:14, marginBottom:20 }}>
        <ArrowLeft size={16}/> Back to Inbox
      </button>
      <div style={{ background:"#fff", borderRadius:14, padding:24, boxShadow:"0 1px 4px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0" }}>
        <h2 style={{ fontWeight:800, fontSize:18, marginBottom:12 }}>{selectedEmail.subject}</h2>
        <div style={{ display:"flex", gap:16, marginBottom:16, fontSize:13, color:"#888" }}>
          <span><strong>From:</strong> {selectedEmail.from}</span>
          <span><strong>To:</strong> {selectedEmail.to}</span>
          <span>{selectedEmail.date}</span>
        </div>
        {selectedEmail.attachments?.length > 0 && (
          <div style={{ marginBottom:16, padding:12, background:"#f8f9fa", borderRadius:8 }}>
            <p style={{ fontSize:12, fontWeight:700, color:"#888", marginBottom:8 }}>ATTACHMENTS</p>
            {selectedEmail.attachments.map(a => (
              <span key={a.id} style={{ display:"inline-flex", gap:4, alignItems:"center", background:"#fff", border:"1px solid #e5e7eb", borderRadius:6, padding:"4px 10px", fontSize:12, marginRight:6 }}>
                <Paperclip size={11}/>{a.name}
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize:14, color:"#333", lineHeight:1.7, whiteSpace:"pre-wrap", maxHeight:400, overflow:"auto" }}>
          {selectedEmail.body.replace(/<[^>]+>/g, "")}
        </div>
        <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid #f0f0f0" }}>
          <Btn onClick={() => compose(selectedEmail.from.match(/[^<]+@[^>]+/)?.[0] || selectedEmail.from)} icon={<Send size={13}/>}>Reply</Btn>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding:32 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:800, color:"#111", marginBottom:4 }}>Inbox</h1>
          <p style={{ color:"#888", fontSize:14 }}>{emails.length} messages</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="secondary" onClick={fetchEmails} disabled={loading} icon={loading ? <Loader size={14} style={{animation:"spin 1s linear infinite"}}/> : <RefreshCw size={14}/>}>Refresh</Btn>
          <Btn onClick={() => compose()} icon={<Edit2 size={14}/>}>Compose</Btn>
        </div>
      </div>

      <div style={{ background:"#fff", borderRadius:14, boxShadow:"0 1px 4px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0", overflow:"hidden" }}>
        {loading && <div style={{ padding:32, textAlign:"center", color:"#aaa" }}>Loading emails...</div>}
        {!loading && emails.length === 0 && <div style={{ padding:32, textAlign:"center", color:"#aaa" }}>No emails found.</div>}
        {emails.map(e => {
          const isUnread = e.labelIds?.includes("UNREAD");
          return (
            <div key={e.id} onClick={() => openEmail(e)} style={{ padding:"14px 20px", borderBottom:"1px solid #f5f5f5", cursor:"pointer", background:isUnread?"#fafeff":"#fff", display:"flex", gap:14, alignItems:"flex-start" }}
              onMouseEnter={ev=>ev.currentTarget.style.background="#f8f9fa"}
              onMouseLeave={ev=>ev.currentTarget.style.background=isUnread?"#fafeff":"#fff"}>
              {isUnread && <div style={{ width:8, height:8, borderRadius:"50%", background:"#3b82f6", flexShrink:0, marginTop:5 }}/>}
              {!isUnread && <div style={{ width:8, height:8, flexShrink:0 }}/>}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                  <span style={{ fontWeight:isUnread?700:500, fontSize:14, color:"#111", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.from}</span>
                  <span style={{ fontSize:12, color:"#aaa", flexShrink:0, marginLeft:8 }}>{e.date ? new Date(e.date).toLocaleDateString() : ""}</span>
                </div>
                <p style={{ fontWeight:isUnread?600:400, fontSize:13, margin:"0 0 2px", color:"#333" }}>{e.subject}</p>
                <p style={{ fontSize:12, color:"#aaa", margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.snippet}</p>
              </div>
              {e.attachments?.length > 0 && <Paperclip size={14} style={{color:"#aaa", flexShrink:0, marginTop:3}}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Compose Modal ────────────────────────────────────────────────────────────
function ComposeModal({ onClose, sendEmail, defaultTo="" }) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef();

  const handleSend = async () => {
    if (!to || !subject) return;
    setSending(true);
    await sendEmail({ to, subject, body, attachments });
    setSending(false);
    onClose();
  };

  const handleFile = (e) => {
    const files = Array.from(e.target.files);
    setAttachments(p => [...p, ...files]);
  };

  return (
    <Modal title="New Email" wide onClose={onClose}>
      <Input label="To" value={to} onChange={e=>setTo(e.target.value)} placeholder="recipient@example.com"/>
      <Input label="Subject" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject line..."/>
      <div style={{ marginBottom:16 }}>
        <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#444", marginBottom:6 }}>Message</label>
        <textarea value={body} onChange={e=>setBody(e.target.value)} rows={8} style={{ width:"100%", padding:"10px 12px", border:"1.5px solid #e5e7eb", borderRadius:8, fontSize:14, resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" }} placeholder="Write your message..."/>
      </div>
      {attachments.length > 0 && (
        <div style={{ marginBottom:12, display:"flex", flexWrap:"wrap", gap:6 }}>
          {attachments.map((f,i) => <span key={i} style={{ background:"#f3f4f6", fontSize:12, padding:"4px 8px", borderRadius:6, display:"flex", gap:4, alignItems:"center" }}><Paperclip size={11}/>{f.name} <button onClick={()=>setAttachments(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",color:"#999"}}>×</button></span>)}
        </div>
      )}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <Btn variant="secondary" onClick={() => fileRef.current.click()} icon={<Paperclip size={13}/>}>Attach File</Btn>
        <input ref={fileRef} type="file" multiple style={{display:"none"}} onChange={handleFile}/>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="secondary" onClick={onClose}>Discard</Btn>
          <Btn onClick={handleSend} disabled={sending || !to || !subject} icon={<Send size={13}/>}>{sending?"Sending...":"Send"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function SettingsPage({ gmailConfig, setGmailConfig, onConnect, onDisconnect, gmail }) {
  const [clientId, setClientId] = useState(gmailConfig.clientId || "");
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const cfg = { ...gmailConfig, clientId };
    setGmailConfig(cfg);
    await saveData("crm_gmail_config", cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ padding:32, maxWidth:600 }}>
      <h1 style={{ fontSize:28, fontWeight:800, color:"#111", marginBottom:4 }}>Settings</h1>
      <p style={{ color:"#888", fontSize:14, marginBottom:28 }}>Configure your CRM integrations.</p>

      <div style={{ background:"#fff", borderRadius:14, padding:24, boxShadow:"0 1px 4px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0", marginBottom:20 }}>
        <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:16 }}>
          <div style={{ width:40, height:40, background:"#fff3e0", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Mail size={20} style={{color:"#f59e0b"}}/>
          </div>
          <div>
            <h3 style={{ fontWeight:700, fontSize:15, margin:0 }}>Gmail Integration</h3>
            <p style={{ color:"#888", fontSize:12, margin:0 }}>Connect your Gmail to send & receive emails</p>
          </div>
          {gmail.connected && <Badge color="#10b981">Connected</Badge>}
        </div>

        {!gmail.connected ? (
          <>
            <div style={{ background:"#f8fafc", borderRadius:8, padding:16, marginBottom:16, fontSize:13, color:"#555", lineHeight:1.7 }}>
              <strong>Setup (5 minutes):</strong><br/>
              1. Go to <a href="https://console.cloud.google.com" target="_blank" style={{color:"#3b82f6"}}>console.cloud.google.com</a><br/>
              2. Create a project → Enable <strong>Gmail API</strong><br/>
              3. OAuth consent screen → Add <strong>gmail.modify</strong> scope<br/>
              4. Create OAuth 2.0 Client ID (Web Application)<br/>
              5. Add <code style={{background:"#e5e7eb",padding:"1px 4px",borderRadius:3}}>{window.location.origin}</code> as Authorized JS Origin<br/>
              6. Paste the Client ID below
            </div>
            <Input label="Google OAuth Client ID" value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com"/>
            <div style={{ display:"flex", gap:8 }}>
              <Btn variant="secondary" onClick={save}>{saved ? "✓ Saved!" : "Save Client ID"}</Btn>
              {clientId && <Btn onClick={onConnect} icon={<Mail size={13}/>}>Connect Gmail</Btn>}
            </div>
          </>
        ) : (
          <div>
            <p style={{ fontSize:13, color:"#555", marginBottom:12 }}>Connected as: <strong>{gmail.userEmail}</strong></p>
            <Btn variant="danger" onClick={onDisconnect} icon={<LogOut size={13}/>}>Disconnect Gmail</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function CRM() {
  const [view, setView] = useState("dashboard");
  const [contacts, setContacts] = useState([]);
  const [leads, setLeads] = useState([]);
  const [detailContact, setDetailContact] = useState(null);
  const [gmailConfig, setGmailConfig] = useState({ clientId:"" });
  const [gmailState, setGmailState] = useState({ connected:false, token:null, userEmail:"", emails:[], loading:false });
  const [composeData, setComposeData] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const tokenClient = useRef(null);

  // Load data
  useEffect(() => {
    (async () => {
      const [c, l, gc] = await Promise.all([
        loadData("crm_contacts", []),
        loadData("crm_leads", []),
        loadData("crm_gmail_config", { clientId:"" }),
      ]);
      setContacts(c);
      setLeads(l);
      setGmailConfig(gc);
    })();
  }, []);

  // Gmail: load token from session
  useEffect(() => {
    const tok = sessionStorage.getItem("gmail_token");
    const email = sessionStorage.getItem("gmail_email");
    if (tok && gmailConfig.clientId) {
      setGmailState(p => ({...p, connected:true, token:tok, userEmail:email||""}));
    }
  }, [gmailConfig.clientId]);

  const connectGmail = () => {
    if (!gmailConfig.clientId) return;
    loadGoogleScripts(() => {
      window.gapi.load("client", async () => {
        await window.gapi.client.init({ discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"] });
        tokenClient.current = window.google.accounts.oauth2.initTokenClient({
          client_id: gmailConfig.clientId,
          scope: GMAIL_SCOPES,
          callback: async (resp) => {
            if (resp.access_token) {
              window.gapi.client.setToken({ access_token: resp.access_token });
              // Get user email
              let email = "";
              try {
                const profile = await window.gapi.client.gmail.users.getProfile({ userId:"me" });
                email = profile.result.emailAddress;
              } catch(e){}
              sessionStorage.setItem("gmail_token", resp.access_token);
              sessionStorage.setItem("gmail_email", email);
              setGmailState(p => ({...p, connected:true, token:resp.access_token, userEmail:email}));
              fetchEmails(resp.access_token);
            }
          }
        });
        tokenClient.current.requestAccessToken();
      });
    });
  };

  const disconnectGmail = () => {
    sessionStorage.removeItem("gmail_token");
    sessionStorage.removeItem("gmail_email");
    setGmailState({ connected:false, token:null, userEmail:"", emails:[], loading:false });
    setSelectedEmail(null);
  };

  const fetchEmails = useCallback(async (tok) => {
    setGmailState(p => ({...p, loading:true}));
    try {
      const token = tok || gmailState.token;
      const res = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=30&labelIds=INBOX`, {
        headers: { Authorization:`Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.messages) { setGmailState(p=>({...p,loading:false})); return; }
      const msgs = await Promise.all(data.messages.map(m =>
        fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json())
      ));
      setGmailState(p => ({...p, emails:msgs.map(parseEmail), loading:false}));
    } catch(e) {
      setGmailState(p => ({...p, loading:false}));
    }
  }, [gmailState.token]);

  const sendEmail = async ({ to, subject, body, attachments }) => {
    const token = gmailState.token;
    if (!token) return;
    const boundary = "boundary_crm_" + uid();
    let raw = `To: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}\r\n`;
    for (const file of attachments) {
      const b64 = await new Promise((res) => { const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.readAsDataURL(file); });
      raw += `--${boundary}\r\nContent-Type: ${file.type||"application/octet-stream"}\r\nContent-Disposition: attachment; filename="${file.name}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64}\r\n`;
    }
    raw += `--${boundary}--`;
    const encoded = btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
    await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
      method:"POST", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
      body: JSON.stringify({ raw: encoded })
    });
    fetchEmails();
  };

  const gmail = {
    ...gmailState,
    fetchEmails: () => fetchEmails(),
    compose: (to="") => setComposeData({ to }),
    openEmail: (e) => setSelectedEmail(e),
    selectedEmail, setSelectedEmail
  };

  const nav = [
    { id:"dashboard", label:"Dashboard", icon:<BarChart2 size={16}/> },
    { id:"contacts", label:"Contacts", icon:<Users size={16}/> },
    { id:"leads", label:"Pipeline", icon:<TrendingUp size={16}/> },
    { id:"inbox", label:"Inbox", icon:<Inbox size={16}/>, badge: gmailState.emails.filter(e=>e.labelIds?.includes("UNREAD")).length || null },
    { id:"settings", label:"Settings", icon:<Settings size={16}/> },
  ];

  return (
    <div style={{ display:"flex", height:"100vh", fontFamily:"'DM Sans', system-ui, sans-serif", background:"#f7f8fc" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; }
        ::-webkit-scrollbar-thumb { background: #ddd; border-radius: 3px; }
        select { cursor: pointer; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Sidebar */}
      <div style={{ width:220, background:"#1a1a2e", display:"flex", flexDirection:"column", flexShrink:0 }}>
        <div style={{ padding:"24px 20px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ width:32, height:32, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <TrendingUp size={16} style={{color:"#fff"}}/>
            </div>
            <div>
              <p style={{ color:"#fff", fontWeight:800, fontSize:14, lineHeight:1 }}>MyCRM</p>
              <p style={{ color:"rgba(255,255,255,0.4)", fontSize:10 }}>Sales Platform</p>
            </div>
          </div>
        </div>

        <nav style={{ flex:1, padding:"12px 10px" }}>
          {nav.map(n => (
            <button key={n.id} onClick={() => setView(n.id)} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:8, background:view===n.id?"rgba(99,102,241,0.2)":"transparent", color:view===n.id?"#818cf8":"rgba(255,255,255,0.6)", border:"none", cursor:"pointer", fontSize:13, fontWeight:view===n.id?700:500, marginBottom:2, fontFamily:"inherit", transition:"all 0.15s", position:"relative" }}>
              {n.icon}{n.label}
              {n.badge > 0 && <span style={{ marginLeft:"auto", background:"#ef4444", color:"#fff", fontSize:10, fontWeight:700, borderRadius:10, padding:"1px 6px", minWidth:18, textAlign:"center" }}>{n.badge}</span>}
            </button>
          ))}
        </nav>

        {gmailState.connected && (
          <div style={{ padding:"14px 16px", borderTop:"1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#10b981" }}/>
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{gmailState.userEmail}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main */}
      <div style={{ flex:1, overflow:"auto" }}>
        {view==="dashboard" && <Dashboard contacts={contacts} leads={leads} setView={setView}/>}
        {view==="contacts" && <ContactsPage contacts={contacts} leads={leads} setContacts={setContacts} setView={setView} setDetailContact={setDetailContact}/>}
        {view==="contact-detail" && detailContact && <ContactDetail contact={detailContact} leads={leads} setLeads={setLeads} contacts={contacts} setView={setView} gmail={gmail}/>}
        {view==="leads" && <LeadsPage leads={leads} contacts={contacts} setLeads={setLeads}/>}
        {view==="inbox" && <InboxPage gmail={gmail}/>}
        {view==="settings" && <SettingsPage gmailConfig={gmailConfig} setGmailConfig={setGmailConfig} onConnect={connectGmail} onDisconnect={disconnectGmail} gmail={gmailState}/>}
      </div>

      {composeData !== null && <ComposeModal defaultTo={composeData.to} onClose={() => setComposeData(null)} sendEmail={sendEmail}/>}
    </div>
  );
}
