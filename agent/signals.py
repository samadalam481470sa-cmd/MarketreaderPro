"""Batch public market signal calculation, accelerated via optional PyTorch GPU."""
import math

def choose_backend(mode="auto"):
    if mode == "cpu":
        return "cpu", None
    try:
        import torch
    except ImportError:
        if mode != "auto": raise RuntimeError("PyTorch must be installed for requested GPU backend")
        return "cpu", None
    cuda = bool(torch.cuda.is_available())
    mps = bool(getattr(torch.backends, "mps", None) and torch.backends.mps.is_available())
    if mode == "cuda":
        if not cuda: raise RuntimeError("CUDA GPU unavailable")
        return "cuda", torch
    if mode == "mps":
        if not mps: raise RuntimeError("Apple Metal GPU unavailable")
        return "mps", torch
    if cuda: return "cuda", torch
    if mps: return "mps", torch
    return "cpu", torch

def _cpu_metrics(values):
    latest = values[-1]
    first = values[0]
    momentum = latest - first if len(values) > 1 else 0.0
    changes = [b-a for a,b in zip(values, values[1:])]
    vol = math.sqrt(sum(x*x for x in changes)/len(changes)) if changes else 0.0
    return latest, momentum, vol

def _scores(rows, metrics, backend):
    results = []
    for (source, mid, title, values), (last,momentum,vol) in zip(rows,metrics):
        # Score is a descriptive, dimensionless indicator, NOT a forecast or recommendation.
        score = abs(momentum)/(vol+0.01) if len(values)>1 else 0.0
        results.append(dict(source=source,market_id=mid,title=title,
                            observations=len(values),latest_probability=round(float(last),6),
                            momentum=round(float(momentum),6),volatility=round(float(vol),6),
                            score=round(min(float(score),1000),6),backend=backend))
    return results

def compute_signals(rows, mode="auto"):
    if not rows: return [], "none"
    backend, torch = choose_backend(mode)
    if backend == "cpu":
        return _scores(rows,[_cpu_metrics(row[3]) for row in rows],backend),backend
    # Pad sequences; vectorize calculations across markets on the GPU.
    import torch as t
    device=t.device(backend)
    with t.no_grad():
        lengths=t.tensor([len(row[3]) for row in rows],device=device,dtype=t.long)
        width=max(len(row[3]) for row in rows)
        seq=t.zeros((len(rows),width),device=device,dtype=t.float64 if backend=="cuda" else t.float32)
        for i,row in enumerate(rows):
            seq[i,:len(row[3])]=t.tensor(row[3],device=device,dtype=seq.dtype)
        first=seq[:,0]
        last=seq.gather(1,(lengths-1).unsqueeze(1)).squeeze(1)
        diffs=seq[:,1:]-seq[:,:-1]
        mask=t.arange(width-1,device=device).unsqueeze(0)<(lengths-1).unsqueeze(1)
        vol=t.sqrt(((diffs*mask)**2).sum(dim=1)/t.clamp(lengths-1,min=1))
        values=t.stack((last,last-first,vol),dim=1).cpu().tolist()
    return _scores(rows,values,backend),backend
