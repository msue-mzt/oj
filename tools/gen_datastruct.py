#!/usr/bin/env python3
"""
"Өгөгдлийн бүтэц" бүлгийн (10.1–11.6) бодлогуудыг problems/ дотор үүсгэнэ:
statement.md, problem.json, tests/NN.in + NN.out (хариуг жишиг шийдлээр бодно).

Хэрэглээ:  python3 tools/gen_datastruct.py && python3 tools/build_index.py
Санамсаргүй тоо тогтмол seed-тэй тул дахин ажиллуулахад ижил тест гарна.
"""
import heapq, json, os, random, string

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROB = os.path.join(ROOT, 'problems')


def join(a):
    return ' '.join(map(str, a))


# ---------------- жишиг шийдлүүд ----------------
def sol_even(inp):
    t = inp.split(); n = int(t[0]); a = [int(x) for x in t[1:1 + n]]
    e = [x for x in a if x % 2 == 0]
    return join(e) if e else '-1'


def sol_unique(inp):
    t = inp.split(); n = int(t[0]); a = [int(x) for x in t[1:1 + n]]
    r = [x for i, x in enumerate(a) if i == 0 or x != a[i - 1]]
    return join(r)


def sol_points(inp):
    t = inp.split(); n = int(t[0])
    p = sorted((int(t[1 + 2 * i]), int(t[2 + 2 * i])) for i in range(n))
    return '\n'.join(f'{x} {y}' for x, y in p)


def sol_merge(inp):
    t = list(map(int, inp.split())); n = t[0]; a = t[1:1 + n]; m = t[1 + n]; b = t[2 + n:2 + n + m]
    return join(sorted(a + b))


def sol_medals(inp):
    t = inp.split(); n = int(t[0]); rows = []
    for i in range(n):
        name, g, s, b = t[1 + 4 * i:5 + 4 * i]
        rows.append((name, int(g), int(s), int(b)))
    rows.sort(key=lambda r: (-r[1], -r[2], -r[3], r[0]))
    return '\n'.join(f'{a} {b} {c} {d}' for a, b, c, d in rows)


def sol_josephus(inp):
    n, k = map(int, inp.split()); j = 0
    for m in range(1, n):
        j = (j + k) % (m + 1)
    return str(j + 1)


def sol_distinct(inp):
    t = inp.split(); n = int(t[0])
    return str(len(set(t[1:1 + n])))


def sol_brackets(inp):
    s = inp.strip(); st = []; pair = {')': '(', ']': '[', '}': '{'}
    for c in s:
        if c in '([{':
            st.append(c)
        elif not st or st.pop() != pair[c]:
            return 'NO'
    return 'NO' if st else 'YES'


def sol_words(inp):
    t = inp.split(); n = int(t[0]); cnt = {}
    for w in t[1:1 + n]:
        cnt[w] = cnt.get(w, 0) + 1
    return '\n'.join(f'{w} {cnt[w]}' for w in sorted(cnt))


def sol_next_greater(inp):
    t = list(map(int, inp.split())); n = t[0]; h = t[1:1 + n]
    res = [-1] * n; st = []
    for i in range(n - 1, -1, -1):
        while st and st[-1] <= h[i]:
            st.pop()
        res[i] = st[-1] if st else -1
        st.append(h[i])
    return join(res)


def sol_ropes(inp):
    t = list(map(int, inp.split())); n = t[0]; q = t[1:1 + n]
    heapq.heapify(q); tot = 0
    while len(q) > 1:
        a = heapq.heappop(q); b = heapq.heappop(q); tot += a + b; heapq.heappush(q, a + b)
    return str(tot)


def sol_histogram(inp):
    t = list(map(int, inp.split())); n = t[0]; h = t[1:1 + n] + [0]
    st = []; best = 0
    for i, x in enumerate(h):
        start = i
        while st and st[-1][1] >= x:
            j, y = st.pop(); best = max(best, y * (i - j)); start = j
        st.append((start, x))
    return str(best)


# ---------------- тест үүсгэгчид ----------------
def arr_test(n, lo, hi, R):
    return f'{n}\n{join(R.randint(lo, hi) for _ in range(n))}\n'


def gen_even(R):
    yield '6\n3 8 5 12 7 0\n'
    yield '3\n1 3 5\n'
    yield '1\n4\n'
    yield '1\n7\n'
    yield arr_test(10, 0, 20, R)
    yield arr_test(1000, 0, 10**9, R)
    yield f'20000\n{join(2 * R.randint(0, 5 * 10**8) + 1 for _ in range(20000))}\n'
    yield f'20000\n{join(2 * R.randint(0, 5 * 10**8) for _ in range(20000))}\n'
    yield arr_test(20000, 0, 10**9, R)
    yield arr_test(20000, 0, 3, R)


def gen_unique(R):
    def t(n, lo, hi):
        return f'{n}\n{join(sorted(R.randint(lo, hi) for _ in range(n)))}\n'
    yield '8\n1 1 2 3 3 3 5 8\n'
    yield '4\n-2 -2 -2 -2\n'
    yield '1\n0\n'
    yield '5\n-5 -1 0 4 9\n'
    yield t(20, -5, 5)
    yield t(1000, -10**9, 10**9)
    yield t(20000, -10, 10)
    yield t(20000, -10**9, 10**9)
    yield f'20000\n{join([10**9] * 20000)}\n'
    yield t(20000, -1000, 1000)


def gen_points(R):
    def t(n, c):
        return f'{n}\n' + ''.join(f'{R.randint(-c, c)} {R.randint(-c, c)}\n' for _ in range(n))
    yield '5\n3 1\n1 2\n3 -4\n1 1\n-2 5\n'
    yield '1\n0 0\n'
    yield '4\n2 2\n2 2\n2 1\n2 3\n'
    yield t(10, 3)
    yield t(100, 10**9)
    yield t(10000, 5)
    yield t(10000, 100)
    yield t(10000, 10**9)
    yield '10000\n' + ''.join(f'{R.choice([-10**9, 10**9])} {R.randint(-10**9, 10**9)}\n' for _ in range(10000))
    yield t(10000, 10**9)


def gen_merge(R):
    def t(n, m, hi):
        a = sorted(R.randint(0, hi) for _ in range(n)); b = sorted(R.randint(0, hi) for _ in range(m))
        return f'{n}\n{join(a)}\n{m}\n{join(b)}\n'
    yield '3\n1 4 9\n4\n2 3 9 10\n'
    yield '1\n5\n1\n5\n'
    yield '2\n1 2\n3\n7 8 9\n'
    yield '3\n100 200 300\n1\n0\n'
    yield t(10, 10, 20)
    yield t(1000, 5, 10**9)
    yield t(20000, 20000, 10**9)
    yield t(20000, 20000, 5)
    yield t(1, 20000, 10**9)
    yield f'20000\n{join(range(0, 40000, 2))}\n20000\n{join(range(1, 40000, 2))}\n'


def gen_medals(R):
    def names(n):
        s = set()
        while len(s) < n:
            s.add(''.join(R.choice(string.ascii_uppercase) for _ in range(R.randint(1, 8))))
        return list(s)

    def t(n, c):
        return f'{n}\n' + ''.join(f'{w} {R.randint(0, c)} {R.randint(0, c)} {R.randint(0, c)}\n' for w in names(n))
    yield '5\nMONGOLIA 3 2 1\nJAPAN 3 2 4\nKOREA 5 0 0\nCHINA 3 2 1\nUSA 0 9 9\n'
    yield '1\nA 0 0 0\n'
    yield '3\nC 0 0 0\nB 0 0 0\nA 0 0 0\n'
    yield t(10, 2)
    yield t(50, 100)
    yield t(2000, 1)
    yield t(2000, 3)
    yield t(2000, 100)
    yield '2000\n' + ''.join(f'{w} 7 7 7\n' for w in names(2000))
    yield t(2000, 10)


def gen_josephus(R):
    yield '5 2\n'
    yield '7 3\n'
    yield '1 1\n'
    yield '1 1000000\n'
    yield '10 1\n'
    yield '1000 7\n'          # дэд бодлого 1: n ≤ 1000
    yield '1000 1000000\n'
    yield f'{R.randint(500, 1000)} {R.randint(1, 1000)}\n'
    yield '1000000 1\n'
    yield '1000000 2\n'
    yield '1000000 1000000\n'
    yield f'{R.randint(900000, 1000000)} {R.randint(1, 1000000)}\n'


def gen_distinct(R):
    yield '7\n15 3 15 8 3 15 42\n'
    yield '1\n1\n'
    yield '5\n9 9 9 9 9\n'
    yield arr_test(20, 1, 10, R)
    yield arr_test(1000, 1, 10**9, R)
    yield arr_test(50000, 1, 100, R)
    yield arr_test(50000, 1, 30000, R)
    yield arr_test(50000, 1, 10**9, R)
    yield f'50000\n{join(range(1, 50001))}\n'
    yield f'50000\n{join([10**9] * 50000)}\n'


def gen_brackets(R):
    def balanced(n):  # n — хосын тоо
        out = []; st = []; opens = n
        while opens or st:
            if opens and (not st or R.random() < 0.5):
                c = R.choice('([{'); out.append(c); st.append(c); opens -= 1
            else:
                out.append({'(': ')', '[': ']', '{': '}'}[st.pop()])
        return ''.join(out)

    def break_one(s):
        s = list(s); i = R.randrange(len(s))
        s[i] = R.choice([c for c in '()[]{}' if c != s[i]])
        return ''.join(s)
    yield '([]{()})\n'
    yield '([)]\n'
    yield '(\n'
    yield ')(\n'
    yield '{}[]()\n'
    yield '((((\n'
    yield balanced(10) + '\n'
    yield break_one(balanced(500)) + '\n'
    yield balanced(25000) + '\n'
    yield break_one(balanced(25000)) + '\n'
    yield '(' * 25000 + ')' * 25000 + '\n'
    yield '(' * 25000 + ')' * 24999 + ']' + '\n'
    yield balanced(24999) + '[' + '\n'
    yield ''.join(R.choice('()[]{}') for _ in range(50000)) + '\n'


def gen_words(R):
    def t(n, k, L):
        voc = list({''.join(R.choice(string.ascii_lowercase[:L]) for _ in range(R.randint(1, 10))) for _ in range(k)})
        w = [R.choice(voc) for _ in range(n)]
        lines = [' '.join(w[i:i + 20]) for i in range(0, n, 20)]
        return f'{n}\n' + '\n'.join(lines) + '\n'
    yield '8\nthe cat and the dog\nand the bird\n'
    yield '1\na\n'
    yield '4\nb a b a\n'
    yield t(30, 5, 3)
    yield t(1000, 100, 26)
    yield t(50000, 10, 26)
    yield t(50000, 5000, 26)
    yield t(50000, 50000, 26)
    yield t(50000, 3000, 2)
    yield f'50000\n' + '\n'.join(['zzzzzzzzzz'] * 50000) + '\n'


def gen_next_greater(R):
    yield '6\n4 2 7 3 3 8\n'
    yield '1\n5\n'
    yield '4\n3 3 3 3\n'
    yield '5\n1 2 3 4 5\n'
    yield '5\n5 4 3 2 1\n'
    yield arr_test(1000, 1, 10**9, R)        # дэд бодлого 1: n ≤ 1000
    yield arr_test(1000, 1, 5, R)
    yield f'1000\n{join(range(1000, 0, -1))}\n'
    yield arr_test(50000, 1, 10**9, R)
    yield arr_test(50000, 1, 10, R)
    yield f'50000\n{join(range(50000, 0, -1))}\n'
    yield f'50000\n{join([10**9 - i % 2 for i in range(50000)])}\n'
    yield f'50000\n{join(list(range(49999, 0, -1)) + [10**9])}\n'


def gen_ropes(R):
    yield '4\n4 3 2 6\n'
    yield '1\n100\n'
    yield '2\n5 7\n'
    yield '5\n1 1 1 1 1\n'
    yield arr_test(20, 1, 100, R)
    yield arr_test(1000, 1, 10**9, R)
    yield arr_test(50000, 1, 10**9, R)
    yield f'50000\n{join([10**9] * 50000)}\n'
    yield arr_test(50000, 1, 10, R)
    yield f'50000\n{join(range(1, 50001))}\n'


def gen_histogram(R):
    yield '7\n2 1 4 5 1 3 3\n'
    yield '1\n1000000000\n'
    yield '5\n3 3 3 3 3\n'
    yield '6\n1 2 3 4 5 6\n'
    yield arr_test(1000, 1, 10**9, R)        # дэд бодлого 1: n ≤ 1000
    yield arr_test(1000, 1, 10, R)
    yield f'1000\n{join(range(1000, 0, -1))}\n'
    yield arr_test(100000, 1, 10**9, R)
    yield arr_test(100000, 1, 100, R)
    yield f'100000\n{join([10**9] * 100000)}\n'
    yield f'100000\n{join(range(1, 100001))}\n'
    yield f'100000\n{join(min(i, 100001 - i) * 10000 for i in range(1, 100001))}\n'


# ---------------- өгүүлбэрүүд ----------------
PROBLEMS = [
    dict(id='ds-10-1', title='Тэгш дугаартай тасалбар', stars=1, tags=['vector'], sol=sol_even, gen=gen_even, samples=['01', '02'],
         st=r'''Хонжворт сугалаанд зөвхөн тэгш дугаартай тасалбар хожно. $n$ тасалбарын дугаар өгөгдөнө. Хожсон тасалбаруудын дугаарыг өгөгдсөн дарааллаар нь хэвлэ. Хожсон тасалбар нэг ч байхгүй бол `-1` хэвлэ.

## Оролт

Эхний мөрөнд $n$ $(1 \le n \le 2 \cdot 10^4)$. Хоёр дахь мөрөнд $n$ бүхэл тоо $a_i$ $(0 \le a_i \le 10^9)$.

## Гаралт

Тэгш дугааруудыг зайгаар тусгаарлан хэвлэ, эсвэл `-1`.

## Зөвлөгөө

Тэгш тоонуудыг `vector<int>`-д `push_back` хийж хадгалаад, эцэст нь хоосон эсэхийг `empty()`-ээр шалга.
'''),
    dict(id='ds-10-2', title='Давхардалгүй жагсаалт', stars=1, tags=['vector', 'unique'], sol=sol_unique, gen=gen_unique, samples=['01', '02'],
         st=r'''Ангийн сурагчид дуртай тоогоо бичихэд зарим тоо давхардсан байв. Багш тоонуудыг өсөх дарааллаар эрэмбэлсэн жагсаалтаас давхардлыг арилгамаар байна.

Өсөх (буурахгүй) дарааллаар эрэмбэлэгдсэн $n$ тоо өгөгдөнө. Ялгаатай тоонуудыг өсөх дарааллаар, тус бүрийг нэг удаа хэвлэ.

## Оролт

Эхний мөрөнд $n$ $(1 \le n \le 2 \cdot 10^4)$. Хоёр дахь мөрөнд буурахгүй дарааллаар $n$ бүхэл тоо $(|a_i| \le 10^9)$.

## Гаралт

Ялгаатай тоонуудыг зайгаар тусгаарлан хэвлэ.

## Зөвлөгөө

`v.erase(unique(v.begin(), v.end()), v.end());` эсвэл өмнөх тооноос ялгаатай үед л хэвлэ.
'''),
    dict(id='ds-10-3', title='Газрын зураг дээрх цэгүүд', stars=2, tags=['sort', 'pair'], sol=sol_points, gen=gen_points, samples=['01'],
         st=r'''Хайгуулчид $n$ цэгт газрын дээж авсан. Цэгүүдийг эхлээд $x$ координатаар өсөхөөр, $x$ нь тэнцүү бол $y$ координатаар өсөхөөр эрэмбэлж хэвлэ.

## Оролт

Эхний мөрөнд $n$ $(1 \le n \le 10^4)$. Дараагийн $n$ мөрөнд цэгийн координат $x$ $y$ $(|x|, |y| \le 10^9)$.

## Гаралт

Эрэмбэлсэн цэгүүд, мөр бүрт нэг цэг.

## Зөвлөгөө

`vector<pair<int,int>>`-ийг `sort` хийхэд яг ийм дарааллаар эрэмбэлэгддэг.
'''),
    dict(id='ds-10-4', title='Хоёр эгнээ', stars=2, tags=['merge', 'хоёр заагч'], sol=sol_merge, gen=gen_merge, samples=['01'],
         st=r'''Хоёр ангийн сурагчид тус тусдаа өндрөөрөө өсөх дарааллаар эгнээнд зогсож байна. Тэднийг нэг эгнээ болгож, мөн өндрөөр өсөх дарааллаар жагсаа.

Хамгийн сайн шийдэл нь хоёр эгнээний эхнээс зэрэг алхаж, бага нь эхэлж ордог "нийлүүлэх" арга юм.

## Оролт

Эхний мөрөнд $n$, дараагийн мөрөнд $n$ тоо. Дараагийн мөрөнд $m$, дараагийн мөрөнд $m$ тоо. $(1 \le n, m \le 2 \cdot 10^4)$, тоонууд $0$-ээс $10^9$, эгнээ тус бүр буурахгүй дарааллаар өгөгдөнө.

## Гаралт

Нийлүүлсэн $n + m$ тоог зайгаар тусгаарлан хэвлэ.
'''),
    dict(id='ds-10-5', title='Медалийн хүснэгт', stars=3, tags=['sort', 'struct', 'comparator'], sol=sol_medals, gen=gen_medals, samples=['01'],
         st=r'''Олон улсын олимпиадын дараа улс орнуудыг медалиар нь эрэмбэлдэг. Дүрэм:

1. Алтан медаль олонтой нь дээр.
2. Алт тэнцүү бол мөнгөн медаль олонтой нь дээр.
3. Мөнгө ч тэнцүү бол хүрэл медаль олонтой нь дээр.
4. Бүгд тэнцүү бол улсын нэрээр цагаан толгойн дарааллаар.

Улсуудыг энэ дүрмээр эрэмбэлж хэвлэ.

## Оролт

Эхний мөрөнд $n$ $(1 \le n \le 2000)$. Дараагийн $n$ мөрөнд: улсын нэр (том латин үсэг, давхардахгүй), алт, мөнгө, хүрэл медалийн тоо ($0$-ээс $100$).

## Гаралт

Эрэмбэлсэн жагсаалт, мөр бүрт `НЭР алт мөнгө хүрэл`.

## Зөвлөгөө

Өөрийн харьцуулах функц бич: `bool cmp(const Country &a, const Country &b)` нь `a` нь `b`-ээс өмнө орох ёстой үед `true` буцаана.
'''),
    dict(id='ds-10-6', title='Тойргоос гарах тоглоом', stars=4, tags=['математик', 'Иосифын бодлого'], sol=sol_josephus, gen=gen_josephus, samples=['01', '02'],
         subtasks=[(40, 'n ≤ 1000', 8), (60, 'n ≤ 10⁶', 12)],
         st=r'''$n$ хүүхэд тойрог хэлбэрээр зогсож, цагийн зүүний дагуу $1$-ээс $n$ хүртэл дугаарлагджээ. $1$-р хүүхдээс эхлэн тоолж эхэлнэ: $1, 2, \dots, k$ гэж тоолоход $k$-д таарсан хүүхэд тойргоос гарна. Дараагийн хүүхдээс эхлэн дахин $1$-ээс тоолно. Ганц хүүхэд үлдтэл үргэлжилнэ.

Сүүлд үлдэх хүүхдийн дугаарыг ол.

## Оролт

Хоёр бүхэл тоо $n$, $k$ $(1 \le n, k \le 10^6)$.

## Гаралт

Үлдэх хүүхдийн дугаар.

## Дэд бодлого

| № | Оноо | Нөхцөл |
|---|------|--------|
| 1 | 40 | $n \le 1000$ |
| 2 | 60 | Нэмэлт хязгаарлалтгүй |

## Зөвлөгөө

Хүүхдүүдийг vector-оос нэг нэгээр нь `erase` хийх нь $n = 10^6$ үед хэт удаан.

Хүүхдүүдийг $0$-ээс дугаарласан гэж үзье. Хэрэв $m$ хүүхэдтэй тойрогт үлдэх хүүхэд нь $J(m)$ бол $m + 1$ хүүхэдтэй тойрогт $J(m + 1) = (J(m) + k) \bmod (m + 1)$ байна. $J(1) = 0$.
'''),
    dict(id='ds-11-1', title='Ялгаатай зочид', stars=1, tags=['set'], sol=sol_distinct, gen=gen_distinct, samples=['01'],
         st=r'''Музейн хаалган дээр орж ирсэн зочин бүрийн картын дугаарыг бүртгэдэг. Нэг хүн өдөрт хэд хэдэн удаа орж гарч болно. Өнөөдөр хэдэн **ялгаатай** хүн ирснийг ол.

## Оролт

Эхний мөрөнд $n$ $(1 \le n \le 5 \cdot 10^4)$. Хоёр дахь мөрөнд $n$ картын дугаар $(1 \le a_i \le 10^9)$.

## Гаралт

Ялгаатай дугаарын тоо.

## Зөвлөгөө

`set<int>`-д бүгдийг хийгээд `size()`-ийг хэвлэ.
'''),
    dict(id='ds-11-2', title='Хаалтын тэнцвэр', stars=1, tags=['stack'], sol=sol_brackets, gen=gen_brackets, samples=['01', '02'],
         st=r'''Программ бичихэд хаалт бүр зөв хаагдсан байх ёстой. `()[]{}` тэмдэгтүүдээс тогтох мөр өгөгдөнө. Мөр зөв бол `YES`, буруу бол `NO` гэж хэвлэ.

Зөв гэдэг нь:

- нээх хаалт бүр ижил төрлийн хаах хаалтаар хаагдсан,
- хаалтууд зөв дарааллаар (дотор талынх нь эхэлж) хаагдсан,
- илүү хаалт байхгүй.

## Оролт

Нэг мөр (урт нь $1$-ээс $5 \cdot 10^4$), зөвхөн `()[]{}` тэмдэгтүүдтэй.

## Гаралт

`YES` эсвэл `NO`.

## Зөвлөгөө

Нээх хаалтыг `stack`-д хий. Хаах хаалт ирэхэд стекийн орой түүнд тохирох нээх хаалт байх ёстой. Төгсгөлд нь стек хоосон байх ёстой.
'''),
    dict(id='ds-11-3', title='Үгийн тоолуур', stars=2, tags=['map', 'string'], sol=sol_words, gen=gen_words, samples=['01'],
         st=r'''Зохиолчийн шинэ номонд ямар үг хэдэн удаа орсныг тоолох хэрэгтэй. $n$ үг өгөгдөнө. Ялгаатай үг бүрийг цагаан толгойн дарааллаар, хэдэн удаа орсныг нь хамт хэвлэ.

## Оролт

Эхний мөрөнд $n$ $(1 \le n \le 5 \cdot 10^4)$. Дараа нь $n$ үг (жижиг латин үсэг, урт нь $1$-ээс $10$), хоосон зай эсвэл шинэ мөрөөр тусгаарлагдсан.

## Гаралт

Мөр бүрт `үг тоо`.

## Зөвлөгөө

`map<string,int> cnt; cnt[w]++;` — `map` нь түлхүүрээ автоматаар эрэмбэлж хадгалдаг.
'''),
    dict(id='ds-11-4', title='Илүү өндөр хөрш', stars=2, tags=['stack', 'монотон стек'], sol=sol_next_greater, gen=gen_next_greater, samples=['01'],
         subtasks=[(40, 'n ≤ 1000', 8), (60, 'n ≤ 5·10⁴', 13)],
         st=r'''Гудамжны нэг талд $n$ байшин эгнэн зогсож байна. Байшин бүрийн хувьд баруун талд нь байгаа байшингуудаас **анх таарах илүү өндөр** байшингийн өндрийг ол. Ийм байшин байхгүй бол `-1`.

## Оролт

Эхний мөрөнд $n$ $(1 \le n \le 5 \cdot 10^4)$. Хоёр дахь мөрөнд $n$ бүхэл тоо $h_i$ $(1 \le h_i \le 10^9)$.

## Гаралт

$n$ тоо — байшин бүрийн хариу.

## Дэд бодлого

| № | Оноо | Нөхцөл |
|---|------|--------|
| 1 | 40 | $n \le 1000$ |
| 2 | 60 | Нэмэлт хязгаарлалтгүй |

## Зөвлөгөө

Давхар давталт $O(n^2)$ — удаан. Баруунаас зүүн тийш явж, "хариу болж магадгүй" байшингуудыг стекд хадгал: одоогийн байшингаас намхан эсвэл тэнцүүг стекээс гарга, тэгвэл стекийн орой нь хариу болно.
'''),
    dict(id='ds-11-5', title='Олс залгах', stars=3, tags=['priority_queue', 'шунахай'], sol=sol_ropes, gen=gen_ropes, samples=['01'],
         st=r'''Майханд хэрэглэх $n$ ширхэг олс байна. Тэдгээрийг бүгдийг нь залгаж нэг урт олс болгох хэрэгтэй. Нэг удаад хоёр олсыг залгана. Урт нь $a$ ба $b$ олсыг залгахад $a + b$ минут зарцуулна, үр дүнд нь урт нь $a + b$ олс гарна.

Бүгдийг нэг олс болгоход зарцуулах хамгийн бага хугацааг ол.

## Оролт

Эхний мөрөнд $n$ $(1 \le n \le 5 \cdot 10^4)$. Хоёр дахь мөрөнд $n$ олсны урт $(1 \le l_i \le 10^9)$.

## Гаралт

Хамгийн бага хугацаа (минутаар).

## Зөвлөгөө

Үргэлж хамгийн богино хоёр олсыг залгах нь хамгийн ашигтай. Хамгийн богиног хурдан олохын тулд `priority_queue<long long, vector<long long>, greater<long long>>`. Хариу `long long`-д багтана.
'''),
    dict(id='ds-11-6', title='Хамгийн том зурагт хуудас', stars=4, tags=['stack', 'монотон стек'], sol=sol_histogram, gen=gen_histogram, samples=['01'],
         subtasks=[(30, 'n ≤ 1000', 7), (70, 'n ≤ 10⁵', 12)],
         st=r'''Хотын төвд $n$ байшин зэрэгцэн зогсдог. Байшин бүрийн өргөн $1$ метр, өндөр нь $h_i$ метр. Байшингуудын нүүрэн дээр нэг том тэгш өнцөгт зурагт хуудас наах гэж байна. Хуудас доод ирмэгээрээ газарт тулж, хэд хэдэн **зэргэлдээ** байшинг хамарна. Хуудас аль ч байшингийн оройгоос дээш гарч болохгүй.

Хуудасны хамгийн их талбайг ол.

## Оролт

Эхний мөрөнд $n$ $(1 \le n \le 10^5)$. Хоёр дахь мөрөнд $n$ бүхэл тоо $h_i$ $(1 \le h_i \le 10^9)$.

## Гаралт

Хамгийн их талбай. Хариу $10^{14}$ хүрч болох тул `long long` ашигла.

## Дэд бодлого

| № | Оноо | Нөхцөл |
|---|------|--------|
| 1 | 30 | $n \le 1000$ |
| 2 | 70 | Нэмэлт хязгаарлалтгүй |

## Зөвлөгөө

Байшин бүрийн хувьд: түүнээс намхан хамгийн ойр байшин зүүн, баруун талд нь хаана байна вэ? Энэ хоёр хязгаарын хоорондох өргөнийг тухайн байшингийн өндрөөр үржүүлбэл нэг нэр дэвшигч хариу гарна. Хязгааруудыг монотон стекээр $O(n)$-д олно.
'''),
]

LEVEL = {1: 'Хялбар', 2: 'Хялбар', 3: 'Дунд', 4: 'Хэцүү'}


def main():
    for p in PROBLEMS:
        d = os.path.join(PROB, p['id']); td = os.path.join(d, 'tests')
        os.makedirs(td, exist_ok=True)
        for f in os.listdir(td):
            os.remove(os.path.join(td, f))
        R = random.Random(p['id'])
        names = []
        for i, inp in enumerate(p['gen'](R), 1):
            name = f'{i:02d}'; names.append(name)
            with open(os.path.join(td, name + '.in'), 'w') as fh:
                fh.write(inp)
            with open(os.path.join(td, name + '.out'), 'w') as fh:
                fh.write(p['sol'](inp) + '\n')
        meta = {
            'title': p['title'], 'tl': 1.0, 'ml': 256,
            'level': LEVEL[p['stars']], 'tags': p['tags'],
            'checker': 'tokens', 'samples': p['samples'],
        }
        if 'subtasks' in p:
            meta['subtasks'] = [{'score': sc, 'name': nm, 'tests': names[:upto]} for sc, nm, upto in p['subtasks']]
        with open(os.path.join(d, 'problem.json'), 'w', encoding='utf-8') as fh:
            json.dump(meta, fh, ensure_ascii=False, indent=2); fh.write('\n')
        with open(os.path.join(d, 'statement.md'), 'w', encoding='utf-8') as fh:
            fh.write(p['st'])
        print(f"{p['id']}: {len(names)} тест")


if __name__ == '__main__':
    main()
