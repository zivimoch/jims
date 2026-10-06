import Echo from "laravel-echo";
import Pusher from "pusher-js";
const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)];
const esc = (v) =>
    String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[c],
    );
const icon = (n) => `<svg aria-hidden="true"><use href="#${n}"/></svg>`;
const state = {
    user: null,
    activities: [],
    activeActivities: [],
    selected: null,
    people: [],
    own: null,
    page: "attendance",
    groups: [],
    villages: [],
    agendaPage: 1,
};
let classes = [
    "Umum",
    "Bapak-bapak",
    "Ibu-ibu",
    "Keputrian",
    "Remaja",
    "Pra Remaja",
    "Caberawit",
    "Paud",
];
const materialTypes = [
    "Al-Quran",
    "Hadist",
    "Nasehat",
    "ASAD",
    "Musyawarah",
    "Lainnya",
];
const statusLabels = {
    offline: "Hadir offline",
    online: "Hadir online",
    izin: "Izin",
};
const roles = {
    super_admin: "Super admin",
    pengurus: "Pengurus",
    jamaah: "Jamaah",
};
const fmt = (d) =>
    new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(d));
const clock = (d) =>
    new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(new Date(d));
const dateInput = (d = new Date()) =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(d));
const money = (v) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(v);
const manages = (a) => {
    if (state.user?.role === "super_admin") return true;
    if (state.user?.role !== "pengurus") return false;
    const scopes = state.user.dapukans?.length
        ? state.user.dapukans
        : [state.user];
    return scopes.some((d) =>
        d.group_id
            ? d.group_id === a.group_id && d.village_id === a.village_id
            : d.village_id
              ? d.village_id === a.village_id
              : d.region_id ===
                (a.region_id ||
                    state.villages.find((v) => v.id === a.village_id)
                        ?.region_id),
    );
};
const requiredText = (a) =>
    a.required_classes?.map((c) => c.name).join(", ") || a.class_name || "Umum";
const selected = () =>
    state.activeActivities.find((a) => a.id === state.selected);
const materialText = (a) =>
    (a.materials || [])
        .map((m) => m.type + (m.detail ? " " + m.detail : ""))
        .join(", ");
const activityStatus = (a) =>
    Date.now() < new Date(a.starts_at) - 7200000
        ? "Belum dimulai"
        : Date.now() > new Date(a.ends_at).getTime() + 7200000
          ? "Selesai"
          : "Sedang berlangsung";
let echo,
    toastTimer,
    refreshTimer,
    installPrompt,
    dialogSubmit,
    attendanceBusy = false;
function toast(message) {
    $("#toast").textContent = message;
    $("#toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
        () => $("#toast").classList.remove("visible"),
        4200,
    );
}
async function api(path, method = "GET", data) {
    if (!navigator.onLine)
        throw Error(
            "Anda offline. Sambungkan internet untuk menyimpan perubahan.",
        );
    const response = await fetch("/api" + path, {
        method,
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-CSRF-TOKEN": $("meta[name=csrf-token]").content,
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    if (response.status === 204) return null;
    const body = await response
        .json()
        .catch(() => ({ message: "Server belum dapat dihubungi." }));
    if (!response.ok) {
        if (response.status === 401 && state.user) {
            echo?.disconnect();
            location.reload();
        }
        if (response.status === 419)
            throw Error(
                "Sesi berakhir. Muat ulang halaman untuk masuk kembali.",
            );
        throw Error(
            Object.values(body.errors || {})
                .flat()
                .join("\n") ||
                body.message ||
                "Permintaan gagal.",
        );
    }
    return body;
}
function run(fn) {
    return (...args) =>
        Promise.resolve()
            .then(() => fn(...args))
            .catch((e) => toast(e.message));
}
function input(label, name, value = "", type = "text", required = true) {
    return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${required ? "required" : ""} maxlength="200"></label>`;
}
function select(label, name, options, value) {
    return `<label>${label}<select name="${name}">${options.map(([id, text]) => `<option value="${esc(id)}" ${String(value ?? "") === String(id) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
}
function dialog(title, html, onSubmit, submitLabel = "Simpan") {
    $("#dialog-form").reset();
    $("#dialog-title").textContent = title;
    $("#dialog-fields").innerHTML =
        html + '<p class="dialog-message" role="alert"></p>';
    $("#dialog-form button[type=submit]").textContent = submitLabel;
    $("#dialog-form button[type=submit]").hidden = !onSubmit;
    dialogSubmit = onSubmit;
    $("#dialog").showModal();
    enhanceChoices($("#dialog-fields"));
}
$("#dialog-form").onsubmit = async (e) => {
    e.preventDefault();
    if (!dialogSubmit) return;
    const button = $("#dialog-form button[type=submit]");
    button.disabled = true;
    $(".dialog-message").textContent = "";
    try {
        await dialogSubmit(
            Object.fromEntries(new FormData(e.target)),
            e.target,
        );
        $("#dialog").close();
    } catch (error) {
        $(".dialog-message").textContent = error.message;
    } finally {
        button.disabled = false;
    }
};
$("#cancel-dialog").onclick = $("#close-dialog").onclick = () =>
    $("#dialog").close();
function menu(open) {
    $("#sidebar").classList.toggle("open", open);
    $("#backdrop").classList.toggle("open", open);
    $("#menu-button").setAttribute("aria-expanded", String(open));
}
$("#menu-button").onclick = () =>
    menu(!$("#sidebar").classList.contains("open"));
$("#backdrop").onclick = () => menu(false);
$("#sidebar").insertAdjacentHTML(
    "afterbegin",
    '<button class="sidebar-close" aria-label="Sembunyikan navigasi">←</button>',
);
$(".sidebar-close").onclick = () => menu(false);
function nav() {
    const items = [
        ["schedule", "calendar", "AMI"],
        ["attendance", "circle-check", "Absen"],
        ["donations", "users", "Shodakoh"],
        ["history", "history", "Riwayat Absen"],
        ["classes", "book", "Kelas"],
        ["notifications", "moon", "Notifikasi"],
    ];
    if (state.user.role !== "jamaah")
        items.push(
            ["users", "users", "Kelola Akun"],
            ["masters", "users", "Master data"],
        );
    if (state.user.role === "super_admin")
        items.push(["audit", "history", "Log Aktivitas"]);
    const html = ([page, symbol, title]) =>
        `<button class="nav-item ${["schedule", "attendance", "donations"].includes(page) ? "primary-nav-item" : ""} ${page === state.page ? "active" : ""}" data-page="${page}">${icon(symbol)}<span>${title}</span></button>`;
    $("#sidebar nav").innerHTML = items.map(html).join("");
    $(".mobile-bottom-nav").innerHTML = items.slice(0, 3).map(html).join("");
    $$("[data-page]").forEach(
        (b) => (b.onclick = run(() => showPage(b.dataset.page))),
    );
    $("#profile-name").textContent = state.user.name.split(" ")[0];
    $("#profile .avatar").textContent = state.user.name
        .split(" ")
        .slice(0, 2)
        .map((s) => s[0])
        .join("");
    $(".account-note").insertAdjacentHTML(
        "beforebegin",
        `<p class="scope-badge">${esc(roles[state.user.role])} · ${esc(state.user.group?.name || state.user.village?.name || "Semua wilayah")}</p><div class="account-tools"><button id="install-app">Pasang aplikasi</button><button id="logout">Keluar</button></div>`,
    );
    $("#install-app").onclick = run(async () => {
        if (installPrompt) {
            await installPrompt.prompt();
            installPrompt = null;
        } else
            toast(
                "Buka menu browser → Pasang aplikasi / Tambahkan ke layar utama. Pada iPhone: Bagikan → Tambah ke Layar Utama.",
            );
    });
    $("#logout").onclick = run(async () => {
        let endpoint;
        try {
            const registration =
                await navigator.serviceWorker?.getRegistration();
            const subscription =
                await registration?.pushManager.getSubscription();
            endpoint = subscription?.endpoint;
            await subscription?.unsubscribe();
        } catch {}
        await api("/logout", "POST", { endpoint });
        echo?.disconnect();
        location.reload();
    });
    $("#create-event").hidden = state.user.role === "jamaah";
    $("#create-event").onclick = () => editActivity();
}
async function start() {
    try {
        await refreshOptions();
        $("#login-screen").hidden = true;
        $("#app-shell").hidden = false;
        nav();
        await reloadActivities();
        connectRealtime();
    } catch (error) {
        if (!state.user) {
            $("#login-screen").hidden = false;
        } else toast(error.message);
    } finally {
        $("#boot-status").hidden = true;
        document.body.classList.remove("booting");
    }
}
document.addEventListener("input", (event) => {
    if (event.target.matches('input[name="phone"]')) {
        const field = event.target;
        const caret = field.selectionStart;
        const before = field.value.slice(0, caret).replace(/[\s-]/g, "");
        field.value = field.value.replace(/[\s-]/g, "");
        field.setSelectionRange(before.length, before.length);
        field.setCustomValidity(
            field.value && !/^(?:08[0-9]{8,11}|000000000000)$/.test(field.value)
                ? "Gunakan nomor WA berawalan 08, sepanjang 10–13 digit (bukan 62)."
                : "",
        );
    }
});
$("#login-form").onsubmit = async (e) => {
    e.preventDefault();
    const button = $("#login-form button");
    button.disabled = true;
    $("#login-error").textContent = "";
    try {
        await api("/login", "POST", Object.fromEntries(new FormData(e.target)));
        location.reload();
    } catch (error) {
        $("#login-error").textContent = error.message;
        button.disabled = false;
    }
};
async function reloadActivities() {
    const [response, active] = await Promise.all([
        api(
            "/activities?page=" +
                state.agendaPage +
                "&" +
                new URLSearchParams(agendaFilters),
        ),
        api("/activities?active=1"),
    ]);
    state.activities = response.data;
    state.activeActivities = active.data;
    state.activityPagination = response;
    if (state.selected && !selected()) {
        state.selected = null;
        state.own = null;
        state.people = [];
    }
    renderActivities();
    if (state.selected) await loadAttendance();
    if (state.page === "schedule") renderAgendaRows();
}
function renderActivities() {
    const active = state.activeActivities.filter(
        (a) => activityStatus(a) === "Sedang berlangsung",
    );
    $("#events").innerHTML =
        active
            .map(
                (a) =>
                    `<button class="event-card ${a.id === state.selected ? "selected" : ""}" data-event="${a.id}" aria-pressed="${a.id === state.selected}"><span class="event-icon">${icon("users")}</span><div class="event-heading"><h2 class="event-title">${esc(a.title)}</h2></div><span class="selection-mark">${a.id === state.selected ? icon("check") : ""}</span><span class="event-labels"><span class="badge">${esc(a.group?.name || "Desa")}</span><span class="badge class-badge">${esc(requiredText(a))}</span><span class="status-marquee is-live"><span>Sedang berlangsung</span></span></span><span class="event-detail">${icon("pin")}<span>${esc(a.location)}</span></span><span class="event-detail">${icon("calendar")}<span>${esc(fmt(a.starts_at))} – ${esc(clock(a.ends_at))} WIB</span></span><span class="event-detail event-material">${icon("book")}<span><b>Materi</b><span>${esc(materialText(a))}</span></span></span>${a.note ? `<span class="event-note"><b>Keterangan</b><span>${esc(a.note)}</span></span>` : ""}</button>`,
            )
            .join("") ||
        '<div class="empty-events">Tidak ada kegiatan yang sedang berlangsung. Lihat agenda di menu AMI.</div>';
    $("#event-dots").innerHTML = active
        .map(
            (a) =>
                `<span class="${a.id === state.selected ? "active" : ""}"></span>`,
        )
        .join("");
    const chosen = active.find((a) => a.id === state.selected);
    $("#attendance-page .workspace").hidden = !chosen;
    $("#select-prompt").hidden = !!chosen || !active.length;
    $("#selected-event").textContent = chosen?.title || "";
    $$("[data-event]").forEach(
        (b) =>
            (b.onclick = run(async () => {
                state.selected = Number(b.dataset.event);
                state.own = null;
                state.people = [];
                renderActivities();
                await loadAttendance();
            })),
    );
    $("#other-attendance").hidden = !chosen || !manages(chosen);
}
let attendanceRequest = 0;
async function loadAttendance() {
    const id = state.selected;
    if (!id) return;
    const request = ++attendanceRequest;
    const d = await api(`/activities/${id}/attendance`);
    if (id !== state.selected || request !== attendanceRequest) return;
    state.people = d.records.data;
    state.peopleTotal = d.records.total;
    state.own = d.own;
    renderPeople();
    renderOwn();
}
function renderPeople() {
    const search = $("#people-search").value.toLocaleLowerCase("id"),
        filter = $("#status-filter").value;
    const people = state.people.filter(
        (p) =>
            p.user.name.toLocaleLowerCase("id").includes(search) &&
            (filter === "all" || p.status === filter),
    );
    $("#people-count").textContent = `${state.peopleTotal || 0} jamaah`;
    $("#people").innerHTML =
        people
            .map(
                (p, i) =>
                    `<li class="person"><span class="avatar ${["mint", "blue", "amber", "purple"][i % 4]}">${esc(
                        p.user.name
                            .split(" ")
                            .slice(0, 2)
                            .map((s) => s[0])
                            .join(""),
                    )}</span><div class="person-name"><strong>${esc(p.user.name)}${p.user_id === state.user.id ? " (Anda)" : ""}</strong><small>${esc(clock(p.updated_at))} WIB</small></div><span class="status ${p.status}">${icon(p.status === "offline" ? "check" : p.status === "online" ? "screen" : "clock")}<span class="sr-only">${esc(statusLabels[p.status])}</span></span></li>`,
            )
            .join("") || '<li class="empty">Belum ada jamaah yang cocok.</li>';
}
function renderOwn() {
    const own = state.own,
        track = $("#swipe-control");
    track.classList.toggle("locked-left", own?.status === "offline");
    track.classList.toggle("locked-right", !!own && own.status !== "offline");
    $("#fingerprint").style.setProperty(
        "--slide-x",
        `${own ? (own.status === "offline" ? -1 : 1) * slideLimit() : 0}px`,
    );
    $("#attendance-feedback").textContent = own
        ? own.status === "offline"
            ? "Anda hadir offline"
            : "Anda Izin / Hadir Online"
        : "";
    $("#fingerprint").setAttribute(
        "aria-label",
        own ? "Absensi sudah tercatat" : "Tap untuk absen hadir offline",
    );
    $$("[data-attend]").forEach((b) => {
        b.disabled = attendanceBusy;
        b.querySelector("strong").textContent = own
            ? own.status === "offline"
                ? "Anda hadir offline"
                : "Anda Izin / Hadir Online"
            : b.dataset.attend === "offline"
              ? "Hadir Offline"
              : "Izin / Hadir Online";
    });
    $("#cancel-attendance")?.remove();
    $("#zoom-access")?.remove();
    if (own)
        $("#attendance-feedback").insertAdjacentHTML(
            "afterend",
            '<button class="text-button" id="cancel-attendance">Batalkan absensi saya</button>',
        );
    if (own && own.status !== "offline" && selected()?.zoom_url)
        $("#attendance-feedback").insertAdjacentHTML(
            "afterend",
            `<div id="zoom-access" class="zoom-access"><a class="zoom-button" href="${esc(selected().zoom_url)}" target="_blank" rel="noopener noreferrer">${icon("screen")}Gabung Zoom</a></div>`,
        );
    if ($("#cancel-attendance"))
        $("#cancel-attendance").onclick = () =>
            confirmAction(
                "Batalkan absensi?",
                "Absensi Anda untuk kegiatan ini akan dihapus.",
                async () => {
                    await api(
                        `/activities/${state.selected}/attendance`,
                        "DELETE",
                    );
                    await loadAttendance();
                },
            );
}
function confirmAction(title, body, action) {
    dialog(title, `<p>${esc(body)}</p>`, action, "Ya, lanjutkan");
}
async function attend(status, reason = null, user_id) {
    if (attendanceBusy) return;
    attendanceBusy = true;
    try {
        await api(`/activities/${state.selected}/attendance`, "POST", {
            status,
            reason,
            ...(user_id ? { user_id } : {}),
        });
        await loadAttendance();
        toast("Absensi berhasil disimpan.");
    } finally {
        attendanceBusy = false;
    }
}
function choose(direction) {
    if (!selected()) return;
    if (state.own) {
        $("#cancel-attendance")?.click();
        return;
    }
    if (direction === "offline") run(() => attend("offline"))();
    else
        dialog(
            "Izin / Hadir Online",
            select(
                "Status",
                "status",
                [
                    ["online", "Hadir online"],
                    ["izin", "Izin"],
                ],
                "online",
            ) + input("Alasan", "reason"),
            (d) => attend(d.status, d.reason),
        );
}
$$("[data-attend]").forEach(
    (b) => (b.onclick = () => choose(b.dataset.attend)),
);
$("#people-search").oninput = renderPeople;
$("#status-filter").onchange = renderPeople;
$("#filter-button").onclick = () => {
    $("#filter-options").hidden = !$("#filter-options").hidden;
    $("#filter-button").setAttribute(
        "aria-expanded",
        String(!$("#filter-options").hidden),
    );
};
$("#other-attendance").onclick = run(async () => {
    const users = (await api("/users")).data.filter(
        (u) =>
            u.active &&
            (!selected().group_id || u.group_id === selected().group_id),
    );
    dialog(
        "Absenkan jamaah lain",
        select(
            "Jamaah",
            "user_id",
            users.map((u) => [u.id, u.name]),
            users[0]?.id,
        ) +
            select(
                "Status",
                "status",
                Object.entries(statusLabels),
                "offline",
            ) +
            input(
                "Alasan (wajib untuk online/izin)",
                "reason",
                "",
                "text",
                false,
            ),
        (d) => attend(d.status, d.reason || null, Number(d.user_id)),
    );
});
function slideLimit() {
    return Math.max(
        0,
        ($("#swipe-control").clientWidth - $("#fingerprint").offsetWidth) / 2 -
            12,
    );
}
let pointer = null,
    moved = false;
const thumb = $("#fingerprint");
thumb.onpointerdown = (e) => {
    if (e.button !== 0) return;
    pointer = { id: e.pointerId, start: e.clientX };
    moved = false;
    thumb.setPointerCapture(e.pointerId);
};
thumb.onpointermove = (e) => {
    if (!pointer || pointer.id !== e.pointerId) return;
    const delta = e.clientX - pointer.start;
    if (Math.abs(delta) > 8) moved = true;
    thumb.style.setProperty(
        "--slide-x",
        `${Math.max(-slideLimit(), Math.min(slideLimit(), delta))}px`,
    );
};
thumb.onpointerup = (e) => {
    if (!pointer) return;
    const delta = e.clientX - pointer.start;
    pointer = null;
    if (moved && Math.abs(delta) >= slideLimit() * 0.65)
        choose(delta < 0 ? "offline" : "online");
    renderOwn();
};
thumb.onpointercancel = () => {
    pointer = null;
    moved = true;
    renderOwn();
};
thumb.onclick = () => {
    if (!moved && !state.own) choose("offline");
};
thumb.onkeydown = (e) => {
    if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        choose(e.key === "ArrowLeft" ? "offline" : "online");
    }
};
window.addEventListener("resize", () => {
    if (state.user) renderOwn();
});
const pageTitles = {
    attendance: "Absen",
    schedule: "AMI",
    history: "Riwayat Absen",
    donations: "Shodakoh",
    classes: "Kelas",
    users: "Kelola Akun",
    notifications: "Notifikasi",
    audit: "Log Aktivitas",
    masters: "Master & Identitas",
};
async function showPage(page) {
    state.page = page;
    Object.keys(pageTitles).forEach(
        (key) => ($("#" + key + "-page").hidden = key !== page),
    );
    $("#page-title").textContent = pageTitles[page];
    $("#page-description").textContent =
        page === "attendance" ? "Pilih kegiatan, lalu klik untuk absensi." : "";
    $$("[data-page]").forEach((b) => {
        b.classList.toggle("active", b.dataset.page === page);
        b.setAttribute(
            "aria-current",
            b.dataset.page === page ? "page" : "false",
        );
    });
    menu(false);
    if (page === "schedule") renderAgenda();
    if (page === "history") await renderHistory();
    if (page === "classes") await renderClasses();
    if (page === "donations") await renderDonations();
    if (page === "users") await renderUsers();
    if (page === "notifications") await renderNotifications();
    if (page === "audit") await renderAudit();
    if (page === "masters") await renderMasters();
    enhanceChoices($("#" + page + "-page"));
}
function preferredVillage(record = {}) {
    return (
        record.village_id ||
        state.villages.find((v) => v.id === state.brand?.default_village_id)
            ?.id ||
        state.user.village_id ||
        state.villages[0]?.id
    );
}
function scopeFields(record = {}, includeRegion = false) {
    const villageId = preferredVillage(record);
    const regionId =
        record.region_id ??
        state.villages.find((v) => v.id === villageId)?.region_id ??
        state.user.region_id ??
        state.regions[0]?.id;
    const villages = state.villages.filter(
        (v) => !includeRegion || v.region_id === Number(regionId),
    );
    const groups = state.groups.filter(
        (g) => g.village_id === Number(villageId),
    );
    return (
        '<div class="scope-fields form-columns">' +
        (includeRegion
            ? masterSelect(
                  "Daerah",
                  "region_id",
                  state.regions,
                  regionId,
                  "region",
              )
            : "") +
        masterSelect(
            "Desa",
            "village_id",
            villages,
            villageId,
            "village",
            includeRegion ? "Tanpa desa (daerah)" : null,
        ) +
        masterSelect(
            "Kelompok",
            "group_id",
            groups,
            record.group_id ?? (record.id ? "" : state.user.group_id) ?? "",
            "group",
            "Semua kelompok (level desa)",
        ) +
        "</div>"
    );
}
function bindScope(root = $("#dialog-fields")) {
    root.querySelectorAll(".scope-fields").forEach((box) => {
        if (box.dataset.bound) return;
        box.dataset.bound = "true";
        const region = box.querySelector("[name=region_id]"),
            village = box.querySelector("[name=village_id]"),
            group = box.querySelector("[name=group_id]");
        const rebuildGroup = () => {
            group.innerHTML =
                '<option value="">Semua kelompok (level desa)</option>' +
                state.groups
                    .filter((g) => g.village_id === Number(village.value))
                    .map(
                        (g) =>
                            `<option value="${g.id}">${esc(g.name)}</option>`,
                    )
                    .join("");
            group.dispatchEvent(new Event("choices-updated"));
            refreshClassChoices();
        };
        village.addEventListener("change", rebuildGroup);
        group.addEventListener("change", refreshClassChoices);
        if (region)
            region.addEventListener("change", () => {
                village.innerHTML =
                    '<option value="">Tanpa desa (daerah)</option>' +
                    state.villages
                        .filter((v) => v.region_id === Number(region.value))
                        .map(
                            (v) =>
                                `<option value="${v.id}">${esc(v.name)}</option>`,
                        )
                        .join("");
                village.dispatchEvent(new Event("choices-updated"));
                rebuildGroup();
            });
    });
}
function refreshClassChoices() {
    const choice = $("#dialog-fields [name=required_class_ids]");
    if (!choice) return;
    const ids = [...choice.selectedOptions].map((o) => o.value),
        village = Number($("#dialog-fields [name=village_id]").value),
        group = Number($("#dialog-fields [name=group_id]").value);
    choice.innerHTML = (state.master_classes || [])
        .filter(
            (c) =>
                c.village_id === village &&
                (!c.group_id || c.group_id === group),
        )
        .map(
            (c) =>
                `<option value="${c.id}" ${ids.includes(String(c.id)) ? "selected" : ""}>${esc(c.name)}</option>`,
        )
        .join("");
    choice.dispatchEvent(new Event("choices-updated"));
}
function editActivity(activity) {
    if (activity && !manages(activity)) return;
    const a = activity || {},
        date = a.starts_at ? dateInput(a.starts_at) : dateInput();
    const time = (d) =>
        d
            ? new Intl.DateTimeFormat("en-GB", {
                  timeZone: "Asia/Jakarta",
                  hour: "2-digit",
                  minute: "2-digit",
              }).format(new Date(d))
            : "20:00";
    dialog(
        a.id ? "Edit kegiatan" : "Buat Kegiatan Baru",
        suggestInput("Judul kegiatan", "title", a.title, "title") +
            suggestInput("Tempat", "location", a.location, "place") +
            scopeFields(a) +
            `<label>Wajib Hadir<select name="required_class_ids" multiple required size="4" data-master="class">${(
                state.master_classes || []
            )
                .filter(
                    (c) =>
                        c.village_id === preferredVillage(a) &&
                        (!c.group_id ||
                            c.group_id === (a.group_id || state.user.group_id)),
                )
                .map(
                    (c) =>
                        `<option value="${c.id}" ${a.required_classes?.some((r) => r.id === c.id) || (!a.id && c.name === "Umum") ? "selected" : ""}>${esc(c.name)}</option>`,
                )
                .join(
                    "",
                )}</select><small>Bisa pilih beberapa kelas (Ctrl/Cmd + klik pada desktop).</small></label>` +
            input("Tanggal", "date", date, "date") +
            '<div class="form-columns">' +
            input("Waktu mulai (WIB)", "start", time(a.starts_at), "time") +
            input(
                "Waktu selesai (WIB)",
                "end",
                a.ends_at ? time(a.ends_at) : "21:30",
                "time",
            ) +
            '</div><fieldset class="materials-editor"><legend>Materi kegiatan</legend>' +
            materialTypes
                .map((type, i) => {
                    const m = a.materials?.find((m) => m.type === type);
                    return `<div class="material-edit-row"><label><input type="checkbox" name="material_${i}" ${m ? "checked" : ""}>${type}</label><input name="detail_${i}" value="${esc(m?.detail)}" placeholder="${type === "Al-Quran" ? "Surat:ayat, contoh 2:213" : type === "Hadist" ? "Kitab dan halaman" : type === "CAI" ? "Halaman" : "Keterangan (opsional)"}" maxlength="300"></div>`;
                })
                .join("") +
            "</fieldset>" +
            input(
                "Link Zoom (opsional)",
                "zoom_url",
                a.zoom_url,
                "url",
                false,
            ) +
            `<label>Catatan / NB<textarea name="note" maxlength="1000">${esc(a.note)}</textarea></label><label class="check-line"><input type="checkbox" name="attendance_enabled" ${a.attendance_enabled !== false ? "checked" : ""}> Buatkan Absennya</label>`,
        async (d) => {
            const materials = materialTypes.flatMap((type, i) =>
                d["material_" + i] ? [{ type, detail: d["detail_" + i] }] : [],
            );
            await api(
                "/activities" + (a.id ? "/" + a.id : ""),
                a.id ? "PUT" : "POST",
                {
                    title: d.title,
                    location: d.location,
                    village_id: Number(d.village_id),
                    group_id: d.group_id ? Number(d.group_id) : null,
                    required_class_ids: [
                        ...$("#dialog-form [name=required_class_ids]")
                            .selectedOptions,
                    ].map((o) => Number(o.value)),
                    attendance_enabled: !!d.attendance_enabled,
                    starts_at: `${d.date}T${d.start}:00+07:00`,
                    ends_at: `${d.date}T${d.end}:00+07:00`,
                    materials,
                    note: d.note || null,
                    zoom_url: d.zoom_url || null,
                },
            );
            await reloadActivities();
            toast("Kegiatan disimpan.");
        },
    );
    bindScope();
    bindSuggestions();
    if (a.id) {
        $("#dialog-fields").insertAdjacentHTML(
            "beforeend",
            '<button type="button" id="agenda-delete" class="secondary-button danger-button">Hapus kegiatan</button>',
        );
        $("#agenda-delete").onclick = () => {
            $("#dialog").close();
            confirmAction(
                "Hapus kegiatan?",
                `Kegiatan "${a.title}" dan absensi terkait akan dihapus.`,
                async () => {
                    await api("/activities/" + a.id, "DELETE");
                    await reloadActivities();
                    toast("Kegiatan dihapus.");
                },
            );
        };
    }
}
let agendaFilterTimer;
let agendaFilters = {
    search: "",
    group: "all",
    class: "all",
    from: "",
    to: "",
    per_page: 25,
    sort: "asc",
};
function filteredAgenda() {
    return state.activities;
}
function renderAgenda() {
    const page = $("#schedule-page");
    page.classList.remove("panel");
    page.innerHTML = `<div class="dt-toolbar"><label>Tampilkan <select id="ami-size">${[10, 25, 50, 100].map((n) => `<option value="${n}" ${Number(agendaFilters.per_page) === n ? "selected" : ""}>${n}</option>`).join("")}</select> baris</label><button id="ami-copy-table">Copy</button><button id="ami-print">PDF / Cetak</button>${state.user.role !== "jamaah" ? '<button id="agenda-create" class="dt-add">＋ Tambah</button>' : ""}<label class="dt-search">Cari: <input id="ami-search" type="search" value="${esc(agendaFilters.search)}" placeholder="Cari kegiatan..." aria-label="Cari agenda"></label></div><details class="agenda-filter-details"><summary>Filter lingkup dan tanggal</summary><div class="filter-grid">${select("Lingkup", "group", [["all", "Semua lingkup"], ["desa", "Desa"], ...state.groups.map((g) => [g.id, g.name])], agendaFilters.group)}${select("Kelas", "class", [["all", "Semua kelas"], ...classes.map((c) => [c, c])], agendaFilters.class)}${input("Dari tanggal", "from", agendaFilters.from, "date", false)}${input("Sampai tanggal", "to", agendaFilters.to, "date", false)}</div></details><div id="ami-results"></div><div class="dt-footer"><span id="ami-info" role="status"></span><div id="agenda-pager"></div></div><div class="dt-selection"><span>${state.user.role === "jamaah" ? "Agenda kegiatan sesuai lingkup Anda." : "Klik / tap dua kali pada baris untuk edit atau hapus."}</span><button id="agenda-share">Bagikan WA</button><button id="agenda-read">Mode baca</button></div>`;
    const refresh = () => {
        state.agendaPage = 1;
        clearTimeout(agendaFilterTimer);
        agendaFilterTimer = setTimeout(run(reloadActivities), 250);
    };
    $("#ami-search").oninput = (e) => {
        agendaFilters.search = e.target.value;
        refresh();
    };
    $("#ami-size").onchange = (e) => {
        agendaFilters.per_page = Number(e.target.value);
        refresh();
    };
    $$(
        "#schedule-page .filter-grid input, #schedule-page .filter-grid select",
    ).forEach(
        (el) =>
            (el.oninput = () => {
                agendaFilters[el.name] = el.value;
                refresh();
            }),
    );
    if ($("#agenda-create")) $("#agenda-create").onclick = () => editActivity();
    $("#ami-copy-table").onclick = run(async () => {
        await navigator.clipboard.writeText(agendaText(filteredAgenda()));
        toast("Agenda halaman ini disalin.");
    });
    $("#ami-print").onclick = () => window.print();
    $("#agenda-share").onclick = () => shareAgenda(false);
    $("#agenda-read").onclick = () => shareAgenda(true);
    renderAgendaRows();
}
function renderAgendaRows() {
    if (!$("#ami-results")) return;
    const activities = filteredAgenda();
    let previousDate = "";
    const rows = activities
        .map((a) => {
            const date = dateInput(a.starts_at);
            const longDate = new Intl.DateTimeFormat("id-ID", {
                timeZone: "Asia/Jakarta",
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
            }).format(new Date(a.starts_at));
            const dateCell =
                previousDate !== date
                    ? `<td class="dt-date" rowspan="${activities.filter((item) => dateInput(item.starts_at) === date).length}">${esc(longDate)}</td>`
                    : "";
            previousDate = date;
            const editable = manages(a),
                status = activityStatus(a);
            return `<tr ${editable ? `data-edit-event="${a.id}" tabindex="0" aria-label="Edit ${esc(a.title)}"` : ""}>${dateCell}<td class="dt-time">${esc(clock(a.starts_at))}<br>– ${esc(clock(a.ends_at))}</td><td>${esc(a.location)}</td><td><strong>${esc(a.title)}</strong>${a.note ? `<p>NB : ${esc(a.note)}</p>` : ""}<div class="dt-tags"><span>${esc(a.village?.name || "Desa")} · ${esc(a.group?.name || "Semua kelompok")}</span></div></td><td>${esc(requiredText(a))}</td></tr>`;
        })
        .join("");
    $("#ami-results").innerHTML =
        `<div class="dt-scroll" tabindex="0" role="region" aria-label="Tabel agenda AMI"><table class="ami-datatable"><thead><tr><th aria-sort="${agendaFilters.sort === "asc" ? "ascending" : "descending"}"><button id="ami-sort-date">Tanggal ${agendaFilters.sort === "asc" ? "↑" : "↓"}</button></th><th>Jam</th><th>Tempat</th><th>Agenda</th><th>Wajib Hadir</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty">Tidak ada kegiatan yang cocok.</td></tr>'}</tbody></table></div>`;
    $("#ami-sort-date").onclick = run(async () => {
        agendaFilters.sort = agendaFilters.sort === "asc" ? "desc" : "asc";
        state.agendaPage = 1;
        await reloadActivities();
    });
    const meta = state.activityPagination;
    $("#ami-info").textContent =
        `Menampilkan ${meta?.from || 0}–${meta?.to || 0} dari ${meta?.total || 0} kegiatan · WIB`;
    $("#agenda-share").disabled = $("#agenda-read").disabled =
        !activities.length;
    pager($("#agenda-pager"), meta, async (page) => {
        state.agendaPage = page;
        await reloadActivities();
    });
    const openRow = (row) => {
        const a = activities.find(
            (a) => a.id === Number(row?.dataset.editEvent),
        );
        if (a && manages(a) && !$("#dialog").open) editActivity(a);
    };
    const results = $("#ami-results");
    results.ondblclick = (e) => openRow(e.target.closest("[data-edit-event]"));
    results.onkeydown = (e) => {
        if (e.key === "Enter" && e.target.matches("[data-edit-event]")) {
            e.preventDefault();
            openRow(e.target);
        }
    };
    let touchStart, lastTap;
    results.onpointerdown = (e) => {
        if (e.pointerType === "touch")
            touchStart = { x: e.clientX, y: e.clientY };
    };
    results.onpointerup = (e) => {
        if (e.pointerType !== "touch" || !touchStart) return;
        const row = e.target.closest("[data-edit-event]"),
            moved = Math.hypot(
                e.clientX - touchStart.x,
                e.clientY - touchStart.y,
            );
        touchStart = null;
        if (!row || moved > 12) {
            lastTap = null;
            return;
        }
        const now = Date.now();
        if (
            lastTap &&
            lastTap.id === row.dataset.editEvent &&
            now - lastTap.time < 350
        ) {
            lastTap = null;
            e.preventDefault();
            openRow(row);
        } else lastTap = { id: row.dataset.editEvent, time: now };
    };
}
function agendaText(activities) {
    return activities
        .map(
            (a) =>
                `${a.title}\n${fmt(a.starts_at)} – ${clock(a.ends_at)} WIB\n${a.group?.name || "Desa"} · Wajib Hadir: ${requiredText(a)}\nLokasi: ${a.location}\nMateri: ${materialText(a)}${a.note ? "\nNB : " + a.note : ""}`,
        )
        .join("\n\n────────────\n\n");
}
function shareAgenda(reader) {
    const activities = filteredAgenda();
    if (!activities.length) {
        toast("Tidak ada kegiatan untuk dibagikan.");
        return;
    }
    const text = agendaText(activities);
    dialog(
        reader ? "Mode baca" : "Bagikan agenda halaman ini",
        reader
            ? `<article class="reader-text">${esc(text)}</article>`
            : `<textarea id="share-text" rows="14">${esc(text)}</textarea><div class="action-row"><button type="button" id="copy-agenda" class="secondary-button">Salin teks</button><a class="primary-button" id="wa-agenda" target="_blank" rel="noopener noreferrer">Buka WhatsApp</a></div>`,
        null,
    );
    if (!reader) {
        const update = () =>
            ($("#wa-agenda").href =
                "https://wa.me/?text=" +
                encodeURIComponent($("#share-text").value));
        update();
        $("#share-text").oninput = update;
        $("#copy-agenda").onclick = run(async () => {
            await navigator.clipboard.writeText($("#share-text").value);
            toast("Agenda disalin.");
        });
    }
}
function pager(target, response, handler) {
    target.innerHTML =
        response && response.last_page > 1
            ? `<button class="secondary-button" data-prev ${response.current_page === 1 ? "disabled" : ""}>Sebelumnya</button><span>${response.current_page} / ${response.last_page}</span><button class="secondary-button" data-next ${response.current_page === response.last_page ? "disabled" : ""}>Berikutnya</button>`
            : "";
    if (target.querySelector("[data-prev]")) {
        target.querySelector("[data-prev]").onclick = run(() =>
            handler(response.current_page - 1),
        );
        target.querySelector("[data-next]").onclick = run(() =>
            handler(response.current_page + 1),
        );
    }
}
async function renderHistory(page = 1) {
    const data = await api("/history?page=" + page);
    $("#history-list").innerHTML =
        data.data
            .map(
                (a) =>
                    `<li class="person"><span class="avatar mint">${icon("check")}</span><div class="person-name"><strong>${esc(a.activity.title)}</strong><small>${esc(fmt(a.activity.starts_at))}</small><small>${esc(a.reason)}</small></div><span class="status ${a.status}">${icon(a.status === "offline" ? "check" : a.status === "online" ? "screen" : "clock")}<span class="sr-only">${statusLabels[a.status]}</span></span></li>`,
            )
            .join("") || '<li class="empty">Belum ada riwayat absensi.</li>';
    $("#history-pager")?.remove();
    $("#history-list").insertAdjacentHTML(
        "afterend",
        '<div id="history-pager" class="pager"></div>',
    );
    pager($("#history-pager"), data, renderHistory);
}
async function renderClasses() {
    const data = await api("/history");
    const attended = data.data.filter((a) => a.status !== "izin");
    $("#classes-page").innerHTML =
        `${state.user.role !== "jamaah" ? '<button id="manage-classes" class="primary-button">Kelola kelas</button>' : ""}<h2>Ketercapaian materi</h2><p class="muted">Materi dari kegiatan yang Anda hadiri secara offline atau online.</p>${select("Kelas", "progress-class", [["all", "Semua kelas"], ...classes.map((c) => [c, c])], "all")}<div id="progress-list"></div>`;
    const render = () => {
        const selectedClass = $("#classes-page select").value;
        const entries = attended.filter(
            (a) =>
                selectedClass === "all" ||
                a.activity.required_classes?.some(
                    (c) => c.name === selectedClass,
                ) ||
                a.activity.class_name === selectedClass,
        );
        $("#progress-list").innerHTML =
            `<p class="metric">${entries.length} pertemuan${data.last_page > 1 ? " (100 catatan terbaru)" : ""}</p>` +
            entries
                .map(
                    (a) =>
                        `<article class="progress-row"><span class="badge class-badge">${esc(requiredText(a.activity))}</span><h3>${esc(a.activity.title)}</h3><p>${esc(materialText(a.activity))}</p><small>${esc(fmt(a.activity.starts_at))}</small></article>`,
                )
                .join("");
    };
    if ($("#manage-classes"))
        $("#manage-classes").onclick = () => {
            masterKind = "class";
            showPage("masters");
        };
    $("#classes-page select").onchange = render;
    render();
}
async function renderDonations(page = 1) {
    const [payments, records] = await Promise.all([
        api("/payments"),
        api("/contributions?page=" + page),
    ]);
    $("#donations-page").innerHTML =
        `<div class="feature-toolbar"><h2>Rekening shodakoh</h2>${state.user.role !== "jamaah" ? '<button class="secondary-button" id="payment-add">＋ Rekening</button>' : ""}</div><div class="donation-grid">${payments.map((p) => `<article class="panel donation-card"><h2>${esc(p.group?.name || "Desa")}</h2>${p.is_dummy ? '<span class="demo-payment">DATA DUMMY · BUKAN UNTUK TRANSFER</span>' : ""}<dl><dt>Bank</dt><dd>${esc(p.bank)}</dd><dt>Nomor rekening</dt><dd>${esc(p.number)}</dd><dt>Atas nama</dt><dd>${esc(p.holder)}</dd></dl>${p.is_dummy ? `<div class="qris-placeholder"><div class="qris-demo-art">${icon("qr-demo")}</div><strong>QRIS ${esc(p.group?.name || "Desa")}</strong><span>Contoh tampilan — tidak dapat dipindai</span></div>` : ""}${manages(p) ? `<button class="text-button" data-payment="${p.id}">Edit rekening</button><button class="text-button danger" data-payment-delete="${p.id}">Hapus</button>` : ""}</article>`).join("")}</div><section class="panel"><div class="feature-toolbar"><h2>Catatan shodakoh</h2>${state.user.village_id ? '<button class="primary-button" id="contribution-add">＋ Catat shodakoh</button>' : ""}</div><p class="muted">Catatan pribadi; bukan konfirmasi atau verifikasi transfer.</p><p class="metric">Total halaman ini: ${money(records.data.reduce((s, r) => s + Number(r.amount), 0))}</p>${records.data.map((r) => `<article class="account-row"><div><h3>${esc(r.category)} · ${money(r.amount)}</h3><p>${esc(r.user.name)} · ${esc(r.class_name)} · ${esc(r.date)}</p><p>${esc(r.note)}</p></div><div class="action-row"><button class="text-button" data-contribution="${r.id}">Edit</button><button class="text-button danger" data-contribution-delete="${r.id}">Hapus</button></div></article>`).join("") || '<p class="empty-state">Belum ada catatan shodakoh.</p>'}<div class="pager" id="contribution-pager"></div></section>`;
    if ($("#payment-add")) $("#payment-add").onclick = () => editPayment();
    $$("[data-payment]").forEach(
        (b) =>
            (b.onclick = () =>
                editPayment(
                    payments.find((p) => p.id === Number(b.dataset.payment)),
                )),
    );
    $$("[data-payment-delete]").forEach(
        (b) =>
            (b.onclick = () =>
                confirmAction(
                    "Hapus rekening?",
                    "Rekening ini tidak lagi tampil di Shodakoh.",
                    async () => {
                        await api(
                            "/payments/" + b.dataset.paymentDelete,
                            "DELETE",
                        );
                        await renderDonations();
                    },
                )),
    );
    if ($("#contribution-add"))
        $("#contribution-add").onclick = () => editContribution();
    $$("[data-contribution]").forEach(
        (b) =>
            (b.onclick = () =>
                editContribution(
                    records.data.find(
                        (r) => r.id === Number(b.dataset.contribution),
                    ),
                )),
    );
    $$("[data-contribution-delete]").forEach(
        (b) =>
            (b.onclick = () =>
                confirmAction(
                    "Hapus catatan?",
                    "Catatan shodakoh ini akan dihapus.",
                    async () => {
                        await api(
                            "/contributions/" + b.dataset.contributionDelete,
                            "DELETE",
                        );
                        await renderDonations(page);
                    },
                )),
    );
    pager($("#contribution-pager"), records, renderDonations);
}
function editPayment(p = {}) {
    dialog(
        p.id ? "Edit rekening" : "Tambah rekening",
        scopeFields(p) +
            input("Bank", "bank", p.bank) +
            input("Nomor rekening", "number", p.number) +
            input("Atas nama", "holder", p.holder) +
            select(
                "Jenis data",
                "is_dummy",
                [
                    [1, "Dummy — bukan untuk transfer"],
                    [0, "Rekening asli"],
                ],
                p.is_dummy === false ? 0 : 1,
            ),
        async (d) => {
            await api(
                "/payments" + (p.id ? "/" + p.id : ""),
                p.id ? "PUT" : "POST",
                {
                    ...d,
                    village_id: Number(d.village_id),
                    group_id: d.group_id ? Number(d.group_id) : null,
                    is_dummy: d.is_dummy === "1",
                },
            );
            await renderDonations();
        },
    );
    bindScope();
}
function editContribution(r = {}) {
    dialog(
        r.id ? "Edit catatan shodakoh" : "Catat shodakoh",
        select(
            "Kategori",
            "category",
            [
                ["Kas", "Kas"],
                ["Tabungan Jalan-jalan", "Tabungan Jalan-jalan"],
            ],
            r.category || "Kas",
        ) +
            select(
                "Kelas",
                "class_name",
                classes.map((c) => [c, c]),
                r.class_name || "Umum",
            ) +
            input("Jumlah (Rp)", "amount", r.amount, "number") +
            input("Tanggal", "date", r.date || dateInput(), "date") +
            input("Keterangan", "note", r.note, "text", false),
        async (d) => {
            await api(
                "/contributions" + (r.id ? "/" + r.id : ""),
                r.id ? "PUT" : "POST",
                { ...d, amount: Number(d.amount) },
            );
            await renderDonations();
        },
    );
}
async function renderUsers(page = 1, search = "") {
    const result = await api(
        "/users?page=" + page + "&search=" + encodeURIComponent(search),
    );
    $("#users-page").innerHTML =
        `<div class="feature-toolbar"><h2>Akun ${esc(state.user.group?.name || state.user.village?.name || "JiMS")}</h2><button id="add-user" class="primary-button">＋ Tambah akun</button></div><p class="muted">${state.user.role === "super_admin" ? "Kelola semua peran dan lingkup akun." : "Akun yang dapat Anda kelola sesuai lingkup kepengurusan."}</p><form id="user-search-form" class="action-row"><input aria-label="Cari akun" id="user-search" placeholder="Cari nama…" value="${esc(search)}"><button class="secondary-button">Cari</button></form><div>${result.data.map((u) => `<article class="account-row"><div><h3>${esc(u.name)} ${u.active ? "" : '<span class="badge inactive">Nonaktif</span>'}</h3><p>${esc(u.phone || "Nomor WA belum diisi")}</p><p>${roles[u.role]} · ${esc([u.region?.name, u.village?.name, u.group?.name].filter(Boolean).join(" / ") || "Semua wilayah")}<br>${(u.dapukans || []).map((d) => `<span class="badge">${esc(d.label)}</span>`).join(" ")}</p></div><button class="text-button" data-user="${u.id}">Kelola</button></article>`).join("") || '<p class="empty-state">Tidak ada akun yang cocok.</p>'}</div><div id="user-pager" class="pager"></div>`;
    $("#add-user").onclick = () => editUser();
    $$("[data-user]").forEach(
        (b) =>
            (b.onclick = () =>
                editUser(
                    result.data.find((u) => u.id === Number(b.dataset.user)),
                )),
    );
    $("#user-search-form").onsubmit = run(async (e) => {
        e.preventDefault();
        await renderUsers(1, $("#user-search").value);
    });
    pager($("#user-pager"), result, (p) => renderUsers(p, search));
}
function editUser(u = {}) {
    const allowed =
        state.user.role === "super_admin"
            ? Object.entries(roles)
            : u.role === "pengurus"
              ? [["pengurus", "Pengurus"]]
              : [["jamaah", "Jamaah"]];
    dialog(
        u.id ? "Kelola akun" : "Tambah akun",
        input("Nama lengkap", "name", u.name) +
            input("Nomor WhatsApp (08…)", "phone", u.phone, "tel") +
            select("Peran", "role", allowed, u.role || "jamaah") +
            scopeFields(u, true) +
            (state.user.role === "super_admin"
                ? '<fieldset><legend>Dapukan (untuk peran pengurus)</legend><div id="dapukan-rows"></div><button type="button" id="add-dapukan" class="secondary-button">＋ Tambah dapukan</button></fieldset>'
                : "") +
            select(
                "Status akun",
                "active",
                [
                    [1, "Aktif"],
                    [0, "Nonaktif"],
                ],
                u.active === false ? 0 : 1,
            ) +
            '<p class="muted">Perubahan akun akan mengakhiri sesi masuk akun tersebut. Akun dinonaktifkan tanpa menghapus riwayat absensinya.</p>',
        async (d) => {
            await api(
                "/users" + (u.id ? "/" + u.id : ""),
                u.id ? "PUT" : "POST",
                {
                    ...d,
                    region_id:
                        Number(
                            $("#dialog-fields > .scope-fields [name=region_id]")
                                .value,
                        ) || null,
                    village_id:
                        Number(
                            $(
                                "#dialog-fields > .scope-fields [name=village_id]",
                            ).value,
                        ) || null,
                    group_id:
                        Number(
                            $("#dialog-fields > .scope-fields [name=group_id]")
                                .value,
                        ) || null,
                    ...(state.user.role === "super_admin"
                        ? { dapukans: readDapukans() }
                        : {}),
                    active: d.active === "1",
                },
            );
            if (u.id === state.user.id) location.reload();
            else await renderUsers();
            toast("Akun disimpan.");
        },
    );
    if ($("#add-dapukan")) {
        $("#add-dapukan").onclick = () => addDapukanRow();
        (u.dapukans || []).forEach(addDapukanRow);
    }
    bindScope();
}
$("#profile").onclick = () =>
    dialog(
        "Profil saya",
        input("Nama lengkap", "name", state.user.name) +
            input("Nomor WhatsApp (08…)", "phone", state.user.phone, "tel") +
            input(
                "Email (opsional)",
                "email",
                state.user.email,
                "email",
                false,
            ) +
            input(
                "Alamat (opsional)",
                "address",
                state.user.address,
                "text",
                false,
            ) +
            `<p class="muted">Wilayah: ${esc([state.user.region?.name, state.user.village?.name, state.user.group?.name].filter(Boolean).join(" / "))}. Wilayah dan dapukan hanya dapat diubah pengelola akun.</p>`,
        async (d) => {
            state.user = await api("/profile", "PATCH", d);
            $("#profile-name").textContent = state.user.name.split(" ")[0];
            toast("Profil disimpan.");
        },
    );
async function renderNotifications(page = 1) {
    const records = await api("/notices?page=" + page);
    $("#notifications-page").innerHTML =
        `<div class="feature-toolbar"><h2>Notifikasi</h2><div class="action-row"><button class="primary-button" id="enable-push">Aktifkan notifikasi</button><button class="secondary-button" id="disable-push">Nonaktifkan</button><button class="secondary-button" id="test-push">Kirim uji</button></div></div><p class="muted">Izinkan notifikasi kegiatan di perangkat ini. Pada iPhone, pasang aplikasi ke layar utama terlebih dahulu.</p>${records.data.map((n) => `<article class="notice-row"><div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><small>${esc(fmt(n.created_at))}</small></div>${n.read_at ? "" : `<button class="text-button" data-read="${n.id}">Tandai dibaca</button>`}</article>`).join("") || '<p class="empty-state">Belum ada notifikasi.</p>'}<div id="notice-pager" class="pager"></div>`;
    $("#enable-push").onclick = run(enablePush);
    $("#disable-push").onclick = run(async () => {
        const reg = await navigator.serviceWorker?.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
            await api("/push", "DELETE", { endpoint: sub.endpoint });
            await sub.unsubscribe();
        }
        toast("Notifikasi perangkat dinonaktifkan.");
    });
    $("#test-push").onclick = run(async () => {
        await api("/push/test", "POST");
        toast("Notifikasi uji masuk antrean.");
    });
    $$("[data-read]").forEach(
        (b) =>
            (b.onclick = run(async () => {
                await api("/notices/" + b.dataset.read, "PATCH");
                await renderNotifications(page);
            })),
    );
    pager($("#notice-pager"), records, renderNotifications);
}
async function enablePush() {
    if (
        !("Notification" in window) ||
        !("PushManager" in window) ||
        !navigator.serviceWorker
    )
        throw Error(
            "Browser ini belum mendukung notifikasi. Coba browser yang mendukung PWA.",
        );
    if (!state.vapid_key) throw Error("Kunci push belum disiapkan di server.");
    if ((await Notification.requestPermission()) !== "granted")
        throw Error(
            "Notifikasi belum diizinkan. Periksa izin situs pada browser.",
        );
    const reg = await navigator.serviceWorker.ready;
    const key = state.vapid_key.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(
        atob(key + "=".repeat((4 - (key.length % 4)) % 4)),
        (c) => c.charCodeAt(0),
    );
    const subscription =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: bytes,
        }));
    await api("/push", "POST", subscription.toJSON());
    toast("Notifikasi diaktifkan untuk perangkat ini.");
}
async function renderAudit(page = 1) {
    const result = await api("/audit?page=" + page);
    $("#audit-page").innerHTML =
        '<h2>Log aktivitas</h2><p class="muted">Jejak perubahan akun, agenda, absensi, dan shodakoh.</p>' +
        result.data
            .map(
                (r) =>
                    `<article class="account-row"><div><h3>${esc(r.action)}</h3><p>${esc(r.entity)} #${r.entity_id} · Akun #${r.actor_id}</p></div><small>${esc(fmt(r.created_at))}</small></article>`,
            )
            .join("") +
        '<div id="audit-pager" class="pager"></div>';
    pager($("#audit-pager"), result, renderAudit);
}
function connectRealtime() {
    window.Pusher = Pusher;
    echo = new Echo({
        broadcaster: "reverb",
        key: state.reverb_key,
        wsHost: location.hostname,
        wsPort:
            Number(location.port) ||
            (location.protocol === "https:" ? 443 : 80),
        wssPort: Number(location.port) || 443,
        forceTLS: location.protocol === "https:",
        enabledTransports: ["ws", "wss"],
        authEndpoint: "/broadcasting/auth",
        auth: {
            headers: { "X-CSRF-TOKEN": $("meta[name=csrf-token]").content },
        },
    });
    const refresh = () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(
            run(async () => {
                await reloadActivities();
                if (state.page === "notifications") await renderNotifications();
                if (state.page === "donations") await renderDonations();
                if (state.page === "users") await renderUsers();
                if (state.page === "history") await renderHistory();
                if (state.page === "classes") await renderClasses();
            }),
            180,
        );
    };
    echo.private("user." + state.user.id).listen(".data.changed", refresh);
    for (const v of state.villages)
        echo.private("village." + v.id).listen(".data.changed", refresh);
    for (const g of state.groups)
        echo.private("group." + g.id).listen(".data.changed", refresh);
    echo.connector.pusher.connection.bind("state_change", ({ current }) => {
        $("#connection-status").textContent =
            current === "connected"
                ? "Terhubung · realtime"
                : "Menghubungkan ulang…";
        document.body.classList.toggle(
            "connection-offline",
            current !== "connected",
        );
        if (current === "connected") refresh();
    });
}
window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt = e;
});
window.addEventListener("offline", () => {
    $("#connection-status").textContent = "Offline · belum bisa menyimpan";
    document.body.classList.add("connection-offline");
    toast("Anda offline. Perubahan memerlukan koneksi internet.");
});
window.addEventListener(
    "online",
    run(async () => {
        if (state.user) await reloadActivities();
    }),
);
document.addEventListener(
    "visibilitychange",
    run(async () => {
        if (!document.hidden && state.user) await reloadActivities();
    }),
);
setInterval(() => {
    if (state.user && !document.hidden) renderActivities();
}, 30000);
if ("serviceWorker" in navigator)
    navigator.serviceWorker.register("/sw.js").catch(() => {});
start();

async function refreshOptions() {
    Object.assign(state, await api("/bootstrap"));
    classes = [...new Set((state.master_classes || []).map((c) => c.name))];
}
function masterSelect(label, name, rows, value, kind, empty = null) {
    return select(
        label,
        name,
        [
            ...(empty !== null ? [["", empty]] : []),
            ...rows.map((r) => [r.id, r.name]),
        ],
        value,
    ).replace("<select ", `<select data-master="${kind}" `);
}
function scopeValues(element) {
    const row =
        element.closest(".dapukan-row") || element.closest("form") || document;
    const value = (name) => row.querySelector(`[name="${name}"]`)?.value || "";
    return {
        region_id: value("region_id"),
        village_id: value("village_id"),
        group_id: value("group_id"),
    };
}
function fuzzyScore(a, b) {
    a = a.toLocaleLowerCase("id");
    b = b.toLocaleLowerCase("id");
    if (a === b) return 10;
    if (a.startsWith(b)) return 8;
    if (a.includes(b)) return 6;
    // Character bigrams also work for short Indonesian names.
    const parts = (x) =>
        new Set(
            Array.from({ length: Math.max(0, x.length - 1) }, (_, i) =>
                x.slice(i, i + 2),
            ),
        );
    const x = parts(a),
        y = parts(b);
    return x.size + y.size
        ? (2 * [...x].filter((t) => y.has(t)).length) / (x.size + y.size)
        : 0;
}
function enhanceChoices(root) {
    root?.querySelectorAll(
        "select:not([data-enhanced]):not(#ami-size)",
    ).forEach((el) => {
        const label =
            el.closest("label")?.firstChild?.textContent?.trim() ||
            el.name ||
            el.id;
        el.setAttribute("aria-label", label);
        el.dataset.enhanced = "true";
        const box = document.createElement("div");
        box.className = "searchable-choice";
        el.parentNode.insertBefore(box, el);
        box.append(el);
        const search = document.createElement("input");
        search.type = "search";
        search.placeholder = "Cari pilihan…";
        search.setAttribute("aria-label", "Cari pilihan " + label);
        search.autocomplete = "off";
        box.prepend(search);
        let options = [...el.options].map((o) => ({
                value: o.value,
                text: o.textContent,
            })),
            sequence = 0,
            timer;
        el.addEventListener("choices-updated", () => {
            options = [...el.options].map((o) => ({
                value: o.value,
                text: o.textContent,
            }));
            search.value = "";
        });
        const kind = el.dataset.master;
        const canCreate =
            kind &&
            (["region", "village", "group", "dapukan"].includes(kind)
                ? state.user?.role === "super_admin"
                : state.user?.role !== "jamaah");
        const create = document.createElement("button");
        create.type = "button";
        create.className = "text-button";
        create.hidden = true;
        box.append(create);
        search.oninput = () => {
            clearTimeout(timer);
            const generation = ++sequence;
            timer = setTimeout(
                run(async () => {
                    const term = search.value.trim(),
                        selected = [...el.selectedOptions].map((o) => ({
                            value: o.value,
                            text: o.textContent,
                        }));
                    let found;
                    if (kind) {
                        const query = { q: term };
                        const scope = scopeValues(el);
                        if (kind === "village" && scope.region_id)
                            query.region_id = scope.region_id;
                        if (
                            ["group", "class", "place", "title"].includes(
                                kind,
                            ) &&
                            scope.village_id
                        )
                            query.village_id = scope.village_id;
                        if (["class", "place", "title"].includes(kind))
                            query.group_id = scope.group_id;
                        const rows = await api(
                            "/masters/" +
                                kind +
                                "?" +
                                new URLSearchParams(query),
                        );
                        found = rows.map((r) => ({
                            value: String(r.id),
                            text: r.name,
                        }));
                    } else
                        found = options
                            .map((o) => ({
                                ...o,
                                score: fuzzyScore(o.text, term),
                            }))
                            .filter((o) => !term || o.score >= 0.25)
                            .sort((a, b) => b.score - a.score);
                    if (generation !== sequence || !el.isConnected) return;
                    const merged = [
                        ...found,
                        ...selected.filter(
                            (o) => !found.some((f) => f.value === o.value),
                        ),
                    ];
                    el.innerHTML = merged
                        .map(
                            (o) =>
                                `<option value="${esc(o.value)}" ${selected.some((v) => v.value === o.value) ? "selected" : ""}>${esc(o.text)}</option>`,
                        )
                        .join("");
                    if (!el.multiple && !selected.length) el.selectedIndex = -1;
                    create.hidden = !(
                        canCreate &&
                        term &&
                        !found.some(
                            (o) => o.text.toLowerCase() === term.toLowerCase(),
                        )
                    );
                    create.textContent = `＋ Tambahkan “${term}”`;
                }),
                200,
            );
        };
        create.onclick = run(async () => {
            create.disabled = true;
            try {
                const scope = scopeValues(el),
                    data = { name: search.value.trim() };
                if (kind === "village")
                    data.region_id = Number(scope.region_id);
                if (["group", "class", "place", "title"].includes(kind))
                    data.village_id = Number(scope.village_id);
                if (["class", "place", "title"].includes(kind))
                    data.group_id = scope.group_id
                        ? Number(scope.group_id)
                        : null;
                const added = await api("/masters/" + kind, "POST", data);
                await refreshOptions();
                const current = [...el.options].some(
                    (o) => o.value === String(added.id),
                );
                if (!current)
                    el.add(
                        new Option(added.name, String(added.id), false, true),
                    );
                else
                    [...el.options].find(
                        (o) => o.value === String(added.id),
                    ).selected = true;
                el.dispatchEvent(new Event("choices-updated"));
                el.dispatchEvent(new Event("change", { bubbles: true }));
                create.hidden = true;
                toast("Pilihan ditambahkan.");
            } finally {
                create.disabled = false;
            }
        });
    });
}
function suggestInput(label, name, value, kind) {
    return `<label>${label}<input name="${name}" value="${esc(value)}" list="suggest-${name}" data-suggest="${kind}" autocomplete="off" required maxlength="${kind === "title" ? 150 : 200}"><datalist id="suggest-${name}"></datalist><small>Pilih data sebelumnya atau ketik baru; tersimpan saat kegiatan disimpan.</small></label>`;
}
function bindSuggestions() {
    $$("#dialog-fields [data-suggest]").forEach((el) => {
        let timer,
            sequence = 0;
        el.oninput = el.onfocus = () => {
            clearTimeout(timer);
            const generation = ++sequence;
            timer = setTimeout(
                run(async () => {
                    const scope = scopeValues(el),
                        rows = await api(
                            "/masters/" +
                                el.dataset.suggest +
                                "?" +
                                new URLSearchParams({
                                    q: el.value,
                                    village_id: scope.village_id,
                                    group_id: scope.group_id,
                                }),
                        );
                    if (generation === sequence && el.isConnected)
                        $("#suggest-" + el.name).innerHTML = rows
                            .map(
                                (r) =>
                                    `<option value="${esc(r.name)}"></option>`,
                            )
                            .join("");
                }),
                200,
            );
        };
    });
}
function addDapukanRow(d = {}) {
    const row = document.createElement("div");
    row.className = "dapukan-row";
    const region = d.region_id || state.user.region_id || state.regions[0]?.id;
    row.innerHTML =
        masterSelect(
            "Dapukan",
            "dapukan_type_id",
            state.dapukan_types,
            d.dapukan_type_id,
            "dapukan",
        ) +
        '<div class="scope-fields form-columns">' +
        masterSelect("Daerah", "region_id", state.regions, region, "region") +
        masterSelect(
            "Desa",
            "village_id",
            state.villages.filter((v) => v.region_id === region),
            d.village_id || "",
            "village",
            "Semua desa (level daerah)",
        ) +
        masterSelect(
            "Kelompok",
            "group_id",
            state.groups.filter((g) => g.village_id === d.village_id),
            d.group_id || "",
            "group",
            "Semua kelompok (level desa)",
        ) +
        '</div><button type="button" class="text-button remove-dapukan">Hapus dapukan ini</button>';
    $("#dapukan-rows").append(row);
    row.querySelector(".remove-dapukan").onclick = () => row.remove();
    bindScope(row);
    enhanceChoices(row);
}
function readDapukans() {
    return $$(".dapukan-row").map((row) =>
        Object.fromEntries(
            ["dapukan_type_id", "region_id", "village_id", "group_id"].map(
                (key) => [
                    key,
                    Number(row.querySelector(`[name=${key}]`).value) || null,
                ],
            ),
        ),
    );
}
let masterKind = "region";
async function renderMasters() {
    const allowed =
        state.user.role === "super_admin"
            ? [
                  ["region", "Daerah"],
                  ["village", "Desa"],
                  ["group", "Kelompok"],
                  ["dapukan", "Dapukan"],
                  ["class", "Kelas"],
                  ["place", "Tempat"],
                  ["title", "Judul kegiatan"],
              ]
            : [
                  ["class", "Kelas"],
                  ["place", "Tempat"],
                  ["title", "Judul kegiatan"],
              ];
    if (!allowed.some(([k]) => k === masterKind)) masterKind = "class";
    $("#masters-page").innerHTML =
        `<h2>Master data</h2><p class="muted">Pilih data yang sudah tersedia. Setiap desa dan kelompok terhubung ke wilayah induknya.</p>${select("Jenis data", "master-kind", allowed, masterKind)}<div class="action-row"><input id="master-search" type="search" placeholder="Cari, termasuk nama mirip…" aria-label="Cari master"><button id="new-master" class="primary-button">＋ Tambah</button></div><div id="master-results"></div>${state.user.role === "super_admin" ? '<button id="edit-brand" class="secondary-button">Ubah identitas aplikasi</button>' : ""}`;
    $("[name=master-kind]").onchange = run(async (e) => {
        masterKind = e.target.value;
        await renderMasters();
    });
    $("#new-master").onclick = () => editMaster(masterKind);
    if ($("#edit-brand"))
        $("#edit-brand").onclick = () =>
            dialog(
                "Identitas aplikasi",
                input("Nama aplikasi", "name", state.brand.name) +
                    input(
                        "Deskripsi singkat",
                        "subtitle",
                        state.brand.subtitle,
                        "text",
                        false,
                    ) +
                    masterSelect(
                        "Desa default AMI",
                        "default_village_id",
                        state.villages,
                        state.brand.default_village_id,
                        "village",
                        "Ikuti wilayah akun",
                    ),
                async (d) => {
                    await api("/brand", "PUT", {
                        ...d,
                        default_village_id:
                            Number(d.default_village_id) || null,
                    });
                    location.reload();
                },
            );
    let timer;
    const load = async () => {
        const query = $("#master-search").value,
            kind = masterKind;
        const rows = await api(
            "/masters/" + kind + "?q=" + encodeURIComponent(query),
        );
        if (
            kind !== masterKind ||
            !$("#master-results") ||
            $("#master-search").value !== query
        )
            return;
        $("#master-results").innerHTML =
            rows
                .map(
                    (r) =>
                        `<article class="account-row"><div><h3>${esc(r.name)}</h3><small>${esc([state.regions.find((v) => v.id === r.region_id)?.name, state.villages.find((v) => v.id === r.village_id)?.name, state.groups.find((g) => g.id === r.group_id)?.name].filter(Boolean).join(" / "))}</small></div>${state.user.role === "super_admin" || manages(r) ? `<div><button class="text-button" data-master-edit="${r.id}">Edit</button><button class="text-button" data-master-delete="${r.id}">Hapus</button></div>` : ""}</article>`,
                )
                .join("") || "<p>Belum ada pilihan. Tambahkan data baru.</p>";
        $$("[data-master-edit]").forEach(
            (b) =>
                (b.onclick = () =>
                    editMaster(
                        kind,
                        rows.find((r) => r.id === Number(b.dataset.masterEdit)),
                    )),
        );
        $$("[data-master-delete]").forEach(
            (b) =>
                (b.onclick = () =>
                    confirmAction(
                        "Hapus master?",
                        "Data yang masih digunakan tidak dapat dihapus.",
                        async () => {
                            await api(
                                "/masters/" +
                                    kind +
                                    "/" +
                                    b.dataset.masterDelete,
                                "DELETE",
                            );
                            await refreshOptions();
                            await renderMasters();
                        },
                    )),
        );
    };
    $("#master-search").oninput = () => {
        clearTimeout(timer);
        timer = setTimeout(run(load), 200);
    };
    await load();
    enhanceChoices($("#masters-page"));
}
function editMaster(kind, r = {}) {
    let html = input("Nama", "name", r.name);
    if (kind === "village")
        html += masterSelect(
            "Daerah",
            "region_id",
            state.regions,
            r.region_id || state.regions[0]?.id,
            "region",
        );
    if (kind === "group")
        html += masterSelect(
            "Desa",
            "village_id",
            state.villages,
            r.village_id ||
                state.brand?.default_village_id ||
                state.villages[0]?.id,
            "village",
        );
    if (["class", "place", "title"].includes(kind)) html += scopeFields(r);
    dialog(r.id ? "Edit master" : "Tambah master", html, async (d) => {
        const data = { ...d };
        for (const key of ["region_id", "village_id", "group_id"])
            if (key in data) data[key] = Number(data[key]) || null;
        await api(
            "/masters/" + kind + (r.id ? "/" + r.id : ""),
            r.id ? "PUT" : "POST",
            data,
        );
        await refreshOptions();
        if (state.page === "masters") await renderMasters();
        else if (state.page === "classes") await renderClasses();
        toast("Master tersimpan.");
    });
    bindScope();
}
