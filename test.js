let showOnlyReceived = false;
let refreshTimer = null;
let isRefreshing = false;
let showOnlyBacklog = false;
let firstLoad = true;
let showOnlyComments = false;
let dataCache = null;
let lastDataHash = "";
let isLoading = false;
let showOnlyPartial = false;
let selectedDateFilter = null;
let showOnlyDistributed = false;
function hashData(data) {
    return JSON.stringify(
        data
            .slice()
            .sort((a, b) => a.orderNo.localeCompare(b.orderNo))
            .map(o => ({
                orderNo: o.orderNo,
                status: o.status,
                wh: o.warehouses
                    .slice()
                    .sort((a, b) => a.base.localeCompare(b.base))
                    .map(w => w.base + w.packed + w.distributed)
            }))
    );
}

const loginContainer = document.getElementById("loginContainer");
const dashboard = document.getElementById("dashboard");
window.addEventListener('DOMContentLoaded', () => {
    const orderDetails = document.getElementById("orderDetails");
    if (orderDetails) {
        orderDetails.addEventListener("click", (e) => {


            if (e.target === orderDetails) {
                orderDetails.classList.add("hidden");
            }
            const warehouse = localStorage.getItem("currentWarehouse");

            let input = null;

            // 🔵 Packing → البحث
            if (warehouse === "Packing Station") {
                input = document.getElementById("newOrderSearch");
            }

            // 🟢 باقي المستخدمين → إدخال الطلب
            else {
                input = document.getElementById("newOrderNumber");
            }

            if (!input) return;

            // // focus أولي
            // setTimeout(() => {
            //     input.focus();
            // }, 300);

            // إذا خرج المؤشر يرجع
            input.addEventListener("blur", () => {
                if (!document.getElementById("editOrderModal").classList.contains("hidden")) return;

// setTimeout(() => { input.focus();}, 300);       
     });
        });
    }
    const loggedIn = localStorage.getItem("isLoggedIn");
    const role = localStorage.getItem("userRole");

    if (loggedIn === "true") {

        loginContainer.style.display = "none";
        dashboard.classList.remove("hidden");

        if (role === "manager") {
            document.getElementById("teamNotesBtn").style.display = "block";
            listenToOrders();

        } else {

            document.querySelector(".kpis").style.display = "none";
            document.querySelector(".warehouse-container").style.display = "none";
            document.querySelector(".sales-order").style.display = "none";

            showNewOrderTab();

            const aside = document.querySelector("aside");

            aside.innerHTML = `
                <a href="#" onclick="signOut()" style="
                    width:100%;
                    padding:12px;
                    background:#ef4444;
                    border:none;
                    border-radius:8px;
                    color:white;
                    font-weight:600;
                    cursor:pointer;
                ">
                    Logout
                </a>
            `;
        }
    }
});
const users = [

    { username: "manager", password: "123456", warehouse: "P&C", role: "manager" },

    { username: "pharmaUser", password: "123456", warehouse: "PHARMA", role: "user" },

    { username: "retailUser", password: "123456", warehouse: "RETAIL", role: "user" },

    { username: "pcUser", password: "123456", warehouse: "P&C", role: "user" },

    { username: "lorealLuxUser", password: "123456", warehouse: "LOREAL LUX", role: "user" },

    { username: "beeslineUser", password: "123456", warehouse: "BEESLINE", role: "user" },

    // 🔵 Packing Station User
    { username: "packingUser", password: "123456", warehouse: "Packing Station", role: "packing" }

];

//   const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSAeWlFZdvqQqrWCq0uJKqxz6boomvVuNal1IYM1tOuoeraNE_ZW2BfYYKr3lKfmldOWOgWAXhz88Ke/pub?output=csv";

let allOrders = [];
const distributionSheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTecpCEwZ10-Ncz2y0xSsAnNdLXcWDGt_GiAeJlbWYhgg9B8zlhvJ1DeDH8H0NDSg/pub?output=csv";
let distributedOrders = new Set(); // 

let distributedOrdersMap = {};


// const canceledSheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTecpCEwZ10-Ncz2y0xSsAnNdLXcWDGt_GiAeJlbWYhgg9B8zlhvJ1DeDH8H0NDSg/pub?gid=508410365&single=true&output=csv";
let canceledOrdersSet = new Set();

async function loadCanceledOrders() {

    const res = await fetch(canceledSheetURL + "&t=" + Date.now(), {
        cache: "no-store"
    });

    const csv = await res.text();
    const parsed = Papa.parse(csv, { skipEmptyLines: true });
    const rows = parsed.data;

    if (!rows.length) return;

    const headers = rows.shift().map(h => h.toLowerCase().trim());

    const ORDER_COL = headers.indexOf("order #"); //  lowercase

    if (ORDER_COL === -1) {
        console.warn("Canceled column not found", headers);
        return;
    }

    let newSet = new Set();

    rows.forEach(r => {
        const orderNo = r[ORDER_COL]?.trim().toUpperCase();
        if (orderNo) newSet.add(orderNo);
    });
    canceledOrdersSet = newSet;

    allOrders.forEach(order => {

        if (canceledOrdersSet.has(order.orderNo)) {

            order.status = "canceled";

        }

    });

    console.log("Canceled Orders Loaded:", canceledOrdersSet.size);
}


// LOGIN  
loginForm.onsubmit = e => {
    e.preventDefault();

    const u = users.find(
        x => x.username === username.value && x.password === password.value
    );

    if (!u) {
        loginError.classList.remove("hidden");
        return;
    }
    if (u.warehouse === "Packing Station") {

        autoMoveToPacking();

    }

    loginError.classList.add("hidden");

    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("currentWarehouse", u.warehouse);
    localStorage.setItem("userWarehouse", u.warehouse);
    localStorage.setItem("userRole", u.role);

    loginContainer.style.display = "none";
    dashboard.classList.remove("hidden");

    // 🔥 manager يرى كل شيء
    if (u.role === "manager") {
        document.getElementById("teamNotesBtn").style.display = "block";
        listenToOrders();

    }
    // 🔥 باقي المستخدمين New Order فقط
    else {

        // إخفاء الداشبورد
        document.querySelector(".kpis").style.display = "none";
        document.querySelector(".warehouse-container").style.display = "none";
        document.querySelector(".sales-order").style.display = "none";

        // اظهار New Order
        showNewOrderTab();

        // تعديل القائمة الجانبية
        const aside = document.querySelector("aside");

        aside.innerHTML = `
            <button onclick="signOut()" style="
                width:100%;
                padding:12px;
                background:#ef4444;
                border:none;
                border-radius:8px;
                color:white;
                font-weight:600;
                cursor:pointer;
            ">
                Logout
            </button>
        `;
    }
};


function getWarehouseBadgeColor(order, warehouse) {

    if (
        order.status === "canceled" ||
        order.status === "canceled_before_delivery"
    ) {
        return "#ef4444";
    }

if (order.status === "distributed") {
    return "#22c55e";
}

if (order.status === "ready_to_distribute") {
    return "#3b82f6"; // 🔵 أزرق
}

    if (order.status === "partial") {
        return warehouse.packed ? "#22c55e" : "#f59e0b";
    }

    if (order.status === "completed") {
        return "#16a34a";
    }

    return "#7c2d12";
}
window.QuickDate = function (type) {
    const from = document.getElementById("dateFrom");
    const to = document.getElementById("dateTo");

    if (!from || !to) return;

    const today = new Date();

    let fromDate = new Date();
    let toDate = new Date();

    if (type === "today") {
        fromDate = new Date(today);
        toDate = new Date(today);
    }

    else if (type === "yesterday") {
        fromDate = new Date(today);
        fromDate.setDate(today.getDate() - 1);
        toDate = new Date(fromDate);
    }

    else if (type === "week") {
        fromDate = new Date(today);
        fromDate.setDate(today.getDate() - 7);
        toDate = new Date(today);
    }

    else if (type === "month") {
        fromDate = new Date(today);
        fromDate.setMonth(today.getMonth() - 1);
        toDate = new Date(today);
    }

    // تحويل إلى YYYY-MM-DD
    const format = d => d.toISOString().split("T")[0];

    from.value = format(fromDate);
    to.value = format(toDate);

    // تحديث الداشبورد
    if (typeof updateDashboard === "function") {
        updateDashboard();
    }

    // إغلاق القائمة
    const menu = document.getElementById("quickDateMenu");
    if (menu) menu.classList.add("hidden");
};


// FORMAT DATE  
function formatDateForInput(value) {
    if (!value) return null;

    let v = String(value).trim();

    // إزالة الوقت إن وجد  
    // 27/01/2026 12:54:26  -->  27/01/2026  
    v = v.split(" ")[0];

    // YYYY-MM-DD  
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

    // DD/MM/YYYY  ✅ (الحالة الموجودة في الصورة)  
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) {
        const [d, m, y] = v.split("/");
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // DD-MM-YYYY  
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(v)) {
        const [d, m, y] = v.split("-");
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // YYYY/MM/DD  
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(v)) {
        const [y, m, d] = v.split("/");
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // fallback  
    const parsed = new Date(value);
    if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);

    return null;
}
let highestOrderCountSeen = 0;
let highestEffectiveDateSeen = null;

    function initDate() {
        const today = new Date().toISOString().slice(0, 10);

        dateFrom.value = today;
        dateTo.value = today;

        updateDashboard();
    }

    function applyFilters() {

        const from = dateFrom.value || null;
        const to = dateTo.value || null;

        return allOrders.filter(o => {

            const dateToCheck = getEffectiveDate(o);

            if (!dateToCheck) return false;
            if (from && dateToCheck < from) return false;
            if (to && dateToCheck > to) return false;

            return true;
        });
    }
let lastKPI = {
    total: 0,
    completed: 0,
    pending: 0,
    distributed: 0,
    ready: 0 // 🔥 جديد
};

    function getEffectiveDate(order) {

        // Distributed
        if (order.status === "distributed") {
            return distributedOrdersMap[order.orderNo]?.date;
        }

        // Completed (In-Packing)
        if (order.status === "completed") {
            const firstPackedWH = order.warehouses.find(w => w.packed);
            return firstPackedWH?.packingTime || order.date;
        }

        // Pending / Partial
        return order.date;
    }
//filteredOrders = Object.values(unique);  

function renderWarehouseBreakdown(orders) {

    const warehouseMap = {};
    const grandTotal = { t: 0, c: 0, p: 0, d: 0 };

    orders.forEach(order => {

const isDistributed = order.status === "distributed";
const isReady = order.status === "ready_to_distribute";
        const seenWH = new Set();

        order.warehouses.forEach(w => {

            if (!w.base) return;

            const base = w.base.trim().toLowerCase();

            // منع التكرار داخل نفس الطلب
            if (seenWH.has(base)) return;
            seenWH.add(base);

            // 🔥 هنا التعديل الأساسي
            grandTotal.t++; // ✔ كل warehouse يُحسب

            if (!warehouseMap[base]) {
                warehouseMap[base] = { t: 0, c: 0, p: 0, d: 0 };
            }

            warehouseMap[base].t++;

   if (isDistributed) {
    warehouseMap[base].d++;
    grandTotal.d++;
}
else if (isReady) {
    // 🔥 إذا بدك تحسبه مع delivered أو تعمل column جديد
    warehouseMap[base].d++; // أو تعمل ready column لاحقاً
    grandTotal.d++;
}
            else if (order.status === "completed") {
                warehouseMap[base].c++;
                grandTotal.c++;
            }
            else {
                warehouseMap[base].p++;
                grandTotal.p++;
            }

        });

    });

    warehouseBreakdownTable.innerHTML = `
<table>
<tr>
<th>Warehouse</th>
<th>Total</th>
<th>In-Packing</th>
<th>Pending</th>
<th>Delivered</th>
</tr>

${Object.entries(warehouseMap).map(([wh, v]) => {

        if (!wh || !v) return "";

        const safeWh = wh.replace(/'/g, "\\'");

        return `
<tr>
<td>${wh.toUpperCase()}</td>
<td><a href="#" onclick="showWarehouseOrders('${safeWh}','total')">${v.t}</a></td>
<td><a href="#" onclick="showWarehouseOrders('${safeWh}','completed')">${v.c}</a></td>
<td><a href="#" onclick="showWarehouseOrders('${safeWh}','pending')">${v.p}</a></td>
<td><a href="#" onclick="showWarehouseOrders('${safeWh}','distributed')">${v.d}</a></td>
</tr>
`;

    }).join("")}

<tr style="font-weight:bold;background:#020617;color:#22c55e">
<td>TOTAL</td>
<td>${grandTotal.t}</td>
<td>${grandTotal.c}</td>
<td>${grandTotal.p}</td>
<td>${grandTotal.d}</td>
</tr>

</table>
`;
}
// MULTI-WAREHOUSE ORDERS  
function renderMultiWHOrders(orders) {
    const m = orders.filter(x => (x.warehouses?.length || 0) > 1);
    const completedOrders = m.filter(x => x.status === "completed");
const distributedOrders = m.filter(x =>
    x.status === "distributed" ||
    x.status === "ready_to_distribute"
);
    const pendingOrders = m.filter(x => x.status === "pending" || x.status === "partial")
        .filter(o => !completedOrders.includes(o) && !distributedOrders.includes(o));

    multiWHTable.innerHTML = `  
<table>  
<tr><th>Type</th><th>Orders</th></tr>  
<tr><td>Total</td><td><a href="#" onclick="showMultiWHOrders('total')">${m.length}</a></td></tr>  
<tr><td>In-Packing</td><td><a href="#" onclick="showMultiWHOrders('completed')">${completedOrders.length}</a></td></tr>  
<tr><td>Pending / partial</td>  
<td>  
<a href="#" onclick="showMultiWHOrders('pending')">  
${pendingOrders.length}</a>  
</td></tr>  
<tr><td>Distributed</td><td><a href="#" onclick="showMultiWHOrders('distributed')">${distributedOrders.length}</a></td></tr>  
</table>`;
}

// SINGLE-WAREHOUSE ORDERS  
function renderSingleWHOrders(orders) {
    const s = orders.filter(x => x.warehouseCount === 1);
    const completedOrders = s.filter(x => x.status === "completed");
const distributedOrders = s.filter(x =>
    x.status === "distributed" ||
    x.status === "ready_to_distribute"
);    const pendingOrders = s.filter(x => x.status === "pending")
        .filter(o => !completedOrders.includes(o) && !distributedOrders.includes(o));

    singleWHTable.innerHTML = `  
<table>  
<tr><th>Type</th><th>Orders</th></tr>  
<tr><td>Total</td><td><a href="#" onclick="showSingleWHOrders('total')">${s.length}</a></td></tr>  
<tr><td>In-Packing</td><td><a href="#" onclick="showSingleWHOrders('completed')">${completedOrders.length}</a></td></tr>  
<tr>  
  <td>Pending</td>  
  <td>  
    <a href="#" onclick="showSingleWHOrders('pending')">  
      ${pendingOrders.length}  
    </a>  
  </td>  
</tr>  
<tr><td>Distributed</td><td><a href="#" onclick="showSingleWHOrders('distributed')">${distributedOrders.length}</a></td></tr>  
</table>`;
}

// SHOW ORDER DETAILS  
function showOrderDetails(type) {

    const ACCUMULATE_FROM = "2026-02-02";
    const todayOrders = applyFilters();

    let todayFiltered = todayOrders;

    if (type === "canceled") {

        const CANCELED_START_DATE = "2026-02-02";

        todayFiltered = allOrders.filter(o => {

            if (
                o.status !== "canceled" &&
                o.status !== "canceled_before_delivery"
            ) return false;

            const dateToCheck = getEffectiveDate(o);
            if (!dateToCheck) return false;

            return dateToCheck >= CANCELED_START_DATE;
        });
    }
    if (type === "completed") {
        todayFiltered = todayOrders.filter(o => o.status === "completed");
    }

    if (type === "pending") {
        todayFiltered = todayOrders.filter(o =>
            (o.status === "pending" || o.status === "partial")
            && o.status !== "canceled"
        );
    }

    if (type === "distributed") {
        todayFiltered = todayOrders.filter(o => o.status === "distributed");
    }
if (type === "ready") {
    todayFiltered = todayOrders.filter(o =>
        o.status === "ready_to_distribute"
    );
}
    if (type === "total") {
        todayFiltered = todayOrders;
    }

    let backlogOrders = [];

    if (type === "completed" || type === "pending") {

        backlogOrders = allOrders.filter(o => {

            const dateToCheck = getEffectiveDate(o);

            if (!dateToCheck) return false;
            if (dateToCheck < ACCUMULATE_FROM) return false;
            if (todayFiltered.includes(o)) return false;

            if (type === "completed") return o.status === "completed";
            if (type === "pending") return o.status === "pending" || o.status === "partial";

            return false;
        });
    }

    lastTodayOrders = todayFiltered;
    lastBacklogOrders = backlogOrders;
    lastType = type;

    displayOrdersWithBacklog(todayFiltered, backlogOrders, type);
}



let lastTodayOrders = [];
let lastBacklogOrders = [];
let lastType = null;


  function displayOrdersWithBacklog(todayOrders, backlogOrders, type) {

        const orderList = document.getElementById("orderList");

        function buildTable(orders) {

            if (!orders.length) {
                return `<p style="color:#9ca3af">No orders found.</p>`;
            }
            orders.sort((a, b) => {

                const dateA =
                    a.status === "distributed"
                        ? distributedOrdersMap[a.orderNo]?.date
                        : a.date;

                const dateB =
                    b.status === "distributed"
                        ? distributedOrdersMap[b.orderNo]?.date
                        : b.date;

                return new Date(dateB) - new Date(dateA); // ⬅️ من الأقدم للأحدث

            });
            return `
        <table>
            <tr>
                <th>Order #</th>
                <th>Warehouses</th>
                <th>Status</th>
            </tr>
            ${orders.map(order => {

                let statusText =
                    order.status === "canceled" ? "Canceled" :
                    order.status === "distributed" ? "Distributed"  : order.status === "ready_to_distribute"  ? "Ready to Distribute" :
                    order.status === "completed" ? "In-Packing" :
                     order.status === "partial" ? "Partial" : "Pending";

                return `
                <tr>
                    <td>${order.orderNo}</td>
                    <td>
                        ${order.warehouses.map(w => {

                    const badgeColor = getWarehouseBadgeColor(order, w);

                    let tooltipText = "";

                    if (order.status === "distributed" || order.status === "ready_to_distribute") {
    tooltipText = `
        Ready/Distributed at: 
        ${distributedOrdersMap[order.orderNo]?.date 
          || order.readyTime 
          || "-"}
    `;
}
                    else if (w.packed) {
                        tooltipText = `
        Received: ${w.receivedTime || "-"} 
        <br>
        Packed: ${w.packingTime || "-"}
    `;
                    }
                    else {
                        tooltipText = `Received in Warehouse: ${w.receivedTime || "-"}`;
                    }

                    return `
        <div class="tooltip-wrapper">
            <span style="
                display:inline-block;
                margin:2px;
                padding:4px 8px;
                border-radius:6px;
                font-size:12px;
                font-weight:600;
                background:${badgeColor};
                color:black;
                cursor:pointer;
            ">
                ${w.base.toUpperCase()}
            </span>
            <div class="tooltip-box">
                ${tooltipText}
            </div>
        </div>
    `;
                }).join("")}
                    </td>
                    <td>${statusText}</td>
                </tr>
                `;
            }).join("")}
        </table>
    `;
        }

        let html = `
    <div style="display:flex;gap:10px;margin-bottom:15px">
        <button onclick="toggleBacklogView(false)" class="toggle-btn">
            All
        </button>
        <button onclick="toggleBacklogView(true)" class="toggle-btn">
            Show Only Backlog
        </button>
    </div>
`;

        if (!showOnlyBacklog) {
            html += `
        <h3 style="color:#22c55e;margin-bottom:10px">
            Today Orders (${todayOrders.length})
        </h3>
        ${buildTable(todayOrders)}
    `;
        }

        if (backlogOrders.length) {

            // 🔥 تجميع الطلبات حسب التاريخ الفعلي
            const grouped = {};

            backlogOrders.forEach(order => {

                const dateKey = getEffectiveDate(order) || "No Date";

                if (!grouped[dateKey]) {
                    grouped[dateKey] = [];
                }

                grouped[dateKey].push(order);
            });

            // ترتيب التواريخ من الأحدث للأقدم
            const sortedDates = Object.keys(grouped)
                .sort((a, b) => new Date(b) - new Date(a));

            html += `
        <h3 style="color:#f59e0b;margin:30px 0 10px 0">
            Backlog Orders (${backlogOrders.length})
        </h3>
    `;

            sortedDates.forEach(date => {

                html += `
            <h4 style="
                margin:20px 0 8px 0;
                color:#eab308;
                font-weight:600;
                border-bottom:1px solid #1f2937;
                padding-bottom:4px;
            ">
                📅 ${date}
            </h4>
        `;

                html += buildTable(grouped[date]);
            });
        }

        orderList.innerHTML = html;

        document.getElementById("orderDetails").classList.remove("hidden");
    }
    function toggleBacklogView(value) {
        showOnlyBacklog = value;
        updateLastOrderDetailsView();
    }
    function updateLastOrderDetailsView() {
        displayOrdersWithBacklog(lastTodayOrders, lastBacklogOrders, lastType);
    }
    // SHOW WAREHOUSE ORDERS  
    function showWarehouseOrders(warehouse, type) {
        let o = applyFilters();

        if (warehouse !== 'all') {
            o = o.filter(order =>
                order.warehouses.some(w => w.base === warehouse)
            );
        }

        if (type === "completed") o = o.filter(x => x.status === "completed");
        if (type === "pending") o = o.filter(x => x.status === "pending" || x.status === "partial");
if (type === "distributed") {
    o = o.filter(x =>
        x.status === "distributed" ||
        x.status === "ready_to_distribute"
    );
}
        if (type === "total") o = o; // all filtered orders  

        displayOrders(o, warehouse === 'all' ? 'All Warehouses' : `Warehouse: ${warehouse}`);
    }


// SHOW MULTI/SINGLE-WAREHOUSE ORDERS  
function showMultiWHOrders(type) {
    let o = applyFilters().filter(x => x.warehouseCount > 1);
    if (type === "completed") o = o.filter(x => x.status === "completed");
    if (type === "pending") {
        o = o.filter(x =>
            x.status === "pending" || x.status === "partial"
        );
    } if (type === "distributed") o = o.filter(x => x.status === "distributed");
    displayOrders(o, "Multi-Warehouse Orders");
}

function showSingleWHOrders(type) {
    let o = applyFilters().filter(x => x.warehouseCount === 1);
    if (type === "completed") o = o.filter(x => x.status === "completed");
    if (type === "pending") o = o.filter(x => x.status === "pending");
    if (type === "distributed") o = o.filter(x => x.status === "distributed");
    displayOrders(o, "Single-Warehouse Orders");
}

function displayOrders(orders, title = "Order Details") {
    lastTodayOrders = orders;
    lastBacklogOrders = [];
    lastType = title || "table";

    orders.sort((a, b) => {

        function getFullDate(order) {

            // لو الطلب Distributed
            if (order.status === "distributed" || order.status === "ready_to_distribute") {
                return new Date(distributedOrdersMap[order.orderNo]?.date);
            }

            // أخذ أول وقت استلام من أول warehouse
            const firstWH = order.warehouses[0];

            if (firstWH?.receivedTime) {
                return new Date(firstWH.receivedTime);
            }

            return new Date(order.date); // fallback
        }

        return getFullDate(b) - getFullDate(a); // ⬅️ الأحدث أولاً حسب الوقت
    });
    const orderList = document.getElementById("orderList");
    lastDisplayedOrders = orders; // مهم للتصدير  

    let html = `  
    <table>  
      <thead>  
        <tr>  
          <th>Order #</th>  
          <th>Warehouses</th>  
          <th>Status</th>  
        </tr>  
      </thead>  
      <tbody>  
    `;

    const seen = new Set();

    orders.forEach(order => {
        const key = order.orderNo.toUpperCase();
        if (seen.has(key)) return;
        seen.add(key);

        // تحديد حالة الطلب  
        let statusText = "";

        if (order.status === "canceled") {
            statusText = "Canceled";
        }
        else if (order.status === "canceled_before_delivery") {
            statusText = "Canceled Before Delivery";
        }
else if (order.status === "distributed" || order.status === "ready_to_distribute") {
    statusText = "Distributed";
}
        else if (order.status === "completed") {
            statusText = "In-Packing";
        }
        else if (order.status === "partial") {
            statusText = "Partial";
        }
        else {
            statusText = "Pending";
        }
        html += `  
        <tr>  
          <td>${order.orderNo}</td>  
          <td>  
${order.warehouses.map(w => {

    let color, text;

    if (order.status === "distributed" || order.status === "ready_to_distribute") {
        color = "#22c55e";
        text = "Distributed";
    }
    else if (w.packed) {
        color = "#22c55e";
        text = "In-Packing";
    } 
    else {
        color = "#7c2d12";
        text = "Pending";
    }

    let tooltipText = "";

    if (order.status === "distributed") {
        tooltipText = `Distributed at: ${distributedOrdersMap[order.orderNo]?.date || "-"}`;
    }
    else if (w.packed) {
        tooltipText = `Received at Packing Station: ${w.receivedTime || "-"}`;
    }
    else {
        tooltipText = `Received in Warehouse: ${w.receivedTime || "-"}`;
    }

    return `
    <div class="tooltip-wrapper">  
        <span style="
            display:inline-block;  
            margin:2px;  
            padding:4px 8px;  
            border-radius:6px;  
            font-size:12px;  
            font-weight:600;  
            background:${color};  
            color:black;  
            cursor:pointer;  
        ">  
            ${(w.base || "UNKNOWN").toUpperCase()}  
        </span>  
        <div class="tooltip-box">  
            ${tooltipText}  
        </div>  
    </div>`;
}).join("")}
<td style="font-weight:600; color:#9ca3af">

${statusText}

${localStorage.getItem("currentWarehouse") === "Packing Station"
                && order.status === "pending"

                ? `
<button id="rec" onclick="receiveInPacking('${order.orderNo}')"
style="
margin-left:8px;
background:#22c55e;
border:none;
padding:4px 8px;
border-radius:6px;
cursor:pointer;
font-size:11px;
font-weight:600;
">
Received
</button>
`
                : ""
            }

</td> 
        </tr>  
        `;
    });

    html += `  
      </tbody>  
    </table>  
    `;

    orderList.innerHTML = `  
      <h3 style="color:var(--accent); margin-bottom:12px"></h3>  
      ${html}  
    `;

    // إظهار نافذة التفاصيل  
    document.getElementById("orderDetails").classList.remove("hidden");
}

const toggleToDateBtn = document.getElementById("toggleToDate");
const dateToInput = document.getElementById("dateTo");


// CLOSE MODAL  
function closeOrderDetails() { orderDetails.classList.add("hidden"); }

// EXPORT TO EXCEL  
function exportOrderDetailsToExcel() {
    
    const currentWarehouse = localStorage.getItem("currentWarehouse");

    let exportOrders = [];


    // 🔥 نفس الفلترة المستخدمة في renderRecentOrders
let sourceOrders = [];

// 🔥 إذا في Order Details مفتوحة → استخدمها
const isDetailsOpen = !document.getElementById("orderDetails").classList.contains("hidden");

if (isDetailsOpen && (lastTodayOrders.length || lastBacklogOrders.length)) {
    sourceOrders = [...lastTodayOrders, ...lastBacklogOrders];
} else {
    // ✅ رجوع لـ recent + الفلاتر
sourceOrders = getBaseFilteredOrders();
}
exportOrders = sourceOrders.filter(order => {
        if (currentWarehouse === "Packing Station" && order.status === "distributed") {
            return false;
        }

        if (showOnlyPending && order.status !== "pending" && order.status !== "partial") return false;

        if (showOnlyComments && !(order.comment && order.comment.trim() !== "")) return false;

        if (showOnlyReceived) {
            const hasReceived = order.warehouses?.every(w => w.packed === true);
            if (!hasReceived) return false;
        }

        return true;
    });

    if (!exportOrders.length) {
        alert("No orders to export!");
        return;
    }

    // إزالة التكرار
    const uniqueMap = {};
    exportOrders.forEach(o => {
        uniqueMap[o.orderNo] = o;
    });

    const unique = Object.values(uniqueMap);

    const headers = ["Order #", "Status", "Warehouses", "Date"];

    const rows = unique.map(o => {

        const whs = o.warehouses
            .map(w => w.base.toUpperCase())
            .join(" | ");

        return [
            o.orderNo,
            o.status,
            whs,
            o.date
        ];
    });

    const csvContent =
        "\uFEFF" +
        [
            headers.join(","),
            ...rows.map(r =>
                r.map(v =>
                    `"${String(v).replace(/"/g, '""')}"`
                ).join(",")
            )
        ].join("\r\n");

    const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);

    const today = new Date().toISOString().slice(0, 10);

    const link = document.createElement("a");
    link.href = url;

    // 🔥 اسم الملف حسب الفلتر
    let fileType = "all";
if (lastType) fileType = lastType;
    if (showOnlyPending) fileType = "pending";
    else if (showOnlyReceived) fileType = "received";
    else if (showOnlyComments) fileType = "comments";

    link.download = `orders_${fileType}_${today}.csv`;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}


function normalizeWarehouse(name) {
    if (!name) return { base: "", packed: false };

    const raw = name.toLowerCase();

    const packed = /pack/.test(raw);

    const base = raw
        .replace(/pack/gi, "")
        .replace(/wh/gi, "")
        .replace(/['’\s]/g, "")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
    return { base, packed };
}
function signOut() {
    clearInterval(refreshTimer);
    refreshTimer = null;

    localStorage.removeItem("isLoggedIn");

    localStorage.removeItem("currentWarehouse");

    location.reload();
    dashboard.classList.add("hidden");
    loginContainer.style.display = "flex";

}
document.addEventListener("mouseover", function (e) {

    const row = e.target.closest(".order-row");
    if (!row) return;

    const tooltip = document.getElementById("tooltip");

    const status = row.dataset.status;
    const receivedWH = row.dataset.wh;
    const receivedPack = row.dataset.pack;

    let text = "";

    if (status === "pending" || status === "partial") {
        text = "Received at WH: " + receivedWH;
    }

    if (status === "completed") {
        text = "Received at Packing Station: " + receivedPack;
    }

    if (!text) return;

    tooltip.textContent = text;
    tooltip.classList.remove("hidden");
});

document.addEventListener("mousemove", function (e) {
    const tooltip = document.getElementById("tooltip");
    tooltip.style.top = (e.pageY + 15) + "px";
    tooltip.style.left = (e.pageX + 15) + "px";
});

document.addEventListener("mouseout", function (e) {
    if (e.target.closest(".order-row")) {
        document.getElementById("tooltip").classList.add("hidden");
    }
});
let recentOrders = [];
function showNewOrderTab() {
document.getElementById("dashboardHeader").style.display="none"
    const currentWarehouse = localStorage.getItem("currentWarehouse");

    if (currentWarehouse === "Packing Station") {        
        const searchInput = document.getElementById("newOrderSearch");
        document.getElementById("hashtag").style.display = "none";
        document.getElementById("newOrderNumber").style.display = "none";
    }
    document.querySelectorAll(".main > div").forEach(div => {
        if (div.id !== "newOrderTab") div.classList.add("hidden");
    });
    document.getElementById("newOrderTab").classList.remove("hidden");

    listenToOrders(); // 🔥 تحديث الطلبات دائماً

    const warehouseInput = document.getElementById("newWarehouseName");
    const userWarehouse = localStorage.getItem("currentWarehouse");

    if (userWarehouse) {

        warehouseInput.value = userWarehouse;

        if (userWarehouse === "manager") {
            warehouseInput.readOnly = false;
        } else {
            warehouseInput.readOnly = true;
        }

    }

    setTodayForNewOrder();
}
window.toggleMenu = function (e) {
    e.stopPropagation();

    const menu = document.getElementById("quickDateMenu");
    if (!menu) return;

    menu.classList.toggle("hidden");
};

document.addEventListener("click", function (e) {
    const menu = document.getElementById("quickDateMenu");
    if (!menu) return;

    if (!menu.contains(e.target) && !e.target.closest(".three-dots")) {
        menu.classList.add("hidden");
    }
});
function setTodayForNewOrder() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById("newOrderDate").value = today;
}
// =============================
// SIMPLE ENCRYPTION
// =============================
function simpleEncrypt(text) {
    return btoa(text); // Base64 encode
}

function simpleDecrypt(text) {
    return atob(text);
}
function saveNewOrder() {

    const orderNo = document
        .getElementById("newOrderNumber")
        .value.trim()
        .toUpperCase();

    const warehouseInput = document
        .getElementById("newWarehouseName")
        .value.trim()
        .toUpperCase();

    const date = document
        .getElementById("newOrderDate").value;

    if (!orderNo || !warehouseInput || !date) {
        // showToast("⚠️ Please fill all fields");
        return;
    }

    const ordersRef = ref(db, "orders");

    runTransaction(ordersRef, (orders) => {

        if (!orders) orders = {};

        let existingKey = null;

        Object.entries(orders).forEach(([key, order]) => {
            if (order.orderNo === orderNo) {
                existingKey = key;
            }
        });

        if (existingKey) {

            const order = orders[existingKey];

            const exists = order.warehouses?.some(
                w => w.base.toUpperCase() === warehouseInput
            );

            if (exists) return orders;

            order.warehouses.push({
                base: warehouseInput,
                packed: false,
                receivedTime: new Date().toISOString()
            });

            orders[existingKey] = order;

        }

        else {

            const newKey = push(ref(db, "orders")).key;

            orders[newKey] = {
                orderNo: orderNo,
                date: date,
                createdAt: new Date().toISOString(),
                history: [
                    {
                        action: "created",
                        date: new Date().toISOString(),
                        by: localStorage.getItem("currentWarehouse")
                    }
                ],

                warehouses: [
                    {
                        base: warehouseInput,
                        packed: false,
                        receivedTime: new Date().toISOString()
                    }
                ],
                status: "pending"
            };

        }

        return orders;

    }).then(() => {
        // showToast("✅ Order saved");
        clearNewOrderForm();
    });

}
let visibleCount = 300;
// 🔥 
function buildRecentOrders() {

    if (!allOrders || !allOrders.length) {
        recentOrders = [];
        return;
    }

    // ترتيب حسب وقت الإنشاء
    const sorted = allOrders
        .slice()
        .sort((a, b) => {

 const aDate = new Date(a.createdAt || a.date).getTime();
const bDate = new Date(b.createdAt || b.date).getTime();
            return bDate - aDate; // الأحدث أولاً
        });

    recentOrders = sorted; // كل الطلبات
}
let showOnlyPending = false;
function togglePendingFilter() {

    showOnlyPending = !showOnlyPending;

    const btn = document.getElementById("pendingToggleBtn");

    const count = getPendingCount(); // ✅ العدد

    if (showOnlyPending) {
        btn.style.background = "#f59e0b";
        btn.textContent = `Showing Pending (${count})`;
    } else {
        btn.style.background = "#020617";
        btn.textContent = `Show Pending Only (${count})`;
    }

    renderRecentOrders();
}
function togglePartialFilter() {

    showOnlyPartial = !showOnlyPartial;

    const btn = document.getElementById("partialToggleBtn");

    const count = getPartialCount();

    if (showOnlyPartial) {
        btn.style.background = "#f97316";
        btn.textContent = `Showing Partial (${count})`;
    } else {
        btn.style.background = "#020617";
        btn.textContent = `Show Partial Only (${count})`;
    }

    renderRecentOrders();
}
function getPartialCount() {
    const base = getBaseFilteredOrders();
    return base.filter(o => o.status === "partial").length;
}
function toggleReceivedFilter() {

    showOnlyReceived = !showOnlyReceived;

    const btn = document.getElementById("receivedToggleBtn");

    const count = getReceivedCount();

    if (showOnlyReceived) {
        btn.style.background = "#22c55e";
        btn.textContent = `Showing Received (${count})`;
    } else {
        btn.style.background = "#020617";
        btn.textContent = `Show Received (${count})`;
    }

    renderRecentOrders();
}
function getBaseFilteredOrders() {

    const currentWarehouse = localStorage.getItem("currentWarehouse");

    const DEFAULT_START = "2026-02-01"; // 🔥 هنا

    return recentOrders.filter(order => {

        const orderDate = getOrderDate(order);

        // 🔥 فلترة من تاريخ معين
        if (orderDate < DEFAULT_START) return false;
if (selectedDateFilter) {
    const orderDate = getOrderDate(order);

    const keepOld =
        order.status === "pending" ||
        order.status === "partial" ||
        order.status === "completed"; // in-packing

    if (orderDate !== selectedDateFilter && !keepOld) {
        return false;
    }
}
        if (currentWarehouse === "Packing Station" && order.status === "distributed") {
            return false;
        }

        return true;
    });
}
function getReceivedCount() {
    const base = getBaseFilteredOrders();

    return base.filter(order =>
        order.status !== "distributed" &&
        order.status !== "ready_to_distribute" && // 🔥 مهم
        order.warehouses?.every(w => w.packed === true)
    ).length;
}
function getPendingCount() {
    const base = getBaseFilteredOrders();
    return base.filter(o => o.status === "pending").length;
}
function renderRecentOrders() {

    const role = localStorage.getItem("userRole");
    const container = document.getElementById("newOrdersList");
    if (!container) return;
    if (role !== "packing" && role !== "manager") {
        const btn = document.getElementById("commentsToggleBtn");
        document.getElementById('receivedToggleBtn').style.display="none";
        document.getElementById('partialToggleBtn').style.display="none"
        if (btn) btn.style.display = "none";
    }
    if (role !== "packing" && role !== "manager") {
        const pendingBtn = document.getElementById("pendingToggleBtn");
        
        if (pendingBtn) pendingBtn.style.display = "none";
        if (pendingBtn) {
            const count = getPendingCount();

            if (showOnlyPending) {
                pendingBtn.textContent = `Showing Pending (${count})`;
            } else {
                pendingBtn.textContent = `Show Pending Only (${count})`;
            }
        }

    }

    container.innerHTML = "";

const currentWarehouse = localStorage.getItem("currentWarehouse");
const sortedOrders = [...recentOrders].sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
});

let filteredOrders = getBaseFilteredOrders();
filteredOrders = filteredOrders.filter(order => {

if (selectedDateFilter) {
    const orderDate = getOrderDate(order);

    const keepOld =
        order.status === "pending" ||
        order.status === "partial" ||
        order.status === "completed"; // In-Packing

    if (orderDate !== selectedDateFilter && !keepOld) {
        return false;
    }
}
    if (role == "packing" && order.status === "distributed") {
        return false;
    }   if (role == "manager" && order.status === "distributed") {
        return false;
    }

    if (showOnlyPending && order.status !== "pending" && order.status !== "partial") return false;

    if (showOnlyPartial && order.status !== "partial") return false;

    if (showOnlyComments && !(order.comment && order.comment.trim() !== "")) return false;

    if (showOnlyReceived) {
        const hasReceived = order.warehouses?.every(w => w.packed === true);
        if (!hasReceived) return false;
    }
    if (showOnlyDistributed &&
    order.status !== "distributed" &&
    order.status !== "ready_to_distribute") return false;

    return true;
});
    // 🔥 عرض فقط عدد محدد
    const visibleOrders = filteredOrders.slice(0, visibleCount);

    visibleOrders.forEach(order => {
        const card = document.createElement("div");

        card.style.cssText = `
    background:#020617;
    border:1px solid #1f2937;
    padding:14px;
    border-radius:14px;
    transition:.2s;
    height: fit-content;
`;


const statusColor =
    order.status === "distributed" ? "#22c55e" :
    order.status === "ready_to_distribute" ? "#3b82f6" : // 🔥 أزرق واضح
    order.status === "completed" ? "#22c55e" :
    order.status === "partial" ? "#f59e0b" :
    order.status === "canceled" ? "#ef4444" :
    "#f59e0b";

        card.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;">

            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:center">
                
                <div style="display:flex;flex-direction:column">
                    <span style="font-weight:700;font-size:15px;letter-spacing:.5px">
                        ${order.orderNo}
                    </span>
                    <span style="font-size:11px;opacity:.5">
                        ${order.createdAt ? new Date(order.createdAt).toLocaleString() : order.date}
                    </span>
                </div>

             <div style="display:flex;align-items:center;gap:6px">

    ${role === "manager" ? `
    <button onclick="showOrderHistory('${order.orderNo}')"
    style="
        background:#0ea5e9;
        border:none;
        padding:5px 10px;
        border-radius:6px;
        cursor:pointer;
        font-size:11px;
        font-weight:600;
        color:white;
    ">
        Info
    </button>
    ` : ""}

    <button onclick="openEditOrder('${order.orderNo}')"
    style="
        background:linear-gradient(135deg,#3b82f6,#2563eb);
        border:none;
        padding:5px 10px;
        border-radius:6px;
        cursor:pointer;
        font-size:11px;
        font-weight:600;
        color:white;
        box-shadow:0 0 8px #3b82f666;
    ">
        Edit
    </button>

<div style="display:flex;align-items:center;gap:6px">

    <span style="
        background:${statusColor};
        padding:5px 12px;
        border-radius:20px;
        font-size:11px;
        font-weight:700;
        color:black;
        box-shadow:0 0 10px ${statusColor}55;
    ">
        ${order.status}
    </span>

    ${order.status === "canceled" ? `
        <button onclick="reopenOrder('${order.orderNo}')"
        style="
            background:#22c55e;
            border:none;
            padding:5px 10px;
            border-radius:6px;
            cursor:pointer;
            font-size:11px;
            font-weight:700;
            color:black;
        ">
            Reopen
        </button>
    ` : ""}

</div>

</div>
            </div>

            <!-- Warehouses -->
            <div style="
                display:flex;
                flex-wrap:wrap;
                gap:6px;
            ">

                ${order.warehouses.map(w => {

            const role = localStorage.getItem("userRole");

const isPacking = 
    (currentWarehouse === "Packing Station" || role === "manager") 
    && !w.packed;

            return `
                    <div style="
                        background:#0f172a;
                        border:1px solid #1f2937;
                        padding:6px 8px;
                        border-radius:8px;
                        display:flex;
                        align-items:center;
                        gap:6px;
                    ">

                        <span style="font-size:11px;font-weight:600">
                            📍 ${w.base.toUpperCase()}
                        </span>

                        ${w.packed
                    ? `<span style="color:#22c55e;font-size:11px">✔</span>`
                    : isPacking
                        ? `
                                <button onclick="markWarehousePacking('${order.orderNo}', \`${w.base}\`)"
                                style="
                                background:linear-gradient(135deg,#22c55e,#16a34a);
                                border:none;
                                padding:4px 8px;
                                border-radius:6px;
                                font-size:10px;
                                font-weight:700;
                                cursor:pointer;
                                color:white;
                                box-shadow:0 0 8px #22c55e66;
                                ">
                                Receive
                                </button>
                                `
                        : `<span style="color:#f59e0b;font-size:11px">Pending</span>`
                }

                    </div>
                    `;

        }).join("")}

            </div>

            <!-- Comment -->
            ${order.comment ? `
            <div style="
                font-size:12px;
                color:#38bdf8;
                background:#020617;
                padding:6px 8px;
                border-radius:8px;
                border:1px dashed #1f2937;
            ">
                💬 ${order.comment}
            </div>
            ` : ""}

        </div>
        `;

        // ✨ Hover Effect
        card.onmouseenter = () => {
            card.style.transform = "scale(1.01)";
            card.style.boxShadow = "0 0 20px #0ea5e933";
        };

        card.onmouseleave = () => {
            card.style.transform = "scale(1)";
            card.style.boxShadow = "none";
        };

        container.appendChild(card);
    });
    // زر عرض المزيد
    if (filteredOrders.length > visibleCount) {

        const loadMoreBtn = document.createElement("button");

        loadMoreBtn.textContent = "Show More →";
        loadMoreBtn.style.cssText = `
        width:100%;
        padding:10px;
        margin-top:10px;
        background:#0ea5e9;
        border:none;
        border-radius:8px;
        color:white;
        cursor:pointer;
        font-weight:600;
    `;

        loadMoreBtn.onclick = () => {
            visibleCount += 10;
            renderRecentOrders();
        };

        container.appendChild(loadMoreBtn);
    }
    document.getElementById("newOrderPreview").classList.remove("hidden");


const exportBtn = document.getElementById("exportBtn");

if (exportBtn) {
    if (showOnlyPending) {
        exportBtn.textContent = "Export Pending";
    } 
    else if (showOnlyReceived) {
        exportBtn.textContent = "Export Received";
    }
    else if (showOnlyComments) {
        exportBtn.textContent = "Export Comments";
    }
       else if (showOnlyPartial) {
        exportBtn.textContent = "Export partial";
    }
    
    else {
        exportBtn.textContent = "Export All";
    }
}

const receivedBtn = document.getElementById("receivedToggleBtn");
if (receivedBtn) {
    const count = getReceivedCount();

    if (showOnlyReceived) {
        receivedBtn.textContent = `Showing Received (${count})`;
        receivedBtn.style.background = "#22c55e";
    } else {
        receivedBtn.textContent = `Show Received (${count})`;
        receivedBtn.style.background = "#020617";
    }
}
updateFilterButtonsCounts();
updateFilterButtonsCounts();
}

const newOrderInput = document.getElementById("newOrderNumber");

newOrderInput.addEventListener("input", function () {

    const value = this.value.trim();
    const pattern = /^#m\d{5}$/i;

    const currentWarehouse = localStorage.getItem("currentWarehouse");

    // 🔵 إذا المستخدم Packing Station
    if (currentWarehouse === "Packing Station") {

        // يعمل مثل search فقط
        updateSearch();

        // يبقي المؤشر داخل input
        // setTimeout(() => {
        //     this.focus();
        // }, 0);

        return;
    }

    // باقي المستخدمين يحفظ الطلب
    if (pattern.test(value)) {

        if (this.dataset.saved === value) return;

        this.dataset.saved = value;

        saveNewOrder();

        this.value = "";

    }

});
function showOrderHistory(orderNo) {
    const role = localStorage.getItem("userRole");
    if (role !== "manager") {
        // showToast("⛔ Access denied");

        return;
    }

    const order = allOrders.find(o => o.orderNo === orderNo);
    if (!order) return;

    const history = order.history || [];
    let html = "";

    if (!history.length) {
        html = `<p>No history found</p>`;
    } else {
        // لمنع تكرار المستودعات
        const seenWarehouses = new Set();

        // ترتيب التاريخ من الأحدث للأقدم
        history.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(h => {
            let actionText = "";

            if (h.action === "created") {
                actionText = `🟢 Created`;
            } else if (h.action === "edited") {

                let commentChange = "";

                if (h.oldComment !== h.newComment) {
                    commentChange = `
            <div style="margin-top:6px;font-size:12px;color:#fbbf24">
                💬 Comment:
                <br>
                <span style="color:#ef4444">Old:</span> ${h.oldComment || "-"}
                <br>
                <span style="color:#22c55e">New:</span> ${h.newComment || "-"}
            </div>
        `;
                }

                actionText = `
        ✏️ Edited (${h.oldOrderNo} → ${h.newOrderNo})
        ${commentChange}
    `;
            }
            else if (h.action === "packed") {
                actionText = `📦 Packed in ${h.warehouse}`;
            }

            // عرض معلومات المستودعات مرة واحدة فقط
            if (order.warehouses && order.warehouses.length) {
                html += `<div style="margin-bottom:10px; display:flex; flex-direction:column; gap:6px;">`;
                order.warehouses.forEach(w => {
                    const key = w.base.trim().toLowerCase();
                    if (seenWarehouses.has(key)) return;
                    seenWarehouses.add(key);

                    html += `
                    <div style="
                        background:#020617;
                        padding:10px;
                        border-radius:8px;
                        border:1px solid #1f2937;
                        font-size:12px;
                        color:white;
                    ">
                        <div style="font-weight:600">📍 ${w.base.toUpperCase()}</div>
                        <div style="opacity:0.7; font-size:11px; margin-top:3px;">
                            🕒 Entered: ${w.receivedTime ? new Date(w.receivedTime).toLocaleString() : "-"}
                        </div>
                    </div>
                    `;
                });
                html += `</div>`;
            }

            // عرض سجل الحدث
            html += `
            <div style="
                background:#0f172a;
                padding:10px;
                border-radius:8px;
                margin-bottom:8px;
                border:1px solid #1f2937;
                font-size:13px;
                color:white;
            ">
                <div style="font-weight:600">${actionText}</div>
                <div style="opacity:0.6; font-size:11px; margin-top:2px;">${new Date(h.date).toLocaleString()}</div>
                <div style="color:#38bdf8; font-size:11px; margin-top:2px;">By: ${h.by || "-"}</div>
            </div>
            `;
        });
    }

    document.getElementById("historyContent").innerHTML = html;
    document.getElementById("historyModal").classList.remove("hidden");
}
function closeHistoryModal() {
    document.getElementById("historyModal").classList.add("hidden");
}
document.getElementById("historyModal").addEventListener("click", function (e) {
    if (e.target.id === "historyModal") {
        closeHistoryModal();
    }
});
function openEditOrder(orderNo) {
    const role = localStorage.getItem("userRole");
    const order = allOrders.find(o => o.orderNo === orderNo);
    if (!order) return;
    if (order.status === "canceled_before_delivery") {
        // showToast("⛔ Cannot edit canceled order");
        return;
    }

    document.getElementById("editOrderNumber").value = order.orderNo;
    document.getElementById("editOrderComment").value = order.comment || "";

    document.getElementById("editOrderModal").classList.remove("hidden");
const orderInput = document.getElementById("editOrderNumber");

    if (role === "manager") {
        orderInput.readOnly = false;
    } else {
        orderInput.readOnly = true;
    }
    window.editingOrderNo = orderNo;
    setTimeout(() => {
        document.getElementById("editOrderNumber").focus();
    }, 100);
}
function closeEditModal() {
    document.getElementById("editOrderModal").classList.add("hidden");
}
function saveEditedOrder() {

    const newOrderNo = document.getElementById("editOrderNumber").value.trim();
    const comment = document.getElementById("editOrderComment").value.trim();

    const ordersRef = ref(db, "orders");

    get(ordersRef).then(snapshot => {

        snapshot.forEach(child => {

            const data = child.val();

            if (data.orderNo === window.editingOrderNo) {

                update(ref(db, "orders/" + child.key), {
                    orderNo: newOrderNo,
                    comment: comment,
                    history: [
                        ...(data.history || []),
                        {
                            action: "edited",
                            date: new Date().toISOString(),
                            by: localStorage.getItem("currentWarehouse"),
                            oldOrderNo: data.orderNo,
                            newOrderNo: newOrderNo,
                            oldComment: data.comment || "",   // ✅ القديم
                            newComment: comment              // ✅ الجديد
                        }
                    ]
                });

            }

        });

    });

    closeEditModal();

    // showToast("Order updated");

}
function closeEditIfOutside(e) {

    if (e.target.id === "editOrderModal") {
        closeEditModal();
    }

}
function cancelOrder() {

    if (!confirm("Cancel this order ?")) return;

    const ordersRef = ref(db, "orders");

    get(ordersRef).then(snapshot => {

        snapshot.forEach(child => {

            const data = child.val();

            if (data.orderNo === window.editingOrderNo) {

                update(ref(db, "orders/" + child.key), {

                    status: "canceled",

                    history: [
                        ...(data.history || []),
                        {
                            action: "canceled",
                            date: new Date().toISOString(),
                            by: localStorage.getItem("currentWarehouse")
                        }
                    ]

                });

            }

        });

    });

    closeEditModal();
}
function markInPacking(orderNo) {

    const ordersRef = ref(db, "orders");

    onValue(ordersRef, (snapshot) => {

        const data = snapshot.val();

        Object.entries(data).forEach(([key, order]) => {

            if (order.orderNo === orderNo) {

                update(ref(db, "orders/" + key), {
                    status: "in-packing",
                    packingTime: new Date().toISOString()
                });

            }

        });

    }, { onlyOnce: true });

}
document.getElementById("newOrderSearch")
    .addEventListener("input", function () {

        const query = this.value.toLowerCase().trim();
        const cards = document.querySelectorAll("#newOrdersList > div");

        cards.forEach(card => {

            const text = card.innerText.toLowerCase();

            if (text.includes(query)) {
                card.style.display = "flex";
            } else {
                card.style.display = "none";
            }

        });
    });
function resolveOrderStatus(order) {
    if ((order.comment || "").toLowerCase().includes("canceled")
        && !distributedOrdersMap[order.orderNo]) {
        return "canceled_before_delivery";
    }
    // 1️⃣ Canceled
  if (canceledOrdersSet.has(order.orderNo)) {
        return "canceled";
    }

    if (order.status === "canceled") {
        return "canceled";
    }

    if (order.status === "canceled_before_delivery") {
        return "canceled_before_delivery";
    }
// 1️⃣ Distributed أولاً
if (order.status === "distributed" || distributedOrdersMap[order.orderNo]) {
    return "distributed";
}

// 2️⃣ Ready بعدها
if (order.status === "ready_to_distribute" || order.readyToDistribute === true) {
    return "ready_to_distribute";
}

    const warehouseCount = order.warehouses.length;

    const packedCount = order.warehouses.filter(w => w.packed).length;

    // 3️⃣ Pending
    if (packedCount === 0) {
        return "pending";
    }

    // 4️⃣ Partial
    if (packedCount < warehouseCount) {
        return "partial";
    }

    // 5️⃣ In-Packing (كل المستودعات انتهت)
    return "completed";
}
// مثال: تحديث كل الطلبات قبل عرضها
allOrders.forEach(order => {
    order.status = resolveOrderStatus(order);
});
//const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz7O-KhP-qVecKdapMORuIlpQWaPzRFWAk4GRImEQAGAWM4Kk72RdLjgTNue95dEUp3JA/exec";
function showOrderPreview(order) {

    const previewContainer = document.getElementById("newOrderPreview");
    const list = document.getElementById("newOrdersList");

    const orderCard = document.createElement("div");

    orderCard.style.cssText = `
        background:#0f172a;
        border:1px solid #1f2937;
        padding:16px;
        border-radius:14px;
        margin-bottom:12px;
        animation:fadeIn .3s ease;
    `;
    const statusText = order.status === "in-packing" ? "In-Packing" : "Pending";
    const statusColor = order.status === "in-packing" ? "#22c55e" : "#f59e0b";
    orderCard.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">

            <div>
                <div style="font-size:15px;font-weight:600">
                    ${order.orderNo}
                </div>

                <div style="font-size:12px;opacity:.7;margin-top:4px">
                    📅 ${order.date} &nbsp; ⏰ ${order.time || ""}
                </div>

                <div class="saved-comment" style="
                    margin-top:6px;
                    font-size:12px;
                    color:#22c55e;
                    font-weight:600;
                ">
                    ${order.comment ? "📝 " + order.comment : ""}
                </div>

                <div style="
                    font-size:12px;
                    margin-top:6px;
                    display:inline-block;
                    background:#1e293b;
                    padding:4px 10px;
                    border-radius:8px;
                    font-weight:600;
                    color:#38bdf8;
                ">
                </div>
            </div>

            <span style="
    background:${statusColor};
    padding:6px 14px;
    border-radius:20px;
    font-size:11px;
    font-weight:600;
">
    ${statusText}
</span>
        </div>

        <div style="margin-top:12px">
            <textarea 
                placeholder="Write comment..."
                style="
                    width:100%;
                    background:#020617;
                    border:1px solid #1f2937;
                    border-radius:10px;
                    padding:8px;
                    color:white;
                    font-size:13px;
                    resize:vertical;
                    min-height:50px;
                    outline:none;
                "
            ></textarea>

            <button style="
                margin-top:8px;
                background:#22c55e;
                border:none;
                padding:6px 14px;
                border-radius:8px;
                font-size:12px;
                font-weight:600;
                cursor:pointer;
            ">
                Save
            </button>
        </div>
    `;

    const textarea = orderCard.querySelector("textarea");
    const saveBtn = orderCard.querySelector("button");
    const savedCommentDiv = orderCard.querySelector(".saved-comment");

    // تحميل التعليق السابق داخل التكست
    textarea.value = order.comment || "";

    saveBtn.addEventListener("click", function () {

        const value = textarea.value.trim();

        order.comment = value;

        savedCommentDiv.textContent = value ? "📝 " + value : "";

        saveCommentsToStorage();

        textarea.value = "";

        // showToast("💾 Comment saved");
    });

    list.prepend(orderCard);
    previewContainer.classList.remove("hidden");

    const maxItems = 10;
    if (list.children.length > maxItems) {
        list.removeChild(list.lastChild);
    }
}



function clearNewOrderForm() {

    document.getElementById("newOrderNumber").value = "";

    // لا تمسح المستودع إذا كان من المستخدم المسجل
    const warehouseInput = document.getElementById("newWarehouseName");
    const userWarehouse = localStorage.getItem("currentWarehouse");

    if (userWarehouse) {
        warehouseInput.value = userWarehouse;
        warehouseInput.readOnly = true;
    } else {
        warehouseInput.value = "";
    }

    // أعد ضبط التاريخ لليوم
    setTodayForNewOrder();
}
function mergeOrdersByNumber(orders) {

    const map = {};

    orders.forEach(order => {

        const orderNo = (order.orderNo || "").trim().toUpperCase();

        if (!map[orderNo]) {
            map[orderNo] = {
                ...order,
                warehouses: []
            };
        }

        (order.warehouses || []).forEach(w => {

            const base = (w.base || "").trim().toUpperCase();

            // نتحقق فقط من التكرار الحقيقي
            const exists = map[orderNo].warehouses.some(x =>
                (x.base || "").trim().toUpperCase() === base
            );

            if (!exists) {
                map[orderNo].warehouses.push(w);
            }

        });

    });

    return Object.values(map);

}
function updateFilterButtonsCounts() {

    const pendingBtn = document.getElementById("pendingToggleBtn");
    const partialBtn = document.getElementById("partialToggleBtn");
    const receivedBtn = document.getElementById("receivedToggleBtn");

    if (!recentOrders) return;

    const pendingCount = getPendingCount();
    const partialCount = getPartialCount();
    const receivedCount = getReceivedCount();

    // ================= Pending =================
    if (pendingBtn) {
        if (showOnlyPending) {
            pendingBtn.textContent = `Showing Pending (${pendingCount})`;
            pendingBtn.style.background = "#f59e0b";
        } else {
            pendingBtn.textContent = `Show Pending Only (${pendingCount})`;
            pendingBtn.style.background = "#020617";
        }
    }

    // ================= Partial =================
    if (partialBtn) {
        if (showOnlyPartial) {
            partialBtn.textContent = `Showing Partial (${partialCount})`;
            partialBtn.style.background = "#f97316";
        } else {
            partialBtn.textContent = `Show Partial Only (${partialCount})`;
            partialBtn.style.background = "#020617";
        }
    }

    // ================= Received =================
    if (receivedBtn) {
        if (showOnlyReceived) {
            receivedBtn.textContent = `Showing Received (${receivedCount})`;
            receivedBtn.style.background = "#22c55e";
        } else {
            receivedBtn.textContent = `Show Received (${receivedCount})`;
            receivedBtn.style.background = "#020617";
        }
    }
}

function listenToOrders() {

    const ordersRef = ref(db, "orders");

    onValue(ordersRef, (snapshot) => {

        const data = snapshot.val();

        if (!data) {
            allOrders = [];
            recentOrders = [];
            renderRecentOrders();
    updateFilterButtonsCounts();
            updateDashboard();
            renderReadyOrders();
            return;

        }
        let allOrdersMap = {};
        // تحويل Firebase object الى array
        allOrdersMap = data;
        const firebaseOrders = Object.values(data);
        const currentWarehouse = localStorage.getItem("currentWarehouse");
        const role = localStorage.getItem("userRole");

        // 🔥 دمج الطلبات التي لها نفس الرقم
        let mergedOrders = mergeOrdersByNumber(firebaseOrders);

        // 🔥 المدير يرى كل الطلبات
        if (role === "manager" || currentWarehouse === "Packing Station") {

            // يرى كل الطلبات
            allOrders = mergedOrders;
            

        } else {

            const normalizedUserWH = currentWarehouse.trim().toUpperCase();

            allOrders = mergedOrders.filter(order =>
                order.warehouses?.some(w =>
                    w.base?.trim().toUpperCase() === normalizedUserWH
                )
            );

        }
mergedOrders.sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
});
        // 🔥 تحديث الحالة وعدد المستودعات
        allOrders.forEach(order => {
            order.status = resolveOrderStatus(order);
            order.warehouseCount = order.warehouses ? order.warehouses.length : 0;
        });

        // 🔥 بناء recent orders
        buildRecentOrders();
        loadDistributedOrders();

        renderRecentOrders();

        updateDashboard();


    });

}
function getOrderWarehouse(orderNo) {
    const order = allOrders.find(o => o.orderNo.toUpperCase() === orderNo.toUpperCase());
    if (!order) return null;

    // إذا الطلب من أكثر من مستودع، نرجع أول مستودع غير PACKING
    const originalWH = order.warehouses.find(w => w.base.toUpperCase() !== "PACKING STATION");
    return originalWH ? originalWH.base : "";
}

function showDashboardHome() {
    document.getElementById("dashboardHeader").style.display = "flex";
    document.getElementById("newOrderTab").classList.add("hidden");
    document.getElementById("teamNotesTab").classList.add("hidden");
        document.getElementById("dsh").style.display="block";
    document.getElementById("readyTab").classList.add("hidden");
    document.querySelector(".kpis").classList.remove("hidden");
    document.querySelector(".warehouse-container").classList.remove("hidden");
    document.querySelector(".sales-order").classList.remove("hidden");
}
function renderOrders() {

    const container = document.getElementById("ordersTableBody");
    container.innerHTML = "";

    if (orders.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:20px;color:#888">
                    No Orders Yet
                </td>
            </tr>
        `;
        return;
    }

    orders
        .sort((a, b) => b.id - a.id)
        .forEach(order => {

            const statusColor =
                order.status === "Pending" ? "#f39c12" :
                    order.status === "Approved" ? "#2ecc71" :
                        order.status === "Rejected" ? "#e74c3c" :
                            "#3498db";

            const row = `
                <tr style="transition:.2s">
                    <td>#${order.id}</td>
                    <td>${order.warehouse}</td>
                    <td>${order.item}</td>
                    <td>${order.qty}</td>
                    <td>
                        <span style="
                            background:${statusColor};
                            color:white;
                            padding:4px 10px;
                            border-radius:20px;
                            font-size:12px;
                            font-weight:600">
                            ${order.status}
                        </span>
                    </td>
                    <td>${new Date(order.date).toLocaleString()}</td>
                </tr>
            `;

            container.innerHTML += row;
        });
}
const currentWarehouse = localStorage.getItem("currentWarehouse");
function autoMoveToPacking() {

    const currentWarehouse = localStorage.getItem("currentWarehouse");

    if (currentWarehouse !== "Packing Station") return;

    const ordersRef = ref(db, "orders");

    onValue(ordersRef, (snapshot) => {

        const data = snapshot.val();
        if (!data) return;

        Object.entries(data).forEach(([key, order]) => {

            if (order.status === "pending" && !canceledOrdersSet.has(order.orderNo)) {
                update(ref(db, "orders/" + key), {
                    status: "in-packing",
                    packingTime: new Date().toISOString()
                });

            }

        });

    }, { onlyOnce: true });

}
function getOrderDate(order) {

    // 🔥 إذا الطلب في packing → استخدم وقت الدخول للباكينغ
    if (order.status === "in-packing" && order.packingTime) {
        const d = new Date(order.packingTime);
        return d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");
    }

    // 🔥 إذا مكتمل → ممكن تستخدم packingReceivedTime
    if (order.status === "completed" && order.packingReceivedTime) {
        const d = new Date(order.packingReceivedTime);
        return d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");
    }

    // 🔥 الافتراضي
    const d = new Date(order.createdAt || order.date);
    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
}


window.DateFilter = function () {
    selectedDateFilter = document.getElementById("ordersDateFilter").value || null;

    visibleCount = 1000;
    renderRecentOrders();
};

// فتح / إغلاق القائمة
window.toggleQuickMenu = function (event) {
    event.stopPropagation();

    const menu = document.getElementById("quickDate");
    if (!menu) return;

    menu.style.display = (menu.style.display === "block") ? "none" : "block";
};

    function QuickMenu(e) {
        e.stopPropagation();
        document.getElementById("quickMenu").classList.toggle("hidden");
    }

    // إغلاق القائمة عند الضغط خارجها  
    document.addEventListener("click", () => {
        document.getElementById("quickMenu").classList.add("hidden");
    });

// اختيار تاريخ سريع
window.setQuickDate = function (type) {
    const input = document.getElementById("ordersDateFilter");
    if (!input) return;

    const today = new Date();
    let targetDate = new Date();

    if (type === "today") {
        targetDate = today;
    }

    else if (type === "yesterday") {
        targetDate.setDate(today.getDate() - 1);
    }

    else if (type === "week") {
        targetDate.setDate(today.getDate() - 7);
    }

    else if (type === "month") {
        targetDate.setMonth(today.getMonth() - 1);
    }

    // تحويل للتنسيق الصحيح YYYY-MM-DD
    const formatted = targetDate.toISOString().split("T")[0];
    input.value = formatted;

    // تشغيل الفلتر إذا موجود
    if (typeof DateFilter === "function") {
        DateFilter();
    }

    // إغلاق القائمة
    const menu = document.getElementById("quickDate");
    if (menu) menu.style.display = "none";
};


// Reset الفلتر
window.clearDateFilter = function () {
    const input = document.getElementById("ordersDateFilter");
    if (input) input.value = "";

    if (typeof DateFilter === "function") {
        DateFilter();
    }

    const menu = document.getElementById("quickDate");
    if (menu) menu.style.display = "none";
};


// إغلاق عند الضغط خارجها
document.addEventListener("click", function () {
    const menu = document.getElementById("quickDateMenu");
    if (menu) menu.style.display = "none";
});
document.addEventListener("click", () => {
    const menu = document.getElementById("quickDateMenu");
    if (menu) menu.style.display = "none";
});
function clearDateFilter() {
    document.getElementById("dateFrom").value = "";
    document.getElementById("dateTo").value = "";
    DateFilter();
}
function markWarehousePacking(orderNo, warehouseName) {
    const order = allOrders.find(o => o.orderNo === orderNo);

    if (!order ||
        order.status === "canceled" ||
        order.status === "canceled_before_delivery") {
        return;
    }
    openConfirmModal(
        `Receive order <b>${orderNo}</b> in <b>${warehouseName}</b>?`,
        () => {

            const ordersRef = ref(db, "orders");

            onValue(ordersRef, (snapshot) => {

                const data = snapshot.val();

                Object.entries(data).forEach(([key, order]) => {

                    if (order.orderNo === orderNo) {

                        const updatedWarehouses = order.warehouses.map(w => {

                            if (normalizeWarehouse(w.base).base === normalizeWarehouse(warehouseName).base) {
                                return {
                                    ...w,
                                    packed: true,
                                    packingTime: new Date().toISOString()
                                };
                            }

                            return w;
                        });

                        update(ref(db, "orders/" + key), {
                            warehouses: updatedWarehouses,
                            history: [
                                ...(order.history || []),
                                {
                                    action: "packed",
                                    warehouse: warehouseName,
                                    date: new Date().toISOString(),
                                    by: "Packing Station"
                                }
                            ]
                        });

                    }

                });

            }, { onlyOnce: true });

        });
}
function openConfirmModal(message, onConfirm) {

    const modal = document.getElementById("confirmModal");
    const text = document.getElementById("confirmText");
    const okBtn = document.getElementById("confirmOk");
    const cancelBtn = document.getElementById("confirmCancel");

    const btnText = document.getElementById("btnText");
    const loader = document.getElementById("btnLoader");
    const icon = document.getElementById("confirmIcon");
    const sound = document.getElementById("successSound");

    text.innerHTML = message;
    modal.classList.remove("hidden");

    function reset() {
        modal.classList.add("hidden");
        loader.classList.add("hidden");
        btnText.style.display = "inline";
        okBtn.classList.remove("loading");
        icon.innerHTML = "📦";
        icon.classList.remove("success");
    }

    cancelBtn.onclick = reset;

    modal.onclick = (e) => {
        if (e.target === modal) reset();
    };

    okBtn.onclick = async () => {

        // start loading
        loader.classList.remove("hidden");
        btnText.style.display = "none";
        okBtn.classList.add("loading");

        // simulate or wait actual action
        await onConfirm();

        // success state
        loader.classList.add("hidden");
        icon.innerHTML = "✔";
        icon.classList.add("success");

        // sound.play().catch(() => { });

        setTimeout(() => {
            reset();
        }, 1000);
    };

}
function showPackingSelection(order) {

    const modal = document.getElementById("orderDetails");

    const html = `
<h3>Select Warehouse for Packing</h3>

<div style="display:flex;gap:10px;flex-wrap:wrap">

${order.warehouses.map(w => {
        return `
<button onclick="markWarehousePacking(${JSON.stringify(order.orderNo)}, ${JSON.stringify(w.base)})"
style="
padding:10px 16px;
background:#22c55e;
border:none;
border-radius:8px;
cursor:pointer;
font-weight:600;
">
${w.base.toUpperCase()}
</button>
`;
    }).join("")}

</div>
`;

    document.getElementById("orderList").innerHTML = html;

    modal.classList.remove("hidden");
}
function openPackingOrder(order) {

    if (order.warehouses.length === 1) {

        markWarehousePacking(order.orderNo, order.warehouses[0].base);

    }

    else {

        showPackingSelection(order);

    }

}

function log(msg) {
    const el = document.getElementById("debug") || (() => {
        const d = document.createElement("div");
        d.id = "debug";
        d.style.position = "fixed";
        d.style.bottom = "0";
        d.style.width = "100%";
        d.style.height = "150px";
        d.style.background = "#000";
        d.style.color = "#0f0";
        d.style.overflow = "auto";
        d.style.fontSize = "12px";
        d.style.padding = "5px";
        document.body.appendChild(d);
        return d;
    })();
    el.innerHTML += msg + "<br>";
}
let receivingOrders = new Set();

function receiveInPacking(orderNo) {
    const order = allOrders.find(o => o.orderNo === orderNo);

    if (!order ||
        order.status === "canceled" ||
        order.status === "canceled_before_delivery") {

        const btn = document.getElementById("rec");
        if (btn) btn.style.display = "none"; // ✅ الصحيح

        return; // 🔥 مهم جداً
    }
    if (receivingOrders.has(orderNo)) return;

    receivingOrders.add(orderNo);

    const orderEntry = Object.entries(allOrdersMap)
        .find(([key, order]) => order.orderNo === orderNo);

    if (!orderEntry) {
        receivingOrders.delete(orderNo);
        return;
    }

    const [key] = orderEntry;

    update(ref(db, "orders/" + key), {
        status: "completed",
        packingReceivedTime: new Date().toISOString()
    })
        .finally(() => {
            receivingOrders.delete(orderNo);
        });

}
function toggleCommentsFilter() {

    showOnlyComments = !showOnlyComments;

    const btn = document.getElementById("commentsToggleBtn");

    if (showOnlyComments) {
        btn.style.background = "#22c55e";
        btn.textContent = "Showing Comments Only";
    } else {
        btn.style.background = "#020617";
        btn.textContent = "Show Comments Only";
    }

    renderRecentOrders(); // 🔥 إعادة رسم
}
function updateFooterStats() {
    if (!allOrders) return;

    let total = allOrders.length;

    let pending = allOrders.filter(o => o.status === "pending").length;

  let distributed = allOrders.filter(o => 
    o.status === "distributed"
).length;
    document.getElementById("footerTotalOrders").textContent = total;
    document.getElementById("footerPendingOrders").textContent = pending;
    document.getElementById("footerDistributedOrders").textContent = distributed;
}

let teamNotes = JSON.parse(localStorage.getItem("teamNotes") || "{}");

function openTeamNotesTab() {

    document.querySelectorAll(".main > div")
        .forEach(div => div.classList.add("hidden"));

    document.getElementById("teamNotesTab")
        .classList.remove("hidden");

    renderTeamNotes();
}



function saveTeamNote() {

    const employee = document.getElementById("employeeName").value.trim();
    const note = document.getElementById("teamNoteInput").value.trim();

    if (!employee || !note) {
        // showToast?.("Please fill all fields");
        return;
    }

    if (!teamNotes[employee]) {
        teamNotes[employee] = [];
    }

    teamNotes[employee].push({
        text: note,
        progress: 0, // ✅ أضف هذا السطر
        date: new Date().toISOString(),
        by: localStorage.getItem("currentWarehouse") || "unknown"
    });

    localStorage.setItem("teamNotes", JSON.stringify(teamNotes));

    document.getElementById("teamNoteInput").value = "";

    renderTeamNotes();
}
function renderTeamNotes() {

    const container = document.getElementById("teamNotesList");
    const employee = document.getElementById("employeeName").value.trim();

    if (!employee) {
        container.innerHTML = "<p style='opacity:.5'>Enter employee name to view notes</p>";
        return;
    }

    const notes = teamNotes[employee] || [];

    if (!notes.length) {
        container.innerHTML = "<p style='opacity:.5'>No notes for this employee</p>";
        return;
    }

    container.innerHTML = notes
        .slice()
        .reverse()
        .map((n, index) => `
        <div style="
            background:#0f172a;
            border:1px solid #1f2937;
            padding:12px;
            border-radius:10px;
            margin-bottom:10px;
        ">
            <div style="font-size:11px;opacity:.6">
                ${new Date(n.date).toLocaleString()} — ${n.by}
            </div>

            <div style="margin-top:6px;margin-bottom:10px">
                ${n.text}
            </div>

            <!-- 🔥 Progress Bar -->
            <div style="
                background:#020617;
                border-radius:10px;
                height:8px;
                overflow:hidden;
                margin-bottom:6px;
            ">
                <div id="progressBar-${index}" style="
    width:${n.progress || 0}%;
    background:linear-gradient(90deg,#22c55e,#4ade80);
    height:100%;
    transition:.2s;
"></div>
            </div>

            <!-- 🔥 Percentage + Input -->
            <div style="display:flex;align-items:center;gap:8px">

                <span style="font-size:12px;font-weight:600;color:#22c55e">
                    ${n.progress || 0}%
                </span>

                <input type="range" min="0" max="100"
    value="${n.progress || 0}"
    oninput="updateNoteProgress('${employee}', ${index}, this.value)"
    style="width:100%;cursor:pointer
                        background:#020617;
                        border:1px solid #1f2937;
                        border-radius:6px;
                        padding:4px;
                        color:white;
                        font-size:11px;
                    "
                />
            </div>

        </div>
    `).join("");
}
function updateNoteProgress(employee, index, value) {

    value = Math.max(0, Math.min(100, Number(value)));

    if (!teamNotes[employee]) return;

    teamNotes[employee][index].progress = value;

    localStorage.setItem("teamNotes", JSON.stringify(teamNotes));

    // ✅ تحديث الرقم
    const text = document.getElementById(`progressText-${index}`);
    if (text) {
        text.textContent = value + "%";
    }

    // ✅ تحديث البار
    const bar = document.getElementById(`progressBar-${index}`);
    if (bar) {
        bar.style.width = value + "%";
    }
}

let lastDistributionHash = "";
let distributionCache = {};
function hashDistribution(dataMap) {
    return JSON.stringify(
        Object.keys(dataMap)
            .sort()
            .map(key => ({
                orderNo: key,
                date: dataMap[key].date,
                company: dataMap[key].company
            }))
    );
}
function updateDashboard() {
    for (const order of allOrders) {
        order.status = resolveOrderStatus(order);
    }
    const todayOrders = applyFilters();
    const ACCUMULATE_FROM = "2026-02-02";

    const accumulatedOrders = allOrders.filter(o => {
        const dateToCheck = getEffectiveDate(o);
        if (!dateToCheck) return false;
        return dateToCheck >= ACCUMULATE_FROM;


        order.status = resolveOrderStatus(order); // الحالة الأصلية

    });


    // ================= TODAY =================
    const CANCELED_START_DATE = "2026-02-02";

    const canceledToday = allOrders.filter(o => {

        if (
            o.status !== "canceled" &&
            o.status !== "canceled_before_delivery"
        ) return false;

        const dateToCheck = getEffectiveDate(o);
        if (!dateToCheck) return false;

        return dateToCheck >= CANCELED_START_DATE;
    });
const distributedToday = todayOrders.filter(o =>
    o.status === "distributed"
);

const readyToday = todayOrders.filter(o =>
    o.status === "ready_to_distribute"
);
    const completedToday = todayOrders.filter(o => o.status === "completed");
    const pendingToday = todayOrders.filter(o =>
        (o.status === "pending" || o.status === "partial")
        && o.status !== "canceled"
    );

    // ================= BACKLOG =================

    const completedBacklog = accumulatedOrders.filter(o =>
        o.status === "completed"
    );

    const pendingBacklog = accumulatedOrders.filter(o =>
        o.status === "pending" || o.status === "partial"
    );
const distributedBacklog = accumulatedOrders.filter(o =>
    o.status === "distributed"
);

const readyBacklog = accumulatedOrders.filter(o =>
    o.status === "ready_to_distribute"
);
    // ================= DISPLAY =================

    updateKPINumber("total", todayOrders.length);
    updateKPINumber("distributed", distributedToday.length);
    updateKPINumber("ready", readyToday.length);
    updateKPINumber("canceled", canceledToday.length);

    updateKPIWithBacklog("completed", completedToday.length, completedBacklog.length);
    updateKPIWithBacklog("pending", pendingToday.length, pendingBacklog.length);

    renderWarehouseBreakdown(todayOrders);
    renderMultiWHOrders(todayOrders);
    renderSingleWHOrders(todayOrders);
}
function updateKPIWithBacklog(id, todayValue, backlogValue) {

    const container = document.getElementById(id);
    const main = container.querySelector(".main-number");
    const sub = container.querySelector(".sub-number");

    main.textContent = todayValue;

    if (backlogValue > todayValue) {
        const backlogOnly = backlogValue - todayValue;
        sub.textContent = `(+${backlogOnly} backlog)`;
    } else {
        sub.textContent = "";
    }
}

function updateKPINumber(id, newValue) {
    if (lastKPI[id] === newValue) return;

    lastKPI[id] = newValue;
    document.getElementById(id).textContent = newValue;
    const element = document.getElementById(id);
    const currentValue = lastKPI[id];

    // إذا زاد → فقط أضف الفرق
    if (newValue > currentValue) {
        const diff = newValue - currentValue;
        lastKPI[id] += diff;
        element.textContent = lastKPI[id];
        return;
    }

    // إذا نقص (تغيير فلتر مثلاً) → حدّث مباشرة

    element.textContent = newValue;
}
    function showDistributedOrders() {
        const from = dateFrom.value || null;
        const to = dateTo.value || null;

        const orders = allOrders.filter(o => {
            const distDate = distributedOrdersMap[o.orderNo];
            if (!distDate) return false;

            if (from && distDate < from) return false;
            if (to && distDate > to) return false;

            return true;
        });

        displayOrders(orders, "Distributed Orders");
    }
function loadDistributedOrders() {

    return fetch(distributionSheetURL + "&t=" + Date.now(), {
        cache: "no-store"
    })
        .then(r => r.text())
        .then(csv => {

            const parsed = Papa.parse(csv, { skipEmptyLines: true });
            const rows = parsed.data;
            if (!rows.length) return;

            const headers = rows
                .shift()
                .map(h => h.toString().trim().toLowerCase());

            const ORDER_COL = headers.indexOf("request number");
            const DATE_COL = headers.indexOf("request registration date time");
            const COMPANY_COL = headers.findIndex(h => h.includes("company"));

            if (ORDER_COL === -1 || DATE_COL === -1) {
                console.warn("❌ Distribution columns not found");
                return;
            }

            let newMap = {};

            rows.forEach(r => {

                const orderNo = r[ORDER_COL]?.trim().toUpperCase();
                const rawDate = r[DATE_COL];
                const company = COMPANY_COL !== -1 ? r[COMPANY_COL]?.trim() : "";

                if (!orderNo || !rawDate) return;

                const formattedDate = formatDateForInput(rawDate);
                if (!formattedDate) return;

                newMap[orderNo] = {
                    date: formattedDate,
                    company: company || "LMD"
                };
            });

            const newHash = hashDistribution(newMap);

            // 🔥 BLOCK إذا رجعت نسخة قديمة
            if (lastDistributionHash && newHash === lastDistributionHash) {
                return; // لا يوجد تغيير
            }

            // 🔥 لو النسخة أقدم (عدد أقل) تجاهلها
            if (
                Object.keys(newMap).length <
                Object.keys(distributionCache).length
            ) {
                console.warn("⚠️ Older distribution snapshot blocked");
                return;
            }

            // ✅ اعتماد النسخة الجديدة
            distributionCache = newMap;
            distributedOrdersMap = newMap;
            lastDistributionHash = newHash;
            updateDashboard();
            console.log("✅ Distribution updated safely");
        })
        .catch(err => {
            console.error("Distribution load error:", err);
        });
}
function resetFilters() {

    // 🔹 إلغاء Today Mode  
    todayOnlyMode = false;

    const todayBtn = document.getElementById("todayToggleBtn");
    if (todayBtn) {
        todayBtn.style.background = "#020617";
        todayBtn.style.color = "white";
        todayBtn.textContent = "Today Only";
    }

    // 🔹 إعادة التاريخ للقيمة الافتراضية  
    const defaultStart = "2026-02-01";  // 01-Feb-2026  
    const today = new Date().toISOString().slice(0, 10);

    dateFrom.value = defaultStart;
    dateTo.value = today;

    // 🔹 إعادة ترتيب الطلبات  
    orderSortMode = "newest";

    // 🔹 تحديث الداشبورد  
    updateDashboard();
    updateFooterStats();
}

function FiltersReset() {

    // 🔹 إلغاء Today Mode  
    todayOnlyMode = false;

    const todayBtn = document.getElementById("todayToggleBtn");
    if (todayBtn) {
        todayBtn.style.background = "#020617";
        todayBtn.style.color = "white";
        todayBtn.textContent = "Today Only";
    }

    // 🔹 إعادة التاريخ للقيمة الافتراضية  
    const defaultStart = "2026-02-01";  // 01-Feb-2026  
    const today = new Date().toISOString().slice(0, 10);

    dateFrom.value = defaultStart;
    dateTo.value = today;

    // 🔹 إعادة ترتيب الطلبات  
    orderSortMode = "newest";

    // 🔹 تحديث الداشبورد  
    updateDashboard();
    updateFooterStats();
}
let lastDisplayedOrders = [];

function updateSearch() {
    const query = document.getElementById("orderSearch").value.trim().toLowerCase();
    const resultsDiv = document.getElementById("searchResultsCard");
    const tableDiv = document.getElementById("searchResultsTable");

    if (!query) {
        resultsDiv.style.display = "none";
        return;
    }

    const filtered = allOrders.filter(o =>
        o.orderNo.toLowerCase().includes(query)
    );

    if (!filtered.length) {
        tableDiv.innerHTML =
            "<p style='color:var(--warning)'>No matching orders found.</p>";
        resultsDiv.style.display = "block";
        return;
    }

    tableDiv.innerHTML = `  
    <table>  
        <tr>  
            <th>Order #</th>  
            <th>Warehouses</th>  
            <th>Status</th>  
        </tr>  
        ${filtered.map(order => {

        /* ---------------- STATUS ---------------- */

        let statusText = "";

        if ( order.status === "distributed"){
            statusText = `<span style="color:#22c55e;font-weight:600;">Distributed</span>`;
        }
        else if(order.status ==="ready_to_distribute"){
              statusText = `<span style="color:#3b82f6;font-weight:600;">ready to Distributed</span>`;

        }
        else if (order.status === "canceled") {
            statusText = `<span style="color:#f59e0b;font-weight:600;">canceled</span>`;
        }
        else if (order.status === "completed") {
            statusText = `<span style="color:#22c55e;font-weight:600;">In-Packing</span>`;
        }
        else if (order.status === "partial") {
            statusText = `<span style="color:#f59e0b;font-weight:600;">Partial</span>`;
        }
        else {
            statusText = `<span style="color:#f59e0b;font-weight:600;">Pending</span>`;
        }

        /* ---------------- WAREHOUSES ---------------- */

        const warehousesHTML = `  
                <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center">  
                    ${order.warehouses.map(w => {

            const color = getWarehouseBadgeColor(order, w);

            let tooltipText = "";

            if (order.status === "distributed") {
                tooltipText = `Distributed at: ${distributedOrdersMap[order.orderNo]?.date || "-"}`;
            }
            else if (w.packed) {
                tooltipText = `Received at Packing: ${w.packingTime || w.receivedTime || "-"}`;
            }
            else {
                tooltipText = `Received in Warehouse: ${w.receivedTime || "-"}`;
            }

            return `  
                        <div style="position:relative;display:inline-block;">  
                            <span style="  
                                display:inline-block;  
                                padding:5px 10px;  
                                border-radius:8px;  
                                font-size:12px;  
                                font-weight:600;  
                                background:${color};  
                                color:black;  
                                cursor:pointer;  
                            ">  
                                ${w.base.toUpperCase()}  
                            </span>  
  
                            <div style="  
                                position:absolute;  
                                bottom:130%;  
                                left:50%;  
                                transform:translateX(-50%);  
                                background:#0f172a;  
                                color:white;  
                                padding:8px 10px;  
                                border-radius:8px;  
                                font-size:12px;  
                                white-space:nowrap;  
                                opacity:0;  
                                pointer-events:none;  
                                transition:.2s ease;  
                                box-shadow:0 8px 25px rgba(0,0,0,.4);  
                                z-index:9999;  
                            " class="wh-tooltip">  
                                ${tooltipText}  
                            </div>  
                        </div>  
                        `;
        }).join("")}  
                </div>  
            `;

        /* ---------------- DISTRIBUTED BOX ---------------- */

        const distributedBox =
            order.status === "distributed" && distributedOrdersMap[order.orderNo]
                ? `  
                <div style="  
                    margin-top:8px;  
                    padding:8px 10px;  
                    border-radius:10px;  
                    background:#022c22;  
                    border:1px solid #065f46;  
                    font-size:12px;  
                    display:inline-block;  
                ">  
                    <div style="color:#22c55e;font-weight:600;">  
                        <i class="fa-solid fa-truck"></i>  
                        Distributed by ${distributedOrdersMap[order.orderNo].company}  
                    </div>  
                    <div style="opacity:.7;margin-top:2px;">  
                        ${distributedOrdersMap[order.orderNo].date}  
                    </div>  
                </div>  
                `
                : "";

        /* ---------------- ROW ---------------- */

        return `  
                <tr>  
                    <td>  
                        <div style="font-weight:600;">  
                            ${order.orderNo}  
                        </div>  
                        ${distributedBox}  
                    </td>  
  
                    <td>${warehousesHTML}</td>  
  
                    <td>${statusText}</td>  
                </tr>  
            `;
    }).join("")}  
    </table>  
    `;

    /* -------- Tooltip Hover Fix -------- */

    setTimeout(() => {
        document.querySelectorAll("td div > span").forEach(badge => {
            badge.addEventListener("mouseenter", function () {
                const tooltip = this.parentElement.querySelector(".wh-tooltip");
                if (tooltip) tooltip.style.opacity = "1";
            });
            badge.addEventListener("mouseleave", function () {
                const tooltip = this.parentElement.querySelector(".wh-tooltip");
                if (tooltip) tooltip.style.opacity = "0";
            });
        });
    }, 0);

    resultsDiv.style.display = "block";
}


function initReadyToDistribute() {

    const input = document.getElementById("readyOrderInput");

    input.addEventListener("input", function () {

        const value = this.value.trim().toUpperCase();

        // مثال pattern
        if (!/^#M\d{5}$/.test(value)) return;

        // moveToReady(value);

        // this.value = "";
    });
}
function moveToReady(orderNo) {

    const ordersRef = ref(db, "orders");

    get(ordersRef).then(snapshot => {

        snapshot.forEach(child => {

            const order = child.val();

            if (order.orderNo === orderNo) {

                update(ref(db, "orders/" + child.key), {
                    readyToDistribute: true,
                    status: "ready_to_distribute", // ✅ مهم جداً
                    readyTime: new Date().toISOString(),
                    history: [
                        ...(order.history || []),
                        {
                            action: "ready_to_distribute",
                            date: new Date().toISOString(),
                            by: "Packing Station"
                        }
                    ]
                }).then(() => {
                    renderReadyOrders(); // ✅ تحديث مباشر
                });

            }

        });

    });
}
function renderReadyOrders() {

    const container = document.getElementById("readyOrdersTable");

    const readyOrders = allOrders.filter(o =>
        o.readyToDistribute || o.status === "ready_to_distribute"
    );

    if (!readyOrders.length) {
        container.innerHTML = "<p>No ready orders</p>";
        return;
    }

container.innerHTML = `
<table style="width:100%;border-collapse:collapse;text-align:center">
    <tr>
        <th></th> <!-- 🔥 جديد -->
        <th>Order</th>
        <th>Boxes</th>
        <th>CBM</th>
        <th>Note</th>
        <th>Status</th>
    </tr>

    ${readyOrders.map(o => `
        <tr>
            <td>
                <input type="checkbox" 
                    class="readyCheckbox" 
                    value="${o.orderNo}">
            </td>

            <td>${o.orderNo}</td>
            <td>${o.boxes || 0}</td>
            <td>${o.cbm || 0}</td>

            <td style="font-size:12px;color:#38bdf8">
                ${o.emailOrComment || "-"}
            </td>

            <td style="color:#22c55e;font-weight:600">
                Ready
            </td>

            <td>
                <button onclick="openReadyEditModal('${o.orderNo}', ${o.boxes || 0}, ${o.cbm || 0})">
                    Edit
                </button>
            </td>
        </tr>
    `).join("")}
</table>
`;
}
function showReadyToDistributeTab() {

    document.getElementById("dashboardHeader").style.display = "none";

    const container = document.getElementById("readyTab");

    container.innerHTML = `
    <div style="
        display:grid;
        grid-template-columns: 1fr 1.5fr;
        gap:20px;
        padding:20px;
        max-width:1200px;
        margin:auto;
    ">

        <!-- LEFT PANEL (INPUTS) -->
        <div style="
            background:#0f172a;
            border:1px solid #1f2937;
            padding:18px;
            border-radius:16px;
            height:fit-content;
            position:sticky;
            top:20px;
        ">

            <h2 style="margin-bottom:15px;font-size:18px;color:#38bdf8">
                🚚 Ready To Distribute
            </h2>

            <input id="readyOrderInput"
                placeholder="Order #"
                style="width:100%;padding:10px;margin-bottom:10px;
                border-radius:10px;border:1px solid #1f2937;
                background:#020617;color:white" />

            <input id="readyBoxesInput"
                placeholder="Boxes Count"
                type="number"
                style="width:100%;padding:10px;margin-bottom:10px;
                border-radius:10px;border:1px solid #1f2937;
                background:#020617;color:white" />

            <input id="readyCBMInput"
                placeholder="CBM"
                type="number"
                step="0.01"
                style="width:100%;padding:10px;margin-bottom:10px;
                border-radius:10px;border:1px solid #1f2937;
                background:#020617;color:white" />

            <input id="readyEmailInput"
                placeholder="Comment / Email Notification"
                style="width:100%;padding:10px;margin-bottom:10px;
                border-radius:10px;border:1px solid #1f2937;
                background:#020617;color:white" />

            <button onclick="moveToReadyFromInputs()"
                style="
                    width:100%;
                    padding:12px;
                    background:linear-gradient(135deg,#22c55e,#16a34a);
                    border:none;
                    border-radius:10px;
                    font-weight:700;
                    color:white;
                    cursor:pointer;
                    box-shadow:0 0 12px #22c55e55;
                ">
                ➕ Add to Ready List
            </button>

            <button onclick="exportReadyToExcel()"
                style="
                    width:100%;
                    padding:12px;
                    margin-top:10px;
                    background:#0ea5e9;
                    border:none;
                    border-radius:10px;
                    font-weight:600;
                    color:white;
                    cursor:pointer;
                ">
                ⬇ Export to Excel
            </button>
<button onclick="distributeSelectedOrders()"
style="
    padding:10px 16px;
    background:linear-gradient(135deg,#22c55e,#16a34a);
    border:none;
    border-radius:8px;
    color:white;
    font-weight:700;
    cursor:pointer;
    margin-bottom:10px;
">
    🚚 Distribute Selected
</button>
        </div>

        <!-- RIGHT PANEL (TABLE) -->
        <div style="
            background:#0f172a;
            border:1px solid #1f2937;
            padding:18px;
            border-radius:16px;
            overflow:auto;
            min-height:70vh;
        ">

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-bottom:10px;
            ">
                <h3 style="color:white;margin:0">
                    📦 Ready Orders
                </h3>
            </div>

            <div id="readyOrdersTable"></div>

        </div>

    </div>
    `;

    document.querySelectorAll(".main > div").forEach(div => {
        if (div.id !== "readyTab") div.classList.add("hidden");
    });

    container.classList.remove("hidden");

    renderReadyOrders();
}

function distributeSelectedOrders() {

    const checkboxes = document.querySelectorAll(".readyCheckbox:checked");

    if (!checkboxes.length) {
        alert("Select at least one order");
        return;
    }

    const ordersRef = ref(db, "orders");

    get(ordersRef).then(snapshot => {

        snapshot.forEach(child => {

            const order = child.val();

            checkboxes.forEach(cb => {

                if (order.orderNo === cb.value) {

                    const orderNoLocal = order.orderNo;

                    update(ref(db, "orders/" + child.key), {
                        status: "distributed",
                        readyToDistribute: false,
                        distributedTime: new Date().toISOString(),
                        history: [
                            ...(order.history || []),
                            {
                                action: "distributed",
                                date: new Date().toISOString(),
                                by: "Distribution"
                            }
                        ]
                    }).then(() => {

                        // ✅ هون الصح
const today = new Date().toISOString().split("T")[0];

distributedOrdersMap[orderNoLocal] = {
    date: today,
    company: "Manual"
};
                        renderReadyOrders();
                        updateDashboard();

                    });

                }

            });

        });

    });

}
function moveToReadyFromInputs() {
const emailOrComment = document.getElementById("readyEmailInput").value.trim();
    const orderNo = document.getElementById("readyOrderInput").value.trim().toUpperCase();
    const boxes = document.getElementById("readyBoxesInput").value.trim();
    const cbm = document.getElementById("readyCBMInput").value.trim();

    if (!orderNo) return;

    if (boxes === "" || cbm === "") {
        alert("Please enter Boxes and CBM before saving");
        return;
    }

    const ordersRef = ref(db, "orders");

    get(ordersRef).then(snapshot => {

        snapshot.forEach(child => {

            const order = child.val();

            if (order.orderNo === orderNo) {

 update(ref(db, "orders/" + child.key), {
    readyToDistribute: true,
    status: "ready_to_distribute",
    boxes: Number(boxes),
    cbm: Number(String(cbm).replace(",", ".")),
    emailOrComment: emailOrComment, // ✅ الجديد
    readyTime: new Date().toISOString(),
    history: [
        ...(order.history || []),
        {
            action: "ready_to_distribute",
            date: new Date().toISOString(),
            by: "Packing Station",
            boxes,
            cbm,
            emailOrComment // optional في التاريخ
        }
    ]
}).then(() => {

                    // ✅ تحديث محلي فوري
                    const localOrder = allOrders.find(o => o.orderNo === orderNo);

                    if (localOrder) {
                        localOrder.readyToDistribute = true;
                        localOrder.status = "ready_to_distribute";
                        localOrder.boxes = Number(boxes);
                        localOrder.cbm = Number(cbm);
                    }

                    // ✅ إعادة الرسم مباشرة
                    renderReadyOrders();
                });

            }

        });

    });

    // تنظيف الحقول
    document.getElementById("readyOrderInput").value = "";
    document.getElementById("readyBoxesInput").value = "";
    document.getElementById("readyCBMInput").value = "";
    document.getElementById("readyEmailInput").value = "";
}
function reopenOrder(orderNo) {

    const ordersRef = ref(db, "orders");

    get(ordersRef).then(snapshot => {

        snapshot.forEach(child => {

            const order = child.val();

            if (order.orderNo === orderNo) {

                update(ref(db, "orders/" + child.key), {

                    status: "pending",

                    history: [
                        ...(order.history || []),
                        {
                            action: "reopened",
                            date: new Date().toISOString(),
                            by: localStorage.getItem("currentWarehouse")
                        }
                    ]

                });

            }

        });

    });

}

let editingReadyOrderNo = null;

function openReadyEditModal(orderNo, boxes, cbm) {

    editingReadyOrderNo = orderNo;

    document.getElementById("editBoxes").value = boxes;
    document.getElementById("editCBM").value = cbm;

    document.getElementById("readyEditModal").classList.remove("hidden");
}
function saveReadyEdit() {

    const boxes = document.getElementById("editBoxes").value;
    const cbm = document.getElementById("editCBM").value;
    const comment = document.getElementById("editOrderComment").value.trim();

    const ordersRef = ref(db, "orders");

    get(ordersRef).then(snapshot => {

        snapshot.forEach(child => {

            const order = child.val();

            if (order.orderNo === editingReadyOrderNo) {

                update(ref(db, "orders/" + child.key), {
                    boxes: Number(boxes),
                    cbm: Number(cbm)
                }).then(() => {

                    // 🔥 الحل المهم:
                    const updatedOrder = allOrders.find(o => o.orderNo === editingReadyOrderNo);

                    if (updatedOrder) {
                        updatedOrder.boxes = Number(boxes);
                        updatedOrder.cbm = Number(cbm);
                    }

                    renderReadyOrders(); // 🔥 تحديث مباشر بدون refresh

                });

            }

        });

    });

    document.getElementById("readyEditModal").classList.add("hidden");
}
document.getElementById("readyEditModal").addEventListener("click", (e) => {
    if (e.target.id === "readyEditModal") {
        e.target.classList.add("hidden");
    }
});
function exportReadyToExcel() {

    const readyOrders = allOrders.filter(o =>
        o.readyToDistribute || o.status === "ready_to_distribute"
    );

    if (!readyOrders.length) {
        alert("No data to export");
        return;
    }

    let csv = "Order,Boxes,CBM,Status\n";

    readyOrders.forEach(o => {
        csv += `${o.orderNo},${o.boxes || 0},${o.cbm || 0}, ${o.note || 0},Ready\n`;
    });

    // إنشاء الملف
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", "Ready_To_Distribute.csv");
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
// function clearAllOrders() {

//     remove(ref(db, "orders"))
//         .then(() => {
//             // showToast("🗑️ All orders deleted");
//         })
//         .catch(err => {
//             console.error(err);
//         });

// }
