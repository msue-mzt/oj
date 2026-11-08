# Олимпиадад бэлтгэгчдэд тусламж: сайт хийж GitHub Pages-д байрлуулсан заавар

Энэ баримт нь өнөөдөр хийсэн бүх ажлыг эхнээс нь дуустал, давтан хийж болохоор бичсэн заавар юм.

**Эцсийн үр дүн:** https://dashdemberel2019.github.io/onlinejudge_2026/

---

## 1. Сайт юу вэ

Статик вэб сайт (сервергүй). C++ бодлого харуулж, хэрэглэгчийн кодыг **хөтөч дотор** хөрвүүлж шалгадаг.

- Бодлогын жагсаалт, хайлт, бодлогын текст (Markdown + KaTeX томьёо)
- Кодын редактор (CodeMirror)
- Шалгагч: **clang → WebAssembly**. Код сервер рүү илгээгдэхгүй, хэрэглэгчийн компьютер дээр ажиллана.

### Файлын бүтэц

```
onlinejudge_2026/
├── index.html        # үндсэн хуудас (app.js-ийг module-ээр ачаална)
├── app.js            # сайтын логик
├── style.css         # загвар
├── netlify.toml      # Netlify-д зориулсан header тохиргоо (GitHub Pages-д ашиглагдахгүй)
├── README.md
├── vendor/           # katex, codemirror, marked.min.js (гадаад сан, локал хуулбар)
├── judge/            # clang.wasm, lld.wasm, memfs.wasm, sysroot (~58 MB)
├── problems/         # бодлогууд (~6 MB)
└── tools/
```

Нийт хэмжээ ойролцоогоор 66 MB. Нэг ч файл 50 MB-аас том биш тул GitHub-ийн 100 MB-ийн хязгаарт багтсан.

---

## 2. Шалгагч хэрхэн ажилладаг

`judge/` доторх гурван wasm файл (binji/wasm-clang төрлийн схем):

| Файл | Хэмжээ | Үүрэг |
|---|---|---|
| `clang.wasm` | 31.2 MB | clang **8.0.1** компайлер (`wasm32-wasi`), C++ → объект файл |
| `lld.wasm` | 19.5 MB | LLVM линкер (wasm-ld), объект → `main.wasm` |
| `memfs.wasm` | 345 KB | Санах ой дахь хиймэл файлын систем (хөтөчид диск байхгүй) |

Нэмээд **sysroot** (libc, libc++, толгой файлууд, `crt1.o`) хэрэгтэй.

### Хөрвүүлэх ердийн дараалал

1. `memfs`-д sysroot-ийг задална.
2. Хэрэглэгчийн кодыг `main.cpp` болгон memfs-д бичнэ.
3. `clang -cc1 -triple wasm32-unknown-wasi ... -emit-obj` ажиллуулж `main.o` гаргана. Алдаа гарвал "Compilation Error".
4. `wasm-ld` ажиллуулж `main.wasm` гаргана.
5. `main.wasm`-ийг WASI shim-ээр ажиллуулна: `fd_read` нь тестийн оролтыг өгч, `fd_write` нь гаралтыг барина.
6. Гаралтыг хүлээгдэж буй хариутай харьцуулна.
7. Хугацааны хязгаарыг Web Worker-ийг `terminate()` хийж, санах ойн хязгаарыг `WebAssembly.Memory`-ийн `maximum`-оор хэрэгжүүлнэ.

> Тэмдэглэл: энэ дарааллыг `app.js` болон `judge/` доторх JS-ийг шууд уншиж баталгаажуулаагүй. Яг аргументыг тэдгээр файлаас шалгаарай.

### Хувилбарын хязгаарлалт

clang 8.0.1 нь 2019 оных.
- **C++11/14/17**: ажиллана (`-std=c++17`).
- **C++20**: бүрэн биш. `<bit>`, `std::span`, concepts, `<ranges>`, `std::format` хөрвөхгүй байж болно.
- `<bits/stdc++.h>` нь GCC-ийн толгой файл. libc++ sysroot-д байхгүй бол хөрвөхгүй. Турших код:

```cpp
#include <bits/stdc++.h>
using namespace std;
int main() {
    auto [a, b] = pair{3, 4};
    cout << a + b << "\n";
}
```

---

## 3. Локал дээр турших

`index.html`-ийг `file://` замаар (файлаа давхар дарж) нээвэл "Ачаалж байна…" дээр гацна. Шалтгаан: `<script type="module">` болон wasm-ийн `fetch` нь `file://` дээр хөтөчийн аюулгүй байдлын дүрмээр (CORS) блоклогддог.

**Шийдэл: локал HTTP сервер.**

```bash
cd ~/Downloads/onlinejudge_2026
python3 -m http.server 8000
```

Дараа нь хөтөч дээр `http://localhost:8000` нээнэ. Өөр сонголт: `npx serve`.

Гацвал **F12 → Console** дахь улаан алдааг харна.

---

## 4. Жишээ бодлогууд (шалгахад)

### A + B

Хоёр бүхэл тоо, |A|, |B| ≤ 10¹⁸. Нийлбэр 2·10¹⁸ хүртэл тул `long long` хэрэгтэй.

```cpp
#include <iostream>
using namespace std;

int main() {
    long long a, b;
    cin >> a >> b;
    cout << a + b << endl;
    return 0;
}
```

### Хамгийн их дэд массив (Кадэн)

N ≤ 2·10⁵, |aᵢ| ≤ 10⁹. Хариу 2·10¹⁴ хүртэл тул `long long`. `best`-ийг `0`-ээр эхлүүлж болохгүй (бүх тоо сөрөг байж болно).

```cpp
#include <iostream>
#include <algorithm>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;

    long long best, cur;
    cin >> best;
    cur = best;

    for (int i = 1; i < n; i++) {
        long long x;
        cin >> x;
        cur = max(x, cur + x);
        best = max(best, cur);
    }

    cout << best << "\n";
    return 0;
}
```

---

## 5. GitHub дээр репо үүсгэх

1. github.com дээр **New repository** дарна.
2. Нэр: `onlinejudge_2026`, **Public** сонгоно (үнэгүй хувилбарт Pages зөвхөн Public репо дээр ажиллана).
3. README, .gitignore, license-ийг **нэмэхгүй** (бол анхны push-д зөрчил гарч болно).

---

## 6. Git-ээр файлаа оруулах

### Анхны тохиргоо (нэг удаа)

```bash
git config --global user.name "Таны нэр"
git config --global user.email "таны@имэйл.com"
```

Үгүй бол `git commit` үед "Author identity unknown" алдаа гарна.

### Push хийхээс өмнө шалгах

```bash
du -sh .                                   # нийт хэмжээ
find . -size +50M -not -path "./.git/*"    # 50 MB-аас том файл (юу ч гарахгүй бол зүгээр)
ls problems tools                          # нууц зүйл байгаа эсэх
```

Репо **Public** тул `problems/` доторх нууц тест, зөв шийдэл, `tools/` доторх нууц үг хэн ч харна. Нууц зүйлийг `.gitignore`-д нэмнэ.

### Commit ба push

```bash
cd ~/Downloads/onlinejudge_2026
git init
git add .
git status          # юу орохыг шалгана
git commit -m "Сайтын бүх файл"
git branch -M main
git remote add origin https://github.com/dashdemberel2019/onlinejudge_2026.git
git push -u origin main
```

Хэрэв `git ls-files` дээр зөвхөн `README.md` гарвал (бусад файл `git add`-д орохгүй байсан бол) `git add .` хийгээд дахин commit, push хийнэ.

---

## 7. Нэвтрэлтийн асуудал, шийдэл

GitHub нь нууц үгээр push хийхийг зөвшөөрдөггүй. Хоёр арга бий.

### Асуудал 1: `403 Permission denied to <өөр хэрэглэгч>`

```
remote: Permission to dashdemberel2019/onlinejudge_2026.git denied to huslen978.
fatal: ... returned error: 403
```

Утга: git компьютер дээр хадгалагдсан **өөр бүртгэлийн** нэвтрэлтийг автоматаар ашиглаж байна, тэр бүртгэлд тухайн репод бичих эрх алга.

Шийдэл: зөв бүртгэлээр дахин нэвтэрнэ (доорх `gh` арга). Өөр хүний бүртгэлээр орох шаардлагагүй. Хамтран ажиллагчийг репод нэмэх бол репо → **Settings → Collaborators → Add people**.

### Арга А (санал болгох): `gh` CLI, токенгүй

```bash
sudo apt install gh        # суулгаагүй бол
gh auth login
```

Асуултууд:
1. **GitHub.com** → Enter
2. Protocol: **HTTPS** → Enter
3. Authenticate Git with your GitHub credentials? → **Y**
4. **Login with a web browser** → Enter
5. Терминалд 8 тэмдэгттэй код гарна. Enter дарж `https://github.com/login/device` нээгээд кодыг оруулж, **dashdemberel2019** бүртгэлээр **Authorize** дарна.

Шалгах:

```bash
gh auth status
```

`Logged in to github.com account dashdemberel2019` гарсан байх ёстой. Дараа нь:

```bash
gh auth setup-git      # git-ийг gh нэвтрэлт ашиглуулна
git push -u origin main
```

Амжилттай бол `* [new branch] main -> main` гарна.

### Арга Б: Personal Access Token

GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic). Scope: **repo**, хугацаа: 7 хоног.

```bash
git push https://dashdemberel2019@github.com/dashdemberel2019/onlinejudge_2026.git main
```

`Password for ...:` мөр гарсны **дараа л** токеноо буулгана (Ctrl+Shift+V). Буулгахад дэлгэц дээр юу ч харагдахгүй, энэ хэвийн.

**Түгээмэл алдаа:** `Password` мөр гарахаас өмнө товчлуур дарах, эсвэл токеныг командын мөрөнд буулгах. Тэгвэл токен дэлгэц дээр ил үлдэнэ.

### Токены аюулгүй байдал (чухал)

- Токеныг **чат, мессеж, зураг, дэлгэцийн хуулбар** дээр хэзээ ч бүү тавь. Ил гарсан бол шууд устгана.
- Устгах: github.com/settings/tokens → тухайн токен дээр **Delete**.
- Хамтарч ашигладаг серверт токены хугацааг богино (7 хоног) тавина.
- Terminal түүхийг цэвэрлэх: `history -c`.
- `gh` ашигласан тохиолдолд хуучин `ghp_...` токенууд хэрэггүй, бүгдийг нь устгана.

---

## 8. GitHub Pages асаах

1. Репо → **Settings → Pages**.
2. **Build and deployment → Source:** `Deploy from a branch`.
3. **Branch:** `main`, **Folder:** `/ (root)` → **Save**.
4. Репогийн **Actions** таб дээр "pages build and deployment" ногоон ✓ болтол хүлээнэ (ихэвчлэн 1-2 минут).
5. Сайт нээгдэнэ:

```
https://dashdemberel2019.github.io/onlinejudge_2026/
```

Хоосон эсвэл хуучин хуудас харагдвал `Ctrl+Shift+R`.

> Actions дээрх "Node.js 20 is deprecated" анхааруулга GitHub-ийн өөрийн action-ы тухай, сайтад нөлөөгүй.

### Хаягийн хэлбэр

```
https://<хэрэглэгчийн нэр>.github.io/<репогийн нэр>/
```

Богино хаяг хүсвэл:
- Репогийн нэрийг солих (Settings → General → Repository name), дараа нь `git remote set-url origin https://github.com/dashdemberel2019/<шинэ нэр>.git`.
- `dashdemberel2019.github.io` нэртэй тусгай репо үүсгэвэл сайт нэргүйгээр шууд `https://dashdemberel2019.github.io/` дээр гарна.
- Өөрийн домэйн (Settings → Pages → Custom domain).

---

## 9. Сайтыг шинэчлэх

Файл өөрчилсний дараа:

```bash
cd ~/Downloads/onlinejudge_2026
git add .
git commit -m "Тайлбар"
git push
```

Pages автоматаар дахин build хийнэ. Шинэ бодлого нэмэхдээ `problems/` хавтсанд нэмж (мөн жагсаалтын файлд бүртгэж) push хийнэ.

---

## 10. Гаднаас хандах, хязгаарлалт

- Pages интернэтэд нээлттэй. Репо Public бол хэн ч нэвтрэхгүйгээр нээнэ.
- Шалгагч хөтөч дотор ажилладаг тул таны серверт ачаалал өгөхгүй. Харин хэрэглэгч бүр анх нээхдээ ~58 MB татна, дараа нь хөтөч кэшлэнэ.
- GitHub Pages сард ойролцоогоор 100 GB дамжуулалтын зөвлөмж хязгаартай.
- Зөвхөн тодорхой хүмүүст нээлттэй болгох (private) нь GitHub Enterprise-д л байдаг. Тэр үед Netlify-ийн нууц үгтэй хамгаалалт гэх мэт өөр хостинг ашиглана.
- GitHub Pages нь custom HTTP header (COOP/COEP) өгдөггүй.

### Хэрэв шалгагч `SharedArrayBuffer` / `crossOriginIsolated` алдаа өгвөл

1. **Netlify** дээр байрлуулна (`netlify.toml` аль хэдийн байгаа): app.netlify.com → Add new site → Import from GitHub → энэ репо.
2. Эсвэл `coi-serviceworker.js` нэмж, `index.html`-ийн `<head>`-д хамгийн эхэнд `<script src="coi-serviceworker.js"></script>` оруулна.

Одоогийн байдлаар сайт ачаалж, бодлогын жагсаалт харагдсан. Шалгагч дээр код ажиллуулж, Console-д алдаа байгаа эсэхийг шалгах хэрэгтэй.

---

## 11. GitHub хэрэглэгчийн нэр солих (сонголт)

`dashdemberel2019` → `dashdemberel`:

1. github.com → профайл → **Settings → Account → Change username**.
2. Нэр завгүй бол "not available" гарна.

**Үр дагавар:**
- Pages хаяг `dashdemberel.github.io/onlinejudge_2026/` болж, хуучин хаяг **redirect хийхгүй**. Хуваалцсан холбоос ажиллахаа болино.
- Репо болон git remote түр хугацаанд redirect хийгдэнэ.

Сольсны дараа:

```bash
git remote set-url origin https://github.com/dashdemberel/onlinejudge_2026.git
gh auth status
```

Хаяг өөрчлөгдөхийг хүсэхгүй бол нэрийг солихгүй байх, зөвхөн хаягийг богиносгох бол репогийн нэрийг солих нь илүү хялбар.

---

## 12. Бонус: CMS (Contest Management System) нэвтрэлтийн лог

Өөр сервер дээр CMS ажиллуулж байхад хэрэглэгчийн IP харах оролдлого хийсэн. Дүгнэлт:

- Лог нь зөвхөн сервер дээр админ эрхтэй хүнд харагдана.
- Лог хавтсыг олох: `find / -name "ContestWebServer*" 2>/dev/null`, тохиргооны `log_dir`-ийг `cms.toml`-оос харна.
- Docker эсвэл systemd-ээр ажиллаж байвал `docker logs`, `journalctl`-ээр хайна.
- Хайх: `grep -r "хэрэглэгчийн_нэр" <лог_хавтас> | grep -i login`
- `log_dir` тохируулаагүй бол өмнөх нэвтрэлт хадгалагдаагүй байж болно.

---

## 13. Нэг дор: дахин хийх товч checklist

- [ ] Сайтын хавтас бэлэн (`index.html`, `app.js`, `vendor/`, `judge/`, `problems/`)
- [ ] Локал сервер дээр турш: `python3 -m http.server 8000`
- [ ] GitHub дээр хоосон **Public** репо үүсгэсэн
- [ ] `git config user.name / user.email` тохируулсан
- [ ] `gh auth login` хийж `gh auth status` дээр зөв бүртгэл харагдсан
- [ ] `git add . && git commit && git push -u origin main`
- [ ] `git ls-files` дээр бүх файл орсныг шалгасан
- [ ] Settings → Pages → `main` / `/ (root)` → Save
- [ ] Actions дээр deploy ногоон болсон
- [ ] Сайтыг нээж, бодлого дээр код ажиллуулж шалгасан
- [ ] Ил гарсан бүх `ghp_...` токеныг устгасан
- [ ] `problems/` доторх нууц зүйлийг шалгасан

---

## 14. Алдааны хураангуй

| Алдаа | Шалтгаан | Шийдэл |
|---|---|---|
| "Ачаалж байна…" дээр гацна | `file://` замаар нээсэн | `python3 -m http.server 8000` |
| `403 denied to huslen978` | git өөр бүртгэлийн нэвтрэлт ашиглаж байна | `gh auth login` зөв бүртгэлээр, `gh auth setup-git` |
| Push дээр "удаж байна" | Git Password хүлээж байна | Password мөр гарсны дараа токен буулгах, эсвэл `gh` ашиглах |
| `Author identity unknown` | git user тохируулаагүй | `git config --global user.name / user.email` |
| Push болсон ч сайт хоосон | Зөвхөн README орсон | `git ls-files` шалгаад `git add .` дахин |
| Pages 404 | Pages асаагаагүй, эсвэл репо Private | Settings → Pages, репог Public болго |
| Хуучин хуудас харагдана | Хөтөчийн кэш | `Ctrl+Shift+R` |
| `SharedArrayBuffer` алдаа | COOP/COEP header дутуу | Netlify эсвэл `coi-serviceworker.js` |
| C++20 код хөрвөхгүй | clang 8.0.1 хуучин | `-std=c++17` хүртэл ашиглах |
| `bits/stdc++.h not found` | libc++ sysroot-д байхгүй | Толгой файлыг sysroot-д нэмэх, эсвэл тусад нь include бичих |
