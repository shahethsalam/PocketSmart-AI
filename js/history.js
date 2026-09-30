const History = {
  list(){return Planner.plans();},
  delete(id){
    const u=Auth.current(); if(!u)return;
    const key=`pocketsmart_plans_${u.id}`;
    const plans=this.list().filter(p=>p.id!==id);
    localStorage.setItem(key,JSON.stringify(plans)); this.render();
  },
  clear(){
    const u=Auth.current(); if(u)localStorage.removeItem(`pocketsmart_plans_${u.id}`);
    this.render();
  },
  render(){
    const box=document.getElementById("historyList"); if(!box)return;
    const q=(document.getElementById("historySearch")?.value||"").toLowerCase();
    const filter=document.getElementById("historyFilter")?.value||"all";
    const plans=this.list().filter(p=>(filter==="all"||p.type===filter)&&(`${p.title} ${p.summary}`.toLowerCase().includes(q)));
    if(!plans.length){box.innerHTML='<div class="empty-state">No matching plans found.</div>';return;}
    box.innerHTML=plans.map(p=>`<div class="history-item"><div class="recent-icon">${p.type==="home"?"⌂":p.type==="party"?"✦":"◇"}</div><div class="history-main"><strong>${p.title}</strong><small>${p.summary} • ${new Date(p.createdAt).toLocaleDateString("en-IN")}</small></div><strong>${Planner.money(p.budget)}</strong><div class="history-actions"><button class="small-btn view-history" data-id="${p.id}">View</button><button class="small-btn delete delete-history" data-id="${p.id}">Delete</button></div></div>`).join("");
  }
};
