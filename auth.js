// Нэвтрэлт (Firebase Authentication): Google болон имэйл/нууц үг.
// firebase-config.js хоосон (null) бол бүх функц идэвхгүй, сайт ердийнхөөрөө ажиллана.
import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";

let auth = null; // Firebase Auth объект
let fb = null; // firebase-auth модулийн функцууд
let current = null; // одоогийн хэрэглэгч
const listeners = new Set();
let ready;

export const authEnabled = true;
// "firebase" — жинхэнэ нэвтрэлт; "local" — config ороогүй үеийн түр горим:
// бүртгэл зөвхөн энэ хөтчийн localStorage-д хадгалагдана (өөр төхөөрөмжөөс нэвтрэхгүй).
export const authMode = firebaseConfig ? "firebase" : "local";

// ---------- local горим ----------
const LS_USERS = "bg:auth:users", LS_SESSION = "bg:auth:session";
const lsGet = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : JSON.parse(v);
  } catch (_) {
    return d;
  }
};
const lsSet = (k, v) => {
  try {
    v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v));
  } catch (_) {}
};
async function hashPass(salt, pass) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pass));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const fail = (code) => {
  throw { code };
};
const localUser = (email) => {
  const u = lsGet(LS_USERS, {})[email];
  return u ? { email, displayName: u.name, photoURL: null } : null;
};
function setLocal(u) {
  current = u;
  lsSet(LS_SESSION, u ? u.email : null);
  listeners.forEach((f) => f(u));
}
const local = {
  async login(email, pass) {
    email = email.toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("auth/invalid-email");
    if (!pass) fail("auth/missing-password");
    const u = lsGet(LS_USERS, {})[email];
    if (!u || (await hashPass(u.salt, pass)) !== u.hash) fail("auth/invalid-credential");
    setLocal(localUser(email));
  },
  async register(name, email, pass) {
    email = email.toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("auth/invalid-email");
    if (!pass || pass.length < 6) fail("auth/weak-password");
    const users = lsGet(LS_USERS, {});
    if (users[email]) fail("auth/email-already-in-use");
    const salt = crypto.getRandomValues(new Uint32Array(4)).join("-");
    users[email] = { name, salt, hash: await hashPass(salt, pass), created: Date.now() };
    lsSet(LS_USERS, users);
    setLocal(localUser(email));
  },
};

export function initAuth() {
  if (ready) return ready;
  if (authMode === "local") {
    current = localUser(lsGet(LS_SESSION, ""));
    listeners.forEach((f) => f(current));
    return (ready = Promise.resolve(current));
  }
  ready = (async () => {
    const [{ initializeApp }, authMod] = await Promise.all([
      import(SDK + "firebase-app.js"),
      import(SDK + "firebase-auth.js"),
    ]);
    fb = authMod;
    auth = fb.getAuth(initializeApp(firebaseConfig));
    auth.languageCode = "mn";
    await new Promise((res) => {
      let first = true;
      fb.onAuthStateChanged(auth, (u) => {
        current = u;
        listeners.forEach((f) => f(u));
        if (first) (first = false), res();
      });
    });
    return current;
  })();
  return ready;
}

export const currentUser = () => current;

export function onUserChange(f) {
  listeners.add(f);
  return () => listeners.delete(f);
}

export const displayName = (u) =>
  (u && (u.displayName || (u.email || "").split("@")[0])) || "";
// Хуурамч имэйлийг (…@users.oj) хэрэглэгчид харуулахгүй
export const shownEmail = (u) =>
  u && u.email && u.email.includes("@") && !u.email.endsWith("@users.oj") ? u.email : "";

export async function loginGoogle() {
  await initAuth();
  if (authMode === "local") fail("local/no-google");
  await fb.signInWithPopup(auth, new fb.GoogleAuthProvider());
}

export async function loginEmail(email, password) {
  await initAuth();
  if (authMode === "local") return local.login(email, password);
  await fb.signInWithEmailAndPassword(auth, email, password);
}

export async function register(name, email, password) {
  await initAuth();
  if (authMode === "local") return local.register(name, email, password);
  const cred = await fb.createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    await fb.updateProfile(cred.user, { displayName: name });
    listeners.forEach((f) => f(auth.currentUser)); // нэрийг header-т шинэчилнэ
  }
}

export async function resetPassword(email) {
  await initAuth();
  if (authMode === "local") fail("local/no-reset");
  await fb.sendPasswordResetEmail(auth, email);
}

export async function logout() {
  await initAuth();
  if (authMode === "local") return setLocal(null);
  await fb.signOut(auth);
}

// Firebase-ийн алдааны кодыг монгол хэл рүү
export function authError(e) {
  const code = (e && e.code) || "";
  const map = {
    "auth/invalid-email": "Имэйл хаяг буруу байна.",
    "auth/missing-password": "Нууц үгээ оруулна уу.",
    "auth/invalid-credential": "Имэйл эсвэл нууц үг буруу байна.",
    "auth/wrong-password": "Имэйл эсвэл нууц үг буруу байна.",
    "auth/user-not-found": "Ийм имэйлтэй хэрэглэгч алга.",
    "auth/email-already-in-use": "Энэ имэйлээр бүртгэл аль хэдийн үүссэн байна.",
    "auth/weak-password": "Нууц үг хэт богино байна (дор хаяж 6 тэмдэгт).",
    "auth/too-many-requests": "Хэт олон оролдлого хийлээ. Түр хүлээгээд дахин оролдоно уу.",
    "auth/popup-closed-by-user": "Нэвтрэх цонхыг хаасан байна.",
    "auth/popup-blocked": "Хөтөч нэвтрэх цонхыг хаасан байна. Popup-ыг зөвшөөрнө үү.",
    "auth/network-request-failed": "Сүлжээний алдаа. Интернэтээ шалгана уу.",
    "auth/unauthorized-domain": "Энэ домэйныг Firebase Console → Authentication → Settings → Authorized domains-д нэмэх хэрэгтэй.",
    "local/no-username": "Хэрэглэгчийн нэрээ оруулна уу.",
    "local/bad-username": "Хэрэглэгчийн нэр 3–32 тэмдэгт, зөвхөн латин үсэг, тоо, _ . - байна.",
    "local/username-taken": "Энэ нэр бүртгэлтэй байна. Өөр нэр сонгоно уу.",
    "local/bad-login": "Хэрэглэгчийн нэр эсвэл нууц үг буруу байна.",
    "local/no-google": "Google-ээр нэвтрэх нь Firebase тохиргоо шаардана.",
    "local/no-reset": "Нууц үг сэргээх нь Firebase тохиргоо шаардана.",
    "auth/operation-not-allowed": "Энэ нэвтрэх аргыг Firebase Console дээр идэвхжүүлээгүй байна.",
  };
  return map[code] || (e && e.message) || "Алдаа гарлаа.";
}

// Рейтингт харуулах хэрэглэгчид: [{ id, name }]. id нь ахицын түлхүүрт ашиглагдана (userScope-тай ижил).
// local горимд энэ хөтөчид бүртгүүлсэн бүх хэрэглэгч; Firebase горимд (сервергүй) зөвхөн одоогийн хэрэглэгч.
export function listUsers() {
  if (authMode === "local")
    return Object.entries(lsGet(LS_USERS, {})).map(([email, u]) => ({
      id: email,
      name: u.name || email.split("@")[0],
      created: u.created || 0,
    }));
  return current ? [{ id: current.uid, name: displayName(current), created: 0 }] : [];
}

// ---------- хэрэглэгчийн нэрээр нэвтрэх (имэйлгүй) ----------
// Нэр: латин үсэг, тоо, _ . - (3–32 тэмдэгт). Том жижиг үсэг ялгахгүй.
// Firebase горимд нэрийг "<нэр>@users.oj" гэсэн хуурамч имэйл болгож хадгална (имэйл илгээгдэхгүй).
const USER_RE = /^[a-z0-9_.-]{3,32}$/;
const FAKE_DOMAIN = "@users.oj";
const normUser = (name) => {
  const n = String(name || "").trim().toLowerCase();
  if (!n) fail("local/no-username");
  if (!USER_RE.test(n)) fail("local/bad-username");
  return n;
};

export async function loginUser(name, password) {
  const n = normUser(name);
  if (!password) fail("auth/missing-password");
  await initAuth();
  if (authMode === "local") {
    const u = lsGet(LS_USERS, {})[n];
    if (!u || (await hashPass(u.salt, password)) !== u.hash) fail("local/bad-login");
    return setLocal(localUser(n));
  }
  try {
    await fb.signInWithEmailAndPassword(auth, n + FAKE_DOMAIN, password);
  } catch (e) {
    if (/invalid-credential|wrong-password|user-not-found/.test(e.code)) fail("local/bad-login");
    throw e;
  }
}

export async function registerUser(name, password) {
  const n = normUser(name);
  if (!password || password.length < 6) fail("auth/weak-password");
  await initAuth();
  if (authMode === "local") {
    const users = lsGet(LS_USERS, {});
    if (users[n]) fail("local/username-taken");
    const salt = crypto.getRandomValues(new Uint32Array(4)).join("-");
    users[n] = { name: n, salt, hash: await hashPass(salt, password), created: Date.now() };
    lsSet(LS_USERS, users);
    return setLocal(localUser(n));
  }
  try {
    const cred = await fb.createUserWithEmailAndPassword(auth, n + FAKE_DOMAIN, password);
    await fb.updateProfile(cred.user, { displayName: n });
    listeners.forEach((f) => f(auth.currentUser));
  } catch (e) {
    if (e.code === "auth/email-already-in-use") fail("local/username-taken");
    throw e;
  }
}

