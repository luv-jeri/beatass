import json, sys
a = json.load(open(sys.argv[1]))
chars, st, en = a["characters"], a["character_start_times_seconds"], a["character_end_times_seconds"]
words, cur = [], None
for c, s, e in zip(chars, st, en):
    if c.isspace():
        if cur: words.append(cur); cur = None
        continue
    if cur is None: cur = {"word": c, "start": round(s, 3), "end": round(e, 3)}
    else: cur["word"] += c; cur["end"] = round(e, 3)
if cur: words.append(cur)
json.dump(words, open(sys.argv[2], "w"), indent=1)
print(f"{len(words)} words, last ends {words[-1]['end']}s")
for w in words:
    if w["word"][-1] in ".?!," and w["word"] != ",": print(f"  {w['word']:<16} ends {w['end']}")
