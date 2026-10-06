"""안전 영역 검사 (개발 서버 필요: pnpm dev → http://127.0.0.1:3200)

    python3 tests/slide_safe.py

템플릿 × 서비스 테마 × 최대 길이(space: 띄어쓰기 있는 한글 / nospace: 넓은 영문 / lines: 줄바꿈까지 / chips: 쉼표 낱말 6개 칩)와 24자 워드마크를
사진 없이 렌더하고, 안전 영역 밖에 바탕색이 아닌 픽셀이 하나라도 있으면 실패.
안전 영역 값은 src/lib/render/kit.tsx SAFE 와 같다. 칸 길이·글꼴·템플릿을 바꾸면 꼭 다시 돌린다.
"""
import io
import json
import pathlib
import sys
import urllib.error
import urllib.request

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
import os
BASE = os.environ.get("STUDIO_URL", "http://127.0.0.1:3200") + "/api/fixture/{ws}/{tpl}/{v}/{n}"
TEMPLATES = ["magazine", "intro", "interview", "news", "poster", "reel"]  # src/lib/templates/index.ts
FEED = (60, 175, 1020, 1175)
COVER = (175, 175, 905, 1175)
REEL = (60, 250, 940, 1540)  # 1080×1920 릴스 (대략)

workspaces = [w["id"] for w in json.loads((ROOT / "data" / "studio.json").read_text())["workspaces"]]
fails = 0
for ws in workspaces:
    for tpl in TEMPLATES:
        for v in ("space", "nospace", "lines", "chips"):  # src/lib/fields.ts FIXTURE_VARIANTS
            n = 1
            while True:
                try:
                    data = urllib.request.urlopen(BASE.format(ws=ws, tpl=tpl, v=v, n=n)).read()
                except urllib.error.HTTPError:
                    break
                im = Image.open(io.BytesIO(data)).convert("RGB")
                assert im.size in ((1080, 1350), (1080, 1920)), im.size
                W, H = im.size
                bg = im.getpixel((2, 2))
                x0, y0, x1, y1 = REEL if H == 1920 else COVER if n == 1 else FEED
                px = im.load()
                bad = sum(
                    1
                    for y in range(0, H, 2)
                    for x in range(0, W, 2)
                    if not (x0 <= x < x1 and y0 <= y < y1) and max(abs(a - b) for a, b in zip(px[x, y], bg)) > 24
                )
                fails += 1 if bad else 0
                print(f"{'FAIL' if bad else 'OK  '} {ws} {tpl} {v} slide {n}  outside-safe pixels: {bad}")
                if bad:
                    im.save(f"/tmp/card-studio-fail-{ws}-{tpl}-{v}-{n}.png")
                n += 1
print("slide safe-zone fails:", fails)
sys.exit(1 if fails else 0)
