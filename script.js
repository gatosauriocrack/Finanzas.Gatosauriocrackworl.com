let DB = { socios: [], productos: [] };
let COMPRAS_DB = { compras: [] };
let REMOTE_DB = { socios: [], productos: [] };
let PENDING_CHANGES = false;
let chart;

const CONFIG = {
    owner: "Gatosauriocrack",
    repo: "Finanzas.Gatosauriocrackworl.com",
    token_key: "gh_dulce_token",
    refresh_interval: 30000,
    files: {
        ventas: "data.json",
        compras: "compras.json"
    }
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

function updateStatusIcon(status) {
    const icon = document.getElementById('status-icon');
    const text = document.getElementById('status-text');
    const container = document.getElementById('status-container');
    if(!icon || !text || !container) return;
    if(status === 'online') {
        icon.className = 'fa-solid fa-signal';
        icon.style.color = 'var(--accent3)';
        text.textContent = 'En Línea';
        container.style.borderColor = 'var(--accent3)';
    } else {
        icon.className = 'fa-solid fa-circle-nodes';
        icon.style.color = '#666';
        text.textContent = 'Modo Local';
        container.style.borderColor = 'var(--border)';
    }
}

async function exportPDF() {
    const element = document.getElementById('page-panel');
    if(!element) return;
    if (document.getElementById('sidebar').classList.contains('open')) toggleSidebar();
    const opt = {
        margin: 10,
        filename: 'Reporte_Ventas Grupal.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#0d0f14' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    log("Generando PDF...", "action");
    showToast("Generando PDF...");
    html2pdf().set(opt).from(element).save();
}

async function exportSocioTicket(socioId) {
    const socio = DB.socios.find(s => s.id === socioId);
    if (!socio) return;
    const ticketEl = document.createElement('div');
    ticketEl.style.padding = '20px'; ticketEl.style.background = '#fff'; ticketEl.style.color = '#000';
    ticketEl.style.fontFamily = 'monospace'; ticketEl.style.width = '80mm';
    ticketEl.innerHTML = `
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
            <h2 style="margin: 0;">CONTROL DE VENTAS</h2>
            <p style="font-size: 12px; margin: 5px 0;">Comprobante de Aportación</p>
        </div>
        <div>
            <p><strong>FECHA:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>SOCIO:</strong> ${socio.nombre.toUpperCase()}</p>
        </div>
        <div style="border-bottom: 1px dashed #000; padding: 10px 0; margin: 10px 0;">
            <div style="display: flex; justify-content: space-between;">
                <span>Aporte Capital</span>
                <span>$${socio.aporte}</span>
            </div>
        </div>
        <div style="text-align: right; font-size: 18px;"><strong>TOTAL: $${socio.aporte}</strong></div>
    `;
    const opt = {
        margin: 5, filename: `Ticket_${socio.nombre}.pdf`,
        jsPDF: { unit: 'mm', format: [90, 150], orientation: 'portrait' }
    };
    html2pdf().set(opt).from(ticketEl).save();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('open');
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + id);
    if(target) target.classList.add('active');
    if (document.getElementById('sidebar').classList.contains('open')) toggleSidebar();
    if(id === 'panel') UI.updateChart();
}

async function loadData() {
    const savedToken = localStorage.getItem(CONFIG.token_key);
    if(savedToken) {
        const input = document.getElementById('gh-token');
        if(input) input.value = savedToken;
    }
    try {
        const resVentas = await fetch(`${CONFIG.files.ventas}?t=${Date.now()}`);
        const resCompras = await fetch(`${CONFIG.files.compras}?t=${Date.now()}`);
        
        if (resVentas.ok && resCompras.ok) {
            const newData = await resVentas.json();
            REMOTE_DB = JSON.parse(JSON.stringify(newData));
            COMPRAS_DB = await resCompras.json();
            
            updateStatusIcon('online');
            localStorage.setItem("cache_ventas", JSON.stringify(newData));
            localStorage.setItem("cache_compras", JSON.stringify(COMPRAS_DB));

            if (!PENDING_CHANGES) {
                DB = JSON.parse(JSON.stringify(newData));
                UI.refresh();
            }
        } else {
            throw new Error("Offline");
        }
    } catch (e) {
        updateStatusIcon('offline');
        DB = JSON.parse(localStorage.getItem("cache_ventas")) || { socios: [], productos: [] };
        COMPRAS_DB = JSON.parse(localStorage.getItem("cache_compras")) || { compras: [] };
        REMOTE_DB = JSON.parse(JSON.stringify(DB));
        UI.refresh();
    }
}

const App = {
    save: async () => {
        const token = document.getElementById('gh-token').value;
        if(!token) return showToast("Falta Token", "error");
        
        log("Sincronizando con la nube...", "action");
        localStorage.setItem(CONFIG.token_key, token);
        
        try {
            const resV = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/dispatches`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ event_type: 'update_db', client_payload: { json_data: DB } })
            });

            const resC = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/dispatches`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ event_type: 'update_compras', client_payload: { json_data: COMPRAS_DB } })
            });

            if(resV.status === 204 && resC.status === 204) {
                PENDING_CHANGES = false;
                REMOTE_DB = JSON.parse(JSON.stringify(DB));
                localStorage.setItem("cache_ventas", JSON.stringify(DB));
                localStorage.setItem("cache_compras", JSON.stringify(COMPRAS_DB));
                log("ÉXITO: Sincronización completa.", "info");
                showToast("Sincronizado");
                UI.refresh();
            }
        } catch (e) { 
            log("Error de conexión.", "error");
            showToast("Error de Red", "error"); 
        }
    },
    vender(id) {
        const p = DB.productos.find(x => x.id === id);
        const qty = parseInt(document.getElementById(`qty-${id}`).value);
        if(p && (p.stock - p.vendidos) >= qty) {
            p.vendidos += qty;
            PENDING_CHANGES = true;
            UI.refresh();
            showToast("Venta registrada");
        } else {
            showToast("Sin stock suficiente", "error");
        }
    },
    registrarCompra() {
        const desc = document.getElementById("buy-desc").value;
        const monto = parseFloat(document.getElementById("buy-amount").value);
        if(desc && monto) {
            COMPRAS_DB.compras.push({ id: Date.now(), fecha: new Date().toLocaleDateString(), desc, monto });
            PENDING_CHANGES = true;
            document.getElementById("buy-desc").value = "";
            document.getElementById("buy-amount").value = "";
            UI.refresh();
            showToast("Compra registrada");
        }
    }
};

const Config = {
    addProduct() {
        const n = document.getElementById("new-p-name"), s = document.getElementById("new-p-stock"), p = document.getElementById("new-p-price");
        if(n.value && s.value && p.value) {
            DB.productos.push({ id: Date.now(), nombre: n.value, stock: parseInt(s.value), precio: parseFloat(p.value), vendidos: 0 });
            PENDING_CHANGES = true; UI.refresh();
            n.value = ""; s.value = ""; p.value = "";
            showToast("Producto en lista");
        }
    },
    addSocio() {
        const n = document.getElementById("new-socio-name"), m = document.getElementById("new-socio-money");
        if(n.value && m.value) {
            DB.socios.push({ id: Date.now(), nombre: n.value, aporte: parseFloat(m.value) });
            PENDING_CHANGES = true; UI.refresh();
            n.value = ""; m.value = "";
            showToast("Socio en lista");
        }
    },
    editItem(type, id, field, value) {
        const item = type === 'p' ? DB.productos.find(x => x.id === id) : DB.socios.find(x => x.id === id);
        if (item) { item[field] = (field === 'nombre') ? value : parseFloat(value); PENDING_CHANGES = true; UI.refresh(); }
    },
    remove(type, id) {
        if(type === 'p') DB.productos = DB.productos.filter(x => x.id !== id);
        else DB.socios = DB.socios.filter(x => x.id !== id);
        PENDING_CHANGES = true; UI.refresh();
        showToast("Eliminado");
    }
};

const UI = {
    currentChartType: 'bar',
    setChartType(type) { this.currentChartType = type; this.updateChart(); },
    refresh() {
        const ing = REMOTE_DB.productos.reduce((s, p) => s + (p.vendidos * p.precio), 0);
        const inv = REMOTE_DB.socios.reduce((s, x) => s + x.aporte, 0);
        const gas = COMPRAS_DB.compras.reduce((s, x) => s + x.monto, 0);

        document.getElementById("v-ingresos").textContent = `$${ing}`;
        document.getElementById("v-gastos").textContent = `$${gas}`;
        document.getElementById("v-ganancia").textContent = `$${ing - inv - gas}`;
        
        const table = document.getElementById("v-inventory");
        if(table) {
            table.innerHTML = REMOTE_DB.productos.map(p => {
                const r = p.stock - p.vendidos;
                return `<tr>
                    <td>${p.nombre}</td>
                    <td>$${p.precio}</td>
                    <td style="color:${r < 5 ? 'var(--accent2)' : 'var(--accent3)'}">${r}</td>
                    <td><input type="number" id="qty-${p.id}" style="width:45px; background:var(--surface2); color:#fff; border:none; border-radius:5px;" value="1"></td>
                    <td><button class="btn btn-accent" onclick="App.vender(${p.id})"><i class="fa-solid fa-cart-shopping"></i></button></td>
                </tr>`;
            }).join('');
        }

        const adminProdList = document.getElementById("admin-productos-list");
        if(adminProdList) {
            adminProdList.innerHTML = DB.productos.map(p => `
                <div class="admin-list-item">
                    <div class="admin-item-info"><input type="text" class="admin-list-input" value="${p.nombre}" onchange="Config.editItem('p', ${p.id}, 'nombre', this.value)"></div>
                    <div class="admin-item-inputs">
                        <input type="number" class="admin-list-input" style="width:60px" value="${p.stock}" onchange="Config.editItem('p', ${p.id}, 'stock', this.value)">
                        <input type="number" class="admin-list-input" style="width:70px" value="${p.precio}" onchange="Config.editItem('p', ${p.id}, 'precio', this.value)">
                    </div>
                    <div class="admin-item-actions"><div class="btn-delete" onclick="Config.remove('p', ${p.id})"><i class="fa-solid fa-trash"></i></div></div>
                </div>`).join('');
        }

        const buyList = document.getElementById("compras-list");
        if(buyList) {
            buyList.innerHTML = COMPRAS_DB.compras.map(c => `
                <div class="admin-list-item">
                    <span>${c.fecha} - ${c.desc}</span>
                    <strong>$${c.monto}</strong>
                </div>`).join('');
        }

        const adminSocioList = document.getElementById("admin-socios-list");
        if(adminSocioList) {
            adminSocioList.innerHTML = DB.socios.map(s => `
                <div class="admin-list-item">
                    <div class="admin-item-info"><input type="text" class="admin-list-input" value="${s.nombre}" onchange="Config.editItem('s', ${s.id}, 'nombre', this.value)"></div>
                    <input type="number" class="admin-list-input" style="width:80px" value="${s.aporte}" onchange="Config.editItem('s', ${s.id}, 'aporte', this.value)">
                    <div class="admin-item-actions">
                        <div class="btn-ticket" onclick="exportSocioTicket(${s.id})"><i class="fa-solid fa-receipt"></i></div>
                        <div class="btn-delete" onclick="Config.remove('s', ${s.id})"><i class="fa-solid fa-trash"></i></div>
                    </div>
                </div>`).join('');
        }
        this.updateChart();
    },
    updateChart() {
        const canvas = document.getElementById('mainChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if(chart) chart.destroy();
        const labels = REMOTE_DB.productos.map(p => p.nombre);
        const data = REMOTE_DB.productos.map(p => p.vendidos);
        chart = new Chart(ctx, {
            type: this.currentChartType === 'bar-h' ? 'bar' : this.currentChartType,
            data: {
                labels: labels,
                datasets: [{ 
                    label: 'Ventas', data: data, 
                    backgroundColor: this.currentChartType === 'pie' ? ['#f7c94b', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeead'] : '#f7c94b',
                    borderRadius: 6 
                }]
            },
            options: { 
                indexAxis: this.currentChartType === 'bar-h' ? 'y' : 'x',
                maintainAspectRatio: false,
                plugins: { legend: { display: this.currentChartType === 'pie' } }
            }
        });
    }
};

function showToast(m, t = "success") {
    const toast = document.getElementById("toast");
    if(!toast) return;
    toast.textContent = m;
    toast.style.borderColor = (t === 'error') ? 'var(--accent2)' : 'var(--accent)';
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
}

document.addEventListener("DOMContentLoaded", () => {
    loadData();
    setInterval(loadData, CONFIG.refresh_interval);
});
