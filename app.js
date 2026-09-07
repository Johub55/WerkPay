let _db = null;
let user = null;

// Wacht tot de browser de Supabase link volledig heeft ingeladen
window.onload = function() {
    const url = "https://supabase.co";
    const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwYW5qaWt3bGxoY3l6cWF4Z3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MTQ5OTAsImV4cCI6MjEwNDE5MDk5MH0.K3iatTgzsDREoGB2bBElCzDThhgaKC2z0H7ZxLwVJm8";
    _db = supabase.createClient(url, key);
};

async function handleLogin() {
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value.trim();
    if(!u || !p) return alert("Vul alles in!");
    if(!_db) return alert("Database laadt nog, wacht een seconde...");
    
    const { data, error } = await _db.from('bank_accounts').select('*').eq('username', u).eq('password', p).single();
    if (error || !data) return alert("Onjuiste gegevens!");
    user = data; showDashboard();
}

function showDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('welcomeText').innerText = user.account_holder + (user.is_admin ? " (Admin)" : "");
    document.getElementById('lblHolder').innerText = user.account_holder;
    document.getElementById('lblUid').innerText = user.card_uid ? `UID: ${user.card_uid}` : "Geen pas";
    document.getElementById('lblCardType').innerText = user.is_admin ? "WerkPay GOD MODE" : "WerkPay Premium";
    document.getElementById('lblBalance').innerText = user.is_admin ? "€ ∞" : `€${parseFloat(user.balance).toFixed(2)}`;
    document.getElementById('tabAdmin').classList.toggle('hidden', !user.is_admin);
    if (user.is_admin) loadAllAccounts();
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
    if(user.is_admin) return alert("Je hebt al oneindig geld!");
    const amt = parseFloat(document.getElementById('txtDeposit').value);
    if (isNaN(amt) || amt <= 0) return;
    const { data } = await _db.from('bank_accounts').update({ balance: parseFloat(user.balance) + amt }).eq('id', user.id).select().single();
    if (data) { user = data; showDashboard(); document.getElementById('txtDeposit').value = ""; }
}

async function handleTransfer() {
    const target = document.getElementById('txtTransferTarget').value.trim();
    const amt = parseFloat(document.getElementById('txtTransferAmount').value);
    if(!target || isNaN(amt) || amt <= 0) return alert("Vul geldige gegevens in!");
    if(!user.is_admin && parseFloat(user.balance) < amt) return alert("Onvoldoende saldo!");
    
    const { data: destUser, error } = await _db.from('bank_accounts').select('*').eq('username', target).single();
    if(error || !destUser) return alert("Ontvanger niet gevonden!");

    if(!user.is_admin) await _db.from('bank_accounts').update({ balance: parseFloat(user.balance) - amt }).eq('id', user.id);
    await _db.from('bank_accounts').update({ balance: parseFloat(destUser.balance) + amt }).eq('id', destUser.id);
    
    alert("Overgemaakt!");
    document.getElementById('txtTransferTarget').value = ""; document.getElementById('txtTransferAmount').value = "";
    if(!user.is_admin) {
        const { data: freshMe } = await _db.from('bank_accounts').select('*').eq('id', user.id).single();
        user = freshMe;
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
    const res = id ? await _db.from('bank_accounts').update(p).eq('id', id) : await _db.from('bank_accounts').insert([p]);
    if (!res.error) { alert("Opgeslagen!"); cancelEdit(); loadAllAccounts(); }
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
    await _db.from('bank_accounts').update({ balance: parseFloat(cur) + amt }).eq('id', id); 
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

function handleLogout() { 
    user = null; 
    document.getElementById('mainApp').classList.add('hidden'); 
    document.getElementById('loginScreen').classList.remove('hidden'); 
}

async function loadAllAccounts() {
    const { data } = await _db.from('bank_accounts').select('*').order('username');
    if (data) {
        const list = document.getElementById('accountsList'); 
        list.innerHTML = "";
        data.forEach(a => {
            const bal = a.is_admin ? "∞" : `€${parseFloat(a.balance).toFixed(2)}`;
            const qB = a.is_admin ? "" : `<br><button class="btn-sm" style="background:var(--green)" onclick="quickMoney('${a.id}',${a.balance},10)">+ €10</button><button class="btn-sm" style="background:var(--red)" onclick="quickMoney('${a.id}',${a.balance},-10)">- €10</button>`;
            list.innerHTML += `<div style='padding:10px; border-bottom:1px solid var(--border); background:#111827; margin-bottom:5px; border-radius:5px;'><button class="btn-sm" style="background:var(--blue); float:right;" onclick="editUser('${encodeURIComponent(JSON.stringify(a))}')">Aanpassen</button><strong>${a.account_holder}</strong> (${a.username})<br>Saldo: <span style='color:var(--green);font-weight:bold;'>${bal}</span>${qB}</div>`;
        });
    }
}
