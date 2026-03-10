with open("admin.html") as f:
    lines = f.readlines()

cnt=0
for i in range(283, 582):  # lines 284 to 582
    line = lines[i]
    vc = line.count("<div") - line.count("</div")
    cnt += vc
    print(f"{i+1}: {cnt} | {line.strip()}")
