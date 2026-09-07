// Directe cloud-database verbinding met de juiste project-URL
const supabaseUrl = "https://kpanjikwllhcyzqaxgqh.supabase.co/";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwYW5qaWt3bGxoY3l6cWF4Z3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MTQ5OTAsImV4cCI6MjEwNDE5MDk5MH0.K3iatTgzsDREoGB2bBElCzDThhgaKC2z0H7ZxLwVJm8";

// Centrale functie om de echte database aan te roepen met de exacte CORS-headers die Supabase eist
const _sbFetch = async (method, path, body = null) => {
    const volledigeUrl = `${supabaseUrl}/${path}`;
    
    const headers = { 
        "apikey": key, 
        "Authorization": `Bearer ${key}`, 
        "Content-Type": "application/json",
        // 'X-Client-Info' helpt Supabase om het verzoek te herkennen als een browser-app
        "X-Client-Info": "supabase-js-web",
        "Prefer": method === "GET" ? "count=none" : "return=representation"
    };
    
    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);
    
    const res = await fetch(volledigeUrl, config);
    return res.json();
};

let user = null;

async function handleLogin() {
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value.trim();
    if(!u || !p) return alert("Vul alles in!");
    
    try {
        // BELANGRIJK: we voegen '&select=*' toe, dit lost de preflight-fout op bij Supabase GET-queries
        const data = await _sbFetch("GET", `bank_accounts?username=eq.${encodeURIComponent(u)}&password=eq.${encodeURIComponent(p)}&select=*`);
        
        if (!data || data.length === 0) return alert("Onjuiste gegevens of account bestaat niet!");
        
        // Supabase geeft een lijst terug; we pakken het eerste element [0]
        user = data[0]; 
        showDashboard();
    } catch(e) { 
        alert("Fout bij het direct verbinden met de cloud-database!"); 
    }
}

function showDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    const isAdmin = user.is_admin === true || user.is_admin === "true";
    
    document.getElementById('welcomeText').innerText = user.account_holder + (isAdmin ? " (Admin)" : "");
    document.getElementById('lblHolder').innerText = user.account_holder;
    document.getElementById('lblUid').innerText = user.card_uid ? `UID: ${user.card_uid}` : "Geen pas";
    
    if (isAdmin) {
        document.getElementById('lblCardType').innerText = "WerkPay GOD MODE";
        document.getElementById('lblBalance').innerText = "€ ∞";
        document.getElementById('tabAdmin').classList.remove('hidden');
        loadAllAccounts();
    } else {
        document.getElementById('lblCardType').innerText = "WerkPay Premium";
        document.getElementById('lblBalance').innerText = `€${parseFloat(user.balance).toFixed(2)}`;
        document.getElementById('tabAdmin').classList.add('hidden');
    }
    switchTab('wallet');
}

function switchTab(t) {
    document.getElementById('tabWallet').classList.toggle('active', t === 'wallet');
    document.getElementById('tabAdmin').classList.toggle('active', t === 'admin');
    document.getElementById('viewWallet').classList.toggle('hidden', t !== 'wallet');
    document.getElementById('viewAdmin').classList.toggle('hidden', t !== 'admin');
}

function toggleAdminField() {
    const isAdmin = document.getElementById('regIsAdmin').value === "true";
    document.getElementById('regBalance').disabled = isAdmin;
    if(isAdmin) document.getElementById('regBalance').value = 999999999;
}

async function handleDeposit() {
    const isAdmin = user.is_admin === true || user.is_admin === "true";
    if(isAdmin) return alert("Je hebt al oneindig geld!");
    
    const amt = parseFloat(document.getElementById('txtDeposit').value);
    if (isNaN(amt) || amt <= 0) return;
    
    const res = await _sbFetch("PATCH", `bank_accounts?id=eq.${user.id}`, { balance: parseFloat(user.balance) + amt });
    if (res && res.length > 0) { 
        user = res[0]; 
        showDashboard(); 
        document.getElementById('txtDeposit').value = ""; 
    }
}

async function handleTransfer() {
    const target = document.getElementById('txtTransferTarget').value.trim();
    const amt = parseFloat(document.getElementById('txtTransferAmount').value);
    if(!target || isNaN(amt) || amt <= 0) return alert("Vul geldige gegevens in!");
    
    const isAdmin = user.is_admin === true || user.is_admin === "true";
    if(!isAdmin && parseFloat(user.balance) < amt) return alert("Onvoldoende saldo!");
    
    const destData = await _sbFetch("GET", `bank_accounts?username=eq.${encodeURIComponent(target)}&select=*`);
    if(!destData || destData.length === 0) return alert("Ontvanger niet gevonden!");
    const dest = destData[0];
    
    if(!isAdmin) {
        await _sbFetch("PATCH", `bank_accounts?id=eq.${user.id}`, { balance: parseFloat(user.balance) - amt });
    }
    
    await _sbFetch("PATCH", `bank_accounts?id=eq.${dest.id}`, { balance: parseFloat(dest.balance) + amt });
    
    alert("Succesvol overgemaakt!");
    document.getElementById('txtTransferTarget').value = ""; 
    document.getElementById('txtTransferAmount').value = "";
    
    if(!isAdmin) {
        const fresh = await _sbFetch("GET", `bank_accounts?id=eq.${user.id}&select=*`);
        user = fresh[0];
    }
    showDashboard();
}

async function handleCreateOrUpdateUser() {
    const id = document.getElementById('editUserId').value;
    const username = document.getElementById('regUser').value.trim();
    const password = document.getElementById('regPass').value.trim();
    const account_holder = document.getElementById('regHolder').value.trim();
    const card_uid = document.getElementById('regUid').value.trim().toUpperCase() || null;
    const pin_code = document.getElementById('regPin').value.trim() || null;
    const balance = parseFloat(document.getElementById('regBalance').value) || 0;
    const is_admin = document.getElementById('regIsAdmin').value === "true";
    
    if(!username || !password || !account_holder) return alert("Vul verplichte velden in!");
    
    const p = { username, password, account_holder, card_uid, pin_code, balance, is_admin };
    
    const res = id ? await _sbFetch("PATCH", `bank_accounts?id=eq.${id}`, p) : await _sbFetch("POST", `bank_accounts`, p);
    if (res) { 
        alert("Opgeslagen!"); 
        cancelEdit(); 
        loadAllAccounts(); 
    }
}

function editUser(accJson) {
    const acc = JSON.parse(decodeURIComponent(accJson));
    document.getElementById('adminFormTitle').innerText = `${acc.account_holder} Aanpassen`;
    document.getElementById('editUserId').value = acc.id; 
    document.getElementById('regUser').value = acc.username; 
    document.getElementById('regPass').value = acc.password; 
    document.getElementById('regHolder').value = acc.account_holder; 
    document.getElementById('regUid').value = acc.card_uid || ""; 
    document.getElementById('regPin').value = acc.pin_code || ""; 
    document.getElementById('regBalance').value = acc.balance; 
    document.getElementById('regIsAdmin').value = acc.is_admin ? "true" : "false";
    document.getElementById('btnCancelEdit').classList.remove('hidden'); 
    toggleAdminField();
}

async function quickMoney(id, cur, amt) {
    await _sbFetch("PATCH", `bank_accounts?id=eq.${id}`, { balance: parseFloat(cur) + amt }); 
    loadAllAccounts();
}

function cancelEdit() { 
    document.getElementById('adminFormTitle').innerText = "👥 Gebruiker Toevoegen / Aanpassen"; 
    document.getElementById('editUserId').value = ""; 
    clearRegForm(); 
    document.getElementById('btnCancelEdit').classList.add('hidden'); 
}

function clearRegForm() { 
    document.getElementById('regUser').value = ""; 
    document.getElementById('regPass').value = ""; 
    document.getElementById('regHolder').value = ""; 
    document.getElementById('regUid').value = ""; 
    document.getElementById('regPin').value = ""; 
    document.getElementById('regBalance').value = "0"; 
    document.getElementById('regIsAdmin').value = "false"; 
    toggleAdminField(); 
}

async function loadAllAccounts() {
    const data = await _sbFetch("GET", "bank_accounts?order=username.asc&select=*");
    if (data) {
        const list = document.getElementById('accountsList'); 
        list.innerHTML = "";
        data.forEach(a => {
            const checkAdmin = a.is_admin === true || a.is_admin === "true";
            const bal = checkAdmin ? "∞" : `€${parseFloat(a.balance).toFixed(2)}`;
            const qB = checkAdmin ? "" : `<br><button class="btn-sm" style="background:var(--green)" onclick="quickMoney('${a.id}',${a.balance},10)">+ €10</button><button class="btn-sm" style="background:var(--red)" onclick="quickMoney('${a.id}',${a.balance},-10)">- €10</button>`;
            
            list.innerHTML += `<div style='padding:10px; border-bottom:1px solid var(--border); background:#111827; margin-bottom:5px; border-radius:5px;'><button class="btn-sm" style="background:var(--blue); float:right;" onclick="editUser('${encodeURIComponent(JSON.stringify(a))}')">Aanpassen</button><strong>${a.account_holder}</strong> (${a.username})<br>Saldo: <span style='color:var(--green);font-weight:bold;'>${bal}</span>${qB}</div>`;
        });
    }
}

function handleLogout() { 
    user = null; 
    document.getElementById('mainApp').classList.add('hidden'); 
    document.getElementById('loginScreen').classList.remove('hidden'); 
}
