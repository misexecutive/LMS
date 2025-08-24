/**
 * js/admin.js
 * Simple admin portal wiring. Depends on API.call.
 * - download template
 * - upload CSV (reads CSV via FileReader)
 * - list users
 * - add/upsert user
 * - assign leads (calls LEADS_QUERY to find candidate leads and LEADS_ASSIGN)
 *
 * NOTE: CSV parsing is lightweight: expects comma-separated with header row. Use XLSX conversion later if needed.
 */

const ADMIN = (function(){
  async function init(){
    // Verify session
    const me = await API.call("AUTH_ME", {}, "POST");
    if(!me.ok){
      alert("Unauthorized. Please login.");
      window.location.href = "login.html";
      return;
    }
    // Wire buttons
    document.getElementById("btnDownloadTemplate").addEventListener("click", downloadTemplate);
    document.getElementById("btnUploadLeads").addEventListener("click", uploadLeads);
    document.getElementById("btnAddUser").addEventListener("click", addUser);
    document.getElementById("btnFetchCount").addEventListener("click", fetchAssignCount);
    document.getElementById("btnAssignLeads").addEventListener("click", assignLeadsBulk);
    document.getElementById("btnSignOut").addEventListener("click", signOut);
    await refreshUsers();
  }

  function downloadTemplate(){
    // Create CSV with headers Name,Phone,AltPhone,Designation,District,Block,SchoolName
    const headers = ["Name","Phone","AltPhone","Designation","District","Block","SchoolName"];
    const csv = headers.join(",") + "\n";
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "leads_template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function parseCSV(text){
    const lines = text.trim().split(/\r?\n/).filter(l=>l.trim());
    if(lines.length <= 1) return [];
    const headers = lines[0].split(",").map(h=>h.trim());
    const rows = [];
    for(let i=1;i<lines.length;i++){
      const cols = lines[i].split(",").map(c=>c.trim());
      const obj = {};
      headers.forEach((h,idx)=> obj[h] = cols[idx] || "");
      rows.push(obj);
    }
    return rows;
  }

  async function uploadLeads(){
    const f = document.getElementById("fileLeads").files[0];
    if(!f){ alert("Select a CSV first"); return; }
    const text = await f.text();
    const leads = parseCSV(text);
    const chunkSize = 200; // batch to avoid timeouts
    let inserted = 0, skipped = 0;
    for(let i=0;i<leads.length;i+=chunkSize){
      const batch = leads.slice(i, i+chunkSize);
      const r = await API.call("LEADS_CREATE", { leads: batch }, "POST");
      if(r.ok){ inserted += r.inserted || 0; skipped += r.skipped || 0; } else {
        document.getElementById("importResult").innerText = "Error: " + r.error; break;
      }
    }
    document.getElementById("importResult").innerText = `Imported: ${inserted}, Skipped duplicates: ${skipped}`;
    await refreshUsers(); // in case admin was added via import (unlikely)
  }

  async function addUser(){
    const user = {
      Email: document.getElementById("uEmail").value.trim(),
      Name: document.getElementById("uName").value.trim(),
      Role: document.getElementById("uRole").value,
      TeamLeaderEmail: document.getElementById("uTeamLeaderEmail").value.trim()
    };
    if(!user.Email){ alert("Email required"); return; }
    const r = await API.call("USERS_UPSERT", { user: user }, "POST");
    if(r.ok){ alert(r.message || "Saved"); await refreshUsers(); }
    else alert("Error: " + r.error);
  }

  async function refreshUsers(){
    const r = await API.call("USERS_LIST", {}, "POST");
    const container = document.getElementById("usersList");
    container.innerHTML = "";
    if(!r.ok) { container.innerText = "Error loading users: " + r.error; return; }
    const tbl = document.createElement("table");
    tbl.className = "simple";
    const header = document.createElement("tr");
    ["Email","Name","Role","Active","Actions"].forEach(h=>{ const th=document.createElement("th"); th.innerText=h; header.appendChild(th); });
    tbl.appendChild(header);
    r.users.forEach(u=>{
      const tr = document.createElement("tr");
      ["Email","Name","Role","Active"].forEach(k=>{
        const td=document.createElement("td"); td.innerText = u[k]; tr.appendChild(td);
      });
      const td = document.createElement("td");
      const del = document.createElement("button"); del.innerText="Delete";
      del.onclick = async ()=>{ if(confirm("Delete user?")){ const d = await API.call("USERS_DELETE",{ email:u.Email },"POST"); if(d.ok) await refreshUsers(); else alert(d.error);} };
      td.appendChild(del);
      tr.appendChild(td);
      tbl.appendChild(tr);
    });
    container.appendChild(tbl);

    // populate assignTo dropdown
    const assignTo = document.getElementById("assignTo");
    assignTo.innerHTML = "";
    r.users.filter(uu=>["Caller","CrossCaller","TL"].indexOf(uu.Role) !== -1).forEach(uu=>{
      const opt = document.createElement("option");
      opt.value = uu.Email; opt.innerText = `${uu.Name} (${uu.Email}) - ${uu.Role}`;
      assignTo.appendChild(opt);
    });
  }

  async function fetchAssignCount(){
    const district = document.getElementById("assignDistrict").value.trim();
    const block = document.getElementById("assignBlock").value.trim();
    if(!district || !block){ alert("District & Block required"); return; }
    // query leads with filters
    const r = await API.call("LEADS_QUERY", { filters: { District: district, Block: block, pageSize: 1 } }, "POST");
    if(!r.ok) { document.getElementById("assignCount").innerText = "Error: " + r.error; return; }
    document.getElementById("assignCount").innerText = `Total matching leads: ${r.total}`;
  }

  async function assignLeadsBulk(){
    const district = document.getElementById("assignDistrict").value.trim();
    const block = document.getElementById("assignBlock").value.trim();
    const assignedTo = document.getElementById("assignTo").value;
    if(!district || !block || !assignedTo){ alert("Fill all"); return; }
    // fetch all candidate leads (page through)
    const allLeadIds = [];
    let page = 1;
    while(true){
      const r = await API.call("LEADS_QUERY", { filters: { District: district, Block: block, page: page, pageSize: 200 } }, "POST");
      if(!r.ok){ alert("Error: " + r.error); return; }
      const leads = r.leads || [];
      leads.forEach(l=>{ if(!l.Assigned) allLeadIds.push(l.LeadID); });
      if(allLeadIds.length >= r.total || leads.length < 200) break;
      page++;
    }
    if(allLeadIds.length === 0) return alert("No unassigned leads found");
    // chunk assign
    const chunk = 200;
    for(let i=0;i<allLeadIds.length;i+=chunk){
      const batch = allLeadIds.slice(i,i+chunk);
      const res = await API.call("LEADS_ASSIGN", { leadIds: batch, assignedToEmail: assignedTo }, "POST");
      if(!res.ok) return alert("Assign error: " + res.error);
    }
    alert("Assigned " + allLeadIds.length + " leads to " + assignedTo);
  }

  async function signOut(){
    API.setAuthToken(null);
    window.location.href = "login.html";
  }

  return { init };
})();
