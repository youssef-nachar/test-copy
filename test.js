


    const orderDetails = document.getElementById("orderDetails");

    orderDetails.addEventListener("click", (e) => {
        if (e.target === orderDetails) {
            orderDetails.classList.add("hidden");
        }
    });


    let refreshTimer = null;
    let isRefreshing = false;
    let showOnlyBacklog = false;
    let firstLoad = true;

    let dataCache = null;
    let lastDataHash = "";
    let isLoading = false;

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

    const loggedIn = localStorage.getItem("isLoggedIn");
    const role = localStorage.getItem("userRole");

    if (loggedIn === "true") {

        loginContainer.style.display = "none";
        dashboard.classList.remove("hidden");

        if (role === "manager") {

            loadData();
            startLiveDashboard();
            listenToOrders();

        } else {

            document.querySelector(".kpis").style.display = "none";
            document.querySelector(".warehouse-container").style.display = "none";
            document.querySelector(".sales-order").style.display = "none";

            showNewOrderTab();

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
                Add orders
                    Logout
                </button>
            `;
        }
    }
});
const users = [
    { username: "manager", password: "123456", warehouse: "P&C", role: "manager" },

    { username: "pharmaUser", password: "123456", warehouse: "Pharma", role: "user" },
    { username: "retailUser", password: "123456", warehouse: "Retail", role: "user" },
    { username: "packing", password: "123456", warehouse: "Packing Station", role: "user" }
];
 //   const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSAeWlFZdvqQqrWCq0uJKqxz6boomvVuNal1IYM1tOuoeraNE_ZW2BfYYKr3lKfmldOWOgWAXhz88Ke/pub?output=csv";

    let allOrders = [];
    const distributionSheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTecpCEwZ10-Ncz2y0xSsAnNdLXcWDGt_GiAeJlbWYhgg9B8zlhvJ1DeDH8H0NDSg/pub?output=csv";
    let distributedOrders = new Set(); // 

    let distributedOrdersMap = {};


    const canceledSheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTecpCEwZ10-Ncz2y0xSsAnNdLXcWDGt_GiAeJlbWYhgg9B8zlhvJ1DeDH8H0NDSg/pub?gid=508410365&single=true&output=csv";
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
allOrders.forEach(order=>{

if(canceledOrdersSet.has(order.orderNo)){

order.status="canceled";

}

});
        canceledOrdersSet = newSet;

        console.log("Canceled Orders Loaded:", canceledOrdersSet.size);
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
allOrders.forEach(order=>{

if(distributedOrdersMap[order.orderNo]){

order.status="distributed";

}

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

            if (order.status === "distributed") {
                statusText = `<span style="color:#22c55e;font-weight:600;">Distributed</span>`;
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
if(u.warehouse === "Packing Station"){

autoMoveToPacking();

}

    loginError.classList.add("hidden");

    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("currentWarehouse", u.warehouse);
    localStorage.setItem("userRole", u.role);

    loginContainer.style.display = "none";
    dashboard.classList.remove("hidden");

    // 🔥 manager يرى كل شيء
    if (u.role === "manager") {

        loadData();
        startLiveDashboard();
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

        if (order.status === "canceled") {
            return "#ef4444"; // red
        }

        if (order.status === "distributed") {
            return "#22c55e";
        }

        if (order.status === "partial") {
            return warehouse.packed ? "#22c55e" : "#f59e0b";
        }

        if (order.status === "completed") {
            return "#16a34a";
        }

        return "#7c2d12";
    }
    function toggleQuickMenu(e) {
        e.stopPropagation();
        document.getElementById("quickDateMenu").classList.toggle("hidden");
    }

    // إغلاق القائمة عند الضغط خارجها  
    document.addEventListener("click", () => {
        document.getElementById("quickDateMenu").classList.add("hidden");
    });

    function setQuickDate(type) {
        const today = new Date();

        const format = d => d.toISOString().slice(0, 10);

        let from, to;

        switch (type) {
            case "today":
                from = to = format(today);
                break;

            case "yesterday":
                const y = new Date(today);
                y.setDate(y.getDate() - 1);
                from = to = format(y);
                break;

            case "week":
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday  
                from = format(startOfWeek);
                to = format(today);
                break;

            case "month":
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                from = format(startOfMonth);
                to = format(today);
                break;
        }

        dateFrom.value = from;
        dateTo.value = to;

        updateDashboard();
    }




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
    async function loadData({ force = false, silent = false } = {}) {
        if (isLoading) return;
        isLoading = true;

        if (!silent && !dataCache) loadingOverlay.classList.remove("hidden");

        try {
            await loadDistributedOrders();
            await loadCanceledOrders();   // 🔥 هذا السطر كان ناقص 

            const res = await fetch(sheetURL + "&t=" + Date.now(), {
                cache: "no-store"
            });
            const csv = await res.text();
            const parsed = Papa.parse(csv, { skipEmptyLines: true });
            const rows = parsed.data;
            if (!rows.length) return;

            const headers = rows.shift().map(h => h.toLowerCase().trim());
            const col = {};
            headers.forEach((h, i) => col[h] = i);

            const ORDER = col["shopify order#"];
            const DATE = col["order received in wh"];
            const WH = col["warehouse name"];
            const PACKED = col["packed"] || null;

            const map = {};

            rows.forEach(r => {
                const orderNo = r[ORDER]?.trim().toUpperCase();
                const date = formatDateForInput(r[DATE]);
                const whRaw = r[WH]?.trim();
                const packedRaw = PACKED ? r[PACKED]?.trim() : null;

                if (!orderNo || !date || !whRaw) return;

                if (!map[orderNo]) {
                    map[orderNo] = { orderNo, date, wh: {} };
                }

                // normalize warehouse  
                const w = normalizeWarehouse(whRaw);
                if (!w.base) return;

                if (!map[orderNo].wh[w.base]) {
                    map[orderNo].wh[w.base] = {
                        base: w.base,
                        packed: false,
                        receivedTime: formatDateForInput(r[DATE]),
                        packingTime: null
                    };
                }

                // ✅ معالجة جميع صيغ العمود Packed  
                const packedValues = ["TRUE", "True", "true", "1", "Yes", "yes", "X", "x"];

                if (w.packed || (packedRaw && packedValues.includes(packedRaw))) {
                    map[orderNo].wh[w.base].packed = true;

                    // ⬅️ هنا نخزن وقت التحويل إلى Packing
                    map[orderNo].wh[w.base].packingTime = formatDateForInput(r[DATE]);
                }
            });

            // بناء الطلبات النهائية مع تحديد الحالة بدقة  
            // بناء الطلبات النهائية مع تحديد الحالة بدقة  
            let newOrders = Object.values(map).map(o => {

                const warehouses = Object.values(o.wh);
                const totalWH = warehouses.length;
                const packedWH = warehouses.filter(w => w.packed).length;

                let status;

                // 🔴 CANCELED FIRST (أولوية قصوى)
                if (canceledOrdersSet.has(o.orderNo)) {
                    status = "canceled";
                }
                else if (distributedOrdersMap[o.orderNo]) {
                    status = "distributed";
                    warehouses.forEach(w => w.distributed = true);
                }
                else if (totalWH === 1) {
                    status = warehouses[0].packed ? "completed" : "pending";
                }
                else {
                    if (packedWH === 0) status = "pending";
                    else if (packedWH < totalWH) status = "partial";
                    else status = "completed";
                }

                return {
                    ...o,
                    warehouses,
                    warehouseCount: totalWH,
                    status
                };

            });
            // 🔥 احسب أحدث تاريخ فعلي في البيانات
            const newestDateInSnapshot = newOrders
                .map(o => getEffectiveDate(o))
                .filter(Boolean)
                .sort()
                .pop(); // آخر عنصر = أحدث تاريخ

            // 🔥 لو النسخة أقدم من آخر نسخة عرضناها → تجاهلها
            if (highestEffectiveDateSeen && newestDateInSnapshot < highestEffectiveDateSeen) {
                console.warn("⚠️ Older snapshot detected — BLOCKED");
                return;
            }

            // حدّث أحدث تاريخ
            highestEffectiveDateSeen = newestDateInSnapshot;
            if (newOrders.length < highestOrderCountSeen) {
                console.warn("⚠️ Sheet returned older snapshot — blocked");
                return;
            }

            highestOrderCountSeen = newOrders.length;
            //  if (dataCache && newOrders.length < dataCache.length) {  
            //   console.warn("Old version detected — skipped");  
            //   return;  
            //}  
            // ❌ إذا رجعت نسخة أقل من الحالية — تجاهلها
            if (dataCache && newOrders.length < dataCache.length) {
                console.warn("⚠️ Older version detected — skipped");
                return;
            }

            // ❌ إذا الهَاش أقدم أو نفسه — تجاهل
            const newHash = hashData(newOrders);

            if (!force && dataCache && newHash === lastDataHash) {
                return; // لا يوجد تغيير
            }
            // ❌ إذا لا يوجد تغيير — لا تفعل أي شيء  
            if (!force && dataCache && newHash === lastDataHash) {
                return; // يحافظ على الأرقام كما هي  
            }
            // إشعار بالطلبات الجديدة  
            let newOnly = [];

            if (dataCache && Array.isArray(dataCache)) {
                const oldSet = new Set(dataCache.map(o => o.orderNo));
                newOnly = newOrders.filter(o => !oldSet.has(o.orderNo));
            }

            if (dataCache && newOnly.length) {
                showToast(`🔔 ${newOnly.length} new order(s) received`);
            }

            dataCache = newOrders;
            allOrders = newOrders;
            lastDataHash = newHash;

            updateDashboard();
            if (!dateFrom.value && !dateTo.value) initDate();

        } catch (e) {
            console.error("Load error:", e);
        } finally {
            isLoading = false;
            loadingOverlay.classList.add("hidden");
        }
    }

    // INIT DATE FILTER  

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
        distributed: 0
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
    function updateDashboard() {
allOrders.forEach(order=>{
order.status = resolveOrderStatus(order);
});
        const todayOrders = applyFilters();
        const ACCUMULATE_FROM = "2026-02-02";

        const accumulatedOrders = allOrders.filter(o => {
            const dateToCheck = getEffectiveDate(o);
            if (!dateToCheck) return false;
            return dateToCheck >= ACCUMULATE_FROM;
            
    const packingWH = order.warehouses.find(w => w.base === "PACKING STATION");
    if (packingWH && packingWH.packed) {
        order.status = "completed";  // In-Packing
    } else {
        order.status = resolveOrderStatus(order); // الحالة الأصلية
    }
});
        

        // ================= TODAY =================
        const CANCELED_START_DATE = "2026-02-02";

        const canceledToday = allOrders.filter(o => {

            if (o.status !== "canceled") return false;

            const dateToCheck = getEffectiveDate(o);
            if (!dateToCheck) return false;

            return dateToCheck >= CANCELED_START_DATE;
        });
        const distributedToday = todayOrders.filter(o => o.status === "distributed");
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

        // ================= DISPLAY =================

        updateKPINumber("total", todayOrders.length);
        updateKPINumber("distributed", distributedToday.length);
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

    function renderWarehouseBreakdown(orders) {
        const warehouseMap = {};
        const grandTotal = { t: 0, c: 0, p: 0, d: 0 };

        orders.forEach(order => {
            // الطلب يُحسب مرة واحدة  
            grandTotal.t++;

            const isDistributed = order.status === "distributed";

            order.warehouses.forEach(w => {
                if (!warehouseMap[w.base]) {
                    warehouseMap[w.base] = { t: 0, c: 0, p: 0, d: 0 };
                }

                warehouseMap[w.base].t++;

                if (isDistributed) {
                    warehouseMap[w.base].d++;
                } else if (order.status === "completed") {
                    warehouseMap[w.base].c++; // In-Packing  
                } else {
                    warehouseMap[w.base].p++; // Pending + Partial  
                }
            });

            // grand totals  
            if (isDistributed) {
                grandTotal.d++;
            } else if (order.status === "completed") {
                grandTotal.c++;
            } else {
                grandTotal.p++;
            }
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
            if (!wh || !v) return ""; // منع أي صف فارغ  
            const safeWh = wh.replace(/'/g, "\\'"); // escape single quotes  
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
        const m = orders.filter(x => x.warehouseCount > 1);
        const completedOrders = m.filter(x => x.status === "completed");
        const distributedOrders = m.filter(x => x.status === "distributed");
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
        const distributedOrders = s.filter(x => x.status === "distributed");
        const pendingOrders = s.filter(x => x.status === "pending")
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

                if (o.status !== "canceled") return false;

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
                        order.status === "distributed" ? "Distributed" :
                            order.status === "completed" ? "In-Packing" :
                                order.status === "partial" ? "Partial" :
                                    "Pending";

                return `
                <tr>
                    <td>${order.orderNo}</td>
                    <td>
                        ${order.warehouses.map(w => {

                    const badgeColor = getWarehouseBadgeColor(order, w);

                    let tooltipText = "";

                    if (order.status === "distributed") {
                        tooltipText = `Distributed at: ${distributedOrdersMap[order.orderNo]?.date || "-"}`;
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
        if (type === "distributed") o = o.filter(x => x.status === "distributed");
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
        orders.sort((a, b) => {

            function getFullDate(order) {

                // لو الطلب Distributed
                if (order.status === "distributed") {
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
            else if (order.status === "distributed") {
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
                // تحديد لون الـ badge لكل warehouse  
                let color, text;

                if (order.status === "distributed") {
                    color = "#22c55e";
                    text = "Distributed";
                } else if (w.packed) {
                    color = "#22c55e";
                    text = "In-Packing";
                } else {
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
        ${w.base.toUpperCase()}  
    </span>  
    <div class="tooltip-box">  
        ${tooltipText}  
    </div>  
</div>  
`;
            }).join("")}  
          </td>  
          <td style="font-weight:600; color:#9ca3af">  
            ${statusText}  
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
    function toggleMenu(id) {
        const menu = document.getElementById(id);
        if (!menu) return;

        const parent = menu.parentElement;
        parent.classList.toggle("menu-open");

        menu.style.display =
            menu.style.display === "block" ? "none" : "block";
    }

    const toggleToDateBtn = document.getElementById("toggleToDate");
    const dateToInput = document.getElementById("dateTo");

    //   

    // CLOSE MODAL  
    function closeOrderDetails() { orderDetails.classList.add("hidden"); }

    // EXPORT TO EXCEL  
    function exportOrderDetailsToExcel() {

        let exportOrders = [];
        let fileType = "filtered";

        // ===============================
        // تحديد مصدر البيانات
        // ===============================

        if (lastType !== null) {

            if (showOnlyBacklog) {
                exportOrders = lastBacklogOrders;
                fileType = "backlog";
            }
            else if (lastBacklogOrders.length > 0) {
                exportOrders = [
                    ...lastTodayOrders,
                    ...lastBacklogOrders
                ];
                fileType = "all";
            }
            else {
                exportOrders = lastTodayOrders;
                fileType = "today";
            }

        } else {
            exportOrders = lastDisplayedOrders;
            fileType = "filtered";
        }

        if (!exportOrders || !exportOrders.length) {
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
            .replace(/[-_]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        return { base, packed };
    }
    // SHOW WAREHOUSES PAGE  
    function showWarehouses() { }
    let currentInterval = 3000; // يبدأ 30 ثانية  
    // ==============================  
    // 🔥 ENTERPRISE LIVE ENGINE  
    // ==============================  

    const FAST_INTERVAL = 2000;   // نشط  
    const SLOW_INTERVAL = 3000;  // خمول  

    let liveTimer = null;
    let idleTimer = null;
    let isIdle = false;

    function startLiveDashboard() {
        stopLiveDashboard();

        runLiveCycle(FAST_INTERVAL);

        // كشف الخمول  
        resetIdleTimer();
        ["mousemove", "keydown", "click", "touchstart"].forEach(evt =>
            document.addEventListener(evt, resetIdleTimer)
        );

        // عند الرجوع للتاب  
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) {
                loadData({ force: true, silent: true });
            }
        });
    }

    function stopLiveDashboard() {
        if (liveTimer) clearInterval(liveTimer);
        if (idleTimer) clearTimeout(idleTimer);
    }

    function runLiveCycle(interval) {
        if (liveTimer) clearInterval(liveTimer);

        liveTimer = setInterval(async () => {
            if (isLoading) return;

            try {
                await loadData({ silent: true });

            } catch (e) {
                console.error("Live error:", e);
            }
        }, interval);
    }

    function resetIdleTimer() {
        isIdle = false;
        runLiveCycle(FAST_INTERVAL);

        if (idleTimer) clearTimeout(idleTimer);

        idleTimer = setTimeout(() => {
            isIdle = true;
            runLiveCycle(SLOW_INTERVAL);
        }, 60000); // بعد دقيقة خمول  
    }

    //function stopAutoRefresh() {  
    // clearInterval(refreshTimer);  
    //  refreshTimer = null;  
    //}  
    // SIGN OUT  
    function signOut() {
        clearInterval(refreshTimer);
        refreshTimer = null;

        localStorage.removeItem("isLoggedIn");

        localStorage.removeItem("currentWarehouse");

        location.reload();
        dashboard.classList.add("hidden");
        loginContainer.style.display = "flex";
        stopLiveDashboard()
    }
    // REFRESH PAGE ON ENTER  
    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const tag = document.activeElement.tagName.toLowerCase();
            if (tag === "input" || tag === "textarea") return;

            e.preventDefault();
            loadData({ force: true });
        }
    });
    function showToast(message) {
        const toast = document.getElementById("toast");
        const sound = document.getElementById("toastSound");

        document.getElementById("toastText").textContent = message;

        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";

        sound.currentTime = 0;
        sound.play().catch(() => { });

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(20px)";
        }, 4000);
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


    // =============================
    // SHOW TAB
    // =============================
    function showNewOrderTab() {

    document.querySelectorAll(".main > div").forEach(div => {
        if (div.id !== "newOrderTab") div.classList.add("hidden");
    });

    document.getElementById("newOrderTab").classList.remove("hidden");

    const warehouseInput = document.getElementById("newWarehouseName");
    const userWarehouse = localStorage.getItem("currentWarehouse");

    if (userWarehouse) {

        warehouseInput.value = userWarehouse;

        // 🔥 فقط packing يستطيع التعديل
        if (userWarehouse === "Packing Station") {
            warehouseInput.readOnly = false;
        } else {
            warehouseInput.readOnly = true;
        }

    }

    setTodayForNewOrder();
}
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

    // =============================
    // SAVE NEW ORDER
function saveNewOrder() {

    const orderNo = document.getElementById("newOrderNumber").value.trim();
    const warehouse = document.getElementById("newWarehouseName").value.trim();
    const date = document.getElementById("newOrderDate").value;

    if (!orderNo || !warehouse || !date) {
        showToast("⚠️ Please fill all fields");
        return;
    }

    const now = new Date();

    const formattedDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const formattedTime = now.toLocaleTimeString(); // الوقت المحلي

    const currentWarehouse = localStorage.getItem("currentWarehouse");

    const status = currentWarehouse === "Packing Station"
        ? "completed"
        : "pending";

    const newOrder = {
        orderNo: orderNo.toUpperCase(),
        date: formattedDate,
        time: formattedTime,
        createdAt: now.toISOString(),
        warehouses: [{
            base: warehouse,
            packed: false,
            receivedTime: formattedDate
        }],
        warehouseCount: 1,
        status: status,   // 🔥 هنا التغيير
        comment: ""
    };

    // 🔥 إرسال إلى Firebase
    const ordersRef = ref(db, "orders");
    push(ordersRef, newOrder)
      .then(() => {
          console.log("Saved to Firebase");
      })
      .catch(err => {
          console.error("Firebase Error:", err);
      });

    // 🔥 إضافة الطلب إلى جميع الطلبات المحلية
    allOrders.push(newOrder);

    // 🔥 إضافة الطلب إلى recentOrders المحلي وعرضه مباشرة
    if (!window.recentOrders) window.recentOrders = [];
    window.recentOrders.unshift(newOrder); // تضيف في البداية
    renderRecentOrders(); // تحديث عرض Recent Orders

    updateDashboard();

    showToast(`✅ Order ${orderNo} added successfully`);

    showOrderPreview(newOrder);

    clearNewOrderForm();
}

// 🔥 دالة عرض الطلبات الأخيرة
function renderRecentOrders() {
    const container = document.getElementById('newOrdersList');
    if (!container) return;

    container.innerHTML = '';
    window.recentOrders.forEach(order => {
        const div = document.createElement('div');
        div.classList.add('order-card');
        div.innerHTML = `
            <strong>#${order.orderNo}</strong> - ${order.warehouses[0].base} - ${order.date} ${order.time}
        `;
        container.appendChild(div);
    });

    // إظهار قسم Recent Orders إذا كان مخفي
    document.getElementById('newOrderPreview').classList.remove('hidden');
}
    const newOrderInput = document.getElementById("newOrderNumber");

    newOrderInput.addEventListener("input", function () {

        const value = this.value.trim();

        // يتحقق من الصيغة: #m + 5 أرقام
        const pattern = /^#m\d{5}$/i;

        if (pattern.test(value)) {

            // منع التكرار إذا نفس الرقم
            if (this.dataset.saved === value) return;

            this.dataset.saved = value;

            // تنفيذ الحفظ تلقائياً
            saveNewOrder();

            // تفريغ الحقل بعد الحفظ
            this.value = "";

        }
    });
function markInPacking(orderNo){

const ordersRef = ref(db,"orders");

onValue(ordersRef,(snapshot)=>{

const data = snapshot.val();

Object.entries(data).forEach(([key,order])=>{

if(order.orderNo === orderNo){

update(ref(db,"orders/"+key),{
status:"in-packing",
packingTime:new Date().toISOString()
});

}

});

},{onlyOnce:true});

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
function resolveOrderStatus(order){

// 🔴 canceled
if(canceledOrdersSet.has(order.orderNo)){
return "canceled";
}

// 🚚 distributed
if(distributedOrdersMap[order.orderNo]){
return "distributed";
}

// 📦 in packing
if(order.status === "in-packing"){
return "completed"; // لأن الداشبورد يعرض completed = In-Packing
}

// ⏳ pending
return "pending";

}
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
                background:#f59e0b;
                padding:6px 14px;
                border-radius:20px;
                font-size:11px;
                font-weight:600;
            ">
                Pending
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

        showToast("💾 Comment saved");
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
    // =============================
    // LOAD SECURE ORDERS
    // =============================
function listenToOrders() {

    const ordersRef = ref(db, "orders");

    onValue(ordersRef, (snapshot) => {

        const data = snapshot.val();
        if (!data) return;

        const firebaseOrders = Object.values(data);

        allOrders = firebaseOrders;

        updateDashboard();

    });
}

    function showDashboardHome() {
        document.getElementById("newOrderTab").classList.add("hidden");

        // اظهار محتوى الداشبورد
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
    function autoMoveToPacking(){

const currentWarehouse = localStorage.getItem("currentWarehouse");

if(currentWarehouse !== "Packing Station") return;

const ordersRef = ref(db,"orders");

onValue(ordersRef,(snapshot)=>{

const data = snapshot.val();
if(!data) return;

Object.entries(data).forEach(([key,order])=>{

if(order.status === "pending"){

update(ref(db,"orders/"+key),{
status:"in-packing",
packingTime:new Date().toISOString()
});

}

});

},{onlyOnce:true});

}
