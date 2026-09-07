let _db = null;
let user = null;

// Wacht tot de browser alle externe scripts (zoals Supabase) volledig heeft ingeladen
window.onload = function() {
    const supabaseUrl = "https://supabase.co";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwYW5qaWt3bGxoY3l6cWF4Z3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MTQ5OTAsImV4cCI6MjEwNDE5MDk5MH0.K3iatTgzsDREoGB2bBElCzDThhgaKC2z0H7ZxLwVJm8";
    _db = supabase.createClient(supabaseUrl, supabaseKey);
};

// 1. INLOGGEN
async function handleLogin() {
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value.trim();
    if(!u || !p) return alert("Vul alle velden in!");
    if(!_db) return alert("Database laadt nog, wacht een seconde...");
    
    try {
        const { data, error } = await _db.from('bank_accounts').select('*').eq('username', u).eq('password', p).maybeSingle();
        if (error || !data) return alert("Onjuiste gebruikersnaam of wachtwoord!");
        
        user = data; 
        showDashboard();
    } catch(e) { 
        alert("Fout bij het direct verbinden met de database!"); 
    }
}

// 2. DASHBOARD UPDATEN
function showDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    const isAdmin = user.is_admin === true || user.is_admin === "true";
    
    document.getElementById('welcomeText').innerText = user.account_holder + (isAdmin ? " (Admin)" : "");
    document.getElementById('lblHolder').innerText = user.account_holder;
    document.getElementById('lblUid').innerText = user.card_uid ? `UID: ${user.card_uid}` : "Geen fysieke pas gekoppeld";
    
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

// 3. NAVIGATIE TUSSEN TABS
function switchTab(t) {
    document.getElementById('tabWallet').classList.toggle('active', t === 'wallet');
    document.getElementById('tabAdmin').classList.toggle('active', t === 'admin');
    document.getElementById('viewWallet').classList.toggle('hidden', t !== 'wallet');
    document.getElementById('viewAdmin').classList.toggle('hidden', t !== 'admin');
}

// 4. MANAGER VELDBEPERKING VOOR ADMINS
function toggleAdminField() {
    const isAdmin = document.getElementById('regIsAdmin').value === "true";
    document.getElementById('regBalance').disabled = isAdmin;
    if(isAdmin) document.getElementById('regBalance').value = 999999999;
}

// 5. SALDO OPWAARDEREN
async function handleDeposit() {
    if(user.is_admin) return alert("Je hebt als Admin al oneindig geld!");
    const amt = parseFloat(document.getElementById('txtDeposit').value);
    if (isNaN(amt) || amt <= 0) return alert("Voer een geldig bedrag in!");
    
    const { data, error } = await _db.from('bank_accounts').update({ balance: parseFloat(user.balance) + amt }).eq('id', user.id).select().maybeSingle();
    if (!error && data) { 
        user = data; 
        showDashboard(); 
        document.getElementById('txtDeposit').value = ""; 
        alert("Geld succesvol gestort!");
    }
}

// 6. GELD OVERBOEKEN NAAR ANDEREN
async function handleTransfer() {
    const target = document.getElementById('txtTransferTarget').value.trim();
    const amt = parseFloat(document.getElementById('txtTransferAmount').value);
    if(!target || isNaN(amt) || amt <= 0) return alert("Vul geldige overboekingsgegevens in!");
    
    const isAdmin = user.is_admin === true || user.is_admin === "true";
    if(!isAdmin && parseFloat(user.balance) < amt) return alert("Onvoldoende saldo op je rekening!");
    
    // Zoek ontvanger
    const { data: dest, error } = await _db.from('bank_accounts').select('*').eq('username', target).maybeSingle();
    if(error || !dest) return alert("Ontvanger gebruikersnaam niet gevonden!");

    // Schrijf af bij zender (behalve als zender Admin is)
    if(!isAdmin) {
        await _db.from('bank_accounts').update({ balance: parseFloat(user.balance) - amt }).eq('id', user.id);
    }
    
    // Stort bij ontvanger
    await _db.from('bank_accounts').update({ balance: parseFloat(dest.balance) + amt }).eq('id', dest.id);
    
    alert(`€${amt.toFixed(2)} succesvol overgemaakt naar ${dest.account_holder}!`);
    document.getElementById('txtTransferTarget').value = ""; 
    document.getElementById('txtTransferAmount').value = "";
    
    if(!isAdmin) {
        const { data: fresh } = await _db.from('bank_accounts').select('*').eq('id', user.id).maybeSingle();
        user = fresh;
    }
    showDashboard();
}

// 7. ACCOUNT INTEGRATIE: GEBRUIKERS AANMAKEN EN AANPASSEN
async function handleCreateOrUpdateUser() {
    const id = document.getElementById('editUserId').value;
    const username = document.getElementById('regUser').value.trim();
    const password = document.getElementById('regPass').value.trim();
    const account_holder = document.getElementById('regHolder').value.trim();
    const card_uid = document.getElementById('regUid').value.trim().toUpperCase() || null;
    const pin_code = document.getElementById('regPin').value.trim() || null;
    const balance = parseFloat(document.getElementById('regBalance').value) || 0;
    const is_admin = document.getElementById('regIsAdmin').value === "true";
    
    if(!username || !password || !account_holder) return alert("Vul alle verplichte velden in!");
    const p = { username, password, account_holder, card_uid, pin_code, balance, is_admin };
    
    const { error } = id ? await _db.from('bank_accounts').update(p).eq('id', id) : await _db.from('bank_accounts').insert([p]);
    if (!error) { 
        alert("Gebruikersprofiel succesvol gesynchroniseerd met de cloud!"); 
        cancelEdit(); 
        loadAllAccounts(); 
    } else {
        alert("Fout bij opslaan: " + error.message);
    }
}

// 8. GEBRUIKER SELECTEREN OM AAN TE PASSEN
function editUser(accJson) {
    const acc = JSON.parse(decodeURIComponent(accJson));
    document.getElementById('adminFormTitle').innerText = `✏️ ${acc.account_holder} Aanpassen`;
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

// 9. SNELKNOPPEN (+10 / -10) VOOR ADMINS
async function quickMoney(id, cur, amt) {
    await _db.from('bank_accounts').update({ balance: parseFloat(cur) + amt }).eq('id', id); 
    loadAllAccounts();
}

// HELPER FUNCTIES RESET & LOGOUT
function cancelEdit() { document.getElementById('adminFormTitle').innerText = "👥 Gebruiker Toevoegen / Aanpassen"; document.getElementById('editUserId').value = ""; clearRegForm(); document.getElementById('btnCancelEdit').classList.add('hidden'); }
function clearRegForm() { document.getElementById('regUser').value = ""; document.getElementById('regPass').value = ""; document.getElementById('regHolder').value = ""; document.getElementById('regUid').value = ""; document.getElementById('regPin').value = ""; document.getElementById('regBalance').value = "0"; document.getElementById('regIsAdmin').value = "false"; toggleAdminField(); }
function handleLogout() { user = null; document.getElementById('mainApp').classList.add('hidden'); document.getElementById('loginScreen').classList.remove('hidden'); document.getElementById('loginUser').value = ""; document.getElementById('loginPass').value = ""; }

// 10. REKENINGOVERZICHT INLADEN
async function loadAllAccounts() {
    const { data, error } = await _db.from('bank_accounts').select('*').order('username');
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
