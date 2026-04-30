let DB = { socios: [], productos: [] };
let chart;
const CONFIG = {
    owner: "Gatosauriocrack",
    repo: "Finanzas.Gatosauriocrackworl.com",
    token_key: "gh_dulce_token"
};

function log(msg, type = 'info') {
    const term = document.getElementById('terminal');
    if (!term) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const div = document.createElement('div');
    div.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-${type}">${msg}</span>`;
    term.appendChild(div);
    term.scrollTop = term.scrollHeight;
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('open');
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + id).classList.add('active');
    if (document.getElementById('sidebar').classList.contains('open')) toggleSidebar();
    if(id === 'panel') UI.updateChart();
}

async function loadData() {
    const savedToken = localStorage.getItem(CONFIG.token_key);
    if(savedToken) {
        document.getElementById('gh-token').value = savedToken;
        log("Token cargado desde almacenamiento local.");
    }
    try {
        log("Intentando cargar datos desde data.json...");
        const res = await fetch('data.json?t=' + Date.now());
        if (res.ok) {
            DB = await res.json();
            log("Base de datos cargada correctamente.", "info");
        } else {
            log("data.json no encontrado, usando respaldo local.", "action");
            DB = JSON.parse(localStorage.getItem("dulce_json") || '{"socios":[],"productos":[]}');
        }
    } catch (e) {
        log("Error de red, cargando datos locales.", "error");
        DB = JSON.parse(localStorage.getItem("dulce_json") || '{"socios":[],"productos":[]}');
    }
    UI.refresh();
}

const App = {
    save: async () => {
        localStorage.setItem("dulce_json", JSON.stringify(DB));
        UI.refresh();
        const token = document.getElementById('gh-token').value;
        
        if(!token) {
            log("Error: Token no ingresado. Sincronización abortada.", "error");
            showToast("Falta Token", "error");
            return;
        }

        log("Iniciando sincronización con GitHub API...", "action");
        localStorage.setItem(CONFIG.token_key, token);

        try {
            const res = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/dispatches`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({ 
                    event_type: 'update_db', 
                    client_payload: { json_data: JSON.stringify(DB, null, 2) }
                })
            });

            if(res.status === 204) {
                log("ÉXITO: Petición enviada a GitHub Actions correctamente.", "info");
                showToast("Sincronizado");
            } else if(res.status === 401) {
                log("ERROR 401: Token inválido o expirado.", "error");
                showToast("Token Inválido", "error");
            } else {
                log(`GitHub respondió con estado: ${res.status}`, "error");
            }
        } catch (e) { 
            log("ERROR: Fallo en la conexión con GitHub.", "error");
            showToast("Error de conexión", "error"); 
        }
    },
    vender(id) {
        const p = DB.productos.find(x => x.id === id);
        const qtyInput = document.getElementById(`qty-${id}`);
        const qty = parseInt(qtyInput.value);
        if(p.stock - p.vendidos >= qty) {
            p.vendidos += qty;
            log(`Venta: ${qty}x ${p.nombre}.`, "action");
            this.save();
            showToast("Venta registrada");
        } else {
            log(`Intento de venta sin stock: ${p.nombre}`, "error");
            showToast("Sin existencias", "error");
        }
    }
};

const Config = {
    addProduct() {
        const nInput = document.getElementById("new-p-name");
        const sInput = document.getElementById("new-p-stock");
        const pInput = document.getElementById("new-p-price");
        const n = nInput.value;
        const s = parseInt(sInput.value);
        const p = parseFloat(pInput.value);
        if(n && s && p) {
            DB.productos.push({ id: Date.now(), nombre: n, stock: s, precio: p, vendidos: 0 });
            log(`Producto añadido: ${n}`, "info");
            App.save();
            nInput.value = "";
            sInput.value = "";
            pInput.value = "";
        }
    },
    addSocio() {
        const nInput = document.getElementById("new-socio-name");
        const mInput = document.getElementById("new-socio-money");
        const n = nInput.value;
        const m = parseFloat(mInput.value);
        if(n && m) {
            DB.socios.push({ id: Date.now(), nombre: n, aporte: m });
            log(`Socio registrado: ${n} con $${m}`, "info");
            App.save();
            nInput.value = "";
            mInput.value = "";
        }
    }
};

const UI = {
    refresh() {
        const ing = DB.productos.reduce((s, p) => s + (p.vendidos * p.precio), 0);
        const inv = DB.socios.reduce((s, x) => s + x.aporte, 0);
        document.getElementById("v-ingresos").textContent = `$${ing}`;
        document.getElementById("v-inversion").textContent = `$${inv}`;
        document.getElementById("v-ganancia").textContent = `$${ing - inv}`;
        
        const table = document.getElementById("v-inventory");
        table.innerHTML = "";
        DB.productos.forEach(p => {
            const r = p.stock - p.vendidos;
            table.innerHTML += `<tr><td>${p.nombre}</td><td>$${p.precio}</td><td style="color:${r<5?'var(--accent2)':'var(--accent3)'}">${r}</td><td><input type="number" id="qty-${p.id}" style="width:45px; background:var(--surface2); color:#fff; border:none; padding:6px; border-radius:5px;" value="1"></td><td><button class="btn btn-accent" onclick="App.vender(${p.id})"><i class="fa-solid fa-cart-shopping"></i></button></td></tr>`;
        });
        this.updateChart();
    },
    updateChart() {
        const canvas = document.getElementById('mainChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if(chart) chart.destroy();
        chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: DB.productos.map(p => p.nombre),
                datasets: [{ label: 'Ventas', data: DB.productos.map(p => p.vendidos), backgroundColor: '#f7c94b', borderRadius: 6 }]
            },
            options: { 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, grid: { color: '#252a3a' } }, x: { grid: { display: false } } } 
            }
        });
    }
};

function showToast(m, t = "success") {
    const toast = document.getElementById("toast");
    toast.textContent = m;
    toast.style.borderColor = t === 'error' ? 'var(--accent2)' : 'var(--accent)';
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
}

document.addEventListener("DOMContentLoaded", loadData);
