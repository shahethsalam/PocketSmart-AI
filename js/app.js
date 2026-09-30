const App = {
  pageNames:{dashboard:"Overview",homePlanner:"Home planner",partyPlanner:"Party planner",jewelryPlanner:"Jewelry planner",history:"Plan history",howItWorks:"How it works"},
  init(){
    this.bindAuth(); this.bindNav(); this.bindForms(); this.bindHistory(); this.bindModal();
    const user=Auth.require();
    if(user)this.showApp();else this.showAuth();
  },
  showAuth(){document.getElementById("authScreen").classList.remove("hidden");document.getElementById("appShell").classList.add("hidden");},
  showApp(){
    const user=Auth.require(); if(!user)return this.showAuth();
    document.getElementById("authScreen").classList.add("hidden");document.getElementById("appShell").classList.remove("hidden");
    document.getElementById("welcomeName").textContent=(user.name||"there").split(" ")[0];
    document.getElementById("userAvatar").textContent=(user.name||"U").charAt(0).toUpperCase();
    document.getElementById("todayLabel").textContent=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
    Dashboard.refresh(); History.render();
  },
  bindAuth(){
    document.querySelectorAll(".auth-tab").forEach(tab=>tab.onclick=()=>{
      document.querySelectorAll(".auth-tab").forEach(t=>t.classList.remove("active"));tab.classList.add("active");
      const login=tab.dataset.auth==="login";document.getElementById("loginForm").classList.toggle("hidden",!login);document.getElementById("registerForm").classList.toggle("hidden",login);
    });
    document.getElementById("loginForm").onsubmit=async e=>{e.preventDefault();try{await Auth.login(loginEmail.value,loginPassword.value);this.showApp();this.toast("Welcome back.");}catch(err){this.toast(err.message)}};
    document.getElementById("registerForm").onsubmit=async e=>{e.preventDefault();try{await Auth.register(registerName.value,registerEmail.value,registerPassword.value);this.showApp();this.toast("Account created.");}catch(err){this.toast(err.message)}};
    document.getElementById("logoutBtn").onclick=()=>{Auth.logout();this.showAuth();};
  },
  bindNav(){
    document.addEventListener("click",e=>{
      const el=e.target.closest("[data-page]"); if(!el)return;
      this.go(el.dataset.page); document.getElementById("sidebar").classList.remove("open");
    });
    mobileMenu.onclick=()=>document.getElementById("sidebar").classList.add("open");
    mobileClose.onclick=()=>document.getElementById("sidebar").classList.remove("open");
  },
  go(page){
    document.querySelectorAll(".page").forEach(p=>p.classList.remove("active-page"));
    document.getElementById(`page-${page}`).classList.add("active-page");
    document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.page===page));
    document.getElementById("breadcrumb").textContent=this.pageNames[page]||"PocketSmart AI";
    if(page==="dashboard")Dashboard.refresh();if(page==="history")History.render();window.scrollTo({top:0,behavior:"smooth"});
  },
  async makePlan(endpoint, payload, fallbackFactory){
    try {
      const result = await Planner.callApi(endpoint, payload);
      if(result) return result;
    } catch(err) {
      console.warn("AI API unavailable:", err);
      this.toast("AI service unavailable — showing demo recommendation.");
    }
    return fallbackFactory();
  },
  bindForms(){
    homeForm.onsubmit=async e=>{
      e.preventDefault();
      const data={budget:Number(homeBudget.value),rooms:[...document.querySelectorAll("#homeRooms input:checked")].map(x=>x.value),lights:Number(homeLights.value),fans:Number(homeFans.value),furniture:Number(homeFurniture.value),dining:Number(homeDining.value),notes:homeNotes.value};
      const plan=await this.makePlan("/generate-home",data,()=>Planner.home(data));
      plan.details=data;
      Planner.save(plan); Dashboard.refresh(); History.render(); renderPlanResult(plan); this.toast(plan.type==="home"&&plan.allocations?.length?"Home AI plan created.":"Home plan created.");
    };
    partyForm.onsubmit=async e=>{
      e.preventDefault();
      const data={budget:Number(partyBudget.value),guests:Number(partyGuests.value),type:partyType.value,venue:partyVenue.value,catering:partyCatering.checked,decor:partyDecor.checked,entertainment:partyEntertainment.checked,notes:partyNotes.value};
      const plan=await this.makePlan("/generate-party",data,()=>Planner.party(data));
      plan.details=data;
      Planner.save(plan); Dashboard.refresh(); History.render(); renderPlanResult(plan); this.toast("Party AI plan created.");
    };
    jewelryForm.onsubmit=async e=>{
      e.preventDefault();
      const file=jewelryImage.files[0];
      const data={budget:Number(jewelryBudget.value),occasion:jewelryOccasion.value,style:jewelryStyle.value,image:file?.name||""};
      const form=new FormData();
      form.append("budget",String(data.budget)); form.append("occasion",data.occasion); form.append("style",data.style);
      if(file) form.append("outfit_image",file);
      let plan;
      try { plan=await Planner.callApi("/generate-jewelry",form); } catch(err) { console.warn("AI API unavailable:",err); this.toast("AI service unavailable — showing demo recommendation."); }
      if(!plan) plan=Planner.jewelry(data);
      plan.details=data;
      Planner.save(plan); Dashboard.refresh(); History.render(); renderPlanResult(plan); this.toast("Jewelry AI recommendation created.");
    };
    jewelryImage.onchange=()=>{const f=jewelryImage.files[0],img=imagePreview;if(!f){img.style.display="none";return}img.src=URL.createObjectURL(f);img.style.display="block"};
  },
  bindHistory(){
    historySearch.oninput=()=>History.render();historyFilter.onchange=()=>History.render();
    clearHistory.onclick=()=>{if(confirm("Clear all saved plans?")){History.clear();Dashboard.refresh();this.toast("History cleared.");}};
    historyList.onclick=e=>{const id=e.target.dataset.id;if(!id)return;const p=Planner.plans().find(x=>x.id===id);if(e.target.classList.contains("delete-history")){History.delete(id);Dashboard.refresh();this.toast("Plan deleted.");}else if(e.target.classList.contains("view-history"))renderPlanResult(p)};
  },
  bindModal(){document.querySelectorAll("[data-close-modal]").forEach(x=>x.onclick=()=>document.getElementById("resultModal").classList.add("hidden"));},
  toast(message){const t=document.getElementById("toast");t.textContent=message;t.classList.add("show");clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>t.classList.remove("show"),2600);}
};
document.addEventListener("DOMContentLoaded",()=>App.init());
