const Auth = {
  key: "pocketsmart_users",
  sessionKey: "pocketsmart_session",
  async hash(text) {
    if (window.crypto?.subtle) {
      const data = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,"0")).join("");
    }
    return btoa(unescape(encodeURIComponent(text)));
  },
  users(){ return JSON.parse(localStorage.getItem(this.key) || "[]"); },
  saveUsers(users){ localStorage.setItem(this.key, JSON.stringify(users)); },
  current(){ return JSON.parse(localStorage.getItem(this.sessionKey) || "null"); },
  async register(name,email,password){
    const users=this.users();
    email=email.trim().toLowerCase();
    if(users.some(u=>u.email===email)) throw new Error("An account with this email already exists.");
    const user={id:crypto.randomUUID?.() || String(Date.now()),name,email,passwordHash:await this.hash(password)};
    users.push(user); this.saveUsers(users); localStorage.setItem(this.sessionKey,JSON.stringify({id:user.id,name:user.name,email:user.email}));
    return user;
  },
  async login(email,password){
    const user=this.users().find(u=>u.email===email.trim().toLowerCase());
    if(!user || user.passwordHash!==await this.hash(password)) throw new Error("Invalid email or password.");
    localStorage.setItem(this.sessionKey,JSON.stringify({id:user.id,name:user.name,email:user.email}));
    return user;
  },
  logout(){ localStorage.removeItem(this.sessionKey); },
  require(){ return this.current(); }
};
