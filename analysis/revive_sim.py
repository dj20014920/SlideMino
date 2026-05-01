#!/usr/bin/env python3
"""SlideMino Revive Simulation (lightweight, fast)"""
import random, copy, time, math
from collections import Counter

SHAPES = {
    'I': [(-1,0),(0,0),(1,0),(2,0)],
    'O': [(0,0),(1,0),(0,1),(1,1)],
    'T': [(-1,0),(0,0),(1,0),(0,1)],
    'S': [(0,0),(1,0),(-1,1),(0,1)],
    'Z': [(-1,0),(0,0),(0,1),(1,1)],
    'J': [(-1,0),(0,0),(1,0),(1,1)],
    'L': [(-1,0),(0,0),(1,0),(-1,1)],
}
STD = list(SHAPES.keys())
DIRS = ['LEFT','RIGHT','UP','DOWN']
DESTROY = {4:3, 5:4, 7:6, 8:7, 10:9}
N = 150
MAX_T = 500

# Precompute rotations
ROTS = {}
for nm, cells in SHAPES.items():
    ROTS[nm] = []
    for r in range(4):
        rc = list(cells)
        for _ in range(r): rc = [(-y, x) for (x, y) in rc]
        ROTS[nm].append(rc)

def empty(sz):
    return [[None]*sz for _ in range(sz)]

def rp(rng):
    nm = rng.choice(STD)
    return {'t': nm, 'c': ROTS[nm][rng.randint(0,3)], 'v': 1}

def cp(g, c, ox, oy):
    sz = len(g)
    for cx, cy in c:
        x, y = ox+cx, oy+cy
        if x<0 or x>=sz or y<0 or y>=sz or g[y][x] is not None:
            return False
    return True

def ml(line):
    ts = [t for t in line if t]
    out, sc, i = [], 0, 0
    while i < len(ts):
        if i+1 < len(ts) and ts[i]['v'] == ts[i+1]['v']:
            out.append({'v': ts[i]['v']*2, 'id': ts[i]['id']})
            sc += ts[i]['v']*2; i += 2
        else:
            out.append(ts[i]); i += 1
    while len(out) < len(line): out.append(None)
    return out, sc

def slide(g, d):
    sz = len(g); ng = [r[:] for r in g]; sc = 0
    if d in ('L','R'):
        for y in range(sz):
            line = ng[y]
            if d == 'R': line = list(reversed(line))
            mg, s = ml(line); sc += s
            if d == 'R': mg = list(reversed(mg))
            ng[y] = mg
    else:
        for x in range(sz):
            line = [ng[y][x] for y in range(sz)]
            if d == 'D': line = list(reversed(line))
            mg, s = ml(line); sc += s
            if d == 'D': mg = list(reversed(mg))
            for y in range(sz): ng[y][x] = mg[y]
    return ng, sc

def movable(g):
    sz = len(g)
    for y in range(sz):
        for x in range(sz):
            if not g[y][x]: return True
            if x+1<sz and g[y][x+1] and g[y][x]['v']==g[y][x+1]['v']: return True
            if y+1<sz and g[y+1][x] and g[y][x]['v']==g[y+1][x]['v']: return True
    return False

def placeable(g, slots):
    sz = len(g)
    for p in slots:
        if not p: continue
        for rc in ROTS[p['t']]:
            for y in range(sz):
                for x in range(sz):
                    if cp(g, rc, x, y):
                        return True
    return False

def gameover(g, s):
    return not placeable(g, s)

def placement(g, slots, rng):
    sz = len(g)
    best = None; bsc = -999
    for idx, p in enumerate(slots):
        if not p: continue
        for rc in ROTS[p['t']]:
            for y in range(sz):
                for x in range(sz):
                    if not cp(g, rc, x, y): continue
                    sc = 0
                    for cx, cy in rc:
                        nx, ny = x+cx, y+cy
                        for dx, dy in [(1,0),(0,1),(-1,0),(0,-1)]:
                            ax, ay = nx+dx, ny+dy
                            if 0<=ax<sz and 0<=ay<sz:
                                n = g[ay][ax]
                                if n and n['v']==1: sc += 3
                                elif n: sc += 1
                                else: sc += 0.5
                    if sc > bsc:
                        bsc = sc
                        best = (idx, rc, x, y)
    if best is None:
        for idx, p in enumerate(slots):
            if not p: continue
            for rc in ROTS[p['t']]:
                for y in range(sz):
                    for x in range(sz):
                        if cp(g, rc, x, y):
                            return idx, rc, x, y
    return best

def play(g, slots, rng):
    t, sc = 0, 0
    while not gameover(g, slots):
        t += 1
        if t > MAX_T: break
        act = placement(g, slots, rng)
        if act is None: break
        idx, cells, ox, oy = act
        for cx, cy in cells:
            x, y = ox+cx, oy+cy
            g[y][x] = {'v': slots[idx]['v'], 'id': f'{x},{y}'}
        slots.pop(idx)
        slots.append(rp(rng))
        if movable(g):
            d = rng.choice(['L','R','U','D'])
            g, s = slide(g, d); sc += s
    return t, sc

def total_tiles(g):
    return sum(1 for row in g for t in row if t)

def strat_destroy(g, n):
    sz = len(g); tiles = []
    for y in range(sz):
        for x in range(sz):
            if g[y][x]:
                val = g[y][x]['v']
                mp = sum(1 for dx,dy in [(1,0),(0,1),(-1,0),(0,-1)]
                    if 0<=x+dx<sz and 0<=y+dy<sz and g[y+dy][x+dx]
                    and g[y+dy][x+dx]['v']==val)
                tiles.append((val*0.03 - mp*0.5, x, y))
    tiles.sort(reverse=True)
    for _, x, y in tiles[:min(n,len(tiles))]:
        g[y][x] = None

def rand_destroy(g, n, rng):
    sz = len(g)
    ps = [(x,y) for y in range(sz) for x in range(sz) if g[y][x]]
    if len(ps) <= n:
        for x,y in ps: g[y][x] = None
    else:
        for x,y in rng.sample(ps, n):
            g[y][x] = None

def simulate(size, strategy, rng):
    destroy = DESTROY[size]
    g = empty(size)
    slots = [rp(rng) for _ in range(3)]
    pt, _ = play(g, slots, rng)
    fill = total_tiles(g)/(size*size)*100
    rg = copy.deepcopy(g)
    if strategy == 'strategic':
        strat_destroy(rg, destroy)
    else:
        rand_destroy(rg, destroy, rng)
    rslots = [s for s in slots if s]
    while len(rslots) < 3: rslots.append(rp(rng))
    imm = placeable(rg, rslots)
    pot, psc = 0, 0
    if imm:
        pot, psc = play(rg, rslots, rng)
    return {
        'pre_turns': pt, 'fill': fill,
        'immediate': imm, 'post_turns': pot,
        'post_score': psc, 'significant': pot >= 5,
    }

def main():
    random.seed(42)
    t0 = time.time()
    results = {}
    for size in [4,5,7,8,10]:
        destroy = DESTROY[size]
        print(f"\n{'='*60}")
        print(f"  Board: {size}x{size} | Destroy: {destroy}/{size*size} ({destroy/(size*size)*100:.0f}%)")
        print(f"{'='*60}")
        for strat in ['strategic','random']:
            rng = random.Random(int(f"{size}042") + (1 if strat=='random' else 0))
            runs = [simulate(size, strat, rng) for _ in range(N)]
            total = len(runs)
            succ = sum(1 for r in runs if r['immediate'])
            sig = sum(1 for r in runs if r['significant'])
            pts = [r['post_turns'] for r in runs if r['immediate']]
            if pts:
                avg = sum(pts)/len(pts)
                srt = sorted(pts)
                med = srt[len(srt)//2]
                mxt = max(pts)
                mnt = min(pts)
                buckets = Counter()
                for t in pts:
                    if t<=3: buckets['1-3']+=1
                    elif t<=10: buckets['4-10']+=1
                    elif t<=25: buckets['11-25']+=1
                    elif t<=50: buckets['26-50']+=1
                    else: buckets['50+']+=1
            else:
                avg = med = mxt = mnt = 0; buckets = Counter()
            avg_sc = sum(r['post_score'] for r in runs if r['immediate'])
            if succ: avg_sc /= succ
            lbl = 'STRATEGIC' if strat=='strategic' else 'RANDOM'
            print(f"  [{lbl}] Success: {succ}/{total} ({succ/total*100:.1f}%)")
            print(f"        Meaningful(5+): {sig}/{total} ({sig/total*100:.1f}%)")
            print(f"        Avg turns: {avg:.1f} | Median: {med} | Range: {mnt}~{mxt}")
            print(f"        Avg score: {avg_sc:.0f}")
            if buckets:
                print(f"        Dist:", "  ".join(f"{k}:{v}" for k,v in buckets.items()))
            results[(size,strat)] = {
                'succ': succ/total*100, 'sig': sig/total*100,
                'avg': avg, 'med': med, 'max': mxt, 'score': avg_sc,
            }
    print(f"\n\n{'='*80}")
    print("SUMMARY TABLE")
    print(f"{'Board':>8} | {'Strat':>10} | {'Ok%':>6} | {'5+%':>5} | {'AvgT':>6} | {'Med':>5} | {'Max':>5} | {'Score':>6}")
    print(f"{'-'*8}-+-{'-'*10}-+-{'-'*6}-+-{'-'*5}-+-{'-'*6}-+-{'-'*5}-+-{'-'*5}-+-{'-'*6}")
    for size in [4,5,7,8,10]:
        for strat in ['strategic','random']:
            r = results[(size,strat)]
            print(f"{size}x{size}   | {strat:>10} | {r['succ']:5.1f}% | {r['sig']:4.1f}% | {r['avg']:5.1f} | {r['med']:>4}  | {r['max']:>4}  | {r['score']:>5.0f}")
    print(f"\nRan {N*10} sims in {time.time()-t0:.1f}s")
if __name__=='__main__':
    main()