const Dashboard = {
  refresh(){
    const plans=Planner.plans();
    const total=plans.reduce((s,p)=>s+Number(p.budget||0),0);
    const latest=plans[0];
    const counts={home:0,party:0,jewelry:0}; plans.forEach(p=>counts[p.type]++);
    const most=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    document.getElementById("statPlans").textContent=plans.length;
    document.getElementById("statBudget").textContent=Planner.money(total);
    document.getElementById("statRemaining").textContent=latest?Planner.money(Math.max(0,latest.budget-latest.allocations.reduce((a,b)=>a+b.amount,0))):Planner.money(0);
    document.getElementById("statMost").textContent=most&&most[1]?({home:"Home",party:"Party",jewelry:"Jewelry"}[most[0]]):"—";
    const recent=document.getElementById("recentPlans");
    recent.innerHTML=plans.slice(0,4).map(p=>`<div class="recent-item"><div class="recent-icon">${p.type==="home"?"⌂":p.type==="party"?"✦":"◇"}</div><div><strong>${p.title}</strong><small>${new Date(p.createdAt).toLocaleDateString("en-IN")}</small></div><div class="recent-budget">${Planner.money(p.budget)}</div></div>`).join("")||'<div class="empty-state">No plans yet.<br>Start your first smart plan.</div>';
    const sums={};
    plans.forEach(p=>p.allocations.forEach(a=>sums[a.label]=(sums[a.label]||0)+a.amount));
    const entries=Object.entries(sums).sort((a,b)=>b[1]-a[1]).slice(0,5);
    document.getElementById("budgetBreakdown").innerHTML=entries.length?`<div class="breakdown">${entries.map(([k,v])=>`<div class="break-row"><span>${k}</span><div class="bar"><i style="width:${Math.min(100,(v/Math.max(total,1))*100)}%"></i></div><strong>${Planner.money(v)}</strong></div>`).join("")}</div>`:"Create a plan to see your budget distribution.";
  }
};
